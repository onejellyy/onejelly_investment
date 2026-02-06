import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { DisclosureCategory } from '@onejellyinvest/shared';
import { disclosureCategoryColors, disclosureCategoryTexts } from '../lib/theme';

interface FilingTypeChipProps {
  type: DisclosureCategory;
}

export function FilingTypeChip({ type }: FilingTypeChipProps) {
  const colors = disclosureCategoryColors[type];
  const text = disclosureCategoryTexts[type];

  // Fallback for safety if a new category is added and theme is not updated
  if (!colors || !text) {
    const fallbackColors = disclosureCategoryColors['기타'];
    return (
      <View style={[styles.chip, { backgroundColor: fallbackColors.bg }]}>
        <Text style={[styles.text, { color: fallbackColors.text }]}>{type}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.chip, { backgroundColor: colors.bg }]}>
      <Text style={[styles.text, { color: colors.text }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  text: {
    fontSize: 11,
    fontWeight: '500',
  },
});

