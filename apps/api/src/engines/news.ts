/**
 * 기사 엔진 (News Engine)
 *
 * 기능:
 * - 신뢰 가능한 언론사에서 기사 수집
 * - 기사 본문 크롤링
 * - AI로 사실 기반 한 줄 요약 생성 (1회만)
 * - URL 중복 방지
 *
 * 원칙:
 * - 요약에 의견/추정/전망 표현 금지
 * - 기사 원문은 DB 저장 안 함
 * - AI 호출은 1건당 1회, 결과 캐시
 */

import type { Env, NewsArticle } from '../types';

// ============================================
// 신뢰 언론사 목록
// ============================================
export const TRUSTED_SOURCES = [
  { id: 'yonhap', name: '연합뉴스', rssUrl: 'https://www.yna.co.kr/rss/economy.xml' },
  { id: 'hankyung', name: '한국경제', rssUrl: 'https://rss.hankyung.com/feed/stock.xml' },
  { id: 'mk', name: '매일경제', rssUrl: 'https://www.mk.co.kr/rss/50100001/' },
  { id: 'mt', name: '머니투데이', rssUrl: 'https://rss.mt.co.kr/mt_main_news.xml' },
  { id: 'edaily', name: '이데일리', rssUrl: 'https://rss.edaily.co.kr/edaily_economy.xml' },
] as const;

// ============================================
// AI 요약 프롬프트 (의견/추정 금지)
// ============================================
const ONE_LINER_PROMPT = `다음 뉴스 기사를 사실만 담은 한 문장으로 요약하세요.

규칙:
1. 50자 이내로 작성
2. 사실만 기술 (누가, 무엇을, 언제)
3. 다음 표현 절대 금지:
   - "전망이다", "예상된다", "기대된다"
   - "우려된다", "관측된다", "분석된다"
   - "긍정적", "부정적", "호재", "악재"
   - "추천", "매수", "매도", "투자"
   - "상승 전망", "하락 예상"
4. 기자/전문가 의견 제외
5. 숫자는 원문 그대로 유지

제목: {title}
본문: {content}

한 줄 요약:`;

// ============================================
// 기사 엔진
// ============================================
export class NewsEngine {
  private db: D1Database;
  private ai: Ai;

  constructor(env: Env) {
    this.db = env.DB;
    this.ai = env.AI;
  }

  /**
   * 새 기사 수집 및 저장
   */
  async fetchNewArticles(): Promise<{ processed: number; skipped: number; errors: string[] }> {
    const result = { processed: 0, skipped: 0, errors: [] as string[] };

    for (const source of TRUSTED_SOURCES) {
      try {
        const articles = await this.fetchFromSource(source);

        for (const article of articles) {
          try {
            // URL 중복 체크
            if (await this.isDuplicate(article.url)) {
              result.skipped++;
              continue;
            }

            // 본문 크롤링
            const content = await this.crawlContent(article.url);
            if (!content || content.length < 100) {
              result.skipped++;
              continue;
            }

            // AI 한 줄 요약 생성
            const oneLiner = await this.generateOneLiner(article.title, content);

            // 저장
            await this.saveArticle({
              url: article.url,
              source: source.name,
              title: article.title,
              published_at: article.published_at,
              one_liner: oneLiner,
              hash: this.simpleHash(content),
              created_at: new Date().toISOString(),
            });

            result.processed++;
          } catch (err) {
            result.errors.push(
              `${article.url}: ${err instanceof Error ? err.message : String(err)}`
            );
          }
        }
      } catch (err) {
        result.errors.push(
          `${source.name}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    return result;
  }

  /**
   * RSS 피드에서 기사 목록 수집
   */
  private async fetchFromSource(
    source: (typeof TRUSTED_SOURCES)[number]
  ): Promise<{ url: string; title: string; published_at: string }[]> {
    const response = await fetch(source.rssUrl, {
      headers: { 'User-Agent': 'OneJellyInvest/1.0' },
    });

    if (!response.ok) {
      throw new Error(`RSS fetch failed: ${response.status}`);
    }

    const xml = await response.text();
    return this.parseRssFeed(xml);
  }

  /**
   * RSS XML 파싱
   */
  private parseRssFeed(xml: string): { url: string; title: string; published_at: string }[] {
    const items: { url: string; title: string; published_at: string }[] = [];

    // 간단한 정규식 기반 파싱 (Workers 환경에서 DOM 파서 제한)
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    const titleRegex = /<title><!\[CDATA\[(.*?)\]\]>|<title>(.*?)<\/title>/;
    const linkRegex = /<link>(.*?)<\/link>|<link><!\[CDATA\[(.*?)\]\]>/;
    const pubDateRegex = /<pubDate>(.*?)<\/pubDate>/;

    let match;
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000; // 24시간 이내 기사

    while ((match = itemRegex.exec(xml)) !== null) {
      const itemXml = match[1];

      const titleMatch = titleRegex.exec(itemXml);
      const linkMatch = linkRegex.exec(itemXml);
      const pubDateMatch = pubDateRegex.exec(itemXml);

      if (!titleMatch || !linkMatch) continue;

      const title = (titleMatch[1] || titleMatch[2] || '').trim();
      const url = (linkMatch[1] || linkMatch[2] || '').trim();
      const pubDateStr = pubDateMatch?.[1] || '';

      // 24시간 이내 기사만
      const pubDate = new Date(pubDateStr);
      if (pubDate.getTime() < oneDayAgo) continue;

      items.push({
        url,
        title,
        published_at: pubDate.toISOString(),
      });
    }

    return items;
  }

  /**
   * URL 중복 체크
   */
  private async isDuplicate(url: string): Promise<boolean> {
    const result = await this.db
      .prepare('SELECT 1 FROM news_article WHERE url = ? LIMIT 1')
      .bind(url)
      .first();
    return result !== null;
  }

  /**
   * 기사 본문 크롤링
   */
  private async crawlContent(url: string): Promise<string | null> {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (compatible; OneJellyInvest/1.0; +https://onejellyinvest.com)',
        },
      });

      if (!response.ok) return null;

      const html = await response.text();
      return this.extractTextFromHtml(html);
    } catch {
      return null;
    }
  }

  /**
   * HTML에서 텍스트 추출
   */
  private extractTextFromHtml(html: string): string {
    // script, style 태그 제거
    let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

    // HTML 태그 제거
    text = text.replace(/<[^>]+>/g, ' ');

    // HTML 엔티티 디코딩
    text = text
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)));

    // 공백 정리
    text = text.replace(/\s+/g, ' ').trim();

    // 15000자 제한
    return text.slice(0, 15000);
  }

  /**
   * AI 한 줄 요약 생성 (1회만, 캐시됨)
   */
  async generateOneLiner(title: string, content: string): Promise<string> {
    const prompt = ONE_LINER_PROMPT.replace('{title}', title).replace(
      '{content}',
      content.slice(0, 3000)
    );

    try {
      const response = await this.ai.run('@cf/meta/llama-3-8b-instruct', {
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 100,
        temperature: 0.3,
      });

      // response 타입 처리
      const result = response as { response?: string };
      const oneLiner = result.response?.trim() || '';

      // 금지 표현 필터링
      if (this.containsForbiddenExpressions(oneLiner)) {
        return this.sanitizeOneLiner(oneLiner);
      }

      return oneLiner.slice(0, 100); // 100자 제한
    } catch (err) {
      console.error('AI generation failed:', err);
      // 폴백: 제목 그대로 반환
      return title.slice(0, 50);
    }
  }

  /**
   * 금지 표현 포함 여부 체크
   */
  private containsForbiddenExpressions(text: string): boolean {
    const forbidden = [
      '전망',
      '예상',
      '기대',
      '우려',
      '관측',
      '분석',
      '긍정적',
      '부정적',
      '호재',
      '악재',
      '추천',
      '매수',
      '매도',
      '투자의견',
      '상승',
      '하락',
      '급등',
      '급락',
      '폭등',
      '폭락',
    ];

    return forbidden.some((word) => text.includes(word));
  }

  /**
   * 금지 표현 제거
   */
  private sanitizeOneLiner(text: string): string {
    // 의견/전망 부분 제거 시도
    let sanitized = text
      .replace(/[,\s]+(전망|예상|기대|우려).*$/g, '')
      .replace(/.*에\s+따르면[,\s]*/g, '')
      .replace(/.*분석했다.*/g, '')
      .trim();

    // 여전히 금지 표현 포함시 제목 일부만 반환
    if (this.containsForbiddenExpressions(sanitized)) {
      return sanitized.split(/[,.]/).slice(0, 1).join('').trim();
    }

    return sanitized;
  }

  /**
   * 기사 저장
   */
  async saveArticle(article: NewsArticle): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO news_article
         (url, source, title, published_at, one_liner, hash, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        article.url,
        article.source,
        article.title,
        article.published_at,
        article.one_liner,
        article.hash,
        article.created_at
      )
      .run();
  }

  /**
   * 간단한 해시 생성
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }
}
