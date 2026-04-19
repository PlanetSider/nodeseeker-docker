import type { KeywordSub, Post } from '../../types';

const CATEGORY_NAME_MAP: Record<string, string> = {
    daily: '日常',
    tech: '技术',
    info: '情报',
    review: '测评',
    trade: '交易',
    carpool: '拼车',
    promotion: '推广',
    life: '生活',
    dev: 'Dev',
    photo: '贴图',
    expose: '曝光',
    sandbox: '沙盒',
};

export interface NotificationMessage {
    title: string;
    markdown: string;
    plainText: string;
    richText: string;
    postUrl: string;
}

function getPostBody(post: Post): string {
    return (post.ai_summary || post.article_body || post.memo || '').trim();
}

function truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
        return text;
    }

    return `${text.slice(0, maxLength)}...`;
}

function getCategoryName(category: string): string {
    return CATEGORY_NAME_MAP[category] || category;
}

function sanitizeMarkdownTitle(title: string): string {
    return title
        .replace(/\[/g, '「')
        .replace(/\]/g, '」')
        .replace(/\(/g, '（')
        .replace(/\)/g, '）');
}

export function buildNotificationMessage(post: Post, matchedSub: KeywordSub): NotificationMessage {
    const keywords = [matchedSub.keyword1, matchedSub.keyword2, matchedSub.keyword3]
        .filter((keyword) => keyword && keyword.trim().length > 0)
        .join(' ');

    const keywordsStr = keywords ? `🎯 ${keywords}` : '';
    const creator = matchedSub.creator ? `👤 ${matchedSub.creator}` : '';
    const category = matchedSub.category ? `🗂️ ${getCategoryName(matchedSub.category)}` : '';
    const metaLine = [keywordsStr, creator, category].filter(Boolean).join(' ');
    const postUrl = `https://www.nodeseek.com/post-${post.post_id}-1`;
    const sanitizedTitle = sanitizeMarkdownTitle(post.title);
    const summary = getPostBody(post);
    const summaryBlock = summary ? `\n\n${summary}` : '';
    const richText = [
        metaLine,
        sanitizedTitle,
        summary ? truncateText(summary, 1800) : '',
        postUrl,
    ].filter(Boolean).join('\n\n');

    return {
        title: sanitizedTitle,
        markdown: `**${metaLine}**\n\n**[${sanitizedTitle}](${postUrl})**${summaryBlock}`,
        plainText: `${metaLine}\n\n${sanitizedTitle}\n${summary}\n${postUrl}`.trim(),
        richText,
        postUrl,
    };
}
