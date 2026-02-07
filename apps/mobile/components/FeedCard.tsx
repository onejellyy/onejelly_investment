import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { DISCLOSURE_CATEGORIES } from '@onejellyinvest/shared';
import type { DisclosureCategory } from '@onejellyinvest/shared';
import { FilingTypeChip } from './FilingTypeChip';
import { colors, shadows } from '../lib/theme';
import type { FeedItem } from '../lib/api';

// The new FeedItem for mobile, mirroring the web version
interface FeedCardProps {
  item: FeedItem;
}

function isDisclosureCategory(value: string | null): value is DisclosureCategory {
  if (!value) return false;
  return (DISCLOSURE_CATEGORIES as readonly string[]).includes(value);
}

export function FeedCard({ item }: FeedCardProps) {
  const openSourceUrl = () => {
    Linking.openURL(item.url);
  };
  const date = new Date(item.published_at);
  const displayDate = Number.isNaN(date.getTime()) ? item.published_at : date.toISOString().slice(0, 10);

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.badges}>
          {item.type === 'disclosure' && isDisclosureCategory(item.category) && (
            <FilingTypeChip type={item.category} />
          )}
          {item.type === 'news' && (
            <Text style={styles.newsTag}>뉴스</Text>
          )}
        </View>
        <Text style={styles.date}>{displayDate}</Text>
      </View>

      {/* Company info */}
      <View style={styles.companyRow}>
        <Text style={styles.companyName}>{item.source}</Text>
        {item.stock_code && (
          <Text style={styles.stockCode}>({item.stock_code})</Text>
        )}
      </View>

      {/* Title */}
      <Text style={styles.title} numberOfLines={2}>
        {item.title}
      </Text>

      {/* Summary */}
      {item.summary && (
        <Text style={styles.summary}>{item.summary}</Text>
      )}

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity onPress={openSourceUrl}>
          <Text style={styles.dartLink}>원문 보기 →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    ...shadows.glass,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  badges: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    flex: 1,
    marginRight: 8,
  },
  newsTag: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  date: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  companyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  companyName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  stockCode: {
    fontSize: 13,
    color: colors.textSecondary,
    marginLeft: 4,
  },
  title: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 8,
    lineHeight: 20,
  },
  summary: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 10,
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.3)',
  },
  dartLink: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '600',
  },
});
