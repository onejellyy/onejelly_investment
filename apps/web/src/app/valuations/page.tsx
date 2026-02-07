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
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-lg mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">로딩 중...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-600 dark:text-gray-400">
            표시할 항목이 없습니다.
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
