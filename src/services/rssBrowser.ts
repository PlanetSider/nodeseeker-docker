import { getEnvConfig } from '../config/env';
import { logger } from '../utils/logger';

type PlaywrightModule = typeof import('playwright');

export class RSSBrowserService {
    private readonly timeout: number;
    private readonly headless: boolean;

    private async loadPlaywright(): Promise<PlaywrightModule> {
        const dynamicImport = new Function('specifier', 'return import(specifier)') as (
            specifier: string,
        ) => Promise<PlaywrightModule>;
        return dynamicImport('playwright');
    }

    constructor() {
        const config = getEnvConfig();
        this.timeout = config.RSS_TIMEOUT;
        this.headless = config.PLAYWRIGHT_HEADLESS;
    }

    private async openPage(url: string, cookie?: string): Promise<{ contentType: string; content: string; bodyText: string }> {
        const { chromium } = await this.loadPlaywright();
        const browser = await chromium.launch({
            headless: this.headless,
        });

        try {
            const context = await browser.newContext({
                userAgent:
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
            });
            if (cookie?.trim()) {
                await context.setExtraHTTPHeaders({
                    Cookie: cookie.trim(),
                });
            }
            const page = await context.newPage();

            await page.goto(url, {
                waitUntil: 'networkidle',
                timeout: this.timeout,
            });

            const contentType = await page.evaluate(() => document.contentType || '');
            const content = await page.content();
            const bodyText = await page.locator('body').innerText().catch(() => '');

            return { contentType, content, bodyText };
        } finally {
            await browser.close();
        }
    }

    async fetchRSSContent(url: string, cookie?: string): Promise<string> {
        try {
            const { contentType, content, bodyText } = await this.openPage(url, cookie);

            if (contentType.includes('xml') || content.includes('<rss') || content.includes('<item')) {
                return content;
            }

            if (bodyText.includes('<rss') || bodyText.includes('<item')) {
                return bodyText;
            }

            throw new Error('Playwright 未获取到有效 RSS XML 内容');
        } catch (error) {
            logger.error('Playwright RSS 抓取失败:', error);
            throw error;
        }
    }

    async fetchPageContent(url: string, cookie?: string): Promise<string> {
        try {
            const { content } = await this.openPage(url, cookie);
            return content;
        } catch (error) {
            logger.error('Playwright 页面抓取失败:', error);
            throw error;
        }
    }
}
