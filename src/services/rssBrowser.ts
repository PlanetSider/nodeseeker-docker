import { getEnvConfig } from '../config/env';
import { logger } from '../utils/logger';

type PlaywrightModule = typeof import('playwright');
type BrowserInstance = Awaited<ReturnType<PlaywrightModule['chromium']['launch']>>;

export class RSSBrowserService {
    private static browserPromise: Promise<BrowserInstance> | null = null;
    private static circuitOpenedUntil: number = 0;
    private static consecutiveFailures: number = 0;
    private static browserGeneration: number = 0;
    private static activeSessions: number = 0;
    private static waitQueue: Array<() => void> = [];

    private readonly timeout: number;
    private readonly headless: boolean;
    private readonly navigationTimeout: number;
    private readonly failureThreshold: number;
    private readonly cooldownMs: number;
    private readonly maxConcurrency: number;

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
        this.navigationTimeout = Math.max(5000, Math.min(this.timeout, 15000));
        this.failureThreshold = Math.max(1, config.PLAYWRIGHT_FAILURE_THRESHOLD);
        this.cooldownMs = Math.max(1000, config.PLAYWRIGHT_COOLDOWN_MS);
        this.maxConcurrency = Math.max(1, config.PLAYWRIGHT_MAX_CONCURRENCY);
    }

    private async acquireSessionSlot(): Promise<void> {
        if (RSSBrowserService.activeSessions < this.maxConcurrency) {
            RSSBrowserService.activeSessions += 1;
            return;
        }

        await new Promise<void>((resolve) => {
            RSSBrowserService.waitQueue.push(() => {
                RSSBrowserService.activeSessions += 1;
                resolve();
            });
        });
    }

    private releaseSessionSlot(): void {
        RSSBrowserService.activeSessions = Math.max(0, RSSBrowserService.activeSessions - 1);
        const next = RSSBrowserService.waitQueue.shift();
        if (next) {
            next();
        }
    }

    private classifyBrowserError(error: unknown): string {
        const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

        if (message.includes('browser has been closed') || message.includes('target page, context or browser has been closed')) {
            return 'browser_closed';
        }

        if (message.includes('page crashed')) {
            return 'page_crashed';
        }

        if (message.includes('timeout') || message.includes('timed out')) {
            return 'navigation_timeout';
        }

        if (message.includes('net::') || message.includes('network')) {
            return 'network_error';
        }

        if (message.includes('熔断')) {
            return 'circuit_open';
        }

        return 'unknown_browser_error';
    }

    private isCircuitOpen(): boolean {
        return Date.now() < RSSBrowserService.circuitOpenedUntil;
    }

    private markSuccess(): void {
        RSSBrowserService.consecutiveFailures = 0;
        RSSBrowserService.circuitOpenedUntil = 0;
    }

    private markFailure(error: unknown): void {
        RSSBrowserService.consecutiveFailures += 1;
        const errorType = this.classifyBrowserError(error);
        logger.warn(`Playwright 抓取失败 [${errorType}]，连续失败次数: ${RSSBrowserService.consecutiveFailures}`);

        if (RSSBrowserService.consecutiveFailures < this.failureThreshold) {
            return;
        }

        RSSBrowserService.circuitOpenedUntil = Date.now() + this.cooldownMs;
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.warn(`Playwright 熔断已开启，${Math.floor(this.cooldownMs / 60000)} 分钟内跳过浏览器兜底: ${errorMessage}`);
    }

    private async resetBrowser(): Promise<void> {
        if (!RSSBrowserService.browserPromise) {
            return;
        }

        try {
            const browser = await RSSBrowserService.browserPromise;
            await browser.close();
        } catch {
            // 浏览器可能已经崩溃或关闭，忽略即可
        } finally {
            RSSBrowserService.browserPromise = null;
            RSSBrowserService.browserGeneration += 1;
        }
    }

    private async getBrowser(): Promise<{ browser: BrowserInstance; generation: number }> {
        if (!RSSBrowserService.browserPromise) {
            const { chromium } = await this.loadPlaywright();
            const currentGeneration = RSSBrowserService.browserGeneration;
            RSSBrowserService.browserPromise = chromium.launch({
                headless: this.headless,
                args: [
                    '--disable-dev-shm-usage',
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                ],
            });

            RSSBrowserService.browserPromise
                .then((browser) => {
                    browser.once('disconnected', () => {
                        if (RSSBrowserService.browserGeneration === currentGeneration) {
                            RSSBrowserService.browserPromise = null;
                            RSSBrowserService.browserGeneration += 1;
                            logger.warn('Playwright 浏览器连接已断开，已清理共享实例');
                        }
                    });
                })
                .catch(() => {
                    RSSBrowserService.browserPromise = null;
                    RSSBrowserService.browserGeneration += 1;
                });
        }

        return {
            browser: await RSSBrowserService.browserPromise,
            generation: RSSBrowserService.browserGeneration,
        };
    }

    private async openPageOnce(url: string, cookie?: string): Promise<{ contentType: string; content: string; bodyText: string }> {
        if (this.isCircuitOpen()) {
            throw new Error('Playwright 浏览器兜底已熔断，暂时跳过');
        }

        await this.acquireSessionSlot();
        const { browser, generation } = await this.getBrowser();
        let context: Awaited<ReturnType<BrowserInstance['newContext']>> | null = null;

        try {
            if (!browser.isConnected()) {
                throw new Error('Playwright browser has been closed before creating context');
            }

            context = await browser.newContext({
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
                waitUntil: 'domcontentloaded',
                timeout: this.navigationTimeout,
            });

            const contentType = await page.evaluate(() => document.contentType || '');
            const content = await page.content();
            const bodyText = await page.locator('body').innerText().catch(() => '');

            this.markSuccess();
            return { contentType, content, bodyText };
        } catch (error) {
            this.markFailure(error);

            const errorType = this.classifyBrowserError(error);
            if (errorType === 'browser_closed' || errorType === 'page_crashed') {
                if (RSSBrowserService.browserGeneration === generation) {
                    await this.resetBrowser();
                }
            }

            throw error;
        } finally {
            if (context) {
                await context.close().catch(() => undefined);
            }
            this.releaseSessionSlot();
        }
    }

    private async openPage(url: string, cookie?: string): Promise<{ contentType: string; content: string; bodyText: string }> {
        try {
            return await this.openPageOnce(url, cookie);
        } catch (error) {
            const errorType = this.classifyBrowserError(error);
            if (errorType !== 'browser_closed' && errorType !== 'page_crashed') {
                throw error;
            }

            logger.warn(`Playwright 页面打开失败 [${errorType}]，重建浏览器后重试一次: ${url}`);
            await this.resetBrowser();
            return this.openPageOnce(url, cookie);
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
