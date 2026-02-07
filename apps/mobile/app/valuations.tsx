import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  ScrollView,
  Animated,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { BandLabel } from '@onejellyinvest/shared';
import { BAND_LABELS } from '@onejellyinvest/shared';
import { api, type ValuationView } from '../lib/api';
import { colors, shadows } from '../lib/theme';
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

function SkeletonCard() {
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
    <View style={skeletonStyles.card}>
      <View style={skeletonStyles.headerRow}>
        <Animated.View style={[skeletonStyles.line, { width: '40%', opacity }]} />
        <Animated.View style={[skeletonStyles.badge, { opacity }]} />
      </View>
      <Animated.View style={[skeletonStyles.line, { width: '80%', opacity }]} />
      <View style={skeletonStyles.metricsRow}>
        {[...Array(4)].map((_, i) => (
          <View key={i} style={skeletonStyles.metricBlock}>
            <Animated.View style={[skeletonStyles.metricLabel, { opacity }]} />
            <Animated.View style={[skeletonStyles.metricValue, { opacity }]} />
          </View>
        ))}
      </View>
    </View>
  );
}

const skeletonStyles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    ...shadows.glass,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  line: {
    height: 14,
    backgroundColor: colors.neuShadow,
    borderRadius: 4,
    marginBottom: 10,
  },
  badge: {
    width: 40,
    height: 20,
    backgroundColor: colors.neuShadow,
    borderRadius: 10,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 4,
  },
  metricBlock: {
    alignItems: 'center',
  },
  metricLabel: {
    width: 24,
    height: 10,
    backgroundColor: colors.neuShadow,
    borderRadius: 3,
    marginBottom: 4,
  },
  metricValue: {
    width: 32,
    height: 14,
    backgroundColor: colors.neuShadow,
    borderRadius: 3,
  },
});

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
        <SkeletonCard />
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.skeletonContainer}>
          {renderHeader()}
          {[...Array(4)].map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorIcon}>⚠</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => fetchValuations(0)} style={styles.retryButton}>
            <Text style={styles.retryText}>다시 시도</Text>
          </TouchableOpacity>
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
            <Text style={styles.emptyIcon}>⚖️</Text>
            <Text style={styles.emptyTitle}>표시할 항목이 없습니다</Text>
            <Text style={styles.emptySubtitle}>필터를 변경하거나 잠시 후 다시 확인해보세요</Text>
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
  skeletonContainer: {
    flex: 1,
    padding: 16,
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
    paddingVertical: 8,
  },
  errorBanner: {
    backgroundColor: 'rgba(255, 152, 0, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 152, 0, 0.3)',
    padding: 12,
    margin: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorIcon: {
    fontSize: 16,
  },
  errorText: {
    color: colors.secondaryOrange,
    fontSize: 13,
    flex: 1,
  },
  retryButton: {
    backgroundColor: colors.background,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    ...shadows.neuRaisedSm,
  },
  retryText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '500',
  },
  empty: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 36,
    marginBottom: 12,
  },
  emptyTitle: {
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  emptySubtitle: {
    color: colors.textSecondary,
    fontSize: 13,
  },
});
