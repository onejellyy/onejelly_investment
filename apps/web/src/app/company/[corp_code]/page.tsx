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

export default function CompanyDetailPage() {
  const params = useParams<{ corp_code: string }>();
  const corpCode = params.corp_code;

  const [valuation, setValuation] = useState<ValuationView | null>(null);
  const [history, setHistory] = useState<ValuationHistoryEntry[]>([]);
  const [disclosures, setDisclosures] = useState<DisclosureListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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
  }, [corpCode]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">로딩 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-lg">
          {error}
        </div>
      </div>
    );
  }

  if (!valuation) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <p className="text-gray-600 dark:text-gray-400">데이터를 찾을 수 없습니다.</p>
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
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-2 text-gray-500 dark:text-gray-400">지표</th>
                <th className="text-right py-2 text-gray-500 dark:text-gray-400">값</th>
                <th className="text-right py-2 text-gray-500 dark:text-gray-400">업종 위치</th>
              </tr>
            </thead>
            <tbody>
              {metrics.map((m) => (
                <tr key={m.key} className="border-b border-gray-100 dark:border-gray-700/50">
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
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 text-gray-500 dark:text-gray-400">날짜</th>
                  <th className="text-right py-2 text-gray-500 dark:text-gray-400">점수</th>
                  <th className="text-right py-2 text-gray-500 dark:text-gray-400">구간</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.snap_date} className="border-b border-gray-100 dark:border-gray-700/50">
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
              <div key={d.rcept_no} className="border-b border-gray-100 dark:border-gray-700/50 pb-3 last:border-0">
                <a
                  href={d.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
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
      <div className="mt-8 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          본 정보는 투자 조언을 목적으로 하지 않으며, 공시 및 재무 데이터를 정리하여 제공합니다.
          모든 투자 결정은 이용자 본인의 판단과 책임 하에 이루어져야 합니다.
        </p>
      </div>
    </div>
  );
}
