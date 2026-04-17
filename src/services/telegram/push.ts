import { TelegramBaseService } from './base';
import type { Post, KeywordSub } from '../../types';
import { logger } from '../../utils/logger';
import { buildNotificationMessage } from '../notification/message';

export class TelegramPushService extends TelegramBaseService {
  private updateHealthStatus(data: {
    lastTestStatus?: string;
    lastTestAt?: string;
    lastSendAt?: string;
    lastError?: string;
  }) {
    this.dbService.updateBaseConfig({
      telegram_last_test_status: data.lastTestStatus,
      telegram_last_test_at: data.lastTestAt,
      telegram_last_send_at: data.lastSendAt,
      telegram_last_error: data.lastError,
    });
  }

  /**
   * 发送消息到 Telegram
   */
  async sendMessage(chatId: string | number, text: string): Promise<boolean> {
    try {
      await this.bot.api.sendMessage(chatId, text, { parse_mode: 'Markdown' });
      this.updateHealthStatus({
        lastSendAt: new Date().toISOString(),
        lastError: '',
      });
      return true;
    } catch (error) {
      logger.error('发送 Telegram 消息时出错:', error);
      this.updateHealthStatus({
        lastError: `发送 Telegram 消息时出错: ${error}`,
      });
      return false;
    }
  }

  /**
   * 推送文章到 Telegram
   */
  async pushPost(post: Post, matchedSub: KeywordSub): Promise<boolean> {
    try {
      const config = this.dbService.getBaseConfig();
      if (!config || config.stop_push === 1) {
        return false;
      }

      const message = buildNotificationMessage(post, matchedSub);
      const success = await this.sendMessage(config.chat_id, message.markdown);

      if (success) {
        return true;
      }

      return false;
    } catch (error) {
      logger.error('推送文章失败:', error);
      return false;
    }
  }

  /**
   * 测试发送消息（简化版，仅用于测试连通性）
   */
  async testSendMessage(chatId: string | number, message?: string): Promise<boolean> {
    const testMessage = message || '🧪 这是一条测试消息，表明 Bot 推送功能正常工作。';
    const result = await this.sendMessage(chatId, testMessage);
    this.updateHealthStatus({
      lastTestStatus: result ? 'success' : 'failed',
      lastTestAt: new Date().toISOString(),
      lastError: result ? '' : 'Telegram 测试发送失败',
    });
    return result;
  }
}
