import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { BandLabel } from '@onejellyinvest/shared';
import { BAND_LABELS } from '@onejellyinvest/shared';
import { api, type ValuationView } from '../lib/api';
import { colors } from '../lib/theme';
import { ValuationCard } from '../components/ValuationCard';
import { FilterChip } from '../components/FilterChip';

const BAND_OPTIONS: { value: BandLabel | null; label: string }[] = [
  { value: null, label: '전체' },
  { value: BAND_LABELS.TOP, label: BAND_LABELS.TOP },
  { value: BAND_LABELS.GOOD, label: BAND_LABELS.GOOD },
  { value: BAND_LABELS.NEUTRAL, label: BAND_LABELS.NEUTRAL },
  { value: BAND_LABELS.LOW, label: BAND_LABELS.LOW },
  { value: BAND_LABELS.VERY_LOW, label: BAND_LABELS.VERY_LOW },
];

const PAGE_SIZE = 20;

export default function ValuationsScreen() {
  const [items, setItems] = useState<ValuationView[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [selectedBand, setSelectedBand] = useState<BandLabel | null>(null);

  const fetchValuations = useCallback(
    async (newOffset: number, append = false) => {
      try {
        if (!append) setError(null);

        const data = await api.getValuations({
          band_label: selectedBand || undefined,
          limit: PAGE_SIZE,
          offset: newOffset,
        });

        if (!data.success || !data.data) {
          throw new Error(data.error || '데이터를 불러오는데 실패했습니다.');
        }

        if (append) {
          setItems((prev) => [...prev, ...data.data!.items]);
        } else {
          setItems(data.data!.items);
        }
        setTotal(data.data!.total);
        setOffset(newOffset);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : '데이터를 불러오는데 실패했습니다.',
        );
      }
    },
    [selectedBand],
  );

  useEffect(() => {
    setLoading(true);
    fetchValuations(0).finally(() => setLoading(false));
  }, [fetchValuations]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchValuations(0);
    setRefreshing(false);
  };

  const handleLoadMore = async () => {
    if (loadingMore || offset + PAGE_SIZE >= total) return;
    setLoadingMore(true);
    await fetchValuations(offset + PAGE_SIZE, true);
    setLoadingMore(false);
  };

  const toggleBand = (band: BandLabel | null) => {
    setSelectedBand(band);
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <Text style={styles.title}>밸류에이션</Text>
      <Text style={styles.subtitle}>업종 대비 밸류에이션 지표를 확인하세요</Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterRow}
      >
        {BAND_OPTIONS.map((opt) => (
          <FilterChip
            key={opt.label}
            label={opt.label}
            active={selectedBand === opt.value}
            onPress={() => toggleBand(opt.value)}
          />
        ))}
      </ScrollView>

      {total > 0 && (
        <Text style={styles.totalText}>총 {total}개 종목</Text>
      )}
    </View>
  );

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  };

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

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <FlatList
        data={items}
        keyExtractor={(item) => item.corp_code}
        renderItem={({ item }) => <ValuationCard item={item} />}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>표시할 항목이 없습니다.</Text>
          </View>
        }
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
      />
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
  list: {
    padding: 16,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  filterRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  totalText: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
  },
  footerLoader: {
    paddingVertical: 16,
    alignItems: 'center',
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
  empty: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
});
