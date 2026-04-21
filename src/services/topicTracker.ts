import { createHash } from 'crypto';
import { parseHTML } from 'linkedom';
import { DatabaseService } from './database';
import { RSSBrowserService } from './rssBrowser';
import { TelegramPushService } from './telegram/push';
import { ServerChanService } from './notification/serverchan';
import { MeowService } from './notification/meow';
import { logger } from '../utils/logger';
import type { TopicReply, TrackedTopic } from '../types';

interface ParsedReply {
  replyKey: string;
  author: string;
  content: string;
  replyTime?: string;
  floorNo?: number;
  sourceUrl: string;
}

export class TopicTrackerService {
  private readonly rssBrowserService: RSSBrowserService;

  constructor(private dbService: DatabaseService) {
    this.rssBrowserService = new RSSBrowserService();
  }

  private getProxy(): string | undefined {
    const config = this.dbService.getBaseConfig();
    return config?.rss_proxy || undefined;
  }

  private getCookie(): string | undefined {
    const config = this.dbService.getBaseConfig();
    return config?.rss_cookie || undefined;
  }

  private normalizeText(text: string): string {
    return text
      .replace(/\r/g, '')
      .replace(/\u00a0/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();
  }

  private getTopicUrl(postIdOrUrl: string | number): string {
    if (typeof postIdOrUrl === 'number') {
      return `https://www.nodeseek.com/post-${postIdOrUrl}-1`;
    }

    if (/^https?:\/\//i.test(postIdOrUrl)) {
      return postIdOrUrl;
    }

    return `https://www.nodeseek.com/post-${postIdOrUrl}-1`;
  }

  extractPostId(postIdOrUrl: string): number | null {
    const trimmed = postIdOrUrl.trim();
    if (/^\d+$/.test(trimmed)) {
      return parseInt(trimmed, 10);
    }

    const match = trimmed.match(/post-(\d+)-/);
    if (match?.[1]) {
      return parseInt(match[1], 10);
    }

    try {
      const url = new URL(trimmed);
      const id = url.searchParams.get('id');
      return id ? parseInt(id, 10) : null;
    } catch {
      return null;
    }
  }

  private async fetchTopicHtml(topicUrl: string): Promise<string> {
    const proxy = this.getProxy();
    const cookie = this.getCookie();
    const headers: Record<string, string> = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36 Edg/139.0.0.0',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    };

    if (cookie?.trim()) {
      headers.Cookie = cookie.trim();
    }

    const fetchOptions: RequestInit & { proxy?: string } = { headers };
    if (proxy) {
      fetchOptions.proxy = proxy;
    }

    try {
      const response = await fetch(topicUrl, fetchOptions);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.text();
    } catch (error) {
      logger.warn(`帖子普通抓取失败，尝试 Playwright: ${topicUrl}`);
      return this.rssBrowserService.fetchPageContent(topicUrl, cookie);
    }
  }

  private buildReplyKey(seed: string): string {
    return createHash('sha1').update(seed).digest('hex');
  }

  private parseReplies(html: string, topicUrl: string): { title: string; replies: ParsedReply[] } {
    const { document } = parseHTML(html);
    const title = this.normalizeText(document.querySelector('title')?.textContent || '未命名帖子');

    const replyContainers = Array.from(document.querySelectorAll('article, .topic-post, .topic-body, .cooked'));
    const replies: ParsedReply[] = [];
    const seenKeys = new Set<string>();

    for (const [index, element] of replyContainers.entries()) {
      const contentElement = element.querySelector('.cooked, .topic-body, .regular.contents, .contents') || element;
      const content = this.normalizeText(contentElement.textContent || '');
      if (content.length < 20) {
        continue;
      }

      const author = this.normalizeText(
        element.querySelector('.creator, .names .username, .topic-meta-data .username, .username')?.textContent || '',
      );
      const replyTime =
        element.querySelector('time')?.getAttribute('datetime') ||
        this.normalizeText(element.querySelector('time')?.textContent || '') ||
        undefined;
      const floorText = this.normalizeText(
        element.querySelector('.post-number, .topic-post-badges .badge-post-number, .crawler-post-floor')?.textContent || '',
      );
      const floorNo = floorText ? parseInt(floorText.replace(/[^\d]/g, ''), 10) || undefined : undefined;
      const rawKey =
        element.getAttribute('data-post-id') ||
        element.getAttribute('id') ||
        `${author}|${replyTime || ''}|${content.slice(0, 120)}|${index}`;
      const replyKey = this.buildReplyKey(rawKey);

      if (seenKeys.has(replyKey)) {
        continue;
      }
      seenKeys.add(replyKey);

      replies.push({
        replyKey,
        author: author || '未知用户',
        content,
        replyTime,
        floorNo,
        sourceUrl: topicUrl,
      });
    }

    return {
      title,
      replies: replies.slice(1),
    };
  }

  async trackTopic(postIdOrUrl: string): Promise<{ success: boolean; message: string }> {
    const postId = this.extractPostId(postIdOrUrl);
    if (!postId) {
      return { success: false, message: '无法识别帖子 ID 或链接' };
    }

    const topicUrl = this.getTopicUrl(postId);
    try {
      const html = await this.fetchTopicHtml(topicUrl);
      const { title, replies } = this.parseReplies(html, topicUrl);
      const existing = this.dbService.getTrackedTopicByPostId(postId);
      const trackedTopic = this.dbService.createTrackedTopic({
        post_id: postId,
        topic_url: topicUrl,
        title,
        enabled: 1,
        last_checked_at: new Date().toISOString(),
        last_seen_reply_count: replies.length,
        last_seen_reply_key: replies.at(-1)?.replyKey,
      });

      for (const reply of replies) {
        this.dbService.createTopicReply({
          tracked_topic_id: trackedTopic.id!,
          reply_key: reply.replyKey,
          reply_author: reply.author,
          reply_content: reply.content,
          reply_time: reply.replyTime,
          floor_no: reply.floorNo,
          source_url: reply.sourceUrl,
          notified: 1,
        });
      }

      return {
        success: true,
        message: existing
          ? `已恢复追踪《${title}》\n帖子 ID: ${postId}\n当前已记录回复数: ${replies.length}`
          : `已开始追踪《${title}》\n帖子 ID: ${postId}\n当前已记录回复数: ${replies.length}`,
      };
    } catch (error) {
      logger.error(`追踪帖子初始化失败 (post_id: ${postId})`, error);
      return { success: false, message: `追踪失败: ${error}` };
    }
  }

  untrackTopic(postIdOrUrl: string): { success: boolean; message: string } {
    const postId = this.extractPostId(postIdOrUrl);
    if (!postId) {
      return { success: false, message: '无法识别帖子 ID 或链接' };
    }

    const success = this.dbService.disableTrackedTopicByPostId(postId);
    return success
      ? { success: true, message: `已停止追踪帖子 ${postId}` }
      : { success: false, message: `帖子 ${postId} 当前未在追踪列表中` };
  }

  listTrackedTopics(): TrackedTopic[] {
    return this.dbService.getTrackedTopics(true);
  }

  private buildTrackedReplyMessage(topic: TrackedTopic, reply: TopicReply): { title: string; markdown: string; richText: string; url: string } {
    const title = `跟帖更新：${topic.title}`;
    const preview = this.normalizeText(reply.reply_content || '').slice(0, 500);
    const floor = reply.floor_no ? `#${reply.floor_no}` : '新回复';
    const url = topic.topic_url;
    const markdown = `**你追踪的帖子有新回复**\n\n**${topic.title}**\n\n楼层: ${floor}\n作者: ${reply.reply_author || '未知用户'}\n\n${preview}\n\n${url}`;
    const richText = [`你追踪的帖子有新回复`, topic.title, `楼层: ${floor}`, `作者: ${reply.reply_author || '未知用户'}`, preview, url]
      .filter(Boolean)
      .join('\n\n');

    return { title, markdown, richText, url };
  }

  private async notifyReply(topic: TrackedTopic, reply: TopicReply): Promise<boolean> {
    const config = this.dbService.getBaseConfig();
    if (!config) {
      return false;
    }

    const message = this.buildTrackedReplyMessage(topic, reply);
    let sent = false;

    if (config.bot_token && config.chat_id && config.stop_push !== 1) {
      try {
        const telegramService = new TelegramPushService(this.dbService, config.bot_token);
        sent = await telegramService.sendMessage(config.chat_id, message.markdown) || sent;
      } catch (error) {
        logger.error(`追踪回复 Telegram 推送失败: ${topic.title}`, error);
      }
    }

    const serverChanService = new ServerChanService(this.dbService);
    if (serverChanService.isEnabled() && serverChanService.isConfigured()) {
      try {
        const result = await serverChanService.sendMessage(message.title, message.richText);
        sent = result.success || sent;
      } catch (error) {
        logger.error(`追踪回复 Server酱 推送失败: ${topic.title}`, error);
      }
    }

    const meowService = new MeowService(this.dbService);
    if (meowService.isEnabled() && meowService.isConfigured()) {
      try {
        const result = await meowService.sendMessage(message.title, message.richText, message.url);
        sent = result.success || sent;
      } catch (error) {
        logger.error(`追踪回复 MeoW 推送失败: ${topic.title}`, error);
      }
    }

    return sent;
  }

  async checkTrackedTopics(): Promise<{ checked: number; newReplies: number; notified: number }> {
    const trackedTopics = this.dbService.getTrackedTopics(true);
    let newReplies = 0;
    let notified = 0;

    for (const topic of trackedTopics) {
      try {
        const html = await this.fetchTopicHtml(topic.topic_url);
        const { title, replies } = this.parseReplies(html, topic.topic_url);
        const existingReplies = this.dbService.getTopicRepliesByTopicId(topic.id!);
        const existingKeys = new Set(existingReplies.map((reply) => reply.reply_key));
        const freshReplies = replies.filter((reply) => !existingKeys.has(reply.replyKey));

        if (freshReplies.length === 0) {
          this.dbService.updateTrackedTopic(topic.id!, {
            title,
            last_checked_at: new Date().toISOString(),
            last_seen_reply_count: replies.length,
            last_seen_reply_key: replies.at(-1)?.replyKey,
          });
          continue;
        }

        const insertedReplyIds: number[] = [];
        for (const reply of freshReplies) {
          const created = this.dbService.createTopicReply({
            tracked_topic_id: topic.id!,
            reply_key: reply.replyKey,
            reply_author: reply.author,
            reply_content: reply.content,
            reply_time: reply.replyTime,
            floor_no: reply.floorNo,
            source_url: reply.sourceUrl,
            notified: 0,
          });

          if (created?.id) {
            insertedReplyIds.push(created.id);
            newReplies++;
            const sent = await this.notifyReply(topic, created);
            if (sent) {
              notified++;
              this.dbService.markTopicRepliesNotified([created.id]);
            }
          }
        }

        this.dbService.updateTrackedTopic(topic.id!, {
          title,
          last_checked_at: new Date().toISOString(),
          last_seen_reply_count: replies.length,
          last_seen_reply_key: replies.at(-1)?.replyKey,
        });
      } catch (error) {
        logger.error(`检查追踪帖子失败: ${topic.title}`, error);
      }
    }

    return {
      checked: trackedTopics.length,
      newReplies,
      notified,
    };
  }
}
