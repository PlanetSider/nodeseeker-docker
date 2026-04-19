import type { BaseConfig } from '../types';
import { logger } from '../utils/logger';

export class AISummaryService {
    private static readonly DEFAULT_PROMPT = '请阅读下面的帖子正文，输出一段简洁中文总结，控制在 2-4 句话，优先保留核心观点、结论、条件和风险提示。不要输出标题，不要使用 Markdown 列表。';

    getDefaultPrompt(): string {
        return AISummaryService.DEFAULT_PROMPT;
    }

    private extractText(value: unknown): string | undefined {
        if (typeof value === 'string') {
            const trimmed = value.trim();
            return trimmed || undefined;
        }

        if (Array.isArray(value)) {
            const combined = value
                .map((item) => this.extractText(item))
                .filter((item): item is string => !!item)
                .join('\n')
                .trim();

            return combined || undefined;
        }

        if (!value || typeof value !== 'object') {
            return undefined;
        }

        const record = value as Record<string, unknown>;

        const directCandidates = [
            record.text,
            record.output_text,
            record.content,
            record.message,
            record.response,
        ];

        for (const candidate of directCandidates) {
            const extracted = this.extractText(candidate);
            if (extracted) {
                return extracted;
            }
        }

        if (Array.isArray(record.choices)) {
            for (const choice of record.choices) {
                const extracted = this.extractText(choice);
                if (extracted) {
                    return extracted;
                }
            }
        }

        if (Array.isArray(record.output)) {
            for (const output of record.output) {
                const extracted = this.extractText(output);
                if (extracted) {
                    return extracted;
                }
            }
        }

        if (Array.isArray(record.data)) {
            for (const dataItem of record.data) {
                const extracted = this.extractText(dataItem);
                if (extracted) {
                    return extracted;
                }
            }
        }

        return undefined;
    }

    private extractSummaryFromResponse(result: unknown): string | undefined {
        const summary = this.extractText(result);
        if (!summary) {
            return undefined;
        }

        return summary.slice(0, 1000);
    }

    isEnabled(config: BaseConfig | null): boolean {
        return !!(
            config &&
            config.ai_enabled === 1 &&
            config.ai_api_url?.trim() &&
            config.ai_api_key?.trim() &&
            config.ai_model?.trim()
        );
    }

    async summarize(config: BaseConfig, title: string, articleBody: string): Promise<string | undefined> {
        if (!this.isEnabled(config)) {
            return undefined;
        }

        const trimmedBody = articleBody.trim();
        if (!trimmedBody) {
            return undefined;
        }

        const prompt = (config.ai_prompt?.trim() || AISummaryService.DEFAULT_PROMPT);
        const content = `标题: ${title}\n\n正文:\n${trimmedBody.slice(0, 12000)}`;

        try {
            const response = await fetch(config.ai_api_url!.trim(), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    Authorization: `Bearer ${config.ai_api_key!.trim()}`,
                },
                body: JSON.stringify({
                    model: config.ai_model!.trim(),
                    messages: [
                        { role: 'system', content: prompt },
                        { role: 'user', content },
                    ],
                    temperature: 0.3,
                    stream: false,
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            const result = await response.json();
            const summary = this.extractSummaryFromResponse(result);
            if (!summary) {
                logger.warn('AI 接口返回了无法识别的响应结构:', JSON.stringify(result).slice(0, 1000));
                return undefined;
            }

            return summary;
        } catch (error) {
            logger.error('AI 总结生成失败:', error);
            return undefined;
        }
    }
}
