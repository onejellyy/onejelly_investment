'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { getBandLabel } from '@onejellyinvest/shared';
import LabelBadge from '@/components/LabelBadge';
import {
  api,
  type ValuationView,
  type ValuationHistoryEntry,
  type DisclosureListItem,
} from '@/lib/api';

function formatMetric(value: number | null): string {
  if (value == null) return '-';
  return value.toFixed(2);
}

function formatDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toISOString().slice(0, 10);
}

function SkeletonDetail() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header skeleton */}
      <div className="mb-6">
        <div className="flex items-start justify-between mb-2">
          <div>
            <div className="skeleton h-7 w-40 mb-2" />
            <div className="skeleton h-4 w-28" />
          </div>
          <div className="skeleton h-6 w-14 rounded-full" />
        </div>
        <div className="skeleton h-4 w-full mt-2" />
      </div>
      {/* Metrics skeleton */}
      <div className="card mb-6">
        <div className="skeleton h-5 w-32 mb-4" />
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex justify-between py-2">
            <div className="skeleton h-4 w-20" />
            <div className="skeleton h-4 w-12" />
            <div className="skeleton h-4 w-16" />
          </div>
        ))}
      </div>
      {/* Disclosures skeleton */}
      <div className="card mb-6">
        <div className="skeleton h-5 w-24 mb-4" />
        {[...Array(3)].map((_, i) => (
          <div key={i} className="py-3">
            <div className="skeleton h-4 w-full mb-2" />
            <div className="skeleton h-3 w-32" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CompanyDetailPage() {
  const params = useParams<{ corp_code: string }>();
  const corpCode = params.corp_code;

  const [valuation, setValuation] = useState<ValuationView | null>(null);
  const [history, setHistory] = useState<ValuationHistoryEntry[]>([]);
  const [disclosures, setDisclosures] = useState<DisclosureListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = () => {
    if (!corpCode) return;

    setLoading(true);
    setError(null);

    Promise.all([
      api.getValuationDetail(corpCode),
      api.getDisclosures({ corp_code: corpCode, limit: 10 }),
    ])
      .then(([valRes, discRes]) => {
        if (valRes.success && valRes.data) {
          setValuation(valRes.data.current);
          setHistory(valRes.data.history);
        }
        if (discRes.success && discRes.data) {
          setDisclosures(discRes.data.items);
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : '데이터를 불러오는데 실패했습니다.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, [corpCode]);

  if (loading) {
    return <SkeletonDetail />;
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-16">
          <svg className="mx-auto h-12 w-12 mb-4" style={{ color: 'var(--secondary-orange)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <p className="font-medium mb-2" style={{ color: 'var(--secondary-orange)' }}>{error}</p>
          <button onClick={fetchData} className="btn btn-secondary mt-4">
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  if (!valuation) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-16">
          <svg className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-gray-500 dark:text-gray-400 font-medium">
            데이터를 찾을 수 없습니다
          </p>
        </div>
      </div>
    );
  }

  const bandLabel =
    valuation.valuation_score != null
      ? getBandLabel(valuation.valuation_score)
      : null;

  const metrics = [
    { key: 'PER (TTM)', value: valuation.metrics.per_ttm.value, label: valuation.metrics.per_ttm.label },
    { key: 'PBR', value: valuation.metrics.pbr.value, label: valuation.metrics.pbr.label },
    { key: 'PSR (TTM)', value: valuation.metrics.psr_ttm.value, label: valuation.metrics.psr_ttm.label },
    { key: 'ROE (TTM)', value: valuation.metrics.roe_ttm.value, label: valuation.metrics.roe_ttm.label, suffix: '%' },
    { key: 'OPM (TTM)', value: valuation.metrics.opm_ttm.value, label: valuation.metrics.opm_ttm.label, suffix: '%' },
    { key: '부채비율', value: valuation.metrics.debt_ratio.value, label: valuation.metrics.debt_ratio.label, suffix: '%' },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Company header */}
      <div className="mb-6">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {valuation.corp_name}
            </h2>
            <p className="text-gray-500 dark:text-gray-400">
              {valuation.stock_code} · {valuation.market}
            </p>
          </div>
          <LabelBadge label={bandLabel} />
        </div>
        <p className="text-gray-600 dark:text-gray-300">{valuation.overall_label}</p>
        {valuation.peer_name && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            업종: {valuation.peer_name}
          </p>
        )}
      </div>

      {/* Valuation metrics table */}
      <div className="card mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          밸류에이션 지표
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: 'var(--glass-border)' }}>
                <th className="text-left py-2 text-gray-500 dark:text-gray-400">지표</th>
                <th className="text-right py-2 text-gray-500 dark:text-gray-400">값</th>
                <th className="text-right py-2 text-gray-500 dark:text-gray-400">업종 위치</th>
              </tr>
            </thead>
            <tbody>
              {metrics.map((m) => (
                <tr key={m.key} className="border-b" style={{ borderColor: 'var(--glass-border)' }}>
                  <td className="py-2 text-gray-900 dark:text-white">{m.key}</td>
                  <td className="py-2 text-right text-gray-900 dark:text-white">
                    {formatMetric(m.value)}{m.suffix || ''}
                  </td>
                  <td className="py-2 text-right text-gray-500 dark:text-gray-400">
                    {m.label}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Score history (30-day) */}
      {history.length > 0 && (
        <div className="card mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            점수 추이 (최근 30일)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: 'var(--glass-border)' }}>
                  <th className="text-left py-2 text-gray-500 dark:text-gray-400">날짜</th>
                  <th className="text-right py-2 text-gray-500 dark:text-gray-400">점수</th>
                  <th className="text-right py-2 text-gray-500 dark:text-gray-400">구간</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.snap_date} className="border-b" style={{ borderColor: 'var(--glass-border)' }}>
                    <td className="py-2 text-gray-900 dark:text-white">{h.snap_date}</td>
                    <td className="py-2 text-right text-gray-900 dark:text-white">
                      {h.valuation_score}
                    </td>
                    <td className="py-2 text-right text-gray-500 dark:text-gray-400">
                      {h.band_label}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent disclosures */}
      {disclosures.length > 0 && (
        <div className="card mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            최근 공시
          </h3>
          <div className="space-y-3">
            {disclosures.map((d) => (
              <div key={d.rcept_no} className="border-b pb-3 last:border-0" style={{ borderColor: 'var(--glass-border)' }}>
                <a
                  href={d.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm hover:underline"
                  style={{ color: 'var(--primary)' }}
                >
                  {d.title}
                </a>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {d.category}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    {formatDate(d.disclosed_at)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <div className="mt-8 neu-inset p-4">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          본 정보는 투자 조언을 목적으로 하지 않으며, 공시 및 재무 데이터를 정리하여 제공합니다.
          모든 투자 결정은 이용자 본인의 판단과 책임 하에 이루어져야 합니다.
        </p>
      </div>
    </div>
  );
}
