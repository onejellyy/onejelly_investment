// ============================================
// Utility Functions
// ============================================

/**
 * Build DART viewer URL from rcept_no
 */
export function buildDartUrl(rcept_no: string): string {
  return `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${rcept_no}`;
}

/**
 * Check if filing is a correction (정정)
 */
export function isCorrection(rm: string, reportNm: string): boolean {
  return rm.includes('정정') || reportNm.includes('[정정]') || reportNm.includes('(정정)');
}

/**
 * Extract original rcept_no from correction filing (if available)
 * Note: OpenDART doesn't provide direct link, this is for manual reference
 */
export function extractOriginRceptNo(_reportNm: string): string | null {
  // Some corrections mention the original in title, but OpenDART doesn't have API for this
  // Return null as we can't reliably extract it
  return null;
}

/**
 * Format date from YYYYMMDD to YYYY-MM-DD
 */
export function formatDate(yyyymmdd: string): string {
  if (yyyymmdd.length !== 8) return yyyymmdd;
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}

/**
 * Get date N days ago in YYYYMMDD format
 */
export function getDateNDaysAgo(n: number): string {
  const date = new Date();
  date.setDate(date.getDate() - n);
  return date.toISOString().slice(0, 10).replace(/-/g, '');
}

/**
 * Get today's date in YYYYMMDD format
 */
export function getTodayYYYYMMDD(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}

/**
 * Truncate text to max length with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Simple hash function for content change detection
 */
export function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    onRetry?: (attempt: number, error: Error) => void;
  } = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelayMs = 1000,
    maxDelayMs = 10000,
    onRetry,
  } = options;

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxAttempts) {
        throw lastError;
      }

      const delay = Math.min(baseDelayMs * Math.pow(2, attempt - 1), maxDelayMs);

      if (onRetry) {
        onRetry(attempt, lastError);
      }

      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Parse Korean number strings (e.g., "1조 2,345억원" -> number)
 */
export function parseKoreanNumber(str: string): number | null {
  if (!str) return null;

  // Remove whitespace and commas
  let cleaned = str.replace(/[\s,]/g, '');

  let result = 0;

  // Handle 조 (trillion)
  const joMatch = cleaned.match(/(\d+(?:\.\d+)?)조/);
  if (joMatch) {
    result += parseFloat(joMatch[1]) * 1_000_000_000_000;
    cleaned = cleaned.replace(/\d+(?:\.\d+)?조/, '');
  }

  // Handle 억 (hundred million)
  const ukMatch = cleaned.match(/(\d+(?:\.\d+)?)억/);
  if (ukMatch) {
    result += parseFloat(ukMatch[1]) * 100_000_000;
    cleaned = cleaned.replace(/\d+(?:\.\d+)?억/, '');
  }

  // Handle 만 (ten thousand)
  const manMatch = cleaned.match(/(\d+(?:\.\d+)?)만/);
  if (manMatch) {
    result += parseFloat(manMatch[1]) * 10_000;
    cleaned = cleaned.replace(/\d+(?:\.\d+)?만/, '');
  }

  // Handle remaining digits
  const remainingMatch = cleaned.match(/(\d+(?:\.\d+)?)/);
  if (remainingMatch && !joMatch && !ukMatch && !manMatch) {
    result = parseFloat(remainingMatch[1]);
  }

  return result > 0 ? result : null;
}

/**
 * Format number with Korean units
 */
export function formatKoreanNumber(num: number): string {
  if (num >= 1_000_000_000_000) {
    const jo = num / 1_000_000_000_000;
    return `${jo.toFixed(1)}조원`;
  }
  if (num >= 100_000_000) {
    const uk = num / 100_000_000;
    return `${uk.toFixed(0)}억원`;
  }
  if (num >= 10_000) {
    const man = num / 10_000;
    return `${man.toFixed(0)}만원`;
  }
  return `${num.toLocaleString()}원`;
}
