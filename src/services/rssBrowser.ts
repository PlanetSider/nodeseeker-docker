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

    async fetchRSSContent(url: string): Promise<string> {
        const { chromium } = await this.loadPlaywright();
        const browser = await chromium.launch({
            headless: this.headless,
        });

        try {
            const page = await browser.newPage({
                userAgent:
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
            });

            await page.goto(url, {
                waitUntil: 'networkidle',
                timeout: this.timeout,
            });

            const contentType = await page.evaluate(() => document.contentType || '');
            const content = await page.content();

            if (contentType.includes('xml') || content.includes('<rss') || content.includes('<item')) {
                return content;
            }

            const bodyText = await page.locator('body').innerText().catch(() => '');
            if (bodyText.includes('<rss') || bodyText.includes('<item')) {
                return bodyText;
            }

            throw new Error('Playwright 未获取到有效 RSS XML 内容');
        } catch (error) {
            logger.error('Playwright RSS 抓取失败:', error);
            throw error;
        } finally {
            await browser.close();
        }
    }
}
