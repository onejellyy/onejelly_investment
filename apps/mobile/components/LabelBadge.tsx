import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { BandLabel } from '@onejellyinvest/shared';
import { bandLabelColors } from '../lib/theme';

interface LabelBadgeProps {
  label: BandLabel | null;
}

export function LabelBadge({ label }: LabelBadgeProps) {
  const currentLabel = label || '중립';
  const colors = bandLabelColors[currentLabel];
  const text = currentLabel;

  if (!colors) {
    // Fallback for safety
    return (
      <View style={[styles.badge, { backgroundColor: bandLabelColors['중립'].bg }]}>
        <Text style={[styles.text, { color: bandLabelColors['중립'].text }]}>
          {text}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.badge, { backgroundColor: colors.bg }]}>
      <Text style={[styles.text, { color: colors.text }]}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
});

