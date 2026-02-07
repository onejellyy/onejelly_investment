import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { colors, shadows } from '../lib/theme';

interface FilterChipProps {
  label: string;
  active: boolean;
  onPress: () => void;
}

export function FilterChip({ label, active, onPress }: FilterChipProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}
    >
      <Text style={[styles.text, active && styles.textActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
  },
  chipInactive: {
    backgroundColor: colors.background,
    ...shadows.neuRaisedSm,
  },
  chipActive: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.neuShadow,
  },
  text: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  textActive: {
    color: colors.primary,
    fontWeight: '700',
  },
});
