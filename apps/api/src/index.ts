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

// 수동 배치 트리거 엔드포인트
app.post('/api/batch/disclosure', async (c) => {
  const result = await runDisclosureBatch(c.env);
  return c.json({ success: true, result, timestamp: new Date().toISOString() });
});

// 테스트용: 샘플 공시 데이터 삽입
app.post('/api/batch/disclosure/seed', async (c) => {
  const db = c.env.DB;

  const sampleDisclosures = [
    {
      rcept_no: '20250109800175',
      corp_code: '01515323',
      stock_code: '373220',
      corp_name: 'LG에너지솔루션',
      disclosed_at: '2025-01-09',
      category: '실적',
      type: '잠정실적',
      title: '[첨부추가]연결재무제표기준영업(잠정)실적(공정공시)',
      key_json: JSON.stringify({ revenue: 6800000000000, op_profit: 150000000000 }),
      source_url: 'https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20250109800175',
      is_correction: 0,
    },
    {
      rcept_no: '20250108000001',
      corp_code: '00126380',
      stock_code: '005930',
      corp_name: '삼성전자',
      disclosed_at: '2025-01-08',
      category: '실적',
      type: '잠정실적',
      title: '연결재무제표기준영업(잠정)실적(공정공시)',
      key_json: JSON.stringify({ revenue: 75000000000000, op_profit: 6500000000000 }),
      source_url: 'https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20250108000001',
      is_correction: 0,
    },
    {
      rcept_no: '20250107000002',
      corp_code: '00164779',
      stock_code: '000660',
      corp_name: 'SK하이닉스',
      disclosed_at: '2025-01-07',
      category: '수주계약',
      type: '공급계약',
      title: '단일판매·공급계약체결',
      key_json: JSON.stringify({ contract_amount: 2500000000000, contract_ratio: 15.2 }),
      source_url: 'https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20250107000002',
      is_correction: 0,
    },
  ];

  let inserted = 0;
  for (const d of sampleDisclosures) {
    try {
      await db.prepare(
        `INSERT OR IGNORE INTO disclosure
         (rcept_no, corp_code, stock_code, corp_name, disclosed_at, category, type, title, key_json, source_url, is_correction, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      ).bind(
        d.rcept_no, d.corp_code, d.stock_code, d.corp_name, d.disclosed_at,
        d.category, d.type, d.title, d.key_json, d.source_url, d.is_correction
      ).run();
      inserted++;
    } catch (e) {
      // ignore duplicates
    }
  }

  return c.json({
    success: true,
    inserted,
    message: `${inserted}건의 샘플 공시 데이터 삽입 완료`,
    timestamp: new Date().toISOString()
  });
});

app.post('/api/batch/news', async (c) => {
  const result = await runNewsBatch(c.env);
  return c.json({ success: true, result, timestamp: new Date().toISOString() });
});

app.post('/api/batch/valuation', async (c) => {
  const result = await runValuationBatch(c.env);
  return c.json({ success: true, result, timestamp: new Date().toISOString() });
});

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

  /**
   * Cron Trigger 핸들러
   */
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const cronTime = new Date(event.scheduledTime);
    const hour = cronTime.getUTCHours();
    const minute = cronTime.getUTCMinutes();

    console.log(`Cron triggered at ${cronTime.toISOString()}`);

    // 공시 엔진: 매 5분 (*/5)
    if (minute % 5 === 0) {
      ctx.waitUntil(
        runDisclosureBatch(env).then((result) => {
          console.log('Disclosure batch result:', result);
        })
      );
    }

    // 기사 엔진: 매 30분 (*/30)
    if (minute % 30 === 0) {
      ctx.waitUntil(
        runNewsBatch(env).then((result) => {
          console.log('News batch result:', result);
        })
      );
    }

    // 지표 엔진: 매일 07:00 UTC (16:00 KST) - 장마감 후
    if (hour === 7 && minute === 0) {
      ctx.waitUntil(
        runValuationBatch(env).then((result) => {
          console.log('Valuation batch result:', result);
        })
      );
    }
  },
};
