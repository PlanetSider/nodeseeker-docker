import { DatabaseService } from './database';
import { escapeHtml, stripHtmlTags } from '../utils/helpers';
import type { Post } from '../types';

function formatRfc2822(dateString?: string): string {
  const date = dateString ? new Date(dateString) : new Date();
  if (Number.isNaN(date.getTime())) {
    return new Date().toUTCString();
  }
  return date.toUTCString();
}

function buildPostUrl(post: Post): string {
  return `https://www.nodeseek.com/post-${post.post_id}-1`;
}

function buildDescription(post: Post): string {
  const raw = post.ai_summary || post.article_body || post.memo || '';
  const text = stripHtmlTags(raw).trim();
  return escapeHtml(text.length > 2000 ? `${text.slice(0, 2000)}...` : text);
}

function buildItemXml(post: Post): string {
  const url = buildPostUrl(post);
  const title = escapeHtml(post.title);
  const description = buildDescription(post);
  const creator = escapeHtml(post.creator);
  const category = escapeHtml(post.category);
  const pubDate = formatRfc2822(post.pub_date);

  return [
    '<item>',
    `<title>${title}</title>`,
    `<link>${url}</link>`,
    `<guid isPermaLink="true">${url}</guid>`,
    `<description><![CDATA[${description}]]></description>`,
    `<dc:creator><![CDATA[${creator}]]></dc:creator>`,
    `<category><![CDATA[${category}]]></category>`,
    `<pubDate>${pubDate}</pubDate>`,
    '</item>',
  ].join('');
}

export class RSSExportService {
  constructor(private dbService: DatabaseService) {}

  private buildFeedXml(params: {
    title: string;
    description: string;
    feedUrl: string;
    siteUrl: string;
    posts: Post[];
  }): string {
    const latestPubDate = params.posts[0]?.pub_date;
    const itemsXml = params.posts.map((post) => buildItemXml(post)).join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title><![CDATA[${params.title}]]></title>
    <link>${params.siteUrl}</link>
    <description><![CDATA[${params.description}]]></description>
    <language>zh-CN</language>
    <generator>NodeSeeker RSS Export</generator>
    <lastBuildDate>${formatRfc2822(latestPubDate)}</lastBuildDate>
    <ttl>10</ttl>
    <atom:link xmlns:atom="http://www.w3.org/2005/Atom" href="${params.feedUrl}" rel="self" type="application/rss+xml" />
    ${itemsXml}
  </channel>
</rss>`;
  }

  buildFullFeed(feedUrl: string, siteUrl: string, limit: number = 50): string {
    const posts = this.dbService.getRecentPosts(limit);
    return this.buildFeedXml({
      title: 'NodeSeeker 全量 RSS',
      description: 'NodeSeeker 最新帖子全量导出 RSS',
      feedUrl,
      siteUrl,
      posts,
    });
  }

  buildSubscriptionFeed(feedUrl: string, siteUrl: string, limit: number = 100): string {
    const result = this.dbService.getPostsWithPagination(1, limit, { pushStatusIn: [1, 3] });
    return this.buildFeedXml({
      title: 'NodeSeeker 订阅 RSS',
      description: 'NodeSeeker 所有已添加关键词订阅命中的帖子 RSS',
      feedUrl,
      siteUrl,
      posts: result.posts,
    });
  }
}
