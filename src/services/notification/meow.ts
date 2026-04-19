import { DatabaseService } from '../database';
import { logger } from '../../utils/logger';
import type { KeywordSub, Post } from '../../types';
import { buildNotificationMessage } from './message';

interface MeowResponse {
    status: number;
    message?: string;
    msg?: string;
}

export class MeowService {
    constructor(private dbService: DatabaseService) {}

    private updateHealthStatus(data: {
        lastTestStatus?: string;
        lastTestAt?: string;
        lastSendAt?: string;
        lastError?: string;
    }) {
        this.dbService.updateBaseConfig({
            meow_last_test_status: data.lastTestStatus,
            meow_last_test_at: data.lastTestAt,
            meow_last_send_at: data.lastSendAt,
            meow_last_error: data.lastError,
        });
    }

    private getConfig() {
        return this.dbService.getBaseConfig();
    }

    private getEndpoint(): string {
        const config = this.getConfig();
        return (config?.meow_endpoint?.trim() || 'https://api.chuckfang.com').replace(/\/$/, '');
    }

    private buildApiUrl(nickname: string): string {
        return `${this.getEndpoint()}/${encodeURIComponent(nickname)}?msgType=text`;
    }

    isConfigured(): boolean {
        const config = this.getConfig();
        return !!config?.meow_nickname?.trim();
    }

    isEnabled(): boolean {
        const config = this.getConfig();
        return config?.meow_enabled === 1;
    }

    async sendMessage(title: string, msg: string, url?: string): Promise<{ success: boolean; message: string }> {
        const config = this.getConfig();
        const now = new Date().toISOString();

        if (!config?.meow_nickname?.trim()) {
            this.updateHealthStatus({
                lastError: 'MeoW 昵称未配置',
            });
            return { success: false, message: 'MeoW 昵称未配置' };
        }

        try {
            const response = await fetch(this.buildApiUrl(config.meow_nickname.trim()), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json;charset=utf-8',
                },
                body: JSON.stringify({
                    title,
                    msg,
                    url,
                }),
            });

            const result = await response.json() as MeowResponse;
            if (response.ok && result.status === 200) {
                this.updateHealthStatus({
                    lastSendAt: now,
                    lastError: '',
                });
                return { success: true, message: result.message || result.msg || '发送成功' };
            }

            logger.error('MeoW 发送失败:', result);
            this.updateHealthStatus({
                lastError: result.message || result.msg || 'MeoW 返回失败',
            });
            return { success: false, message: result.message || result.msg || 'MeoW 返回失败' };
        } catch (error) {
            logger.error('MeoW 发送异常:', error);
            this.updateHealthStatus({
                lastError: `MeoW 发送异常: ${error}`,
            });
            return { success: false, message: `MeoW 发送异常: ${error}` };
        }
    }

    async pushPost(post: Post, matchedSub: KeywordSub): Promise<boolean> {
        const config = this.getConfig();
        if (!config || config.meow_enabled !== 1) {
            return false;
        }

        const message = buildNotificationMessage(post, matchedSub);
        const result = await this.sendMessage(message.title, message.richText, message.postUrl);
        return result.success;
    }

    async testSend(message?: string): Promise<{ success: boolean; message: string }> {
        const now = new Date().toLocaleString('zh-CN');
        const title = 'NodeSeeker MeoW 测试消息';
        const msg = message || `📡 NodeSeeker MeoW 推送测试\n\n⏰ 时间: ${now}`;
        const result = await this.sendMessage(title, msg);
        this.updateHealthStatus({
            lastTestStatus: result.success ? 'success' : 'failed',
            lastTestAt: new Date().toISOString(),
            lastError: result.success ? '' : result.message,
        });
        return result;
    }
}
