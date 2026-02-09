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
import type { DisclosureCategory } from '@onejellyinvest/shared';
import { DISCLOSURE_CATEGORIES } from '@onejellyinvest/shared';
import { api, type FeedItem } from '../lib/api';
import { colors, shadows } from '../lib/theme';
import { FeedCard } from '../components/FeedCard';
import { FilterChip } from '../components/FilterChip';

const TYPE_OPTIONS: { value: 'all' | 'disclosure' | 'news'; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'disclosure', label: '공시' },
  { value: 'news', label: '뉴스' },
];

const CATEGORY_OPTIONS: DisclosureCategory[] = [...DISCLOSURE_CATEGORIES];

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
      <Animated.View style={[skeletonStyles.line, { width: '30%', opacity }]} />
      <Animated.View style={[skeletonStyles.line, { width: '50%', height: 16, opacity }]} />
      <Animated.View style={[skeletonStyles.line, { width: '100%', opacity }]} />
      <Animated.View style={[skeletonStyles.line, { width: '75%', opacity }]} />
      <Animated.View style={[skeletonStyles.lineShort, { opacity }]} />
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
  line: {
    height: 12,
    backgroundColor: colors.neuShadow,
    borderRadius: 4,
    marginBottom: 10,
  },
  lineShort: {
    height: 12,
    width: '40%',
    backgroundColor: colors.neuShadow,
    borderRadius: 4,
  },
});

export default function FeedScreen() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<'all' | 'disclosure' | 'news'>('all');
  const [selectedCategory, setSelectedCategory] = useState<DisclosureCategory | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const hasActiveFilter = selectedType !== 'all' || selectedCategory !== null;
  const activeFilterCount = (selectedType !== 'all' ? 1 : 0) + (selectedCategory ? 1 : 0);

  const fetchFeed = useCallback(async (cursor?: string, append = false) => {
    try {
      if (!append) setError(null);

      const response = await api.getFeed({
        type: selectedType,
        category: selectedCategory || undefined,
        cursor,
        limit: 20,
      });

      if (!response.success || !response.data) {
        throw new Error(response.error || '데이터를 불러오는데 실패했습니다.');
      }

      if (append) {
        setItems(prev => [...prev, ...response.data!.items]);
      } else {
        setItems(response.data!.items);
      }
      setNextCursor(response.data!.next_cursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : '데이터를 불러오는데 실패했습니다.');
    }
  }, [selectedType, selectedCategory]);

  useEffect(() => {
    setLoading(true);
    fetchFeed().finally(() => setLoading(false));
  }, [fetchFeed]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchFeed();
    setRefreshing(false);
  };

  const handleLoadMore = async () => {
    if (!nextCursor || loadingMore) return;

    setLoadingMore(true);
    await fetchFeed(nextCursor, true);
    setLoadingMore(false);
  };

  const toggleCategory = (type: DisclosureCategory) => {
    setSelectedCategory((prev: DisclosureCategory | null) => (prev === type ? null : type));
  };

  const resetFilters = () => {
    setSelectedType('all');
    setSelectedCategory(null);
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.heroCard}>
        <Text style={styles.title}>최신 피드</Text>
        <Text style={styles.subtitle}>공시와 뉴스의 최신 업데이트를 확인하세요</Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryText}>
            현재 {items.length}개 항목
            {hasActiveFilter ? ` · 필터 ${activeFilterCount}개 적용` : ''}
          </Text>
          {hasActiveFilter && (
            <TouchableOpacity onPress={resetFilters} style={styles.resetButton}>
              <Text style={styles.resetButtonText}>필터 초기화</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.filterToggle}>
        <TouchableOpacity
          style={styles.filterToggleButton}
          onPress={() => setShowFilters(!showFilters)}
          activeOpacity={0.8}
        >
          <Text style={styles.filterToggleText}>
            {showFilters ? '필터 숨기기 ▲' : '필터 보기 ▼'}
          </Text>
        </TouchableOpacity>
      </View>

      {showFilters && (
        <View style={styles.filters}>
          <Text style={styles.filterTitle}>타입</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
            {TYPE_OPTIONS.map(option => (
              <FilterChip
                key={option.value}
                label={option.label}
                active={selectedType === option.value}
                onPress={() => setSelectedType(option.value)}
              />
            ))}
          </ScrollView>

          <Text style={styles.filterTitle}>공시 카테고리</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
            {CATEGORY_OPTIONS.map(type => (
              <FilterChip
                key={type}
                label={type}
                active={selectedCategory === type}
                onPress={() => toggleCategory(type)}
              />
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footer}>
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
          <TouchableOpacity onPress={() => fetchFeed()} style={styles.retryButton}>
            <Text style={styles.retryText}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={items}
        keyExtractor={item => `${item.type}-${item.id}`}
        renderItem={({ item }) => <FeedCard item={item} />}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyTitle}>표시할 항목이 없습니다</Text>
            <Text style={styles.emptySubtitle}>필터를 변경하거나 잠시 후 다시 확인해보세요</Text>
            {hasActiveFilter && (
              <TouchableOpacity onPress={resetFilters} style={styles.emptyResetButton}>
                <Text style={styles.emptyResetButtonText}>필터 초기화</Text>
              </TouchableOpacity>
            )}
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
    paddingBottom: 28,
  },
  header: {
    marginBottom: 16,
  },
  heroCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.48)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    paddingHorizontal: 14,
    paddingVertical: 14,
    ...shadows.glass,
  },
  title: {
    fontSize: 25,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
    letterSpacing: 0.2,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  summaryRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  summaryText: {
    fontSize: 12,
    color: colors.textSecondary,
    flex: 1,
  },
  resetButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.neuShadow,
  },
  resetButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  filterToggle: {
    marginTop: 12,
    alignItems: 'flex-start',
  },
  filterToggleButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterToggleText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '600',
  },
  filters: {
    marginTop: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  filterTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 8,
    marginTop: 4,
  },
  filterRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  footer: {
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
  emptyResetButton: {
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.neuShadow,
  },
  emptyResetButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
});
