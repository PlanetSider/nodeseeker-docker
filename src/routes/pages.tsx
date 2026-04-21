import { Hono } from 'hono';
import { DatabaseService } from '../services/database';
import { AuthService } from '../services/auth';
import { RSSExportService } from '../services/rssExport';
import { InitPage, HomePage, ErrorPage } from '../components';
import type { ContextVariables } from '../types';

type Variables = ContextVariables & {
  authService: AuthService;
}

export const pageRoutes = new Hono<{ Variables: Variables }>();

// 首页 - 检查初始化状态，未初始化跳转到初始化页面
pageRoutes.get('/', async (c) => {
  try {
    const authService = c.get('authService');
    const initStatus = authService.checkInitialization();
    
    // 未初始化时跳转到初始化页面
    if (!initStatus.initialized) {
      return c.redirect('/init');
    }
    
    return c.html(<HomePage />);
  } catch (error) {
    return c.html(<ErrorPage message={`加载页面失败: ${error}`} />);
  }
});

// 初始化页面
pageRoutes.get('/init', async (c) => {
  try {
    const authService = c.get('authService');
    const initStatus = authService.checkInitialization();
    
    if (initStatus.initialized) {
      return c.redirect('/');
    }
    
    return c.html(<InitPage />);
  } catch (error) {
    return c.html(<ErrorPage message={`加载初始化页面失败: ${error}`} />);
  }
});

// 兼容旧版路由（重定向到首页）
pageRoutes.get('/login', async (c) => {
  return c.redirect('/');
});

pageRoutes.get('/dashboard', async (c) => {
  return c.redirect('/');
});

pageRoutes.get('/rss.xml', async (c) => {
  try {
    const dbService = c.get('dbService');
    const exportService = new RSSExportService(dbService);
    const url = new URL(c.req.url);
    const feedUrl = `${url.origin}/rss.xml`;
    const xml = exportService.buildFullFeed(feedUrl, url.origin);
    return c.body(xml, 200, {
      'Content-Type': 'application/rss+xml; charset=UTF-8',
      'Cache-Control': 'public, max-age=300',
    });
  } catch (error) {
    return c.html(<ErrorPage message={`生成全量 RSS 失败: ${error}`} />);
  }
});

const handleSubscriptionFeed = async (c: any) => {
  try {
    const dbService = c.get('dbService');
    const exportService = new RSSExportService(dbService);
    const url = new URL(c.req.url);
    const feedUrl = `${url.origin}/sub.xml`;
    const xml = exportService.buildSubscriptionFeed(feedUrl, url.origin);

    return c.body(xml, 200, {
      'Content-Type': 'application/rss+xml; charset=UTF-8',
      'Cache-Control': 'public, max-age=300',
    });
  } catch (error) {
    return c.html(<ErrorPage message={`生成聚合订阅 RSS 失败: ${error}`} />);
  }
};

pageRoutes.get('/sub', handleSubscriptionFeed);
pageRoutes.get('/sub.xml', handleSubscriptionFeed);
