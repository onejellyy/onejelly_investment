import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { BandLabel } from '@onejellyinvest/shared';
import { bandLabelColors, shadows } from '../lib/theme';

interface LabelBadgeProps {
  label: BandLabel | null;
}

export function LabelBadge({ label }: LabelBadgeProps) {
  const currentLabel = label || '중립';
  const badgeColors = bandLabelColors[currentLabel];
  const text = currentLabel;

  if (!badgeColors) {
    // Fallback for safety
    return (
      <View style={[styles.badge, { backgroundColor: bandLabelColors['중립'].bg }, shadows.neuRaisedSm]}>
        <Text style={[styles.text, { color: bandLabelColors['중립'].text }]}>
          {text}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.badge, { backgroundColor: badgeColors.bg }, shadows.neuRaisedSm]}>
      <Text style={[styles.text, { color: badgeColors.text }]}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
});
