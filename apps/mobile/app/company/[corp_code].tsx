import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { getBandLabel } from '@onejellyinvest/shared';
import { LabelBadge } from '../../components/LabelBadge';
import { colors, shadows } from '../../lib/theme';
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

function SkeletonBlock({ width, height }: { width: string | number; height: number }) {
  const opacity = React.useRef(new Animated.Value(0.3)).current;

  React.useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={{
        width: width as any,
        height,
        backgroundColor: colors.neuShadow,
        borderRadius: 4,
        marginBottom: 8,
        opacity,
      }}
    />
  );
}

function SkeletonDetail() {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header skeleton */}
        <View style={styles.headerSection}>
          <SkeletonBlock width="60%" height={22} />
          <SkeletonBlock width="40%" height={14} />
          <SkeletonBlock width="80%" height={14} />
        </View>
        {/* Metrics skeleton */}
        <View style={styles.card}>
          <SkeletonBlock width="40%" height={16} />
          {[...Array(6)].map((_, i) => (
            <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
              <SkeletonBlock width="30%" height={14} />
              <SkeletonBlock width="20%" height={14} />
              <SkeletonBlock width="25%" height={14} />
            </View>
          ))}
        </View>
        {/* Disclosures skeleton */}
        <View style={styles.card}>
          <SkeletonBlock width="30%" height={16} />
          {[...Array(3)].map((_, i) => (
            <View key={i} style={{ marginBottom: 8 }}>
              <SkeletonBlock width="100%" height={14} />
              <SkeletonBlock width="40%" height={10} />
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export default function CompanyDetailScreen() {
  const { corp_code } = useLocalSearchParams<{ corp_code: string }>();

  const [valuation, setValuation] = useState<ValuationView | null>(null);
  const [history, setHistory] = useState<ValuationHistoryEntry[]>([]);
  const [disclosures, setDisclosures] = useState<DisclosureListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = () => {
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
  };

  useEffect(() => {
    fetchData();
  }, [corp_code]);

  if (loading) {
    return <SkeletonDetail />;
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.errorIcon}>⚠</Text>
          <Text style={styles.errorMessage}>{error}</Text>
          <TouchableOpacity onPress={fetchData} style={styles.retryButton}>
            <Text style={styles.retryText}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!valuation) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.emptyIcon}>🔍</Text>
          <Text style={styles.emptyText}>데이터를 찾을 수 없습니다</Text>
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
  const displaySnapDate = formatDate(valuation.snap_date);

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerCard}>
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
            <View style={styles.snapshotPill}>
              <Text style={styles.snapshotPillText}>기준일 {displaySnapDate}</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>밸류에이션 지표</Text>
          {metricsData.map((m, idx) => (
            <View key={m.key} style={[styles.metricRow, idx === metricsData.length - 1 && styles.rowLast]}>
              <Text style={styles.metricKey}>{m.key}</Text>
              <Text style={styles.metricValue}>
                {formatMetric(m.value)}{m.suffix || ''}
              </Text>
              <Text style={styles.metricLabel}>{m.label}</Text>
            </View>
          ))}
        </View>

        {history.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>점수 추이 (최근 30일)</Text>
            {history.map((h, idx) => (
              <View key={h.snap_date} style={[styles.historyRow, idx === history.length - 1 && styles.rowLast]}>
                <Text style={styles.historyDate}>{formatDate(h.snap_date)}</Text>
                <Text style={styles.historyScore}>{h.valuation_score}</Text>
                <Text style={styles.historyBand}>{h.band_label}</Text>
              </View>
            ))}
          </View>
        )}

        {disclosures.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>최근 공시</Text>
            {disclosures.map((d, idx) => (
              <TouchableOpacity
                key={d.rcept_no}
                onPress={() => Linking.openURL(d.source_url)}
                style={[styles.disclosureRow, idx === disclosures.length - 1 && styles.rowLast]}
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
                <Text style={styles.disclosureAction}>원문 보기</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

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
    padding: 24,
  },
  content: {
    padding: 16,
    paddingBottom: 28,
  },
  headerCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.48)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    marginBottom: 14,
    ...shadows.glass,
  },
  headerSection: {
    paddingHorizontal: 14,
    paddingVertical: 14,
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
  snapshotPill: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.neuShadow,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  snapshotPillText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    ...shadows.glass,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  rowLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.3)',
  },
  metricKey: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },
  metricValue: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
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
    borderBottomColor: 'rgba(255, 255, 255, 0.3)',
  },
  historyDate: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
  },
  historyScore: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
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
    borderBottomColor: 'rgba(255, 255, 255, 0.3)',
  },
  disclosureTitle: {
    fontSize: 14,
    color: colors.primary,
    lineHeight: 20,
    fontWeight: '500',
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
  disclosureAction: {
    marginTop: 6,
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
  },
  disclaimer: {
    marginTop: 10,
    padding: 16,
    backgroundColor: colors.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.neuShadow,
  },
  disclaimerText: {
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  errorIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  errorMessage: {
    color: colors.secondaryOrange,
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: colors.background,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    ...shadows.neuRaised,
  },
  retryText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: '500',
  },
});
