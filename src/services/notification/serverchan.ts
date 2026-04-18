import { DatabaseService } from '../database';
import { logger } from '../../utils/logger';
import type { KeywordSub, Post } from '../../types';
import { buildNotificationMessage } from './message';

interface ServerChanResponse {
    code: number;
    message: string;
    data?: unknown;
}

export class ServerChanService {
    constructor(private dbService: DatabaseService) {}

    private updateHealthStatus(data: {
        lastTestStatus?: string;
        lastTestAt?: string;
        lastSendAt?: string;
        lastError?: string;
    }) {
        this.dbService.updateBaseConfig({
            serverchan_last_test_status: data.lastTestStatus,
            serverchan_last_test_at: data.lastTestAt,
            serverchan_last_send_at: data.lastSendAt,
            serverchan_last_error: data.lastError,
        });
    }

    private getConfig() {
        return this.dbService.getBaseConfig();
    }

    private buildApiUrl(uid: string, sendkey: string): string {
        return `https://${uid}.push.ft07.com/send/${sendkey}.send`;
    }

    isConfigured(): boolean {
        const config = this.getConfig();
        return !!(config?.serverchan_uid?.trim() && config?.serverchan_sendkey?.trim());
    }

    isEnabled(): boolean {
        const config = this.getConfig();
        return config?.serverchan_enabled === 1;
    }

    async sendMessage(title: string, desp: string): Promise<{ success: boolean; message: string }> {
        const config = this.getConfig();
        const now = new Date().toISOString();

        if (!config?.serverchan_uid?.trim() || !config.serverchan_sendkey?.trim()) {
            this.updateHealthStatus({
                lastError: 'Server酱 UID 或 SendKey 未配置',
            });
            return { success: false, message: 'Server酱 UID 或 SendKey 未配置' };
        }

        try {
            const response = await fetch(this.buildApiUrl(config.serverchan_uid.trim(), config.serverchan_sendkey.trim()), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json;charset=utf-8',
                },
                body: JSON.stringify({
                    title,
                    desp,
                    tags: 'NodeSeek',
                }),
            });

            const result = await response.json() as ServerChanResponse;
            if (response.ok && result.code === 0) {
                this.updateHealthStatus({
                    lastSendAt: now,
                    lastError: '',
                });
                return { success: true, message: result.message || '发送成功' };
            }

            logger.error('Server酱发送失败:', result);
            this.updateHealthStatus({
                lastError: result.message || 'Server酱返回失败',
            });
            return { success: false, message: result.message || 'Server酱返回失败' };
        } catch (error) {
            logger.error('Server酱发送异常:', error);
            this.updateHealthStatus({
                lastError: `Server酱发送异常: ${error}`,
            });
            return { success: false, message: `Server酱发送异常: ${error}` };
        }
    }

    async pushPost(post: Post, matchedSub: KeywordSub): Promise<boolean> {
        const config = this.getConfig();
        if (!config || config.serverchan_enabled !== 1) {
            return false;
        }

        const message = buildNotificationMessage(post, matchedSub);
        const result = await this.sendMessage(message.title, message.markdown);
        return result.success;
    }

    async testSend(message?: string): Promise<{ success: boolean; message: string }> {
        const now = new Date().toLocaleString('zh-CN');
        const title = 'NodeSeeker Server酱 测试消息';
        const desp = message || `🧪 **测试消息**\n\n⏰ **时间:** ${now}`;
        const result = await this.sendMessage(title, desp);
        this.updateHealthStatus({
            lastTestStatus: result.success ? 'success' : 'failed',
            lastTestAt: new Date().toISOString(),
            lastError: result.success ? '' : result.message,
        });
        return result;
    }
}
