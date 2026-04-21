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
    const dbService = c.get('dbService');
    const config = dbService.getBaseConfig();
    const body = await c.req.json();
    const feishuService = new FeishuService(dbService);
    const parsedEvent = feishuService.parseWebhookEvent(body);

    if (parsedEvent.challenge) {
      return c.json({ challenge: parsedEvent.challenge });
    }

    if (!config?.feishu_enabled || config.feishu_enabled !== 1) {
      return c.json({ code: 0 });
    }

    const requestToken = c.req.header('x-lark-request-token') || parsedEvent.token;
    if (!feishuService.validateWebhookToken(requestToken)) {
      return c.json(createErrorResponse('飞书请求校验失败'), 403);
    }

    if (parsedEvent.eventType && parsedEvent.eventType !== 'im.message.receive_v1') {
      return c.json({ code: 0 });
    }

    if (!parsedEvent.chatId || !parsedEvent.senderId || !parsedEvent.text) {
      return c.json({ code: 0 });
    }

    const replyText = await feishuService.handleTextCommand(
      parsedEvent.chatId,
      parsedEvent.senderId,
      parsedEvent.senderName || parsedEvent.senderId,
      parsedEvent.text,
    );

    if (parsedEvent.chatId) {
      await feishuService.sendMessage(parsedEvent.chatId, replyText);
    }

    return c.json({ code: 0 });
  } catch (error) {
    logger.error('处理飞书 webhook 失败:', error);
    return c.json(createErrorResponse(`处理飞书 webhook 失败: ${error}`), 500);
  }
});
