import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { getBandLabel } from '@onejellyinvest/shared';
import { LabelBadge } from './LabelBadge';
import { colors, shadows } from '../lib/theme';
import type { ValuationView } from '../lib/api';

interface ValuationCardProps {
  item: ValuationView;
}

function formatMetric(value: number | null): string {
  if (value == null) return '-';
  return value.toFixed(1);
}

export function ValuationCard({ item }: ValuationCardProps) {
  const router = useRouter();
  const bandLabel =
    item.valuation_score != null ? getBandLabel(item.valuation_score) : null;

  return (
    <TouchableOpacity
      onPress={() => router.push(`/company/${item.corp_code}`)}
      activeOpacity={0.7}
    >
      <View style={styles.card}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.companyInfo}>
            <Text style={styles.companyName}>{item.corp_name}</Text>
            <Text style={styles.stockCode}>{item.stock_code}</Text>
          </View>
          <LabelBadge label={bandLabel} />
        </View>

        {/* Overall label */}
        <Text style={styles.overallLabel}>{item.overall_label}</Text>

        {/* Key metrics */}
        <View style={styles.metricsRow}>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>PER</Text>
            <Text style={styles.metricValue}>
              {formatMetric(item.metrics.per_ttm.value)}
            </Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>PBR</Text>
            <Text style={styles.metricValue}>
              {formatMetric(item.metrics.pbr.value)}
            </Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>ROE</Text>
            <Text style={styles.metricValue}>
              {formatMetric(item.metrics.roe_ttm.value)}%
            </Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>OPM</Text>
            <Text style={styles.metricValue}>
              {formatMetric(item.metrics.opm_ttm.value)}%
            </Text>
          </View>
        </View>

        {/* Peer group */}
        {item.peer_name && (
          <View style={styles.footer}>
            <Text style={styles.peerName}>업종: {item.peer_name}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
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
  companyInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  companyName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  stockCode: {
    fontSize: 13,
    color: colors.textSecondary,
    marginLeft: 6,
  },
  overallLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  metric: {
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  footer: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.3)',
  },
  peerName: {
    fontSize: 12,
    color: colors.textSecondary,
  },
});
