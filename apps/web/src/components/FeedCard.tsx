'use client';

import { DISCLOSURE_CATEGORIES } from '@onejellyinvest/shared';
import type { DisclosureCategory } from '@onejellyinvest/shared';
import FilingTypeChip from './FilingTypeChip';

interface FeedCardProps {
  item: {
    type: 'disclosure' | 'news';
    id: string;
    title: string;
    source: string;
    category: string | null;
    published_at: string;
    summary: string | null;
    url: string;
    stock_code: string | null;
    corp_code: string | null;
  };
}

function isDisclosureCategory(value: string | null): value is DisclosureCategory {
  if (!value) return false;
  return (DISCLOSURE_CATEGORIES as readonly string[]).includes(value);
}

function formatDisplayDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().slice(0, 10);
}

export default function FeedCard({ item }: FeedCardProps) {
  return (
    <div className="card mb-4 hover:shadow-lg transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center flex-wrap gap-2">
          {item.type === 'disclosure' && isDisclosureCategory(item.category) && (
            <FilingTypeChip type={item.category} />
          )}
          {item.type === 'news' && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              뉴스
            </span>
          )}
        </div>
        <span className="text-sm text-gray-500 dark:text-gray-400 flex-shrink-0 ml-2">
          {formatDisplayDate(item.published_at)}
        </span>
      </div>

      {/* Company info */}
      <div className="mb-2">
        <span className="font-semibold text-gray-900 dark:text-white">
          {item.source}
        </span>
        {item.stock_code && (
          <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
            ({item.stock_code})
          </span>
        )}
      </div>

      {/* Title */}
      <h3 className="text-base font-medium text-gray-800 dark:text-gray-200 mb-2 line-clamp-2">
        {item.title}
      </h3>

      {/* Summary */}
      {item.summary && (
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
          {item.summary}
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700">
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          원문 보기 →
        </a>
      </div>
    </div>
  );
}
