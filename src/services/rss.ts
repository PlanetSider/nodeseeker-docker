import { DatabaseService } from "./database";
import { getEnvConfig } from "../config/env";
import { logger } from "../utils/logger";
import { parseHTML } from "linkedom";
import type { Post, RSSItem, ParsedPost, RSSProcessResult } from "../types";
import { RSSBrowserService } from "./rssBrowser";
import { TelegramPushService } from "./telegram/push";
import { ServerChanService } from "./notification/serverchan";
import { MeowService } from "./notification/meow";
import { AISummaryService } from './aiSummary';

export class RSSService {
  private readonly TIMEOUT: number;
  private readonly ARTICLE_BODY_ENRICHMENT_ENABLED: boolean;
  private readonly AI_SUMMARY_ENABLED: boolean;
  private readonly PLAYWRIGHT_FALLBACK: boolean;
  private readonly MAX_ARTICLE_BROWSER_FALLBACKS: number;
  private readonly rssBrowserService: RSSBrowserService;
  private readonly aiSummaryService: AISummaryService;

  constructor(private dbService: DatabaseService) {
    const config = getEnvConfig();
    this.TIMEOUT = config.RSS_TIMEOUT;
    this.ARTICLE_BODY_ENRICHMENT_ENABLED = config.RSS_ARTICLE_BODY_ENRICHMENT_ENABLED;
    this.AI_SUMMARY_ENABLED = config.AI_SUMMARY_ENABLED;
    this.PLAYWRIGHT_FALLBACK = config.RSS_PLAYWRIGHT_FALLBACK;
    this.MAX_ARTICLE_BROWSER_FALLBACKS = Math.max(0, config.RSS_ARTICLE_BROWSER_FALLBACK_LIMIT);
    this.rssBrowserService = new RSSBrowserService();
    this.aiSummaryService = new AISummaryService();
  }

  private shouldUseArticleBrowserFallback(usedFallbackCount: number): boolean {
    if (!this.PLAYWRIGHT_FALLBACK) {
      return false;
    }

    return usedFallbackCount < this.MAX_ARTICLE_BROWSER_FALLBACKS;
  }

  private decodeHtmlEntities(text: string): string {
    return text
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }

  private normalizeText(text: string): string {
    return this.decodeHtmlEntities(text)
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\r/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();
  }

  private removeHiddenNodes(root: ParentNode): void {
    const hiddenSelectors = [
      'script',
      'style',
      'noscript',
      'template',
      'svg',
      'canvas',
      'iframe',
      '[aria-hidden="true"]',
      '[hidden]',
      '.sr-only',
      '.visually-hidden',
      '.crawler-link',
      '.topic-map',
      '.topic-footer-main-buttons',
      '.topic-navigation',
      '.sidebar-wrapper',
      '.navigation-container',
      '.nav-pills',
      '.nav-stacked',
      '.header-sidebar-toggle',
      '.d-header',
      '.d-header-icons',
      '.header-cloak',
      '.contents .topic-avatar',
      '.post-menu-area',
      '.post-actions',
      '.embedded-posts',
      '.private-message-glyph',
      '.ad-container',
      '.category-list',
      '.footer-message',
      '.footer-nav',
      '.below-topic-list-area',
      '.discourse-tags',
      '.list-controls',
      '.user-directory-link',
      '.topic-list-footer',
      'header',
      'footer',
      'nav',
      'aside',
    ];

    for (const selector of hiddenSelectors) {
      for (const element of Array.from(root.querySelectorAll(selector))) {
        element.remove();
      }
    }
  }

  private getNodeTextScore(element: Element): number {
    const text = this.normalizeText(element.textContent || '');
    const paragraphCount = element.querySelectorAll('p, blockquote, pre, li').length;
    const boilerplatePenalty = this.containsBoilerplate(text) ? 5000 : 0;
    return text.length + paragraphCount * 80 - boilerplatePenalty;
  }

  private containsBoilerplate(text: string): boolean {
    const patterns = [
      'NodeSeek beta',
      'search for post',
      'search for people',
      'use google search',
      '所有版块 日常 技术 情报 测评 交易 拼车 推广',
      '发帖 快捷功能区 推荐阅读 管理记录 幸运抽奖 邀请好友',
      '相关网站 LowEndTalk LowEndSpirit HostLoc ServerHunter',
      '站内导航 关于本站 隐私协议 RSS订阅 sitemap',
      'Copyright © 2022 -',
      '目前论坛共有',
      '欢迎新用户',
    ];

    return patterns.some((pattern) => text.includes(pattern));
  }

  private stripBoilerplate(text: string): string {
    const lines = text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    const filteredLines = lines.filter((line) => {
      const compact = line.replace(/\s+/g, ' ');

      if (compact.length < 2) {
        return false;
      }

      const blockedPatterns = [
        /NodeSeek beta 日常 技术 情报 测评 交易 拼车 推广/i,
        /DeepFlood search for post search for people use google search/i,
        /所有版块 日常 技术 情报 测评 交易 拼车 推广/i,
        /发帖 快捷功能区 推荐阅读 管理记录 幸运抽奖 邀请好友/i,
        /合作商家 友站链接 所有版块/i,
        /📈用户数目📈/i,
        /目前论坛共有\d+位seeker/i,
        /🎉欢迎新用户🎉/i,
        /相关网站 LowEndTalk LowEndSpirit HostLoc ServerHunter/i,
        /站内导航 关于本站 隐私协议 RSS订阅 sitemap/i,
        /商业推广 商家申请规则 Premium Provider/i,
        /广告合作 其他平台 电报频道 电报群组 联系我们/i,
        /Copyright © 2022\s*-\s*20\d{2}/i,
      ];

      if (blockedPatterns.some((pattern) => pattern.test(compact))) {
        return false;
      }

      if (/^(日常|技术|情报|测评|交易|拼车|推广|生活|Dev|贴图|曝光|内版|沙盒)(\s+(日常|技术|情报|测评|交易|拼车|推广|生活|Dev|贴图|曝光|内版|沙盒))+$/i.test(compact)) {
        return false;
      }

      return true;
    });

    return filteredLines.join('\n');
  }

  private extractArticleBodyFromHtml(html: string): string {
    try {
      const { document } = parseHTML(html);
      this.removeHiddenNodes(document);

      const selectors = [
        'article',
        '.topic-body',
        '.post-body',
        '.cooked',
        '.topic-post .contents',
        '.regular.contents',
        '.topic-area',
        'main',
        'body',
      ];

      let bestText = '';
      let bestScore = 0;

      for (const selector of selectors) {
        for (const element of Array.from(document.querySelectorAll(selector))) {
          const score = this.getNodeTextScore(element);
          if (score <= bestScore) {
            continue;
          }

          const normalized = this.normalizeText(element.innerHTML || element.textContent || '');
          const cleaned = this.stripBoilerplate(normalized);
          if (cleaned.length >= 80) {
            bestText = cleaned;
            bestScore = score;
          }
        }
      }

      if (bestText) {
        return bestText;
      }
    } catch (error) {
      logger.debug(`DOM 解析正文失败，将回退到纯文本清洗: ${error}`);
    }

    return this.stripBoilerplate(this.normalizeText(html));
  }

  private async fetchArticleBody(url: string, cookie?: string, allowBrowserFallback: boolean = false): Promise<string | undefined> {
    try {
      const proxy = this.getProxy();
      const headers: Record<string, string> = {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36 Edg/139.0.0.0',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      };

      if (cookie?.trim()) {
        headers.Cookie = cookie.trim();
      }

      const fetchOptions: RequestInit & { proxy?: string } = {
        headers,
      };

      if (proxy) {
        fetchOptions.proxy = proxy;
      }

      const response = await fetch(url, fetchOptions);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      const articleBody = this.extractArticleBodyFromHtml(html);
      if (articleBody.length >= 80) {
        return articleBody;
      }
    } catch (error) {
      if (!allowBrowserFallback) {
        logger.warn(`正文普通抓取失败，跳过浏览器兜底: ${url}`);
        return undefined;
      }

      logger.warn(`正文普通抓取失败，尝试 Playwright: ${url}`);
    }

    try {
      const html = await this.rssBrowserService.fetchPageContent(url, cookie);
      const articleBody = this.extractArticleBodyFromHtml(html);
      if (articleBody.length >= 80) {
        return articleBody;
      }
    } catch (error) {
      logger.error('正文抓取失败:', error);
    }

    return undefined;
  }

  private async fetchWithPlaywright(url: string, cookie?: string): Promise<RSSItem[]> {
    logger.rss(`普通抓取失败，尝试 Playwright 兜底: ${url}`);
    const xmlText = await this.rssBrowserService.fetchRSSContent(url, cookie);
    return this.parseRSSXML(xmlText);
  }

  /**
   * 获取代理配置（从数据库）
   */
  private getProxy(): string | undefined {
    const config = this.dbService.getBaseConfig();
    return config?.rss_proxy || undefined;
  }

  /**
   * 获取 RSS 配置（从数据库）
   */
  private getRSSConfig(): { url: string; intervalSeconds: number; cookie?: string } {
    const config = this.dbService.getBaseConfig();
    return {
      url: config?.rss_url || "https://rss.nodeseek.com/",
      intervalSeconds: config?.rss_interval_seconds || 60,
      cookie: config?.rss_cookie || undefined,
    };
  }

  private isCookieExpiredResponse(status: number, responseText: string): boolean {
    if (status === 401 || status === 403) {
      return true;
    }

    const lowered = responseText.toLowerCase();
    return (
      lowered.includes('登录') ||
      lowered.includes('登陆') ||
      lowered.includes('cookie') ||
      lowered.includes('unauthorized') ||
      lowered.includes('forbidden')
    ) && !lowered.includes('<rss');
  }

  private async notifyCookieExpired(): Promise<void> {
    const config = this.dbService.getBaseConfig();
    if (!config?.rss_cookie?.trim() || config.rss_cookie_expired_notified === 1) {
      return;
    }

    const title = 'NodeSeeker RSS Cookie 已过期';
    const message = '⚠️ NodeSeeker RSS 抓取检测到 Cookie 可能已失效，请在 RSS 设置中更新 Cookie。';
    let notified = false;

    if (config.bot_token && config.chat_id && config.stop_push !== 1) {
      const telegramService = new TelegramPushService(this.dbService, config.bot_token);
      notified = await telegramService.testSendMessage(config.chat_id, message) || notified;
    }

    if (config.serverchan_enabled === 1) {
      const serverChanService = new ServerChanService(this.dbService);
      const result = await serverChanService.sendMessage(title, message);
      notified = result.success || notified;
    }

    if (config.meow_enabled === 1) {
      const meowService = new MeowService(this.dbService);
      const result = await meowService.sendMessage(title, message);
      notified = result.success || notified;
    }

    this.dbService.updateBaseConfig({
      rss_cookie_expired_notified: notified ? 1 : 0,
    });
  }

  /**
   * 从 XML 文本中提取标签内容
   */
  private extractTagContent(xml: string, tagName: string): string {
    const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, "i");
    const match = xml.match(regex);
    return match ? match[1].trim() : "";
  }

  /**
   * 从 XML 文本中提取 CDATA 内容
   */
  private extractCDATA(text: string): string {
    const cdataMatch = text.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
    return cdataMatch ? cdataMatch[1] : text;
  }

  /**
   * 解析 RSS XML 数据
   */
  private parseRSSXML(xmlText: string): RSSItem[] {
    try {
      // 提取所有 <item> 元素
      const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
      const items: RSSItem[] = [];
      let match;

      while ((match = itemRegex.exec(xmlText)) !== null) {
        const itemXML = match[1];

        // 提取各个字段
        const title = this.extractCDATA(
          this.extractTagContent(itemXML, "title"),
        );
        const link = this.extractTagContent(itemXML, "link");
        const pubDate = this.extractTagContent(itemXML, "pubDate");
        const creator = this.extractCDATA(
          this.extractTagContent(itemXML, "dc:creator"),
        );
        const category = this.extractCDATA(
          this.extractTagContent(itemXML, "category"),
        );
        const description = this.extractCDATA(
          this.extractTagContent(itemXML, "description"),
        );
        const content = this.extractCDATA(
          this.extractTagContent(itemXML, "content:encoded") || description,
        );
        const guid = this.extractTagContent(itemXML, "guid") || link;

        // 创建清理后的摘要
        let contentSnippet = description.replace(/<[^>]*>/g, "").trim();
        if (contentSnippet.length > 200) {
          contentSnippet = contentSnippet.substring(0, 200) + "...";
        }

        items.push({
          title,
          link,
          pubDate,
          creator,
          category,
          contentSnippet,
          content,
          guid,
        });
      }

      return items;
    } catch (error) {
      logger.error("RSS XML 解析失败:", error);
      throw new Error(`RSS XML 解析失败: ${error}`);
    }
  }

  /**
   * 抓取并解析 RSS 数据
   */
  async fetchAndParseRSS(): Promise<RSSItem[]> {
    let controller: AbortController | undefined;
    let timeoutId: NodeJS.Timeout | undefined;

    try {
      const rssConfig = this.getRSSConfig();
      const proxy = this.getProxy();
      if (proxy) {
        logger.rss(`使用代理: ${proxy}`);
      }

      controller = new AbortController();
      timeoutId = setTimeout(() => controller?.abort(), this.TIMEOUT);

      // 构建 fetch 选项
      const fetchOptions: RequestInit & { proxy?: string } = {
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36 Edg/139.0.0.0",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
          "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
          "Accept-Encoding": "gzip, deflate, br",
          Connection: "keep-alive",
          "Upgrade-Insecure-Requests": "1",
          "Sec-Fetch-Dest": "document",
          "Sec-Fetch-Mode": "navigate",
          "Sec-Fetch-Site": "none",
          "Sec-Fetch-User": "?1",
          "Sec-Ch-Ua":
            '"Microsoft Edge";v="139", "Chromium";v="139", "Not=A?Brand";v="8"',
          "Sec-Ch-Ua-Mobile": "?0",
          "Sec-Ch-Ua-Platform": '"Windows"',
          DNT: "1",
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      };

      if (rssConfig.cookie?.trim()) {
        fetchOptions.headers = {
          ...fetchOptions.headers,
          Cookie: rssConfig.cookie.trim(),
        };
      }

      // 如果配置了代理，添加代理选项
      if (proxy) {
        fetchOptions.proxy = proxy;
      }

      const response = await fetch(rssConfig.url, fetchOptions);

      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = undefined;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const xmlText = await response.text();

      if (rssConfig.cookie?.trim() && this.isCookieExpiredResponse(response.status, xmlText)) {
        await this.notifyCookieExpired();
        throw new Error('RSS Cookie 可能已过期');
      }

      if (rssConfig.cookie?.trim()) {
        this.dbService.updateBaseConfig({ rss_cookie_expired_notified: 0 });
      }

      const items = this.parseRSSXML(xmlText);

      if (!items || items.length === 0) {
        return [];
      }
      return items;
    } catch (error) {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`RSS 请求超时 (${this.TIMEOUT}ms)`);
      }
      
      // 提取友好的错误信息
      let errorMessage = '未知错误';
      if (error instanceof Error) {
        const message = error.message;
        if (message.includes('socket connection was closed unexpectedly')) {
          errorMessage = '连接被意外关闭（网络不稳定或服务器拒绝连接）';
        } else if (message.includes('ENOTFOUND') || message.includes('getaddrinfo')) {
          errorMessage = 'DNS 解析失败（请检查 RSS 地址是否正确）';
        } else if (message.includes('ETIMEDOUT') || message.includes('timeout')) {
          errorMessage = '连接超时（网络延迟或服务器响应慢）';
        } else if (message.includes('ECONNREFUSED')) {
          errorMessage = '连接被拒绝（服务器未运行或端口错误）';
        } else if (message.includes('certificate') || message.includes('TLS') || message.includes('SSL')) {
          errorMessage = 'SSL/TLS 证书错误';
        } else {
          errorMessage = message;
        }
      }
      
      if (this.PLAYWRIGHT_FALLBACK) {
        try {
          const rssConfig = this.getRSSConfig();
          return await this.fetchWithPlaywright(rssConfig.url, rssConfig.cookie);
        } catch (playwrightError) {
          logger.error('Playwright RSS 兜底失败:', playwrightError);
          throw new Error(`RSS 抓取失败: ${errorMessage}；Playwright 兜底也失败: ${playwrightError}`);
        }
      }

      throw new Error(`RSS 抓取失败: ${errorMessage}`);
    }
  }

  /**
   * 从链接中提取 post_id
   */
  private extractPostId(link: string): number | null {
    try {
      // NodeSeek 的链接格式通常是 https://www.nodeseek.com/post-{id}-1
      const match = link.match(/post-(\d+)-/);
      if (match && match[1]) {
        return parseInt(match[1], 10);
      }

      // 备用方案：从 URL 参数中提取
      const url = new URL(link);
      const id = url.searchParams.get("id");
      if (id) {
        return parseInt(id, 10);
      }

      return null;
    } catch (error) {
      logger.error("提取 post_id 失败:", error);
      return null;
    }
  }

  /**
   * 清洗和格式化数据
   */
  private cleanAndFormatData(item: RSSItem): ParsedPost | null {
    const postId = this.extractPostId(item.link);
    if (!postId) {
      logger.warn("无法提取 post_id:", item.link);
      return null;
    }

    // 清洗标题
    const title = item.title.trim().replace(/\s+/g, " ");

    // 清洗内容摘要
    let memo = item.contentSnippet || item.content || "";
    memo = this.normalizeText(memo).replace(/\s+/g, " ");
    memo = memo.substring(0, 500); // 限制长度

    // 清洗分类
    const category = item.category ? item.category.trim() : "";

    // 清洗创建者
    const creator = item.creator ? item.creator.trim() : "";

    // 格式化发布时间
    let pubDate: string;
    try {
      const date = new Date(item.pubDate);
      if (isNaN(date.getTime())) {
        pubDate = new Date().toISOString();
      } else {
        pubDate = date.toISOString();
      }
    } catch (error) {
      pubDate = new Date().toISOString();
    }

    return {
      post_id: postId,
      title,
      memo,
      source_url: item.link,
      category,
      creator,
      pub_date: pubDate,
    };
  }

  /**
   * 处理新的 RSS 数据 - 优化版本，批量查询减少数据库访问
   */
  async processNewRSSData(): Promise<RSSProcessResult> {
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 1) logger.rssDebug(`第 ${attempt} 次尝试...`);

        const rssItems = await this.fetchAndParseRSS();

        let processed = 0;
        let newPosts = 0;
        let errors = 0;

        const rssConfig = this.getRSSConfig();
        const baseConfig = this.dbService.getBaseConfig();

        // 第一步：批量解析所有RSS项目
        const parsedPosts: ParsedPost[] = [];
        const postIds: number[] = [];

        for (const item of rssItems) {
          try {
            processed++;

            const parsedPost = this.cleanAndFormatData(item);
            if (!parsedPost) {
              errors++;
              continue;
            }

            parsedPosts.push(parsedPost);
            postIds.push(parsedPost.post_id);
          } catch (error) {
            errors++;
            logger.debug(`解析单条 RSS 数据失败: ${error}`);
          }
        }

        // 第二步：批量查询已存在的文章
        const existingPosts = this.dbService.getPostsByPostIds(postIds);

        // 第三步：筛选出需要创建的新文章
        const newPostsToCreate = parsedPosts.filter((parsedPost) => !existingPosts.has(parsedPost.post_id));

        let articleBrowserFallbacksUsed = 0;

        if (!this.ARTICLE_BODY_ENRICHMENT_ENABLED) {
          logger.rss('已关闭文章正文增强，跳过正文抓取与 AI 摘要');
        } else {
          for (const post of newPostsToCreate) {
            const allowBrowserFallback = this.shouldUseArticleBrowserFallback(articleBrowserFallbacksUsed);

            try {
              const articleBody = await this.fetchArticleBody(post.source_url, rssConfig.cookie, allowBrowserFallback);
              if (articleBody) {
                post.article_body = articleBody;
                post.memo = articleBody.slice(0, 500);
                if (baseConfig && this.AI_SUMMARY_ENABLED) {
                  post.ai_summary = await this.aiSummaryService.summarize(baseConfig, post.title, articleBody);
                }
              }

              if (allowBrowserFallback && !post.article_body) {
                articleBrowserFallbacksUsed++;
              }
            } catch (error) {
              logger.error(`补充正文或AI摘要失败 (post_id: ${post.post_id}):`, error);
              if (allowBrowserFallback) {
                articleBrowserFallbacksUsed++;
              }
            }
          }
        }

        // 第四步：批量创建新文章
        if (newPostsToCreate.length > 0) {
          try {
            // 检查是否有订阅（关键词订阅）
            const subscriptions = this.dbService.getAllKeywordSubs();
            const hasSubscriptions = subscriptions.length > 0;
            

            
            const postsWithDefaults = newPostsToCreate.map((post) => ({
              ...post,
              push_status: hasSubscriptions ? 0 : 2, // 有订阅则未推送，无订阅则无需推送
            }));

            const createdCount =
              this.dbService.batchCreatePosts(postsWithDefaults);
            newPosts = createdCount;

            logger.rss(`新增 ${createdCount} 篇文章`);
          } catch (error) {
            errors += newPostsToCreate.length;
            logger.error('批量创建文章失败', error);
          }
        }

        return {
          new: newPosts,
          updated: 0, // RSS 服务不更新现有文章
          skipped: processed - newPosts - errors,
        };
      } catch (error) {
        lastError = error as Error;
        logger.warn(`第 ${attempt} 次尝试失败`);

        if (attempt < maxRetries) {
          const delayMs = attempt * 2000;
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
    }

    logger.error(`RSS 处理失败，已尝试 ${maxRetries} 次`, lastError);
    throw lastError || new Error("RSS 处理失败，已达到最大重试次数");
  }

  /**
   * 获取最新的文章数据（用于测试）
   */
  getLatestPosts(limit: number = 5): Post[] {
    return this.dbService.getRecentPosts(limit);
  }

  /**
   * 手动触发 RSS 更新
   */
  async manualUpdate(): Promise<{
    success: boolean;
    message: string;
    data?: any;
  }> {
    try {
      const result = await this.processNewRSSData();
      return {
        success: true,
        message: `RSS 更新成功`,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        message: `RSS 更新失败: ${error}`,
      };
    }
  }

  /**
   * 验证 RSS 源是否可访问（使用数据库配置的 URL）
   */
  async validateRSSSource(): Promise<{ accessible: boolean; message: string }> {
    const rssConfig = this.getRSSConfig();
    return this.validateRSSUrl(rssConfig.url);
  }

  /**
   * 验证指定 RSS URL 是否可访问
   */
  async validateRSSUrl(url: string): Promise<{ accessible: boolean; message: string }> {
    try {
      const proxy = this.getProxy();
      if (proxy) {
        logger.rss(`测试连接使用代理: ${proxy}`);
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const fetchOptions: RequestInit & { proxy?: string } = {
        method: "HEAD",
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36 Edg/139.0.0.0",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
          "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
          "Accept-Encoding": "gzip, deflate, br",
          Connection: "keep-alive",
          "Upgrade-Insecure-Requests": "1",
          "Sec-Fetch-Dest": "document",
          "Sec-Fetch-Mode": "navigate",
          "Sec-Fetch-Site": "none",
          "Sec-Fetch-User": "?1",
          "Sec-Ch-Ua":
            '"Microsoft Edge";v="139", "Chromium";v="139", "Not=A?Brand";v="8"',
          "Sec-Ch-Ua-Mobile": "?0",
          "Sec-Ch-Ua-Platform": '"Windows"',
          DNT: "1",
        },
      };

      // 如果配置了代理，添加代理选项
      if (proxy) {
        fetchOptions.proxy = proxy;
      }

      const response = await fetch(url, fetchOptions);

      clearTimeout(timeoutId);

      if (response.ok) {
        return {
          accessible: true,
          message: "RSS 源可正常访问",
        };
      } else {
        return {
          accessible: false,
          message: `RSS 源访问失败: HTTP ${response.status}`,
        };
      }
    } catch (error) {
      return {
        accessible: false,
        message: `RSS 源访问失败: ${error}`,
      };
    }
  }

  /**
   * 获取当前 RSS 配置
   */
  getRSSConfigFromDB(): { url: string; intervalSeconds: number } {
    return this.getRSSConfig();
  }
}
