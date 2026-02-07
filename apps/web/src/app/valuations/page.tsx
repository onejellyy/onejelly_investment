'use client';

import { useState, useEffect, useCallback } from 'react';
import type { BandLabel } from '@onejellyinvest/shared';
import { BAND_LABELS } from '@onejellyinvest/shared';
import ValuationCard from '@/components/ValuationCard';
import { api, type ValuationView } from '@/lib/api';

const BAND_OPTIONS: { value: BandLabel | null; label: string }[] = [
  { value: null, label: '전체' },
  { value: BAND_LABELS.TOP, label: BAND_LABELS.TOP },
  { value: BAND_LABELS.GOOD, label: BAND_LABELS.GOOD },
  { value: BAND_LABELS.NEUTRAL, label: BAND_LABELS.NEUTRAL },
  { value: BAND_LABELS.LOW, label: BAND_LABELS.LOW },
  { value: BAND_LABELS.VERY_LOW, label: BAND_LABELS.VERY_LOW },
];

const PAGE_SIZE = 20;

function SkeletonCard() {
  return (
    <div className="card mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="skeleton h-5 w-24" />
          <div className="skeleton h-4 w-16" />
        </div>
        <div className="skeleton h-5 w-12 rounded-full" />
      </div>
      <div className="skeleton h-4 w-full mb-3" />
      <div className="grid grid-cols-4 gap-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <div className="skeleton h-3 w-8" />
            <div className="skeleton h-4 w-10" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ValuationsPage() {
  const [items, setItems] = useState<ValuationView[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [selectedBand, setSelectedBand] = useState<BandLabel | null>(null);

  const fetchValuations = useCallback(async (newOffset: number) => {
    try {
      setLoading(true);
      setError(null);

      const data = await api.getValuations({
        band_label: selectedBand || undefined,
        limit: PAGE_SIZE,
        offset: newOffset,
      });

      if (!data.success || !data.data) {
        throw new Error(data.error || '데이터를 불러오는데 실패했습니다.');
      }

      setItems(data.data.items);
      setTotal(data.data.total);
      setOffset(newOffset);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [selectedBand]);

  useEffect(() => {
    fetchValuations(0);
  }, [fetchValuations]);

  const handleBandChange = (band: BandLabel | null) => {
    setSelectedBand(band);
  };

  const hasMore = offset + PAGE_SIZE < total;
  const hasPrev = offset > 0;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          밸류에이션
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          업종 대비 밸류에이션 지표를 확인하세요
        </p>
      </div>

      {/* Band filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        {BAND_OPTIONS.map((opt) => (
          <button
            key={opt.label}
            onClick={() => handleBandChange(opt.value)}
            className={`filter-chip ${
              selectedBand === opt.value ? 'filter-chip-active' : 'filter-chip-inactive'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="error-banner">
          <svg className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--secondary-orange)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <div className="flex-1">
            <p className="text-sm font-medium" style={{ color: 'var(--secondary-orange)' }}>{error}</p>
          </div>
          <button
            onClick={() => fetchValuations(0)}
            className="btn btn-secondary text-sm px-3 py-1"
          >
            다시 시도
          </button>
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16">
          <svg className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
          </svg>
          <p className="text-gray-500 dark:text-gray-400 font-medium">
            표시할 항목이 없습니다
          </p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
            필터를 변경하거나 잠시 후 다시 확인해보세요
          </p>
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            총 {total}개 종목
          </p>

          <div className="space-y-4">
            {items.map((item) => (
              <ValuationCard key={item.corp_code} item={item} />
            ))}
          </div>

          {/* Pagination */}
          <div className="mt-8 flex justify-center gap-4">
            {hasPrev && (
              <button
                onClick={() => fetchValuations(Math.max(0, offset - PAGE_SIZE))}
                className="btn btn-secondary"
              >
                이전
              </button>
            )}
            {hasMore && (
              <button
                onClick={() => fetchValuations(offset + PAGE_SIZE)}
                className="btn btn-secondary"
              >
                다음
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
