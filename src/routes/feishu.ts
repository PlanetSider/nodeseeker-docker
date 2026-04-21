import { Hono } from 'hono';
import { z } from 'zod';
import { FeishuService } from '../services/feishu';
import { createSuccessResponse, createErrorResponse } from '../utils/helpers';
import { createValidationMiddleware } from '../utils/validation';
import type { ContextVariables } from '../types';
import { logger } from '../utils/logger';

type Variables = ContextVariables;

const feishuSetupSchema = z.object({
  feishu_enabled: z.boolean().optional(),
  feishu_app_id: z.string().min(1).optional(),
  feishu_app_secret: z.string().min(1).optional(),
  feishu_verification_token: z.string().min(1).optional(),
});

export const feishuRoutes = new Hono<{ Variables: Variables }>();

feishuRoutes.get('/status', async (c) => {
  try {
    const dbService = c.get('dbService');
    const config = dbService.getBaseConfig();
    return c.json(createSuccessResponse({
      enabled: config?.feishu_enabled === 1,
      configured: !!(config?.feishu_app_id && config?.feishu_app_secret),
      bound: !!config?.feishu_chat_id,
      config: {
        feishu_chat_id: config?.feishu_chat_id || null,
        feishu_bound_user_name: config?.feishu_bound_user_name || null,
        feishu_bound_user_id: config?.feishu_bound_user_id || null,
        feishu_last_test_status: config?.feishu_last_test_status || null,
        feishu_last_test_at: config?.feishu_last_test_at || null,
        feishu_last_send_at: config?.feishu_last_send_at || null,
        feishu_last_error: config?.feishu_last_error || null,
      },
    }));
  } catch (error) {
    return c.json(createErrorResponse(`获取飞书状态失败: ${error}`), 500);
  }
});

feishuRoutes.post('/setup', createValidationMiddleware(feishuSetupSchema), async (c) => {
  try {
    const dbService = c.get('dbService');
    const validatedData = c.get('validatedData');
    const updated = dbService.updateBaseConfig({
      feishu_enabled: validatedData.feishu_enabled === undefined ? undefined : (validatedData.feishu_enabled ? 1 : 0),
      feishu_app_id: validatedData.feishu_app_id,
      feishu_app_secret: validatedData.feishu_app_secret,
      feishu_verification_token: validatedData.feishu_verification_token,
    });

    return c.json(createSuccessResponse(updated, '飞书配置保存成功'));
  } catch (error) {
    return c.json(createErrorResponse(`保存飞书配置失败: ${error}`), 500);
  }
});

feishuRoutes.post('/test-connection', async (c) => {
  try {
    const dbService = c.get('dbService');
    const feishuService = new FeishuService(dbService);
    const result = await feishuService.testConnection();
    return result.success
      ? c.json(createSuccessResponse(null, result.message))
      : c.json(createErrorResponse(result.message), 400);
  } catch (error) {
    return c.json(createErrorResponse(`飞书连接测试失败: ${error}`), 500);
  }
});

feishuRoutes.post('/webhook', async (c) => {
  try {
    const body = await c.req.json();
    if (body.challenge) {
      return c.json({ challenge: body.challenge });
    }

    const dbService = c.get('dbService');
    const config = dbService.getBaseConfig();
    if (!config?.feishu_enabled || config.feishu_enabled !== 1) {
      return c.json({ code: 0 });
    }

    const token = c.req.header('x-lark-request-token');
    if (config.feishu_verification_token?.trim() && token && token !== config.feishu_verification_token.trim()) {
      return c.json(createErrorResponse('飞书请求校验失败'), 403);
    }

    const event = body.event || body;
    const message = event.message || event.event?.message;
    const sender = event.sender || event.event?.sender;
    if (!message || !sender) {
      return c.json({ code: 0 });
    }

    const content = typeof message.content === 'string' ? JSON.parse(message.content) : message.content;
    const text = content?.text?.trim();
    if (!text) {
      return c.json({ code: 0 });
    }

    const chatId = message.chat_id;
    const senderId = sender.sender_id?.open_id || sender.open_id || sender.sender_id?.user_id || '';
    const senderName = sender.sender_name || senderId || '飞书用户';

    const feishuService = new FeishuService(dbService);
    const replyText = await feishuService.handleTextCommand(chatId, senderId, senderName, text);

    if (chatId) {
      await feishuService.sendMessage(chatId, replyText);
    }

    return c.json({ code: 0 });
  } catch (error) {
    logger.error('处理飞书 webhook 失败:', error);
    return c.json(createErrorResponse(`处理飞书 webhook 失败: ${error}`), 500);
  }
});
