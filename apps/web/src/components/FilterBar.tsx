'use client';

import type { DisclosureCategory } from '@onejellyinvest/shared';
import { DISCLOSURE_CATEGORIES } from '@onejellyinvest/shared';

interface FilterBarProps {
  selectedType: 'all' | 'disclosure' | 'news';
  selectedCategory: DisclosureCategory | null;
  onTypeChange: (type: 'all' | 'disclosure' | 'news') => void;
  onCategoryChange: (category: DisclosureCategory | null) => void;
}

const TYPE_OPTIONS: { value: 'all' | 'disclosure' | 'news'; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'disclosure', label: '공시' },
  { value: 'news', label: '뉴스' },
];

const CATEGORY_OPTIONS: { value: DisclosureCategory; label: string }[] =
  DISCLOSURE_CATEGORIES.map((category) => ({
    value: category,
    label: category,
  }));

export default function FilterBar({
  selectedType,
  selectedCategory,
  onTypeChange,
  onCategoryChange,
}: FilterBarProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
      {/* Type filters */}
      <div className="mb-4">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          타입 필터
        </h3>
        <div className="flex flex-wrap gap-2">
          {TYPE_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => onTypeChange(option.value)}
              className={`filter-chip ${
                selectedType === option.value
                  ? 'filter-chip-active'
                  : 'filter-chip-inactive'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Category filters */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          공시 카테고리
        </h3>
        <div className="flex flex-wrap gap-2">
          {CATEGORY_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() =>
                onCategoryChange(selectedCategory === option.value ? null : option.value)
              }
              className={`filter-chip ${
                selectedCategory === option.value
                  ? 'filter-chip-active'
                  : 'filter-chip-inactive'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Clear filters */}
      {(selectedType !== 'all' || selectedCategory) && (
        <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
          <button
            onClick={() => {
              onTypeChange('all');
              onCategoryChange(null);
            }}
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          >
            필터 초기화
          </button>
        </div>
      )}
    </div>
  );
}
