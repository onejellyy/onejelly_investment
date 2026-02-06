'use client';

import type { DisclosureCategory } from '@onejellyinvest/shared';

interface FilingTypeChipProps {
  type: DisclosureCategory;
}

const TYPE_CONFIG: Record<DisclosureCategory, { text: string; className: string }> = {
  '실적': {
    text: '실적',
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  },
  '수주계약': {
    text: '수주/계약',
    className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  },
  '자본': {
    text: '자본',
    className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  },
  '주주가치': {
    text: '주주가치',
    className: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  },
  '지배구조': {
    text: '지배구조',
    className: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
  },
  '리스크': {
    text: '리스크',
    className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  },
  '기타': {
    text: '기타',
    className: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
  },
};

export default function FilingTypeChip({ type }: FilingTypeChipProps) {
  const config = TYPE_CONFIG[type];

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${config.className}`}>
      {config.text}
    </span>
  );
}
