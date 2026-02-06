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
import type { DisclosureCategory } from '@onejellyinvest/shared';
import { DISCLOSURE_CATEGORIES } from '@onejellyinvest/shared';
import { api, type FeedItem } from '../lib/api';
import { colors } from '../lib/theme';
import { FeedCard } from '../components/FeedCard';
import { FilterChip } from '../components/FilterChip';

const TYPE_OPTIONS: { value: 'all' | 'disclosure' | 'news'; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'disclosure', label: '공시' },
  { value: 'news', label: '뉴스' },
];

const CATEGORY_OPTIONS: DisclosureCategory[] = [...DISCLOSURE_CATEGORIES];

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

  const renderHeader = () => (
    <View style={styles.header}>
      <Text style={styles.title}>최신 피드</Text>
      <Text style={styles.subtitle}>공시와 뉴스의 최신 업데이트를 확인하세요</Text>

      {/* Filter toggle */}
      <View style={styles.filterToggle}>
        <Text
          style={styles.filterToggleText}
          onPress={() => setShowFilters(!showFilters)}
        >
          {showFilters ? '필터 숨기기 ▲' : '필터 보기 ▼'}
        </Text>
      </View>

      {/* Filters */}
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
        keyExtractor={item => `${item.type}-${item.id}`}
        renderItem={({ item }) => <FeedCard item={item} />}
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
  },
  filterToggle: {
    marginTop: 12,
  },
  filterToggleText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '500',
  },
  filters: {
    marginTop: 12,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
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
