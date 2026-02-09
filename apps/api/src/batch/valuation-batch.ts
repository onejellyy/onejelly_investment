/**
 * 지표 배치 작업
 *
 * 실행 주기: 매일 16:00 KST (07:00 UTC)
 * 작업: 밸류에이션 스냅샷 생성 (PER, PBR, PSR, ROE, OPM 계산)
 */

import type { Env } from '../types';
import { ValuationEngine } from '../engines';

export async function runValuationBatch(
  env: Env
): Promise<{ success: boolean; processed: number; errors: string[] }> {
  const startedAt = new Date().toISOString();
  const batchId = await startBatchLog(env.DB, 'valuation', startedAt);

  try {
    const engine = new ValuationEngine(env);
    const result = await engine.createDailySnapshots();

    await finishBatchLog(env.DB, batchId, {
      status: result.errors.length > 0 ? 'partial' : 'success',
      items_processed: result.processed,
      items_failed: result.errors.length,
      error_message: result.errors.length > 0 ? result.errors.slice(0, 10).join('; ') : null,
    });

    return {
      success: true,
      processed: result.processed,
      errors: result.errors,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);

    try {
      await finishBatchLog(env.DB, batchId, {
        status: 'failed',
        items_processed: 0,
        items_failed: 0,
        error_message: errorMessage.slice(0, 500),
      });
    } catch (logErr) {
      console.error('Failed to update batch log:', logErr);
    }

    return {
      success: false,
      processed: 0,
      errors: [errorMessage],
    };
  }
}

async function startBatchLog(db: D1Database, batchType: string, startedAt: string): Promise<number> {
  const cutoffIso = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  try {
    await db
      .prepare(
        `UPDATE batch_log
         SET finished_at = ?, status = 'failed', error_message = 'stale run: marked failed by next invocation'
         WHERE batch_type = ? AND status = 'running' AND started_at < ?`
      )
      .bind(new Date().toISOString(), batchType, cutoffIso)
      .run();
  } catch (err) {
    console.error('Failed to cleanup stale batch logs:', err);
  }

  const result = await db
    .prepare(
      `INSERT INTO batch_log (batch_type, started_at, status, items_processed, items_failed)
       VALUES (?, ?, 'running', 0, 0)`
    )
    .bind(batchType, startedAt)
    .run();

  return result.meta.last_row_id as number;
}

async function finishBatchLog(
  db: D1Database,
  batchId: number,
  update: {
    status: string;
    items_processed: number;
    items_failed: number;
    error_message: string | null;
  }
): Promise<void> {
  await db
    .prepare(
      `UPDATE batch_log
       SET finished_at = ?, status = ?, items_processed = ?, items_failed = ?, error_message = ?
       WHERE id = ?`
    )
    .bind(
      new Date().toISOString(),
      update.status,
      update.items_processed,
      update.items_failed,
      update.error_message,
      batchId
    )
    .run();
}
