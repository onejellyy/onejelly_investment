/**
 * 공시 배치 작업
 *
 * 실행 주기: 1시간마다
 * 작업: OpenDART에서 새 공시 수집 및 분류
 */

import type { Env } from '../types';
import { DisclosureEngine } from '../engines';

export async function runDisclosureBatch(
  env: Env
): Promise<{ success: boolean; processed: number; errors: string[] }> {
  const startedAt = new Date().toISOString();
  // Cron 트리거는 겹쳐 실행될 수 있고, 외부 API 지연으로 런타임이 길어질 수 있다.
  // 너무 오래 걸리면 platform timeout으로 finish 로그가 남지 않으므로, 배치 자체에 시간 제한을 둔다.
  const runtimeBudgetMs = 25_000;
  const batchId = await startBatchLog(env.DB, 'disclosure', startedAt);

  try {
    const engine = new DisclosureEngine(env);
    const result = await engine.pollNewDisclosures({ runtimeBudgetMs });

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
  // 이전 실행이 platform timeout 등으로 끝나지 못하고 running으로 남는 경우가 있어 정리한다.
  // ISO 문자열은 사전순 비교가 가능하므로 started_at < cutoffIso로 안전하게 필터링한다.
  // 공시는 1시간 크론이지만 실제 실행은 수십초 수준이라 15분 이상 running이면 stale로 간주한다.
  const cutoffIso = new Date(Date.now() - 15 * 60 * 1000).toISOString();
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
