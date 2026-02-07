import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { getBandLabel } from '@onejellyinvest/shared';
import { LabelBadge } from '../../components/LabelBadge';
import { colors } from '../../lib/theme';
import type {
  ValuationView,
  ValuationHistoryEntry,
  DisclosureListItem,
} from '../../lib/api';
import { api } from '../../lib/api';

function formatMetric(value: number | null): string {
  if (value == null) return '-';
  return value.toFixed(2);
}

function formatDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toISOString().slice(0, 10);
}

export default function CompanyDetailScreen() {
  const { corp_code } = useLocalSearchParams<{ corp_code: string }>();

  const [valuation, setValuation] = useState<ValuationView | null>(null);
  const [history, setHistory] = useState<ValuationHistoryEntry[]>([]);
  const [disclosures, setDisclosures] = useState<DisclosureListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!corp_code) return;

    setLoading(true);
    setError(null);

    Promise.all([
      api.getValuationDetail(corp_code),
      api.getDisclosures({ corp_code, limit: 10 }),
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
        setError(
          err instanceof Error
            ? err.message
            : '데이터를 불러오는데 실패했습니다.',
        );
      })
      .finally(() => setLoading(false));
  }, [corp_code]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>로딩 중...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!valuation) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.emptyText}>데이터를 찾을 수 없습니다.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const bandLabel =
    valuation.valuation_score != null
      ? getBandLabel(valuation.valuation_score)
      : null;

  const metricsData = [
    { key: 'PER (TTM)', value: valuation.metrics.per_ttm.value, label: valuation.metrics.per_ttm.label },
    { key: 'PBR', value: valuation.metrics.pbr.value, label: valuation.metrics.pbr.label },
    { key: 'PSR (TTM)', value: valuation.metrics.psr_ttm.value, label: valuation.metrics.psr_ttm.label },
    { key: 'ROE (TTM)', value: valuation.metrics.roe_ttm.value, label: valuation.metrics.roe_ttm.label, suffix: '%' },
    { key: 'OPM (TTM)', value: valuation.metrics.opm_ttm.value, label: valuation.metrics.opm_ttm.label, suffix: '%' },
    { key: '부채비율', value: valuation.metrics.debt_ratio.value, label: valuation.metrics.debt_ratio.label, suffix: '%' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Company header */}
        <View style={styles.headerSection}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.companyName}>{valuation.corp_name}</Text>
              <Text style={styles.stockInfo}>
                {valuation.stock_code} · {valuation.market}
              </Text>
            </View>
            <LabelBadge label={bandLabel} />
          </View>
          <Text style={styles.overallLabel}>{valuation.overall_label}</Text>
          {valuation.peer_name && (
            <Text style={styles.peerName}>업종: {valuation.peer_name}</Text>
          )}
        </View>

        {/* Metrics card */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>밸류에이션 지표</Text>
          {metricsData.map((m) => (
            <View key={m.key} style={styles.metricRow}>
              <Text style={styles.metricKey}>{m.key}</Text>
              <Text style={styles.metricValue}>
                {formatMetric(m.value)}{m.suffix || ''}
              </Text>
              <Text style={styles.metricLabel}>{m.label}</Text>
            </View>
          ))}
        </View>

        {/* Score history */}
        {history.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>점수 추이 (최근 30일)</Text>
            {history.map((h) => (
              <View key={h.snap_date} style={styles.historyRow}>
                <Text style={styles.historyDate}>{h.snap_date}</Text>
                <Text style={styles.historyScore}>{h.valuation_score}</Text>
                <Text style={styles.historyBand}>{h.band_label}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Recent disclosures */}
        {disclosures.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>최근 공시</Text>
            {disclosures.map((d) => (
              <TouchableOpacity
                key={d.rcept_no}
                onPress={() => Linking.openURL(d.source_url)}
                style={styles.disclosureRow}
              >
                <Text style={styles.disclosureTitle} numberOfLines={2}>
                  {d.title}
                </Text>
                <View style={styles.disclosureMeta}>
                  <Text style={styles.disclosureCategory}>{d.category}</Text>
                  <Text style={styles.disclosureDate}>
                    {formatDate(d.disclosed_at)}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Disclaimer */}
        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerText}>
            본 정보는 투자 조언을 목적으로 하지 않으며, 공시 및 재무 데이터를
            정리하여 제공합니다. 모든 투자 결정은 이용자 본인의 판단과 책임 하에
            이루어져야 합니다.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: colors.textSecondary,
  },
  content: {
    padding: 16,
  },
  headerSection: {
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  companyName: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  stockInfo: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  overallLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  peerName: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  metricKey: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },
  metricValue: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
    textAlign: 'right',
  },
  metricLabel: {
    flex: 1,
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'right',
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  historyDate: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
  },
  historyScore: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: colors.text,
    textAlign: 'right',
  },
  historyBand: {
    flex: 1,
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'right',
  },
  disclosureRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  disclosureTitle: {
    fontSize: 14,
    color: colors.primary,
    lineHeight: 20,
  },
  disclosureMeta: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  disclosureCategory: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  disclosureDate: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  disclaimer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: colors.card,
    borderRadius: 12,
  },
  disclaimerText: {
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  errorBanner: {
    backgroundColor: '#FEE2E2',
    padding: 12,
    margin: 16,
    borderRadius: 8,
  },
  errorText: {
    color: '#991B1B',
    fontSize: 13,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
});
