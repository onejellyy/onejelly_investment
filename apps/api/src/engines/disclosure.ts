/**
 * 공시 엔진 (Disclosure Engine)
 *
 * 기능:
 * - OpenDART API에서 공시 목록 수집
 * - 룰 기반 카테고리 분류 (AI 사용 안 함)
 * - 핵심 수치 추출 (정규식 기반)
 * - 실적 공시 감지 시 재무 업데이트 트리거
 */

import type {
  Env,
  Disclosure,
  DisclosureCategory,
  DisclosureKeyNumbers,
  DartListItem,
  DartListResponse,
} from '../types';

// ============================================
// 카테고리 분류 룰
// ============================================
const CATEGORY_RULES: Record<DisclosureCategory, string[]> = {
  '실적': [
    '사업보고서',
    '분기보고서',
    '반기보고서',
    '잠정실적',
    '매출액',
    '영업이익',
    '실적',
    '연결재무',
    '재무제표',
  ],
  '수주계약': [
    '수주',
    '계약',
    '공급계약',
    '납품',
    '공급',
    '용역계약',
    '라이선스',
  ],
  '자본': [
    '유상증자',
    '무상증자',
    '증자',
    '감자',
    '전환사채',
    'CB',
    'BW',
    '신주인수권',
    '주식매수선택권',
    '신주',
  ],
  '주주가치': [
    '배당',
    '현금배당',
    '자사주',
    '자기주식',
    '주식소각',
    '주주환원',
  ],
  '지배구조': [
    '임원',
    '이사회',
    '주총',
    '주주총회',
    '최대주주',
    '대표이사',
    '감사',
    '사외이사',
  ],
  '리스크': [
    '소송',
    '횡령',
    '배임',
    '감사의견',
    '비적정',
    '상장폐지',
    '관리종목',
    '회생',
    '파산',
    '부도',
    '거래정지',
  ],
  '기타': [],
};

// 공시 유형별 우선순위 (재무 업데이트용)
const SOURCE_PRIORITY: Record<string, number> = {
  '사업보고서': 3,
  '반기보고서': 2,
  '분기보고서': 2,
  '잠정실적': 1,
};

// ============================================
// OpenDART API 클라이언트
// ============================================
export class OpenDartClient {
  private baseUrl = 'https://opendart.fss.or.kr/api';
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async getDisclosureList(params: {
    bgn_de?: string;
    end_de?: string;
    corp_code?: string;
    page_no?: number;
    page_count?: number;
  }): Promise<DartListResponse> {
    const searchParams = new URLSearchParams({
      crtfc_key: this.apiKey,
      page_count: String(params.page_count || 100),
      page_no: String(params.page_no || 1),
    });

    if (params.bgn_de) searchParams.set('bgn_de', params.bgn_de);
    if (params.end_de) searchParams.set('end_de', params.end_de);
    if (params.corp_code) searchParams.set('corp_code', params.corp_code);

    const url = `${this.baseUrl}/list.json?${searchParams}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        },
        redirect: 'follow',
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    // 에러 페이지 리다이렉트 감지
    if (response.url.includes('error')) {
      throw new Error(`OpenDART blocked request. Final URL: ${response.url}`);
    }

    if (!response.ok) {
      throw new Error(`OpenDART API error: ${response.status}`);
    }

    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`Invalid JSON response: ${text.substring(0, 200)}`);
    }
  }

  async getAllRecentDisclosures(
    days: number = 1,
    options?: { maxPages?: number }
  ): Promise<DartListItem[]> {
    const endDate = this.formatDate(new Date());
    const startDate = this.formatDate(new Date(Date.now() - days * 24 * 60 * 60 * 1000));
    return this.getDisclosuresForRange(startDate, endDate, options);
  }

  async getDisclosuresForRange(
    startDate: string,
    endDate: string,
    options?: { maxPages?: number }
  ): Promise<DartListItem[]> {
    const allItems: DartListItem[] = [];
    let pageNo = 1;
    const maxPages = options?.maxPages ?? 10;

    while (pageNo <= maxPages) {
      const response = await this.getDisclosureList({
        bgn_de: startDate,
        end_de: endDate,
        page_no: pageNo,
        page_count: 100,
      });

      if (response.status !== '000') {
        if (response.status === '013') break; // 조회 결과 없음
        throw new Error(`OpenDART error: ${response.message}`);
      }

      allItems.push(...response.list);

      if (pageNo >= response.total_page) break;
      pageNo++;
    }

    return allItems;
  }

  private formatDate(date: Date): string {
    return date.toISOString().slice(0, 10).replace(/-/g, '');
  }
}

// ============================================
// 공시 엔진
// ============================================
export class DisclosureEngine {
  private db: D1Database;
  private dartClient: OpenDartClient;

  constructor(env: Env) {
    this.db = env.DB;
    if (!env.OPENDART_API_KEY) {
      throw new Error('OPENDART_API_KEY is required');
    }
    this.dartClient = new OpenDartClient(env.OPENDART_API_KEY);
  }

  /**
   * 새 공시 수집 및 저장
   */
  async pollNewDisclosures(options?: {
    runtimeBudgetMs?: number;
    maxPages?: number;
  }): Promise<{ processed: number; skipped: number; errors: string[] }> {
    return this.pollDisclosuresForDateRange(undefined, undefined, options);
  }

  /**
   * 특정 날짜 범위의 공시 수집
   */
  async pollDisclosuresForDateRange(
    startDate?: string,
    endDate?: string,
    options?: {
      runtimeBudgetMs?: number;
      maxPages?: number;
    }
  ): Promise<{ processed: number; skipped: number; errors: string[] }> {
    const result = { processed: 0, skipped: 0, errors: [] as string[] };
    const startedAtMs = Date.now();
    const runtimeBudgetMs = options?.runtimeBudgetMs ?? 25_000;
    const maxPages = options?.maxPages ?? 3;

    try {
      const disclosures = startDate && endDate
        ? await this.dartClient.getDisclosuresForRange(startDate, endDate)
        : await this.dartClient.getAllRecentDisclosures(1, { maxPages });

      for (const item of disclosures) {
        try {
          if (Date.now() - startedAtMs > runtimeBudgetMs) {
            result.errors.push('time_budget_exceeded: stopping early to avoid cron timeout');
            break;
          }

          // KRX만 처리 (Y=KOSPI, K=KOSDAQ, N=KONEX)
          if (!this.isKrxCorp(item.corp_cls)) {
            result.skipped++;
            continue;
          }

          // 중복 체크
          if (await this.isDuplicate(item.rcept_no)) {
            result.skipped++;
            continue;
          }

          // FK 제약(disclosure.corp_code -> corp_master.corp_code) 때문에
          // 공시 저장 전에 corp_master를 최소 정보로 시딩한다.
          await this.ensureCorpMaster(item);

          // 분류 및 저장
          const disclosure = this.convertToDisclosure(item);
          await this.saveDisclosure(disclosure);
          result.processed++;

          // 실적 공시면 재무 업데이트 트리거
          if (disclosure.category === '실적') {
            await this.triggerFinancialUpdate(disclosure);
          }
        } catch (err) {
          result.errors.push(`${item.rcept_no}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    } catch (err) {
      result.errors.push(`API error: ${err instanceof Error ? err.message : String(err)}`);
    }

    return result;
  }

  private async ensureCorpMaster(item: DartListItem): Promise<void> {
    try {
      await this.db
        .prepare(
          `INSERT OR IGNORE INTO corp_master (corp_code, stock_code, corp_name, updated_at)
           VALUES (?, ?, ?, datetime('now'))`
        )
        .bind(item.corp_code, item.stock_code || null, item.corp_name)
        .run();
    } catch (err) {
      // 시딩 실패하더라도 공시 저장이 실패할 수 있으므로, 상위에서 에러를 기록하도록 던진다.
      throw err;
    }
  }

  /**
   * KRX 상장 여부 확인 (DART corp_cls 기준)
   */
  private isKrxCorp(corpCls: string): boolean {
    return corpCls === 'Y' || corpCls === 'K' || corpCls === 'N';
  }

  /**
   * 중복 체크 (EXISTS 쿼리로 효율적 처리)
   */
  private async isDuplicate(rceptNo: string): Promise<boolean> {
    const result = await this.db
      .prepare('SELECT 1 FROM disclosure WHERE rcept_no = ? LIMIT 1')
      .bind(rceptNo)
      .first();
    return result !== null;
  }

  /**
   * DART 아이템 → Disclosure 변환
   */
  private convertToDisclosure(item: DartListItem): Disclosure {
    const category = this.classifyCategory(item.report_nm);
    const type = this.extractType(item.report_nm);
    const keyJson = this.extractKeyNumbers(category, item.report_nm);
    const isCorrection = item.rm?.includes('정정') || item.report_nm.includes('[정정]');

    return {
      rcept_no: item.rcept_no,
      corp_code: item.corp_code,
      stock_code: item.stock_code || null,
      corp_name: item.corp_name,
      disclosed_at: this.formatIsoDate(item.rcept_dt),
      category,
      type,
      title: item.report_nm,
      key_json: Object.keys(keyJson).length > 0 ? (keyJson as Record<string, unknown>) : null,
      source_url: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${item.rcept_no}`,
      is_correction: isCorrection,
      created_at: new Date().toISOString(),
    };
  }

  /**
   * 카테고리 분류 (룰 기반)
   */
  classifyCategory(title: string): DisclosureCategory {
    for (const [category, keywords] of Object.entries(CATEGORY_RULES)) {
      if (category === '기타') continue;
      if (keywords.some((kw) => title.includes(kw))) {
        return category as DisclosureCategory;
      }
    }
    return '기타';
  }

  /**
   * 공시 유형 추출
   */
  private extractType(title: string): string {
    // 사업보고서, 분기보고서 등 주요 유형 추출
    const types = [
      '사업보고서',
      '반기보고서',
      '분기보고서',
      '잠정실적',
      '주요사항보고서',
      '공급계약',
      '수주공시',
      '배당결정',
      '증자결정',
      '자기주식취득',
    ];

    for (const type of types) {
      if (title.includes(type)) return type;
    }

    // 괄호 안 유형 추출
    const match = title.match(/\[([^\]]+)\]/);
    if (match) return match[1];

    return '일반공시';
  }

  /**
   * 핵심 수치 추출 (정규식 기반)
   */
  extractKeyNumbers(category: DisclosureCategory, content: string): DisclosureKeyNumbers {
    const numbers: DisclosureKeyNumbers = {};

    switch (category) {
      case '실적':
        // 매출액, 영업이익, 순이익 패턴
        const revenueMatch = content.match(/매출액?\s*[:\s]*([0-9,]+)\s*(조|억)/);
        if (revenueMatch) {
          numbers.revenue = this.parseKoreanAmount(revenueMatch[1], revenueMatch[2]);
        }

        const opMatch = content.match(/영업이익\s*[:\s]*([0-9,]+)\s*(조|억)/);
        if (opMatch) {
          numbers.op_profit = this.parseKoreanAmount(opMatch[1], opMatch[2]);
        }

        // YoY 변동률
        const yoyMatch = content.match(/전년\s*대비\s*([+-]?\d+\.?\d*)\s*%/);
        if (yoyMatch) {
          numbers.revenue_yoy = parseFloat(yoyMatch[1]);
        }
        break;

      case '수주계약':
        const contractMatch = content.match(/계약금액?\s*[:\s]*([0-9,]+)\s*(조|억)/);
        if (contractMatch) {
          numbers.contract_amount = this.parseKoreanAmount(contractMatch[1], contractMatch[2]);
        }

        const ratioMatch = content.match(/매출액?\s*대비\s*([0-9\.]+)\s*%/);
        if (ratioMatch) {
          numbers.contract_ratio = parseFloat(ratioMatch[1]);
        }
        break;

      case '주주가치':
        const dpsMatch = content.match(/주당\s*배당금?\s*[:\s]*([0-9,]+)\s*원/);
        if (dpsMatch) {
          numbers.dividend_per_share = parseInt(dpsMatch[1].replace(/,/g, ''));
        }

        const yieldMatch = content.match(/배당수익률?\s*[:\s]*([0-9\.]+)\s*%/);
        if (yieldMatch) {
          numbers.dividend_yield = parseFloat(yieldMatch[1]);
        }
        break;

      case '자본':
        const capitalMatch = content.match(/([0-9,]+)\s*(조|억)\s*원?\s*(증자|발행)/);
        if (capitalMatch) {
          numbers.capital_amount = this.parseKoreanAmount(capitalMatch[1], capitalMatch[2]);
        }
        break;
    }

    return numbers;
  }

  /**
   * 한글 금액 → 숫자 변환
   */
  private parseKoreanAmount(numStr: string, unit: string): number {
    const num = parseInt(numStr.replace(/,/g, ''));
    switch (unit) {
      case '조':
        return num * 1_000_000_000_000;
      case '억':
        return num * 100_000_000;
      case '만':
        return num * 10_000;
      default:
        return num;
    }
  }

  /**
   * YYYYMMDD → ISO 날짜 변환
   */
  private formatIsoDate(yyyymmdd: string): string {
    return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
  }

  /**
   * 공시 저장
   */
  async saveDisclosure(disclosure: Disclosure): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO disclosure
         (rcept_no, corp_code, stock_code, corp_name, disclosed_at, category, type, title, key_json, source_url, is_correction, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        disclosure.rcept_no,
        disclosure.corp_code,
        disclosure.stock_code,
        disclosure.corp_name,
        disclosure.disclosed_at,
        disclosure.category,
        disclosure.type,
        disclosure.title,
        disclosure.key_json ? JSON.stringify(disclosure.key_json) : null,
        disclosure.source_url,
        disclosure.is_correction ? 1 : 0,
        disclosure.created_at
      )
      .run();
  }

  /**
   * 실적 공시 → 재무 업데이트 트리거
   */
  async triggerFinancialUpdate(disclosure: Disclosure): Promise<void> {
    // 공시 유형에서 분기/연도 추출
    const quarterInfo = this.extractQuarterInfo(disclosure.title, disclosure.disclosed_at);
    if (!quarterInfo) return;

    const { year, quarter, priority } = quarterInfo;
    const id = `${disclosure.corp_code}_${year}Q${quarter}`;

    // 기존 레코드 확인
    const existing = await this.db
      .prepare('SELECT source_priority FROM financial_quarter WHERE id = ?')
      .bind(id)
      .first<{ source_priority: number }>();

    // 우선순위 비교 (기존보다 높거나 같으면 덮어쓰기)
    if (existing && existing.source_priority > priority) {
      return; // 기존이 더 우선순위 높음 → 무시
    }

    // key_json에서 재무 수치 추출
    const keyNumbers = disclosure.key_json as DisclosureKeyNumbers | null;

    await this.db
      .prepare(
        `INSERT OR REPLACE INTO financial_quarter
         (id, corp_code, year, quarter, revenue, op_profit, net_profit, source_rcept_no, source_priority, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        disclosure.corp_code,
        year,
        quarter,
        keyNumbers?.revenue || null,
        keyNumbers?.op_profit || null,
        keyNumbers?.net_profit || null,
        disclosure.rcept_no,
        priority,
        new Date().toISOString()
      )
      .run();

    // TTM 재계산
    await this.recalculateTTM(disclosure.corp_code);
  }

  /**
   * 분기/연도 정보 추출
   */
  private extractQuarterInfo(
    title: string,
    disclosedAt: string
  ): { year: number; quarter: number; priority: number } | null {
    // 연도 추출
    const yearMatch = title.match(/(20\d{2})/);
    const year = yearMatch ? parseInt(yearMatch[1]) : new Date(disclosedAt).getFullYear();

    // 분기 추출
    let quarter = 4;
    let priority = 0;

    if (title.includes('1분기')) {
      quarter = 1;
      priority = SOURCE_PRIORITY['분기보고서'] || 2;
    } else if (title.includes('반기') || title.includes('2분기')) {
      quarter = 2;
      priority = SOURCE_PRIORITY['반기보고서'] || 2;
    } else if (title.includes('3분기')) {
      quarter = 3;
      priority = SOURCE_PRIORITY['분기보고서'] || 2;
    } else if (title.includes('사업보고서')) {
      quarter = 4;
      priority = SOURCE_PRIORITY['사업보고서'] || 3;
    } else if (title.includes('잠정실적')) {
      // 잠정실적은 제목에서 분기 추정
      const qMatch = title.match(/(\d)분기/);
      quarter = qMatch ? parseInt(qMatch[1]) : 4;
      priority = SOURCE_PRIORITY['잠정실적'] || 1;
    } else {
      return null; // 분기 정보 없음
    }

    return { year, quarter, priority };
  }

  /**
   * TTM 재계산
   */
  private async recalculateTTM(corpCode: string): Promise<void> {
    // 최근 4개 분기 조회
    const quarters = await this.db
      .prepare(
        `SELECT revenue, op_profit, net_profit, total_equity, total_debt, shares_outstanding, year, quarter
         FROM financial_quarter
         WHERE corp_code = ?
         ORDER BY year DESC, quarter DESC
         LIMIT 4`
      )
      .bind(corpCode)
      .all<{
        revenue: number | null;
        op_profit: number | null;
        net_profit: number | null;
        total_equity: number | null;
        total_debt: number | null;
        shares_outstanding: number | null;
        year: number;
        quarter: number;
      }>();

    if (!quarters.results || quarters.results.length === 0) return;

    // 4분기 합산
    let revenueTtm = 0;
    let opProfitTtm = 0;
    let netProfitTtm = 0;

    for (const q of quarters.results) {
      if (q.revenue) revenueTtm += q.revenue;
      if (q.op_profit) opProfitTtm += q.op_profit;
      if (q.net_profit) netProfitTtm += q.net_profit;
    }

    const latest = quarters.results[0];

    await this.db
      .prepare(
        `INSERT OR REPLACE INTO financial_ttm
         (corp_code, revenue_ttm, op_profit_ttm, net_profit_ttm, total_equity, total_debt, shares_outstanding, last_quarter_year, last_quarter, calculated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        corpCode,
        revenueTtm || null,
        opProfitTtm || null,
        netProfitTtm || null,
        latest.total_equity,
        latest.total_debt,
        latest.shares_outstanding,
        latest.year,
        latest.quarter,
        new Date().toISOString()
      )
      .run();
  }
}
