'use client';

import { useState, useEffect, useCallback } from 'react';
import type { DisclosureCategory } from '@onejellyinvest/shared';
import FeedCard from '@/components/FeedCard';
import FilterBar from '@/components/FilterBar';
import { api, type FeedItem } from '@/lib/api';

function SkeletonCard() {
  return (
    <div className="card mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="skeleton h-5 w-16 rounded-full" />
        <div className="skeleton h-4 w-20" />
      </div>
      <div className="skeleton h-4 w-32 mb-2" />
      <div className="skeleton h-5 w-full mb-2" />
      <div className="skeleton h-5 w-3/4 mb-3" />
      <div className="skeleton h-4 w-48" />
    </div>
  );
}

export default function FeedPage() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<'all' | 'disclosure' | 'news'>('all');
  const [selectedCategory, setSelectedCategory] = useState<DisclosureCategory | null>(null);

  const fetchFeed = useCallback(async (cursor?: string, append = false) => {
    try {
      setLoading(true);
      setError(null);

      const data = await api.getFeed({
        type: selectedType,
        category: selectedCategory || undefined,
        cursor,
        limit: 20,
      });

      if (!data.success || !data.data) {
        throw new Error(data.error || 'Failed to fetch feed');
      }

      if (append) {
        setItems((prev) => [...prev, ...data.data!.items]);
      } else {
        setItems(data.data!.items);
      }
      setNextCursor(data.data!.next_cursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [selectedType, selectedCategory]);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  const loadMore = () => {
    if (nextCursor && !loading) {
      fetchFeed(nextCursor, true);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          최신 피드
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          공시와 뉴스의 최신 업데이트를 확인하세요
        </p>
      </div>

      <FilterBar
        selectedType={selectedType}
        selectedCategory={selectedCategory}
        onTypeChange={setSelectedType}
        onCategoryChange={setSelectedCategory}
      />

      {error && (
        <div className="error-banner">
          <svg className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--secondary-orange)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <div className="flex-1">
            <p className="text-sm font-medium" style={{ color: 'var(--secondary-orange)' }}>{error}</p>
          </div>
          <button
            onClick={() => fetchFeed()}
            className="btn btn-secondary text-sm px-3 py-1"
          >
            다시 시도
          </button>
        </div>
      )}

      {loading && items.length === 0 ? (
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16">
          <svg className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
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
          <div className="space-y-4">
            {items.map((item) => (
              <FeedCard key={`${item.type}-${item.id}`} item={item} />
            ))}
          </div>

          {nextCursor && (
            <div className="mt-8 text-center">
              <button
                onClick={loadMore}
                disabled={loading}
                className="btn btn-secondary"
              >
                {loading ? '로딩 중...' : '더 보기'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
