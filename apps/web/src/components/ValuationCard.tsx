'use client';

import Link from 'next/link';
import type { BandLabel } from '@onejellyinvest/shared';
import { getBandLabel } from '@onejellyinvest/shared';
import LabelBadge from './LabelBadge';
import type { ValuationView } from '@/lib/api';

interface ValuationCardProps {
  item: ValuationView;
}

function formatMetric(value: number | null): string {
  if (value == null) return '-';
  return value.toFixed(1);
}

export default function ValuationCard({ item }: ValuationCardProps) {
  const bandLabel: BandLabel | null =
    item.valuation_score != null ? getBandLabel(item.valuation_score) : null;

  return (
    <Link href={`/company/${item.corp_code}`} className="block">
      <div className="card mb-4 hover:shadow-lg transition-shadow">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <span className="font-semibold text-gray-900 dark:text-white">
              {item.corp_name}
            </span>
            <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
              {item.stock_code}
            </span>
          </div>
          <LabelBadge label={bandLabel} />
        </div>

        {/* Overall label */}
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
          {item.overall_label}
        </p>

        {/* Key metrics */}
        <div className="grid grid-cols-4 gap-2 text-center">
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400">PER</div>
            <div className="text-sm font-medium text-gray-900 dark:text-white">
              {formatMetric(item.metrics.per_ttm.value)}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400">PBR</div>
            <div className="text-sm font-medium text-gray-900 dark:text-white">
              {formatMetric(item.metrics.pbr.value)}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400">ROE</div>
            <div className="text-sm font-medium text-gray-900 dark:text-white">
              {formatMetric(item.metrics.roe_ttm.value)}%
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400">OPM</div>
            <div className="text-sm font-medium text-gray-900 dark:text-white">
              {formatMetric(item.metrics.opm_ttm.value)}%
            </div>
          </div>
        </div>

        {/* Peer group */}
        {item.peer_name && (
          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              업종: {item.peer_name}
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}
