'use client';

import { useState, useEffect, useCallback } from 'react';
import type { DisclosureCategory } from '@onejellyinvest/shared';
import FeedCard from '@/components/FeedCard';
import FilterBar from '@/components/FilterBar';
import { api, type FeedItem } from '@/lib/api';

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
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-lg mb-4">
          {error}
        </div>
      )}

      {loading && items.length === 0 ? (
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
