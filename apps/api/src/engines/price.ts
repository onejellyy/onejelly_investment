/**
 * KRX 일별 시세 수집 엔진
 *
 * - KRX OpenAPI 또는 공개 CSV/HTML 데이터 소스 사용
 * - 날짜 단위로 전체 종목 시세를 수집하여 price_daily에 저장
 * - 공개 소스는 CSV/HTML 테이블 형식 지원
 */

import type { Env, PriceDaily } from '../types';

interface KRXApiRow {
  ISU_SRT_CD?: string; // 종목코드
  ISU_NM?: string;
  TDD_CLSPRC?: string; // 종가
  CMPPREVDD_PRC?: string; // 전일대비
  FLUC_RT?: string; // 등락률
  ACC_TRDVOL?: string; // 거래량
  ACC_TRDVAL?: string; // 거래대금
  MKTCAP?: string; // 시가총액
}

interface KRXApiResponse {
  OutBlock_1?: KRXApiRow[];
}

type PublicTableRow = string[];
type PublicHeaderIndex = {
  stock_code?: number;
  corp_name?: number;
  trade_date?: number;
  open_price?: number;
  high_price?: number;
  low_price?: number;
  close_price?: number;
  volume?: number;
  market_cap?: number;
};

function parseNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const cleaned = value.replace(/[,\s]/g, '').replace(/[^\d.-]/g, '');
  if (!cleaned || cleaned === '-' || cleaned === '.') return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function toTradeDate(value?: string): string | null {
  if (!value) return null;
  if (/^\d{8}$/.test(value)) {
    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  if (/^\d{4}[./]\d{2}[./]\d{2}$/.test(value)) {
    return value.replace(/[./]/g, '-');
  }
  return null;
}

function normalizeHeader(value: string): string {
  return value
    .replace(/\uFEFF/g, '')
    .replace(/\s+/g, '')
    .replace(/[()]/g, '')
    .replace(/[^\w가-힣]/g, '')
    .toLowerCase();
}

function buildHeaderIndex(headers: string[]): PublicHeaderIndex {
  const headerIndex: PublicHeaderIndex = {};
  const aliases: Record<keyof PublicHeaderIndex, string[]> = {
    stock_code: ['종목코드', '단축코드', '코드', 'isusrtcd', 'isucd', '표준코드'],
    corp_name: ['종목명', '종목', 'isunm', 'isu_nm'],
    trade_date: ['일자', '거래일', 'trddd', 'trdd', '기준일'],
    open_price: ['시가', '시가원', 'opnprc', 'tddopnprc'],
    high_price: ['고가', '고가원', 'hgprc', 'tddhgprc'],
    low_price: ['저가', '저가원', 'lwprc', 'tddlwprc'],
    close_price: ['종가', '현재가', 'clsprc', 'tddclsprc'],
    volume: ['거래량', '거래량주', 'acc_trdvol'],
    market_cap: ['시가총액', '시가총액원', 'mktcap', 'mkcap'],
  };

  const normalized = headers.map((header) => normalizeHeader(header));

  for (const [key, values] of Object.entries(aliases) as [keyof PublicHeaderIndex, string[]][]) {
    for (const alias of values) {
      const normalizedAlias = normalizeHeader(alias);
      const index = normalized.findIndex((header) => header === normalizedAlias);
      if (index >= 0) {
        headerIndex[key] = index;
        break;
      }
    }
  }

  return headerIndex;
}

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  result.push(current);
  return result.map((value) => value.trim());
}

function parseCsv(text: string): PublicTableRow[] {
  const cleaned = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/^\uFEFF/, '');
  const lines = cleaned.split('\n').filter((line) => line.trim().length > 0);
  return lines.map((line) => splitCsvLine(line));
}

const DEFAULT_REFERER = 'https://data.krx.co.kr/contents/MDC/MDI/mdiLoader';

function decodeKrxCsv(buffer: ArrayBuffer): string {
  try {
    return new TextDecoder('euc-kr').decode(buffer);
  } catch {
    return new TextDecoder('utf-8').decode(buffer);
  }
}

function buildOtpPayload(url: URL): Record<string, string> {
  const payload: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    payload[key] = value;
  });
  return payload;
}

export class PriceEngine {
  private env: Env;

  constructor(env: Env) {
    this.env = env;
  }

  /**
   * 날짜 기준 전체 시세 조회
   *
   * 환경 변수:
   * - KRX_SOURCE: 'public' | 'api' (기본: API 키 있으면 api, 없으면 public)
   * - KRX_KOSPI_API_URL: OpenAPI URL
   * - KRX_KOSDAQ_API_URL: OpenAPI URL
   * - KRX_API_KEY: OpenAPI 키
   * - KRX_PUBLIC_KOSPI_URL: 공개 데이터 CSV/HTML URL (날짜 치환 {date} 지원)
   * - KRX_PUBLIC_KOSDAQ_URL: 공개 데이터 CSV/HTML URL (날짜 치환 {date} 지원)
   */
  async fetchDailyPrices(date: string): Promise<PriceDaily[]> {
    if (this.env.KRX_USE_MOCK === '1') {
      return this.generateMockPrices(date);
    }

    const source = this.resolveSource();

    if (source === 'api') {
      if (!this.env.KRX_KOSPI_API_URL || !this.env.KRX_KOSDAQ_API_URL) {
        throw new Error('KRX_KOSPI_API_URL and KRX_KOSDAQ_API_URL are required');
      }
      if (!this.env.KRX_API_KEY) {
        throw new Error('KRX_API_KEY is required');
      }

      const [kospiRows, kosdaqRows] = await Promise.all([
        this.fetchMarket(this.env.KRX_KOSPI_API_URL, date),
        this.fetchMarket(this.env.KRX_KOSDAQ_API_URL, date),
      ]);

      const rows = [...kospiRows, ...kosdaqRows];

      return rows
        .map((row) => this.mapRowToPriceDaily(row, date))
        .filter((row): row is PriceDaily => row !== null);
    }

    return this.fetchPublicDailyPrices(date);
  }

  private async fetchMarket(baseUrl: string, date: string): Promise<KRXApiRow[]> {
    const url = baseUrl.includes('{date}')
      ? baseUrl.replace('{date}', date.replace(/-/g, ''))
      : `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}basDd=${date.replace(/-/g, '')}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'OneJellyInvest/1.0',
        'Accept': 'application/json',
        'AUTH_KEY': this.env.KRX_API_KEY || '',
      },
    });

    if (!response.ok) {
      throw new Error(`KRX API error: ${response.status}`);
    }

    const json = (await response.json()) as KRXApiResponse;
    return Array.isArray(json.OutBlock_1) ? json.OutBlock_1 : [];
  }

  private resolveSource(): 'api' | 'public' {
    const source = (this.env as { KRX_SOURCE?: string }).KRX_SOURCE;
    if (source === 'api' || source === 'public') return source;
    return this.env.KRX_API_KEY ? 'api' : 'public';
  }

  private async fetchPublicDailyPrices(date: string): Promise<PriceDaily[]> {
    const kospiUrl = (this.env as { KRX_PUBLIC_KOSPI_URL?: string }).KRX_PUBLIC_KOSPI_URL;
    const kosdaqUrl = (this.env as { KRX_PUBLIC_KOSDAQ_URL?: string }).KRX_PUBLIC_KOSDAQ_URL;

    if (!kospiUrl || !kosdaqUrl) {
      throw new Error('KRX_PUBLIC_KOSPI_URL and KRX_PUBLIC_KOSDAQ_URL are required');
    }

    const [kospiRows, kosdaqRows] = await Promise.all([
      this.fetchPublicMarket(kospiUrl, date),
      this.fetchPublicMarket(kosdaqUrl, date),
    ]);

    // 시장 구분 태깅
    for (const row of kospiRows) row.market = 'KOSPI';
    for (const row of kosdaqRows) row.market = 'KOSDAQ';

    return [...kospiRows, ...kosdaqRows];
  }

  private async fetchPublicMarket(baseUrl: string, date: string): Promise<PriceDaily[]> {
    const normalized = baseUrl.includes('{date}')
      ? baseUrl.replace('{date}', date.replace(/-/g, ''))
      : baseUrl;

    let url: URL;
    try {
      url = new URL(normalized);
    } catch {
      throw new Error(`Invalid KRX public URL: ${normalized}`);
    }

    const otpPayload = buildOtpPayload(url);
    if (!otpPayload.trdDd) {
      otpPayload.trdDd = date.replace(/-/g, '');
    }

    const otpResponse = await fetch(url.origin + url.pathname, {
      method: 'POST',
      headers: {
        'User-Agent': 'OneJellyInvest/1.0',
        'Accept': 'text/plain,*/*',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Referer': DEFAULT_REFERER,
      },
      body: new URLSearchParams(otpPayload),
    });

    if (!otpResponse.ok) {
      throw new Error(`KRX OTP error: ${otpResponse.status}`);
    }

    const otp = (await otpResponse.text()).trim();
    if (!otp) {
      throw new Error('KRX OTP response empty');
    }

    const downloadUrl = `${url.origin}/comm/fileDn/download_csv/download.cmd`;
    const downloadResponse = await fetch(downloadUrl, {
      method: 'POST',
      headers: {
        'User-Agent': 'OneJellyInvest/1.0',
        'Accept': 'text/csv, application/vnd.ms-excel, */*',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Referer': DEFAULT_REFERER,
      },
      body: new URLSearchParams({ code: otp }),
    });

    if (!downloadResponse.ok) {
      throw new Error(`KRX download error: ${downloadResponse.status}`);
    }

    const buffer = await downloadResponse.arrayBuffer();
    const text = decodeKrxCsv(buffer);
    const table = parseCsv(text);

    if (table.length === 0) return [];

    let headerRowIndex = 0;
    let headerIndex = buildHeaderIndex(table[0]);

    if (headerIndex.stock_code === undefined || headerIndex.close_price === undefined) {
      for (let i = 1; i < Math.min(table.length, 10); i += 1) {
        const candidate = buildHeaderIndex(table[i]);
        if (candidate.stock_code !== undefined && candidate.close_price !== undefined) {
          headerIndex = candidate;
          headerRowIndex = i;
          break;
        }
      }
    }

    const rows = table.slice(headerRowIndex + 1);

    return rows
      .map((row) => this.mapPublicRowToPriceDaily(row, headerIndex, date))
      .filter((row): row is PriceDaily => row !== null);
  }

  private mapRowToPriceDaily(row: KRXApiRow, fallbackDate: string): PriceDaily | null {
    const stockCode = row.ISU_SRT_CD;
    const tradeDate = toTradeDate(fallbackDate) || fallbackDate;

    if (!stockCode || !tradeDate) return null;

    return {
      id: `${stockCode}_${tradeDate}`,
      stock_code: stockCode,
      trade_date: tradeDate,
      open_price: null,
      high_price: null,
      low_price: null,
      close_price: parseNumber(row.TDD_CLSPRC),
      volume: parseNumber(row.ACC_TRDVOL),
      market_cap: parseNumber(row.MKTCAP),
      created_at: new Date().toISOString(),
      corp_name: row.ISU_NM || undefined,
    };
  }

  private mapPublicRowToPriceDaily(
    row: PublicTableRow,
    headerIndex: PublicHeaderIndex,
    fallbackDate: string
  ): PriceDaily | null {
    const stockCode = headerIndex.stock_code !== undefined
      ? row[headerIndex.stock_code]?.trim()
      : undefined;
    const tradeDateValue = headerIndex.trade_date !== undefined
      ? row[headerIndex.trade_date]?.trim()
      : undefined;
    const tradeDate = toTradeDate(tradeDateValue) || toTradeDate(fallbackDate) || fallbackDate;

    if (!stockCode || !tradeDate) return null;

    const openPrice = headerIndex.open_price !== undefined
      ? parseNumber(row[headerIndex.open_price])
      : null;
    const highPrice = headerIndex.high_price !== undefined
      ? parseNumber(row[headerIndex.high_price])
      : null;
    const lowPrice = headerIndex.low_price !== undefined
      ? parseNumber(row[headerIndex.low_price])
      : null;
    const closePrice = headerIndex.close_price !== undefined
      ? parseNumber(row[headerIndex.close_price])
      : null;
    const volume = headerIndex.volume !== undefined
      ? parseNumber(row[headerIndex.volume])
      : null;
    const marketCap = headerIndex.market_cap !== undefined
      ? parseNumber(row[headerIndex.market_cap])
      : null;

    if (closePrice === null) return null;

    const corpName = headerIndex.corp_name !== undefined
      ? row[headerIndex.corp_name]?.trim()
      : undefined;

    return {
      id: `${stockCode}_${tradeDate}`,
      stock_code: stockCode,
      trade_date: tradeDate,
      open_price: openPrice,
      high_price: highPrice,
      low_price: lowPrice,
      close_price: closePrice,
      volume,
      market_cap: marketCap,
      created_at: new Date().toISOString(),
      corp_name: corpName || undefined,
    };
  }

  /**
   * 로컬 개발용 Mock 가격 생성
   * - 종목코드 기반으로 결정적 가격 생성
   * - 운영 환경에서는 사용 금지 (KRX_USE_MOCK=1일 때만 동작)
   */
  private async generateMockPrices(date: string): Promise<PriceDaily[]> {
    const tradeDate = toTradeDate(date) || date;
    const corps = await this.env.DB
      .prepare(
        `SELECT stock_code
         FROM corp_master
         WHERE is_active = 1 AND stock_code IS NOT NULL`
      )
      .all<{ stock_code: string }>();

    if (!corps.results) return [];

    return corps.results.map((corp) => {
      const base = this.simpleHash(corp.stock_code) % 50000;
      const close = 1000 + base;
      const open = close - (base % 200);
      const high = close + (base % 300);
      const low = close - (base % 250);

      return {
        id: `${corp.stock_code}_${tradeDate}`,
        stock_code: corp.stock_code,
        trade_date: tradeDate,
        open_price: open,
        high_price: high,
        low_price: low,
        close_price: close,
        volume: 100000 + (base * 3),
        market_cap: null,
        created_at: new Date().toISOString(),
      };
    });
  }

  private simpleHash(input: string): number {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return Math.abs(hash);
  }
}
