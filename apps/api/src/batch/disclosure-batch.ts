/**
 * 공시 배치 작업
 *
 * 실행 주기: 5분마다
 * 작업: OpenDART에서 새 공시 수집 및 분류
 */

import type { Env } from '../types';
import { DisclosureEngine } from '../engines';

export async function runDisclosureBatch(
  env: Env
): Promise<{ success: boolean; processed: number; errors: string[] }> {
  const startedAt = new Date().toISOString();
  const batchId = await startBatchLog(env.DB, 'disclosure', startedAt);

  try {
    const engine = new DisclosureEngine(env);
    const result = await engine.pollNewDisclosures();

    await finishBatchLog(env.DB, batchId, {
      status: result.errors.length > 0 ? 'partial' : 'success',
      items_processed: result.processed,
      items_failed: result.skipped,
      error_message: result.errors.length > 0 ? result.errors.join('; ') : null,
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
