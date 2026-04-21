import type { Database } from 'bun:sqlite';
import { createDatabaseConnection } from '../config/database';
import type { BaseConfig, Post, KeywordSub, TrackedTopic, TopicReply } from '../types';
import { logger } from '../utils/logger';

export class DatabaseService {
  private queryCache: Map<string, { data: any; timestamp: number; ttl: number }>;
  private readonly CACHE_TTL = 60000; // 1分钟缓存

  constructor(private db: Database) {
    this.queryCache = new Map();
  }

  // 静态工厂方法
  static create(): DatabaseService {
    const db = createDatabaseConnection();
    return new DatabaseService(db);
  }

  // 缓存助手方法
  private getCacheKey(method: string, params: any[]): string {
    return `${method}:${JSON.stringify(params)}`;
  }

  private getFromCache<T>(key: string): T | null {
    const cached = this.queryCache.get(key);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.data as T;
    }
    this.queryCache.delete(key);
    return null;
  }

  private setCache(key: string, data: any, ttl: number = this.CACHE_TTL): void {
    this.queryCache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  private clearCacheByPattern(pattern: string): void {
    const keysToDelete: string[] = [];
    this.queryCache.forEach((_, key) => {
      if (key.includes(pattern)) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => this.queryCache.delete(key));
  }

  /**
   * 检查数据库表是否存在
   */
  checkTablesExist(): boolean {
    try {
      // 检查主要表是否存在
      const tables = ['base_config', 'posts', 'keywords_sub'];
      
      for (const table of tables) {
        const result = this.db.query(`
          SELECT name FROM sqlite_master 
          WHERE type='table' AND name=?
        `).get(table);
        
        if (!result) {
          return false;
        }
      }
      
      return true;
    } catch (error) {
      logger.error('检查数据库表存在性失败:', error);
      return false;
    }
  }

  // 基础配置相关操作
  getBaseConfig(): BaseConfig | null {
    const cacheKey = this.getCacheKey('getBaseConfig', []);
    const cached = this.getFromCache<BaseConfig | null>(cacheKey);
    if (cached !== null) return cached;

    const result = this.db.query('SELECT * FROM base_config LIMIT 1').get() as BaseConfig | null;
    
    // 缓存120秒，配置变化不频繁
    this.setCache(cacheKey, result, 120000);
    return result;
  }

  createBaseConfig(config: Omit<BaseConfig, 'id' | 'created_at' | 'updated_at'>): BaseConfig {
    const stmt = this.db.query(`
      INSERT INTO base_config (
        username, password, bot_token, chat_id, bound_user_name, bound_user_username,
        stop_push, only_title, serverchan_enabled, serverchan_uid, serverchan_sendkey,
        meow_enabled, meow_endpoint, meow_nickname, meow_token,
        feishu_enabled, feishu_app_id, feishu_app_secret, feishu_verification_token, feishu_chat_id, feishu_bound_user_name, feishu_bound_user_id,
        rss_url, rss_interval_seconds, rss_proxy, rss_cookie, rss_cookie_expired_notified,
        ai_enabled, ai_api_url, ai_api_key, ai_model, ai_prompt
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING *
    `);
    
    const result = stmt.get(
      config.username,
      config.password,
      config.bot_token || null,
      config.chat_id,
      config.bound_user_name || null,
      config.bound_user_username || null,
      config.stop_push,
      config.only_title,
      config.serverchan_enabled || 0,
      config.serverchan_uid || null,
      config.serverchan_sendkey || null,
      config.meow_enabled || 0,
      config.meow_endpoint || null,
      config.meow_nickname || null,
      config.meow_token || null,
      config.feishu_enabled || 0,
      config.feishu_app_id || null,
      config.feishu_app_secret || null,
      config.feishu_verification_token || null,
      config.feishu_chat_id || null,
      config.feishu_bound_user_name || null,
      config.feishu_bound_user_id || null,
      config.rss_url || 'https://rss.nodeseek.com/',
      config.rss_interval_seconds || 60,
      config.rss_proxy || null,
      config.rss_cookie || null,
      config.rss_cookie_expired_notified || 0,
      config.ai_enabled || 0,
      config.ai_api_url || null,
      config.ai_api_key || null,
      config.ai_model || null,
      config.ai_prompt || null
    ) as BaseConfig;
    
    // 清理相关缓存
    this.clearCacheByPattern('BaseConfig');
    
    return result;
  }

  updateBaseConfig(config: Partial<BaseConfig>): BaseConfig | null {
    const updates: string[] = [];
    const values: any[] = [];

    if (config.username !== undefined) {
      updates.push('username = ?');
      values.push(config.username);
    }
    if (config.password !== undefined) {
      updates.push('password = ?');
      values.push(config.password);
    }
    if (config.bot_token !== undefined) {
      updates.push('bot_token = ?');
      values.push(config.bot_token);
    }
    if (config.chat_id !== undefined) {
      updates.push('chat_id = ?');
      values.push(config.chat_id);
    }
    if (config.bound_user_name !== undefined) {
      updates.push('bound_user_name = ?');
      values.push(config.bound_user_name);
    }
    if (config.bound_user_username !== undefined) {
      updates.push('bound_user_username = ?');
      values.push(config.bound_user_username);
    }
    if (config.stop_push !== undefined) {
      updates.push('stop_push = ?');
      values.push(config.stop_push);
    }
    if (config.only_title !== undefined) {
      updates.push('only_title = ?');
      values.push(config.only_title);
    }
    if (config.serverchan_enabled !== undefined) {
      updates.push('serverchan_enabled = ?');
      values.push(config.serverchan_enabled);
    }
    if (config.serverchan_uid !== undefined) {
      updates.push('serverchan_uid = ?');
      values.push(config.serverchan_uid);
    }
    if (config.serverchan_sendkey !== undefined) {
      updates.push('serverchan_sendkey = ?');
      values.push(config.serverchan_sendkey);
    }
    if (config.meow_enabled !== undefined) {
      updates.push('meow_enabled = ?');
      values.push(config.meow_enabled);
    }
    if (config.meow_endpoint !== undefined) {
      updates.push('meow_endpoint = ?');
      values.push(config.meow_endpoint);
    }
    if (config.meow_nickname !== undefined) {
      updates.push('meow_nickname = ?');
      values.push(config.meow_nickname);
    }
    if (config.meow_token !== undefined) {
      updates.push('meow_token = ?');
      values.push(config.meow_token);
    }
    if (config.feishu_enabled !== undefined) {
      updates.push('feishu_enabled = ?');
      values.push(config.feishu_enabled);
    }
    if (config.feishu_app_id !== undefined) {
      updates.push('feishu_app_id = ?');
      values.push(config.feishu_app_id);
    }
    if (config.feishu_app_secret !== undefined) {
      updates.push('feishu_app_secret = ?');
      values.push(config.feishu_app_secret);
    }
    if (config.feishu_verification_token !== undefined) {
      updates.push('feishu_verification_token = ?');
      values.push(config.feishu_verification_token);
    }
    if (config.feishu_chat_id !== undefined) {
      updates.push('feishu_chat_id = ?');
      values.push(config.feishu_chat_id);
    }
    if (config.feishu_bound_user_name !== undefined) {
      updates.push('feishu_bound_user_name = ?');
      values.push(config.feishu_bound_user_name);
    }
    if (config.feishu_bound_user_id !== undefined) {
      updates.push('feishu_bound_user_id = ?');
      values.push(config.feishu_bound_user_id);
    }
    if (config.feishu_last_test_status !== undefined) {
      updates.push('feishu_last_test_status = ?');
      values.push(config.feishu_last_test_status);
    }
    if (config.feishu_last_test_at !== undefined) {
      updates.push('feishu_last_test_at = ?');
      values.push(config.feishu_last_test_at);
    }
    if (config.feishu_last_send_at !== undefined) {
      updates.push('feishu_last_send_at = ?');
      values.push(config.feishu_last_send_at);
    }
    if (config.feishu_last_error !== undefined) {
      updates.push('feishu_last_error = ?');
      values.push(config.feishu_last_error);
    }
    if (config.telegram_last_test_status !== undefined) {
      updates.push('telegram_last_test_status = ?');
      values.push(config.telegram_last_test_status);
    }
    if (config.telegram_last_test_at !== undefined) {
      updates.push('telegram_last_test_at = ?');
      values.push(config.telegram_last_test_at);
    }
    if (config.telegram_last_send_at !== undefined) {
      updates.push('telegram_last_send_at = ?');
      values.push(config.telegram_last_send_at);
    }
    if (config.telegram_last_error !== undefined) {
      updates.push('telegram_last_error = ?');
      values.push(config.telegram_last_error);
    }
    if (config.serverchan_last_test_status !== undefined) {
      updates.push('serverchan_last_test_status = ?');
      values.push(config.serverchan_last_test_status);
    }
    if (config.serverchan_last_test_at !== undefined) {
      updates.push('serverchan_last_test_at = ?');
      values.push(config.serverchan_last_test_at);
    }
    if (config.serverchan_last_send_at !== undefined) {
      updates.push('serverchan_last_send_at = ?');
      values.push(config.serverchan_last_send_at);
    }
    if (config.serverchan_last_error !== undefined) {
      updates.push('serverchan_last_error = ?');
      values.push(config.serverchan_last_error);
    }
    if (config.meow_last_test_status !== undefined) {
      updates.push('meow_last_test_status = ?');
      values.push(config.meow_last_test_status);
    }
    if (config.meow_last_test_at !== undefined) {
      updates.push('meow_last_test_at = ?');
      values.push(config.meow_last_test_at);
    }
    if (config.meow_last_send_at !== undefined) {
      updates.push('meow_last_send_at = ?');
      values.push(config.meow_last_send_at);
    }
    if (config.meow_last_error !== undefined) {
      updates.push('meow_last_error = ?');
      values.push(config.meow_last_error);
    }
    if (config.rss_url !== undefined) {
      updates.push('rss_url = ?');
      values.push(config.rss_url);
    }
    if (config.rss_interval_seconds !== undefined) {
      updates.push('rss_interval_seconds = ?');
      values.push(config.rss_interval_seconds);
    }
    if (config.rss_proxy !== undefined) {
      updates.push('rss_proxy = ?');
      values.push(config.rss_proxy);
    }
    if (config.rss_cookie !== undefined) {
      updates.push('rss_cookie = ?');
      values.push(config.rss_cookie);
    }
    if (config.rss_cookie_expired_notified !== undefined) {
      updates.push('rss_cookie_expired_notified = ?');
      values.push(config.rss_cookie_expired_notified);
    }
    if (config.ai_enabled !== undefined) {
      updates.push('ai_enabled = ?');
      values.push(config.ai_enabled);
    }
    if (config.ai_api_url !== undefined) {
      updates.push('ai_api_url = ?');
      values.push(config.ai_api_url);
    }
    if (config.ai_api_key !== undefined) {
      updates.push('ai_api_key = ?');
      values.push(config.ai_api_key);
    }
    if (config.ai_model !== undefined) {
      updates.push('ai_model = ?');
      values.push(config.ai_model);
    }
    if (config.ai_prompt !== undefined) {
      updates.push('ai_prompt = ?');
      values.push(config.ai_prompt);
    }
    if (config.telegram_mode !== undefined) {
      updates.push('telegram_mode = ?');
      values.push(config.telegram_mode);
    }

    if (updates.length === 0) {
      return this.getBaseConfig();
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');

    const stmt = this.db.query(`
      UPDATE base_config 
      SET ${updates.join(', ')}
      WHERE id = (SELECT id FROM base_config LIMIT 1)
      RETURNING *
    `);

    const result = stmt.get(...values) as BaseConfig | null;

    // 清理相关缓存
    this.clearCacheByPattern('BaseConfig');

    return result;
  }

  // 文章相关操作
  createPost(post: Omit<Post, 'id' | 'created_at'>): Post {
    const stmt = this.db.query(`
      INSERT INTO posts (post_id, title, memo, source_url, article_body, ai_summary, category, creator, push_status, sub_id, pub_date, push_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING *
    `);

    const result = stmt.get(
      post.post_id,
      post.title,
      post.memo,
      post.source_url || null,
      post.article_body || null,
      post.ai_summary || null,
      post.category,
      post.creator,
      post.push_status,
      post.sub_id || null,
      post.pub_date,
      post.push_date || null
    ) as Post;

    // 清除相关缓存
    this.clearCacheByPattern('posts');
    this.clearCacheByPattern('Stats');

    return result;
  }

  /**
   * 批量创建文章
   */
  batchCreatePosts(posts: Array<Omit<Post, 'id' | 'created_at'>>): number {
    if (posts.length === 0) {
      return 0;
    }

    const stmt = this.db.query(`
      INSERT INTO posts (post_id, title, memo, source_url, article_body, ai_summary, category, creator, push_status, sub_id, pub_date, push_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // 使用事务进行批量插入
    const transaction = this.db.transaction((posts: Array<Omit<Post, 'id' | 'created_at'>>) => {
      let insertedCount = 0;
      for (const post of posts) {
        try {
          stmt.run(
            post.post_id,
            post.title,
            post.memo,
            post.source_url || null,
            post.article_body || null,
            post.ai_summary || null,
            post.category,
            post.creator,
            post.push_status,
            post.sub_id || null,
            post.pub_date,
            post.push_date || null
          );
          insertedCount++;
        } catch (error) {
          logger.error(`插入文章失败 (post_id: ${post.post_id}):`, error);
        }
      }
      return insertedCount;
    });

    const insertedCount = transaction(posts);
    
    // 清除相关缓存
    this.clearCacheByPattern('posts');
    this.clearCacheByPattern('Stats');
    
    return insertedCount;
  }

  getPostByPostId(postId: number): Post | null {
    const stmt = this.db.query('SELECT * FROM posts WHERE post_id = ?');
    return stmt.get(postId) as Post | null;
  }

  /**
   * 批量查询文章，根据 post_id 数组
   */
  getPostsByPostIds(postIds: number[]): Map<number, Post> {
    if (postIds.length === 0) {
      return new Map();
    }

    // 构建 IN 查询的占位符
    const placeholders = postIds.map(() => '?').join(',');
    const query = `SELECT * FROM posts WHERE post_id IN (${placeholders})`;
    
    const stmt = this.db.query(query);
    const results = stmt.all(...postIds) as Post[];
    
    // 将结果转换为 Map，以 post_id 为键
    const postMap = new Map<number, Post>();
    results.forEach(post => {
      postMap.set(post.post_id, post);
    });
    
    return postMap;
  }

  updatePostPushStatus(postId: number, pushStatus: number, subId?: number, pushDate?: string): void {
    const stmt = this.db.query(`
      UPDATE posts 
      SET push_status = ?, sub_id = ?, push_date = ?
      WHERE post_id = ?
    `);
    
    stmt.run(pushStatus, subId || null, pushDate || null, postId);
  }

  getRecentPosts(limit: number = 10): Post[] {
    const stmt = this.db.query(`
      SELECT * FROM posts 
      ORDER BY pub_date DESC 
      LIMIT ?
    `);
    
    return stmt.all(limit) as Post[];
  }

  getUnpushedPosts(): Post[] {
    const stmt = this.db.query(`
      SELECT * FROM posts 
      WHERE push_status = 0 
      ORDER BY pub_date ASC
    `);
    
    return stmt.all() as Post[];
  }

  // 新增：带分页的文章查询（包含匹配的关键词信息）
  getPostsWithPagination(
    page: number = 1, 
    limit: number = 30, 
    filters?: {
      pushStatus?: number;
      pushStatusIn?: number[];  // 新增：IN 查询
      pushStatusNot?: number;
      creator?: string;
      category?: string;
      search?: string;
      subId?: number;
    }
  ): {
    posts: Array<Post & { keywords?: string[] }>;
    total: number;
    page: number;
    totalPages: number;
  } {
    const offset = (page - 1) * limit;
    
    // 构建查询条件
    const conditions: string[] = [];
    const params: any[] = [];
    

    if (filters) {
      if (filters.pushStatusIn && filters.pushStatusIn.length > 0) {
        const placeholders = filters.pushStatusIn.map(() => '?').join(',');
        conditions.push(`p.push_status IN (${placeholders})`);
        params.push(...filters.pushStatusIn);
      } else if (filters.pushStatus !== undefined && filters.pushStatus !== null && filters.pushStatus.toString() !== '') {
        conditions.push('p.push_status = ?');
        params.push(filters.pushStatus);
      }
      
      if (filters.pushStatusNot !== undefined && filters.pushStatusNot !== null && filters.pushStatusNot.toString() !== '') {
        conditions.push('p.push_status != ?');
        params.push(filters.pushStatusNot);
      }
      
      if (filters.creator) {
        conditions.push('p.creator LIKE ?');
        params.push(`%${filters.creator}%`);
      }
      
      if (filters.category) {
        conditions.push('p.category LIKE ?');
        params.push(`%${filters.category}%`);
      }
      
      if (filters.search) {
        conditions.push('p.title LIKE ?');
        params.push(`%${filters.search}%`);
      }
      
      // 按订阅筛选：直接从订阅详情构建查询条件，而非通过 sub_id 关联
      if (filters.subId !== undefined) {
        const sub = this.getKeywordSubById(filters.subId);
        if (sub) {
          // 关键词匹配：每个非空关键词必须在标题或内容中出现（AND 关系）
          const keywords = [sub.keyword1, sub.keyword2, sub.keyword3]
            .filter(k => k && k.trim().length > 0) as string[];
          
          for (const keyword of keywords) {
            conditions.push('(p.title LIKE ? OR p.memo LIKE ?)');
            params.push(`%${keyword}%`, `%${keyword}%`);
          }
          
          // 作者匹配
          if (sub.creator && sub.creator.trim().length > 0) {
            conditions.push('p.creator LIKE ?');
            params.push(`%${sub.creator.trim()}%`);
          }
          
          // 分类匹配
          if (sub.category && sub.category.trim().length > 0) {
            conditions.push('p.category LIKE ?');
            params.push(`%${sub.category.trim()}%`);
          }
        } else {
          // 订阅不存在，返回空结果
          conditions.push('1 = 0');
        }
      }
    }
    
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    // 查询文章，LEFT JOIN 订阅表以获取匹配的订阅详情
    const postsStmt = this.db.query(`
      SELECT p.*,
             ks.keyword1 AS sub_keyword1,
             ks.keyword2 AS sub_keyword2,
             ks.keyword3 AS sub_keyword3,
             ks.creator  AS sub_creator,
             ks.category AS sub_category
      FROM posts p
      LEFT JOIN keywords_sub ks ON p.sub_id = ks.id
      ${whereClause}
      ORDER BY p.pub_date DESC 
      LIMIT ? OFFSET ?
    `);
    const posts = postsStmt.all(...params, limit, offset) as Post[];
    
    // 查询总数（使用与主查询相同的别名和 JOIN）
    const countStmt = this.db.query(`
      SELECT COUNT(*) as count
      FROM posts p
      LEFT JOIN keywords_sub ks ON p.sub_id = ks.id
      ${whereClause}
    `);
    const countResult = countStmt.get(...params) as { count: number };
    const total = countResult?.count || 0;
    const totalPages = Math.ceil(total / limit);
    
    return {
      posts,
      total,
      page,
      totalPages
    };
  }

  // 新增：批量更新文章推送状态
  batchUpdatePostPushStatus(updates: Array<{
    postId: number;
    pushStatus: number;
    subId?: number;
    pushDate?: string;
  }>): void {
    if (updates.length === 0) return;
    
    const stmt = this.db.query(`
      UPDATE posts 
      SET push_status = ?, sub_id = ?, push_date = ?
      WHERE post_id = ?
    `);
    
    // 使用事务进行批量更新
    const transaction = this.db.transaction((updates) => {
      for (const update of updates) {
        stmt.run(
          update.pushStatus,
          update.subId || null,
          update.pushDate || null,
          update.postId
        );
      }
    });
    
    transaction(updates);
  }

  // 关键词订阅相关操作
  createKeywordSub(sub: Omit<KeywordSub, 'id' | 'created_at' | 'updated_at'>): KeywordSub {
    const stmt = this.db.query(`
      INSERT INTO keywords_sub (keyword1, keyword2, keyword3, creator, category)
      VALUES (?, ?, ?, ?, ?)
      RETURNING *
    `);

    const result = stmt.get(
      sub.keyword1 || null,
      sub.keyword2 || null,
      sub.keyword3 || null,
      sub.creator || null,
      sub.category || null
    ) as KeywordSub;

    // 清理相关缓存
    this.clearCacheByPattern('KeywordSubs');
    this.clearCacheByPattern('Subscriptions');

    return result;
  }

  getAllKeywordSubs(): KeywordSub[] {
    const cacheKey = this.getCacheKey('getAllKeywordSubs', []);
    const cached = this.getFromCache<KeywordSub[]>(cacheKey);
    if (cached !== null) return cached;

    const stmt = this.db.query('SELECT * FROM keywords_sub ORDER BY created_at DESC');
    const subscriptions = stmt.all() as KeywordSub[];
    
    // 缓存60秒，因为订阅变化不频繁
    this.setCache(cacheKey, subscriptions, 60000);
    return subscriptions;
  }

  deleteKeywordSub(id: number): boolean {
    const stmt = this.db.query('DELETE FROM keywords_sub WHERE id = ?');
    const result = stmt.run(id);
    
    // 清理相关缓存
    this.clearCacheByPattern('KeywordSubs');
    this.clearCacheByPattern('Subscriptions');
    
    return result.changes > 0;
  }

  updateKeywordSub(id: number, sub: Partial<Omit<KeywordSub, 'id' | 'created_at' | 'updated_at'>>): KeywordSub | null {
    const updates: string[] = [];
    const values: any[] = [];

    if (sub.keyword1 !== undefined) {
      updates.push('keyword1 = ?');
      values.push(sub.keyword1 || null);
    }
    if (sub.keyword2 !== undefined) {
      updates.push('keyword2 = ?');
      values.push(sub.keyword2 || null);
    }
    if (sub.keyword3 !== undefined) {
      updates.push('keyword3 = ?');
      values.push(sub.keyword3 || null);
    }
    if (sub.creator !== undefined) {
      updates.push('creator = ?');
      values.push(sub.creator || null);
    }
    if (sub.category !== undefined) {
      updates.push('category = ?');
      values.push(sub.category || null);
    }

    if (updates.length === 0) {
      return this.getKeywordSubById(id);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const stmt = this.db.query(`
      UPDATE keywords_sub 
      SET ${updates.join(', ')}
      WHERE id = ?
      RETURNING *
    `);

    return stmt.get(...values) as KeywordSub | null;
  }

  getKeywordSubById(id: number): KeywordSub | null {
    const stmt = this.db.query('SELECT * FROM keywords_sub WHERE id = ?');
    return stmt.get(id) as KeywordSub | null;
  }

  createTrackedTopic(topic: Omit<TrackedTopic, 'id' | 'created_at' | 'updated_at'>): TrackedTopic {
    const stmt = this.db.query(`
      INSERT INTO tracked_topics (post_id, topic_url, title, enabled, last_checked_at, last_seen_reply_count, last_seen_reply_key)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(post_id) DO UPDATE SET
        topic_url = excluded.topic_url,
        title = excluded.title,
        enabled = excluded.enabled,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `);

    const result = stmt.get(
      topic.post_id,
      topic.topic_url,
      topic.title,
      topic.enabled,
      topic.last_checked_at || null,
      topic.last_seen_reply_count || 0,
      topic.last_seen_reply_key || null,
    ) as TrackedTopic;

    this.clearCacheByPattern('TrackedTopics');
    return result;
  }

  getTrackedTopicByPostId(postId: number): TrackedTopic | null {
    const stmt = this.db.query('SELECT * FROM tracked_topics WHERE post_id = ? LIMIT 1');
    return stmt.get(postId) as TrackedTopic | null;
  }

  getTrackedTopics(enabledOnly: boolean = false): TrackedTopic[] {
    const cacheKey = this.getCacheKey('getTrackedTopics', [enabledOnly]);
    const cached = this.getFromCache<TrackedTopic[]>(cacheKey);
    if (cached !== null) return cached;

    const stmt = this.db.query(`
      SELECT * FROM tracked_topics
      ${enabledOnly ? 'WHERE enabled = 1' : ''}
      ORDER BY created_at DESC
    `);
    const topics = stmt.all() as TrackedTopic[];
    this.setCache(cacheKey, topics, 30000);
    return topics;
  }

  updateTrackedTopic(id: number, topic: Partial<Omit<TrackedTopic, 'id' | 'created_at' | 'updated_at'>>): TrackedTopic | null {
    const updates: string[] = [];
    const values: any[] = [];

    if (topic.topic_url !== undefined) {
      updates.push('topic_url = ?');
      values.push(topic.topic_url);
    }
    if (topic.title !== undefined) {
      updates.push('title = ?');
      values.push(topic.title);
    }
    if (topic.enabled !== undefined) {
      updates.push('enabled = ?');
      values.push(topic.enabled);
    }
    if (topic.last_checked_at !== undefined) {
      updates.push('last_checked_at = ?');
      values.push(topic.last_checked_at);
    }
    if (topic.last_seen_reply_count !== undefined) {
      updates.push('last_seen_reply_count = ?');
      values.push(topic.last_seen_reply_count);
    }
    if (topic.last_seen_reply_key !== undefined) {
      updates.push('last_seen_reply_key = ?');
      values.push(topic.last_seen_reply_key);
    }

    if (updates.length === 0) {
      return this.getTrackedTopics().find((item) => item.id === id) || null;
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const stmt = this.db.query(`
      UPDATE tracked_topics
      SET ${updates.join(', ')}
      WHERE id = ?
      RETURNING *
    `);

    const result = stmt.get(...values) as TrackedTopic | null;
    this.clearCacheByPattern('TrackedTopics');
    return result;
  }

  disableTrackedTopicByPostId(postId: number): boolean {
    const stmt = this.db.query(`
      UPDATE tracked_topics
      SET enabled = 0, updated_at = CURRENT_TIMESTAMP
      WHERE post_id = ?
    `);
    const result = stmt.run(postId);
    this.clearCacheByPattern('TrackedTopics');
    return result.changes > 0;
  }

  createTopicReply(reply: Omit<TopicReply, 'id' | 'created_at'>): TopicReply | null {
    const stmt = this.db.query(`
      INSERT INTO topic_replies (tracked_topic_id, reply_key, reply_author, reply_content, reply_time, floor_no, source_url, notified)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(tracked_topic_id, reply_key) DO NOTHING
      RETURNING *
    `);

    return stmt.get(
      reply.tracked_topic_id,
      reply.reply_key,
      reply.reply_author || null,
      reply.reply_content || null,
      reply.reply_time || null,
      reply.floor_no || null,
      reply.source_url || null,
      reply.notified,
    ) as TopicReply | null;
  }

  getTopicRepliesByTopicId(trackedTopicId: number): TopicReply[] {
    const stmt = this.db.query(`
      SELECT * FROM topic_replies
      WHERE tracked_topic_id = ?
      ORDER BY created_at ASC
    `);
    return stmt.all(trackedTopicId) as TopicReply[];
  }

  markTopicRepliesNotified(replyIds: number[]): void {
    if (replyIds.length === 0) return;

    const placeholders = replyIds.map(() => '?').join(',');
    const stmt = this.db.query(`
      UPDATE topic_replies
      SET notified = 1
      WHERE id IN (${placeholders})
    `);
    stmt.run(...replyIds);
  }

  // 数据库初始化检查：只要用户存在即视为已初始化
  isInitialized(): boolean {
    try {
      const config = this.getBaseConfig();
      return config !== null;
    } catch (error) {
      return false;
    }
  }

  // 统计查询方法（使用 COUNT 提高效率和缓存）
  getPostsCount(): number {
    const cacheKey = this.getCacheKey('getPostsCount', []);
    const cached = this.getFromCache<number>(cacheKey);
    if (cached !== null) return cached;

    const stmt = this.db.query(`
      SELECT COUNT(*) as count FROM posts
    `);
    const result = stmt.get() as { count: number };
    const count = result?.count || 0;
    this.setCache(cacheKey, count, 30000); // 30秒缓存
    return count;
  }

  getPostsCountByStatus(pushStatus: number): number {
    const cacheKey = this.getCacheKey('getPostsCountByStatus', [pushStatus]);
    const cached = this.getFromCache<number>(cacheKey);
    if (cached !== null) return cached;

    const stmt = this.db.query(`
      SELECT COUNT(*) as count FROM posts
      WHERE push_status = ?
    `);
    const result = stmt.get(pushStatus) as { count: number };
    const count = result?.count || 0;
    this.setCache(cacheKey, count, 30000); // 30秒缓存
    return count;
  }

  getSubscriptionsCount(): number {
    const cacheKey = this.getCacheKey('getSubscriptionsCount', []);
    const cached = this.getFromCache<number>(cacheKey);
    if (cached !== null) return cached;

    const stmt = this.db.query(`SELECT COUNT(*) as count FROM keywords_sub`);
    const result = stmt.get() as { count: number };
    const count = result?.count || 0;
    this.setCache(cacheKey, count, 60000); // 1分钟缓存（关键词变化较少）
    return count;
  }

  getTodayPostsCount(): number {
    const cacheKey = this.getCacheKey('getTodayPostsCount', []);
    const cached = this.getFromCache<number>(cacheKey);
    if (cached !== null) return cached;

    // 从当天 0 点（UTC）开始
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const todayStart = today.toISOString().replace('T', ' ').substring(0, 19);

    const stmt = this.db.query(`
      SELECT COUNT(*) as count FROM posts
      WHERE datetime(pub_date) >= datetime(?)
    `);
    const result = stmt.get(todayStart) as { count: number };
    const count = result?.count || 0;
    this.setCache(cacheKey, count, 60000);
    return count;
  }

  getTodayPushedCount(): number {
    const cacheKey = this.getCacheKey('getTodayMatchedCount', []);
    const cached = this.getFromCache<number>(cacheKey);
    if (cached !== null) return cached;

    // 从当天 0 点（UTC）开始
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const todayStart = today.toISOString().replace('T', ' ').substring(0, 19);

    const stmt = this.db.query(`
      SELECT COUNT(*) as count FROM posts
      WHERE push_status IN (1, 3) AND datetime(pub_date) >= datetime(?)
    `);
    const result = stmt.get(todayStart) as { count: number };
    const count = result?.count || 0;
    this.setCache(cacheKey, count, 60000);
    return count;
  }

  getTodayMessagesCount(): number {
    const cacheKey = this.getCacheKey('getTodayMessagesCount', []);
    const cached = this.getFromCache<number>(cacheKey);
    if (cached !== null) return cached;

    // 从当天 0 点（UTC）开始
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const todayStart = today.toISOString().replace('T', ' ').substring(0, 19);

    const stmt = this.db.query(`
      SELECT COUNT(*) as count FROM posts
      WHERE push_status = 3 AND datetime(push_date) >= datetime(?)
    `);
    const result = stmt.get(todayStart) as { count: number };
    const count = result?.count || 0;
    this.setCache(cacheKey, count, 60000);
    return count;
  }

  getPostsCountByDateRange(startDate: string, endDate: string): number {
    const cacheKey = this.getCacheKey('getPostsCountByDateRange', [startDate, endDate]);
    const cached = this.getFromCache<number>(cacheKey);
    if (cached !== null) return cached;
    
    const stmt = this.db.query(`
      SELECT COUNT(*) as count FROM posts 
      WHERE DATE(pub_date) BETWEEN ? AND ?
    `);
    const result = stmt.get(startDate, endDate) as { count: number };
    const count = result?.count || 0;
    this.setCache(cacheKey, count, 60000); // 1分钟缓存
    return count;
  }

  getLastUpdateTime(): string | null {
    const stmt = this.db.query(`
      SELECT created_at as last_update FROM posts order by id desc limit 1
    `);
    const result = stmt.get() as { last_update: string } | null;
    return result?.last_update || null; // 返回最后更新时间
  }

  // 获取综合统计信息
  getComprehensiveStats(): {
    total_posts: number;
    pushed_posts: number; // 已推送成功 (状态 3)
    matched_not_pushed: number; // 已匹配但未推送 (状态 1)
    total_subscriptions: number;
    today_pushed: number;
    today_posts: number;
    last_update: string | null;
  } {
    try {
      const totalPosts = this.getPostsCount();
      const pushedPosts = this.getPostsCountByStatus(3); // 已推送成功
      const matchedNotPushed = this.getPostsCountByStatus(1); // 已匹配但未推送
      const totalSubscriptions = this.getSubscriptionsCount();
      const todayPushed = this.getTodayPushedCount();
      const todayPosts = this.getTodayPostsCount();
      const lastUpdate = this.getLastUpdateTime();

      return {
        total_posts: totalPosts,
        pushed_posts: pushedPosts,
        matched_not_pushed: matchedNotPushed,
        total_subscriptions: totalSubscriptions,
        today_pushed: todayPushed,
        today_posts: todayPosts,
        last_update: lastUpdate
      };
    } catch (error) {
      logger.error('获取综合统计信息失败:', error);
      return {
        total_posts: 0,
        pushed_posts: 0,
        matched_not_pushed: 0,
        total_subscriptions: 0,
        today_pushed: 0,
        today_posts: 0,
        last_update: null
      };
    }
  }

  /**
   * 最近 24 小时发帖趋势：按小时统计过去 24 小时内每小时的发帖数
   * 返回 24 个桶，index 0 = 24h 前，index 23 = 1h 前（时间顺序从左到右）
   */
  getLast24HoursPostStats(): Array<{ hour: number; count: number }> {
    const cacheKey = this.getCacheKey('getLast24HoursPostStats', []);
    const cached = this.getFromCache<Array<{ hour: number; count: number }>>(cacheKey);
    if (cached !== null) return cached;

    // hours_ago: 0=最近1小时, 23=24小时前
    const rows = this.db.query(`
      SELECT
        CAST((julianday('now') - julianday(datetime(pub_date))) * 24 AS INTEGER) AS hours_ago,
        COUNT(*) AS count
      FROM posts
      WHERE datetime(pub_date) >= datetime('now', '-24 hours')
      GROUP BY hours_ago
    `).all() as Array<{ hours_ago: number; count: number }>;

    const countByHoursAgo = new Map<number, number>();
    rows.forEach((r) => {
      const h = Math.max(0, Math.min(23, r.hours_ago));
      countByHoursAgo.set(h, r.count);
    });

    // 转为时间顺序：index 0 = 24h 前，index 23 = 1h 前
    const result = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      count: countByHoursAgo.get(23 - i) || 0,
    }));

    this.setCache(cacheKey, result, 60000);
    return result;
  }

  /**
   * 按小时统计最近 N 天的发帖数量（已弃用，保留供兼容）
   * days=-1 → 仅今日（从 0 点开始）；days=0 → 全部；days>0 → 最近 N 天
   */
  getHourlyPostStats(days: number = 7): Array<{ hour: number; count: number }> {
    const cacheKey = this.getCacheKey('getHourlyPostStats', [days]);
    const cached = this.getFromCache<Array<{ hour: number; count: number }>>(cacheKey);
    if (cached !== null) return cached;

    let rows: Array<{ hour: number; count: number }>;

    if (days === -1) {
      // 仅今日：从当天 0 点（UTC）开始
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const todayStart = today.toISOString().replace('T', ' ').substring(0, 19);

      rows = this.db.query(`
        SELECT CAST(strftime('%H', datetime(pub_date)) AS INTEGER) AS hour, COUNT(*) AS count
        FROM posts
        WHERE datetime(pub_date) >= datetime(?)
        GROUP BY hour
        ORDER BY hour
      `).all(todayStart) as Array<{ hour: number; count: number }>;
    } else if (days === 0) {
      rows = this.db.query(`
        SELECT CAST(strftime('%H', datetime(pub_date)) AS INTEGER) AS hour, COUNT(*) AS count
        FROM posts
        GROUP BY hour
        ORDER BY hour
      `).all() as Array<{ hour: number; count: number }>;
    } else {
      // 最近 N 天：从 N 天前的 0 点开始
      const startDate = new Date();
      startDate.setUTCDate(startDate.getUTCDate() - days);
      startDate.setUTCHours(0, 0, 0, 0);
      const startTime = startDate.toISOString().replace('T', ' ').substring(0, 19);

      rows = this.db.query(`
        SELECT CAST(strftime('%H', datetime(pub_date)) AS INTEGER) AS hour, COUNT(*) AS count
        FROM posts
        WHERE datetime(pub_date) >= datetime(?)
        GROUP BY hour
        ORDER BY hour
      `).all(startTime) as Array<{ hour: number; count: number }>;
    }

    // 填充缺失的小时（保证 0-23 都有值）
    const hourMap = new Map<number, number>();
    rows.forEach(r => hourMap.set(r.hour, r.count));
    const result = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      count: hourMap.get(i) || 0,
    }));

    this.setCache(cacheKey, result, 60000);
    return result;
  }

  /**
   * 统计最近 N 天各分类的帖子数量
   * days=-1 → 仅今日（从 0 点开始）；days=0 → 全部；days>0 → 最近 N 天
   */
  getCategoryDistribution(days: number = 7): Array<{ category: string; count: number }> {
    const cacheKey = this.getCacheKey('getCategoryDistribution', [days]);
    const cached = this.getFromCache<Array<{ category: string; count: number }>>(cacheKey);
    if (cached !== null) return cached;

    let result: Array<{ category: string; count: number }>;

    if (days === -1) {
      // 仅今日：从当天 0 点（UTC）开始
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const todayStart = today.toISOString().replace('T', ' ').substring(0, 19);

      result = this.db.query(`
        SELECT category, COUNT(*) AS count
        FROM posts
        WHERE datetime(pub_date) >= datetime(?)
        GROUP BY category
        ORDER BY count DESC
      `).all(todayStart) as Array<{ category: string; count: number }>;
    } else if (days === 0) {
      result = this.db.query(`
        SELECT category, COUNT(*) AS count
        FROM posts
        GROUP BY category
        ORDER BY count DESC
      `).all() as Array<{ category: string; count: number }>;
    } else {
      // 最近 N 天：从 N 天前的 0 点开始
      const startDate = new Date();
      startDate.setUTCDate(startDate.getUTCDate() - days);
      startDate.setUTCHours(0, 0, 0, 0);
      const startTime = startDate.toISOString().replace('T', ' ').substring(0, 19);

      result = this.db.query(`
        SELECT category, COUNT(*) AS count
        FROM posts
        WHERE datetime(pub_date) >= datetime(?)
        GROUP BY category
        ORDER BY count DESC
      `).all(startTime) as Array<{ category: string; count: number }>;
    }

    this.setCache(cacheKey, result, 60000);
    return result;
  }


  // 关闭数据库连接
  close(): void {
    this.db.close();
  }
}
