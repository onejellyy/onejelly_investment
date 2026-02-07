import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { DisclosureCategory } from '@onejellyinvest/shared';
import { disclosureCategoryColors, disclosureCategoryTexts } from '../lib/theme';

interface FilingTypeChipProps {
  type: DisclosureCategory;
}

export function FilingTypeChip({ type }: FilingTypeChipProps) {
  const chipColors = disclosureCategoryColors[type];
  const text = disclosureCategoryTexts[type];

  // Fallback for safety if a new category is added and theme is not updated
  if (!chipColors || !text) {
    const fallbackColors = disclosureCategoryColors['기타'];
    return (
      <View style={[styles.chip, { backgroundColor: fallbackColors.bg }]}>
        <Text style={[styles.text, { color: fallbackColors.text }]}>{type}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.chip, { backgroundColor: chipColors.bg }]}>
      <Text style={[styles.text, { color: chipColors.text }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  text: {
    fontSize: 11,
    fontWeight: '600',
  },
});
