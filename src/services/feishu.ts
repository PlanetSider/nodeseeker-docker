import { DatabaseService } from './database';
import { TopicTrackerService } from './topicTracker';
import { logger } from '../utils/logger';

interface FeishuTenantAccessTokenResponse {
  code: number;
  msg?: string;
  tenant_access_token?: string;
}

interface FeishuWebhookPayload {
  challenge?: string;
  encrypt?: string;
  header?: {
    event_type?: string;
    token?: string;
  };
  event?: any;
}

export class FeishuService {
  constructor(private dbService: DatabaseService) {}

  private getConfig() {
    return this.dbService.getBaseConfig();
  }

  private updateHealthStatus(data: {
    lastTestStatus?: string;
    lastTestAt?: string;
    lastSendAt?: string;
    lastError?: string;
  }) {
    this.dbService.updateBaseConfig({
      feishu_last_test_status: data.lastTestStatus,
      feishu_last_test_at: data.lastTestAt,
      feishu_last_send_at: data.lastSendAt,
      feishu_last_error: data.lastError,
    });
  }

  isConfigured(): boolean {
    const config = this.getConfig();
    return !!(config?.feishu_app_id?.trim() && config?.feishu_app_secret?.trim());
  }

  isEnabled(): boolean {
    const config = this.getConfig();
    return config?.feishu_enabled === 1;
  }

  private async getTenantAccessToken(): Promise<string | null> {
    const config = this.getConfig();
    if (!config?.feishu_app_id?.trim() || !config.feishu_app_secret?.trim()) {
      return null;
    }

    const response = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        app_id: config.feishu_app_id.trim(),
        app_secret: config.feishu_app_secret.trim(),
      }),
    });

    const result = await response.json() as FeishuTenantAccessTokenResponse;
    if (response.ok && result.code === 0 && result.tenant_access_token) {
      return result.tenant_access_token;
    }

    logger.error('获取飞书 tenant_access_token 失败:', result);
    return null;
  }

  async sendMessage(receiveId: string, text: string): Promise<boolean> {
    try {
      const token = await this.getTenantAccessToken();
      if (!token) {
        this.updateHealthStatus({ lastError: '获取飞书访问令牌失败' });
        return false;
      }

      const response = await fetch('https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=chat_id', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          receive_id: receiveId,
          msg_type: 'text',
          content: JSON.stringify({ text }),
        }),
      });

      const result = await response.json();
      if (response.ok && result.code === 0) {
        this.updateHealthStatus({
          lastSendAt: new Date().toISOString(),
          lastError: '',
        });
        return true;
      }

      logger.error('飞书发送消息失败:', result);
      this.updateHealthStatus({ lastError: result.msg || '飞书发送消息失败' });
      return false;
    } catch (error) {
      logger.error('飞书发送消息异常:', error);
      this.updateHealthStatus({ lastError: `飞书发送消息异常: ${error}` });
      return false;
    }
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    const token = await this.getTenantAccessToken();
    const success = !!token;
    this.updateHealthStatus({
      lastTestStatus: success ? 'success' : 'failed',
      lastTestAt: new Date().toISOString(),
      lastError: success ? '' : '飞书连接测试失败',
    });
    return {
      success,
      message: success ? '飞书连接测试成功' : '飞书连接测试失败',
    };
  }

  private parseCommandText(content: unknown): string {
    if (!content) {
      return '';
    }

    if (typeof content === 'string') {
      try {
        const parsed = JSON.parse(content);
        return this.parseCommandText(parsed);
      } catch {
        return content.trim();
      }
    }

    if (typeof content === 'object') {
      const record = content as Record<string, unknown>;
      if (typeof record.text === 'string') {
        return record.text.trim();
      }
    }

    return '';
  }

  validateWebhookToken(token?: string): boolean {
    const config = this.getConfig();
    if (!config?.feishu_verification_token?.trim()) {
      return true;
    }

    return token === config.feishu_verification_token.trim();
  }

  private normalizeCommand(text: string): string {
    return text.trim().replace(/^\//, '');
  }

  private checkUserPermission(chatId: string): boolean {
    const config = this.getConfig();
    return !!(config?.feishu_chat_id && config.feishu_chat_id === chatId);
  }

  private async handleStart(chatId: string, senderId: string, senderName: string): Promise<string> {
    const config = this.getConfig();
    if (!config) {
      return '系统尚未初始化，请先在网页端完成初始化设置。';
    }

    if (config.feishu_chat_id && config.feishu_chat_id.trim() !== '') {
      if (config.feishu_chat_id === chatId) {
        return `欢迎回来，${senderName}。当前飞书命令通道已绑定。`;
      }
      return '此系统已绑定到其他飞书会话。如需更换绑定，请联系管理员解除当前绑定。';
    }

    this.dbService.updateBaseConfig({
      feishu_enabled: 1,
      feishu_chat_id: chatId,
      feishu_bound_user_id: senderId,
      feishu_bound_user_name: senderName,
    });

    return `已绑定飞书会话。\n会话ID: ${chatId}\n现在可以使用 /track、/untrack、/tracks 命令。`;
  }

  private async handleTrack(commandText: string): Promise<string> {
    const args = commandText.split(/\s+/).slice(1);
    if (args.length === 0) {
      return '请提供帖子 ID 或链接。用法: /track 694190';
    }

    const tracker = new TopicTrackerService(this.dbService);
    const result = await tracker.trackTopic(args[0]);
    return result.message;
  }

  private handleUntrack(commandText: string): string {
    const args = commandText.split(/\s+/).slice(1);
    if (args.length === 0) {
      return '请提供帖子 ID 或链接。用法: /untrack 694190';
    }

    const tracker = new TopicTrackerService(this.dbService);
    return tracker.untrackTopic(args[0]).message;
  }

  private handleTracks(): string {
    const tracker = new TopicTrackerService(this.dbService);
    const topics = tracker.listTrackedTopics();
    if (topics.length === 0) {
      return '当前没有正在追踪的帖子。使用 /track 694190 开始追踪。';
    }

    return `当前追踪列表\n\n${topics.slice(0, 20).map((topic, index) => {
      const checkedAt = topic.last_checked_at ? new Date(topic.last_checked_at).toLocaleString('zh-CN') : '未检查';
      return `${index + 1}. ID:${topic.post_id}\n${topic.title}\n回复数: ${topic.last_seen_reply_count || 0} | 最近检查: ${checkedAt}`;
    }).join('\n\n')}`;
  }

  async handleTextCommand(chatId: string, senderId: string, senderName: string, text: string): Promise<string> {
    const normalized = this.normalizeCommand(text);
    const command = normalized.split(/\s+/)[0]?.toLowerCase();

    if (!command) {
      return '请输入命令。发送 /help 查看可用命令。';
    }

    if (command === 'start') {
      return this.handleStart(chatId, senderId, senderName);
    }

    if (command === 'help') {
      return [
        'NodeSeeker 飞书命令',
        '',
        '/start - 绑定当前飞书会话',
        '/track 帖子ID或链接 - 开始追踪帖子后续回复',
        '/untrack 帖子ID或链接 - 停止追踪',
        '/tracks - 查看当前追踪列表',
      ].join('\n');
    }

    if (!this.checkUserPermission(chatId)) {
      return '您没有权限使用此功能。请先发送 /start 进行绑定。';
    }

    if (command === 'track') {
      return this.handleTrack(normalized);
    }

    if (command === 'untrack') {
      return this.handleUntrack(normalized);
    }

    if (command === 'tracks') {
      return this.handleTracks();
    }

    return '暂不支持该命令。当前支持: /start /help /track /untrack /tracks';
  }

  parseWebhookEvent(payload: FeishuWebhookPayload): {
    challenge?: string;
    eventType?: string;
    token?: string;
    chatId?: string;
    senderId?: string;
    senderName?: string;
    text?: string;
  } {
    if (payload.challenge) {
      return { challenge: payload.challenge };
    }

    const event = payload.event || {};
    const message = event.message || event.im?.message || event.event?.message || {};
    const sender = event.sender || event.operator || event.event?.sender || {};
    const senderId =
      sender.sender_id?.open_id ||
      sender.sender_id?.user_id ||
      sender.open_id ||
      sender.user_id ||
      '';
    const senderName =
      sender.sender_name ||
      sender.name ||
      sender.user_name ||
      senderId ||
      '飞书用户';
    const chatId =
      message.chat_id ||
      message.open_chat_id ||
      event.open_chat_id ||
      event.chat_id ||
      '';
    const text = this.parseCommandText(message.content || event.content || event.text || '');

    return {
      eventType: payload.header?.event_type,
      token: payload.header?.token,
      chatId,
      senderId,
      senderName,
      text,
    };
  }
}
