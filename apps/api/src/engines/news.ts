import type { Env, NewsArticle } from '../types';

export const TRUSTED_SOURCES = [
  { id: 'yonhap', name: '연합뉴스', rssUrl: 'https://www.yna.co.kr/rss/economy.xml' },
  { id: 'hankyung', name: '한국경제', rssUrl: 'https://www.hankyung.com/feed/finance' },
  { id: 'mk', name: '매일경제', rssUrl: 'https://www.mk.co.kr/rss/50200011/' },
  { id: 'mt', name: '머니투데이', rssUrl: 'http://rss.mt.co.kr/mt_news.xml' },
  { id: 'edaily', name: '이데일리', rssUrl: 'http://rss.edaily.co.kr/stock_news.xml' },
] as const;

const ECONOMY_URL_HINTS = [
  '/economy',
  '/business',
  '/finance',
  '/markets',
  '/market',
  '/stock',
  '/industry',
  '/companies',
  '/economics',
];

const EXCLUDED_URL_HINTS = [
  '/sports',
  '/entertainment',
  '/culture',
  '/life',
  '/travel',
  '/movie',
  '/drama',
  '/k-pop',
  '/music',
];

const ECONOMY_KEYWORDS = [
  '금리',
  '환율',
  '물가',
  'cpi',
  'gdp',
  '고용',
  '실적',
  '매출',
  '영업이익',
  '증시',
  '코스피',
  '코스닥',
  '나스닥',
  '연준',
  '한국은행',
  '채권',
  '원자재',
  '반도체',
  '수출',
  '수주',
  'm&a',
  'ipo',
  '배당',
  '유가',
  '주가',
  '상장',
  '기업',
  '분기',
  '재무',
  '투자',
  '매각',
  '인수',
];

const EXCLUDED_KEYWORDS = [
  '경기',
  '골',
  '득점',
  '선수',
  '감독',
  '리그',
  '우승',
  '드라마',
  '배우',
  '아이돌',
  '컴백',
  '예능',
  '팬미팅',
  '스캔들',
  '앨범',
  '콘서트',
  '시청률',
];

const IMAGE_META_KEYS = [
  'og:image',
  'og:image:url',
  'twitter:image',
  'twitter:image:src',
];

type ParsedRssArticle = {
  url: string;
  title: string;
  published_at: string;
};

type CrawledArticleData = {
  content: string;
  previewImageUrl: string | null;
};

type EconomyJudge = {
  isEconomy: boolean;
  economyScore: number;
};

export class NewsEngine {
  private db: D1Database;
  private ai: Ai;

  constructor(env: Env) {
    this.db = env.DB;
    this.ai = env.AI;
  }

  async fetchNewArticles(options?: { runtimeBudgetMs?: number }): Promise<{ processed: number; skipped: number; errors: string[] }> {
    const result = { processed: 0, skipped: 0, errors: [] as string[] };
    const startedAtMs = Date.now();
    const runtimeBudgetMs = options?.runtimeBudgetMs ?? 25_000;

    for (const source of TRUSTED_SOURCES) {
      try {
        const articles = await this.fetchFromSource(source);

        for (const article of articles) {
          try {
            if (Date.now() - startedAtMs > runtimeBudgetMs) {
              result.errors.push('time_budget_exceeded: stopping early to avoid cron timeout');
              return result;
            }

            if (await this.isDuplicate(article.url)) {
              result.skipped++;
              continue;
            }

            // 1차 빠른 필터: URL/제목 기반으로 명확히 비경제면 크롤 자체를 생략
            const quickScore = this.calculateUrlHintScore(article.url) + this.calculateKeywordScore(article.title);
            if (quickScore <= 0) {
              result.skipped++;
              continue;
            }

            const crawled = await this.crawlArticle(article.url);
            if (!crawled || crawled.content.length < 100) {
              result.skipped++;
              continue;
            }

            const judged = await this.classifyEconomyArticle({ url: article.url, title: article.title, content: crawled.content });

            if (!judged.isEconomy) {
              result.skipped++;
              continue;
            }

            await this.saveArticle({
              url: article.url,
              source: source.name,
              title: article.title,
              published_at: article.published_at,
              preview_image_url: crawled.previewImageUrl,
              category: 'economy',
              hash: this.simpleHash(crawled.content),
              created_at: new Date().toISOString(),
            });

            result.processed++;
          } catch (err) {
            result.errors.push(`${article.url}: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      } catch (err) {
        result.errors.push(`${source.name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return result;
  }

  private async fetchFromSource(
    source: (typeof TRUSTED_SOURCES)[number]
  ): Promise<ParsedRssArticle[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(source.rssUrl, {
        headers: { 'User-Agent': 'OneJellyInvest/1.0' },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`RSS fetch failed: ${response.status}`);
      }

      const text = await response.text();
      if (text.trimStart().startsWith('<!DOCTYPE') || text.trimStart().startsWith('<html')) {
        throw new Error('RSS returned HTML instead of XML');
      }

      return this.parseRssFeed(text);
    } finally {
      clearTimeout(timeout);
    }
  }

  private parseRssFeed(xml: string): ParsedRssArticle[] {
    const items: ParsedRssArticle[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    const titleRegex = /<title><!\[CDATA\[(.*?)\]\]>|<title>(.*?)<\/title>/;
    const linkRegex = /<link>(.*?)<\/link>|<link><!\[CDATA\[(.*?)\]\]>/;
    const pubDateRegex = /<pubDate>(.*?)<\/pubDate>/;

    let match: RegExpExecArray | null;
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

    while ((match = itemRegex.exec(xml)) !== null) {
      const itemXml = match[1];
      const titleMatch = titleRegex.exec(itemXml);
      const linkMatch = linkRegex.exec(itemXml);
      const pubDateMatch = pubDateRegex.exec(itemXml);

      if (!titleMatch || !linkMatch) continue;

      const title = (titleMatch[1] || titleMatch[2] || '').trim();
      const url = (linkMatch[1] || linkMatch[2] || '').trim();
      const pubDateStr = pubDateMatch?.[1] || '';
      const pubDate = new Date(pubDateStr);

      if (!title || !url || Number.isNaN(pubDate.getTime())) continue;
      if (pubDate.getTime() < oneDayAgo) continue;

      items.push({ url, title, published_at: pubDate.toISOString() });
    }

    return items;
  }

  private async isDuplicate(url: string): Promise<boolean> {
    const result = await this.db.prepare('SELECT 1 FROM news_article WHERE url = ? LIMIT 1').bind(url).first();
    return result !== null;
  }

  private async crawlArticle(url: string): Promise<CrawledArticleData | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; OneJellyInvest/1.0; +https://onejellyinvest.com)',
        },
        signal: controller.signal,
      });

      if (!response.ok) return null;

      const html = await response.text();
      return {
        content: this.extractTextFromHtml(html),
        previewImageUrl: this.extractPreviewImageUrl(html, url),
      };
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  private extractTextFromHtml(html: string): string {
    let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    text = text.replace(/<[^>]+>/g, ' ');
    text = text
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#x([0-9a-fA-F]+);/g, (_, n: string) => String.fromCharCode(parseInt(n, 16)))
      .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(parseInt(n, 10)));
    text = text.replace(/\s+/g, ' ').trim();
    return text.slice(0, 15000);
  }

  private extractPreviewImageUrl(html: string, articleUrl: string): string | null {
    for (const key of IMAGE_META_KEYS) {
      const content = this.extractMetaContent(html, key);
      const normalized = this.normalizeImageUrl(content, articleUrl);
      if (normalized) return normalized;
    }

    const firstImage = this.extractFirstContentImage(html, articleUrl);
    return firstImage;
  }

  private extractMetaContent(html: string, key: string): string | null {
    const metaTagRegex = /<meta\s+[^>]*>/gi;
    let tagMatch: RegExpExecArray | null;

    while ((tagMatch = metaTagRegex.exec(html)) !== null) {
      const attrs = this.parseTagAttributes(tagMatch[0]);
      const property = (attrs.property || attrs.name || '').toLowerCase();
      if (property !== key.toLowerCase()) continue;
      const content = attrs.content?.trim();
      if (content) return content;
    }

    return null;
  }

  private parseTagAttributes(tag: string): Record<string, string> {
    const attrs: Record<string, string> = {};
    const attrRegex = /([a-zA-Z_:][\w:.-]*)\s*=\s*("([^"]*)"|'([^']*)')/g;
    let match: RegExpExecArray | null;

    while ((match = attrRegex.exec(tag)) !== null) {
      const key = match[1].toLowerCase();
      const value = (match[3] ?? match[4] ?? '').trim();
      attrs[key] = value;
    }

    return attrs;
  }

  private extractFirstContentImage(html: string, articleUrl: string): string | null {
    const imageRegex = /<img\s+[^>]*>/gi;
    let imageMatch: RegExpExecArray | null;

    while ((imageMatch = imageRegex.exec(html)) !== null) {
      const attrs = this.parseTagAttributes(imageMatch[0]);
      const rawSrc = attrs.src || attrs['data-src'] || attrs['data-original'] || attrs['data-lazy-src'];
      if (!rawSrc) continue;

      const width = this.parsePositiveInt(attrs.width);
      const height = this.parsePositiveInt(attrs.height);

      if (width != null && height != null && (width < 80 || height < 80)) continue;

      const normalized = this.normalizeImageUrl(rawSrc, articleUrl);
      if (!normalized) continue;
      return normalized;
    }

    return null;
  }

  private parsePositiveInt(value: string | undefined): number | null {
    if (!value) return null;
    const parsed = parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return parsed;
  }

  private normalizeImageUrl(rawUrl: string | null, articleUrl: string): string | null {
    if (!rawUrl) return null;

    const trimmed = rawUrl.trim();
    if (!trimmed) return null;

    if (
      trimmed.startsWith('data:') ||
      trimmed.startsWith('javascript:') ||
      trimmed.endsWith('.svg')
    ) {
      return null;
    }

    try {
      const normalized = new URL(trimmed, articleUrl);
      if (!['http:', 'https:'].includes(normalized.protocol)) return null;
      return normalized.toString();
    } catch {
      return null;
    }
  }

  private async classifyEconomyArticle(input: {
    url: string;
    title: string;
    content: string;
  }): Promise<EconomyJudge> {
    const urlHintScore = this.calculateUrlHintScore(input.url);
    const keywordScore = this.calculateKeywordScore(
      `${input.title}\n${input.content.slice(0, 2500)}`
    );
    const economyScore = urlHintScore + keywordScore;

    if (economyScore >= 3) {
      return { isEconomy: true, economyScore };
    }

    if (economyScore <= 0) {
      return { isEconomy: false, economyScore };
    }

    const llmResult = await this.llmEconomyClassifier(input);
    return { isEconomy: llmResult, economyScore };
  }

  private calculateUrlHintScore(url: string): number {
    const lowered = url.toLowerCase();
    let score = 0;

    for (const hint of ECONOMY_URL_HINTS) {
      if (lowered.includes(hint)) score += 2;
    }
    for (const hint of EXCLUDED_URL_HINTS) {
      if (lowered.includes(hint)) score -= 3;
    }

    return score;
  }

  private calculateKeywordScore(text: string): number {
    const lowered = text.toLowerCase();
    let score = 0;

    for (const keyword of ECONOMY_KEYWORDS) {
      if (lowered.includes(keyword.toLowerCase())) score += 1;
    }
    for (const keyword of EXCLUDED_KEYWORDS) {
      if (lowered.includes(keyword.toLowerCase())) score -= 2;
    }

    return score;
  }

  private async llmEconomyClassifier(input: {
    url: string;
    title: string;
    content: string;
  }): Promise<boolean> {
    const prompt = `다음 기사가 경제 기사인지 판정하세요.
출력은 반드시 JSON 한 줄만 반환하세요.
형식: {"isEconomy": true} 또는 {"isEconomy": false}

URL: ${input.url}
제목: ${input.title}
본문 일부: ${input.content.slice(0, 1200)}
`;

    try {
      const response = await this.ai.run('@cf/meta/llama-3-8b-instruct', {
        messages: [
          {
            role: 'system',
            content: '당신은 기사 분류기입니다. 반드시 JSON 한 줄만 출력하세요.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 30,
        temperature: 0,
      });

      const content = (response as { response?: string }).response?.trim() || '';
      const parsed = this.extractJsonBoolean(content);
      return parsed ?? false;
    } catch {
      return false;
    }
  }

  private extractJsonBoolean(raw: string): boolean | null {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) return null;

    try {
      const json = JSON.parse(raw.slice(start, end + 1)) as { isEconomy?: unknown };
      return typeof json.isEconomy === 'boolean' ? json.isEconomy : null;
    } catch {
      return null;
    }
  }

  async saveArticle(article: NewsArticle): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO news_article
         (url, source, title, published_at, preview_image_url, category, hash, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        article.url,
        article.source,
        article.title,
        article.published_at,
        article.preview_image_url,
        article.category,
        article.hash,
        article.created_at
      )
      .run();
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash &= hash;
    }
    return Math.abs(hash).toString(16);
  }
}
