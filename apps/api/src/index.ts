/**
 * OneJellyInvest API - Cloudflare Workers Entry Point
 *
 * 한국 주식 정보 앱 (중립적 정보 제공)
 * - 추천/분석/전망 표현 금지
 * - 앱/웹은 읽기 전용
 * - 모든 계산은 배치에서 수행
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from './types';

// 라우트
import { feedRoutes } from './routes/feed';
import { disclosureRoutes } from './routes/disclosure';
import { valuationRoutes } from './routes/valuation';
import { newsRoutes } from './routes/news';
import { healthRoutes } from './routes/health';
import { internalRoutes } from './routes/internal';

// 배치
import { runDisclosureBatch } from './batch/disclosure-batch';
import { runNewsBatch } from './batch/news-batch';
import { runValuationBatch } from './batch/valuation-batch';

// Hono 앱 생성
const app = new Hono<{ Bindings: Env }>();

// CORS 설정
app.use(
  '*',
  cors({
    origin: ['http://localhost:3000', 'https://onejellyinvest.com'],
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    maxAge: 86400,
  })
);

// 라우트 등록
app.route('/api/feed', feedRoutes);
app.route('/api/disclosures', disclosureRoutes);
app.route('/api/valuations', valuationRoutes);
app.route('/api/news', newsRoutes);
app.route('/api/health', healthRoutes);
app.route('/api/internal', internalRoutes);

// 루트 엔드포인트
app.get('/', (c) => {
  return c.json({
    name: 'OneJellyInvest API',
    version: '1.0.0',
    description: '한국 주식 정보 제공 (중립적 정보, 투자 조언 아님)',
    disclaimer: '본 서비스는 투자 조언을 제공하지 않습니다.',
    endpoints: {
      feed: '/api/feed',
      disclosures: '/api/disclosures',
      valuations: '/api/valuations',
      news: '/api/news',
      health: '/api/health',
    },
  });
});

// 수동 배치 트리거 엔드포인트 (인증 필요)
app.post('/api/batch/disclosure', async (c) => {
  if (!verifyBatchAuth(c)) return c.json({ success: false, error: 'Unauthorized' }, 401);
  const result = await runDisclosureBatch(c.env);
  return c.json({ success: true, result, timestamp: new Date().toISOString() });
});

// 테스트용: 샘플 데이터 삽입 (회사 + 공시 + 뉴스)
app.post('/api/batch/seed', async (c) => {
  const db = c.env.DB;
  const results = { corps: 0, disclosures: 0, news: 0, errors: [] as string[] };

  // 1. 샘플 회사 데이터 (corp_master)
  const sampleCorps = [
    { corp_code: '00126380', stock_code: '005930', corp_name: '삼성전자', industry_code: '26', market: 'KOSPI' },
    { corp_code: '00164779', stock_code: '000660', corp_name: 'SK하이닉스', industry_code: '26', market: 'KOSPI' },
    { corp_code: '01515323', stock_code: '373220', corp_name: 'LG에너지솔루션', industry_code: '26', market: 'KOSPI' },
    { corp_code: '00401731', stock_code: '005380', corp_name: '현대차', industry_code: '30', market: 'KOSPI' },
    { corp_code: '00104856', stock_code: '035420', corp_name: 'NAVER', industry_code: '63', market: 'KOSPI' },
    { corp_code: '00220478', stock_code: '035720', corp_name: '카카오', industry_code: '63', market: 'KOSPI' },
    { corp_code: '00155276', stock_code: '051910', corp_name: 'LG화학', industry_code: '20', market: 'KOSPI' },
    { corp_code: '00126186', stock_code: '006400', corp_name: '삼성SDI', industry_code: '26', market: 'KOSPI' },
  ];

  for (const corp of sampleCorps) {
    try {
      await db.prepare(
        `INSERT OR REPLACE INTO corp_master (corp_code, stock_code, corp_name, industry_code, market, updated_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'))`
      ).bind(corp.corp_code, corp.stock_code, corp.corp_name, corp.industry_code, corp.market).run();
      results.corps++;
    } catch (e: any) {
      results.errors.push(`corp ${corp.corp_name}: ${e.message}`);
    }
  }

  // 2. 샘플 공시 데이터
  const sampleDisclosures = [
    {
      rcept_no: '20260206000001', corp_code: '00126380', stock_code: '005930', corp_name: '삼성전자',
      disclosed_at: '2026-02-06', category: '실적', type: '잠정실적',
      title: '연결재무제표기준영업(잠정)실적(공정공시)',
      key_json: JSON.stringify({ revenue: 75000000000000, op_profit: 6500000000000 }),
      source_url: 'https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260206000001',
    },
    {
      rcept_no: '20260205000001', corp_code: '00164779', stock_code: '000660', corp_name: 'SK하이닉스',
      disclosed_at: '2026-02-05', category: '실적', type: '잠정실적',
      title: '연결재무제표기준영업(잠정)실적(공정공시)',
      key_json: JSON.stringify({ revenue: 18500000000000, op_profit: 7200000000000 }),
      source_url: 'https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260205000001',
    },
    {
      rcept_no: '20260204000001', corp_code: '01515323', stock_code: '373220', corp_name: 'LG에너지솔루션',
      disclosed_at: '2026-02-04', category: '수주계약', type: '공급계약',
      title: '단일판매·공급계약체결(자율공시)',
      key_json: JSON.stringify({ contract_amount: 5000000000000, contract_ratio: 18.5 }),
      source_url: 'https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260204000001',
    },
    {
      rcept_no: '20260203000001', corp_code: '00401731', stock_code: '005380', corp_name: '현대차',
      disclosed_at: '2026-02-03', category: '주주가치', type: '배당',
      title: '현금·현물배당결정',
      key_json: JSON.stringify({ dividend_per_share: 8000, dividend_yield: 3.2 }),
      source_url: 'https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260203000001',
    },
    {
      rcept_no: '20260202000001', corp_code: '00104856', stock_code: '035420', corp_name: 'NAVER',
      disclosed_at: '2026-02-02', category: '자본', type: '유상증자',
      title: '유상증자결정',
      key_json: JSON.stringify({ amount: 500000000000, share_count: 2500000 }),
      source_url: 'https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260202000001',
    },
  ];

  for (const d of sampleDisclosures) {
    try {
      await db.prepare(
        `INSERT OR IGNORE INTO disclosure
         (rcept_no, corp_code, stock_code, corp_name, disclosed_at, category, type, title, key_json, source_url, is_correction, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, datetime('now'))`
      ).bind(d.rcept_no, d.corp_code, d.stock_code, d.corp_name, d.disclosed_at, d.category, d.type, d.title, d.key_json, d.source_url).run();
      results.disclosures++;
    } catch (e: any) {
      results.errors.push(`disclosure ${d.rcept_no}: ${e.message}`);
    }
  }

  // 3. 샘플 뉴스 데이터
  const sampleNews = [
    {
      url: 'https://news.example.com/2026020601', stock_code: '005930', corp_name: '삼성전자',
      title: '삼성전자, 4분기 실적 발표... 매출 75조원 기록',
      one_liner: '삼성전자가 2025년 4분기 매출 75조원, 영업이익 6.5조원을 기록했다.',
      source: '한국경제', published_at: '2026-02-06',
    },
    {
      url: 'https://news.example.com/2026020501', stock_code: '000660', corp_name: 'SK하이닉스',
      title: 'SK하이닉스, HBM 수요 급증으로 실적 호조',
      one_liner: 'SK하이닉스가 HBM 수요 증가에 힘입어 4분기 영업이익 7.2조원을 달성했다.',
      source: '매일경제', published_at: '2026-02-05',
    },
    {
      url: 'https://news.example.com/2026020401', stock_code: '373220', corp_name: 'LG에너지솔루션',
      title: 'LG에너지솔루션, 북미 완성차 업체와 5조원 규모 공급계약',
      one_liner: 'LG에너지솔루션이 북미 완성차 업체와 5조원 규모의 배터리 공급계약을 체결했다.',
      source: '조선비즈', published_at: '2026-02-04',
    },
    {
      url: 'https://news.example.com/2026020301', stock_code: '005380', corp_name: '현대차',
      title: '현대차, 주당 8000원 배당 결정',
      one_liner: '현대차가 주당 8000원의 현금배당을 결정했으며 배당수익률은 3.2%이다.',
      source: '서울경제', published_at: '2026-02-03',
    },
    {
      url: 'https://news.example.com/2026020201', stock_code: '035420', corp_name: 'NAVER',
      title: 'NAVER, AI 사업 확대 위해 5000억원 유상증자',
      one_liner: 'NAVER가 AI 사업 투자를 위해 5000억원 규모의 유상증자를 결정했다.',
      source: '한겨레', published_at: '2026-02-02',
    },
  ];

  for (const n of sampleNews) {
    try {
      await db.prepare(
        `INSERT OR IGNORE INTO news_article
         (url, stock_code, corp_name, title, one_liner, source, published_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      ).bind(n.url, n.stock_code, n.corp_name, n.title, n.one_liner, n.source, n.published_at).run();
      results.news++;
    } catch (e: any) {
      results.errors.push(`news ${n.url}: ${e.message}`);
    }
  }

  return c.json({
    success: true,
    results,
    message: `회사 ${results.corps}건, 공시 ${results.disclosures}건, 뉴스 ${results.news}건 삽입 완료`,
    timestamp: new Date().toISOString()
  });
});

app.post('/api/batch/news', async (c) => {
  if (!verifyBatchAuth(c)) return c.json({ success: false, error: 'Unauthorized' }, 401);
  const result = await runNewsBatch(c.env);
  return c.json({ success: true, result, timestamp: new Date().toISOString() });
});

app.post('/api/batch/valuation', async (c) => {
  if (!verifyBatchAuth(c)) return c.json({ success: false, error: 'Unauthorized' }, 401);
  const result = await runValuationBatch(c.env);
  return c.json({ success: true, result, timestamp: new Date().toISOString() });
});

// 배치 엔드포인트 인증 확인
function verifyBatchAuth(c: { req: { header: (name: string) => string | undefined }; env: Env }): boolean {
  const secret = c.env.INTERNAL_API_SECRET;
  if (!secret) return true; // 시크릿 미설정 시 허용 (개발 환경)
  const auth = c.req.header('x-api-secret') || c.req.header('authorization')?.replace('Bearer ', '');
  return auth === secret;
}

// 404 핸들러
app.notFound((c) => {
  return c.json(
    {
      success: false,
      error: 'Not Found',
      timestamp: new Date().toISOString(),
    },
    404
  );
});

// 에러 핸들러
app.onError((err, c) => {
  console.error('API Error:', err);
  return c.json(
    {
      success: false,
      error: err.message || 'Internal Server Error',
      timestamp: new Date().toISOString(),
    },
    500
  );
});

// Export for Workers
export default {
  fetch: app.fetch,

  // Cron Trigger 핸들러
  // event.cron으로 어떤 트리거인지 정확히 구분
  // 기사: 5분마다 | 공시: 1시간마다 | 밸류에이션: 매일 16:00 KST
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const cron = event.cron;
    console.log(`Cron triggered: ${cron} at ${new Date(event.scheduledTime).toISOString()}`);

    // "*/5 * * * *" → 뉴스 (5분마다)
    if (cron === '*/5 * * * *') {
      ctx.waitUntil(
        runNewsBatch(env)
          .then((r) => console.log('News batch:', JSON.stringify(r)))
          .catch((e) => console.error('News batch error:', e))
      );
    }

    // "0 * * * *" → 공시 (1시간마다)
    if (cron === '0 * * * *') {
      ctx.waitUntil(
        runDisclosureBatch(env)
          .then((r) => console.log('Disclosure batch:', JSON.stringify(r)))
          .catch((e) => console.error('Disclosure batch error:', e))
      );
    }

    // "0 7 * * *" → 밸류에이션 (매일 16:00 KST)
    if (cron === '0 7 * * *') {
      ctx.waitUntil(
        runValuationBatch(env)
          .then((r) => console.log('Valuation batch:', JSON.stringify(r)))
          .catch((e) => console.error('Valuation batch error:', e))
      );
    }
  },
};
