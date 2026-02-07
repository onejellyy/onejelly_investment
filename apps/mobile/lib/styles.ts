import { StyleSheet } from 'react-native';
import { colors, shadows } from './theme';

export const glassCard = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    ...shadows.glass,
  },
});

export const neuRaised = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    borderRadius: 16,
    ...shadows.neuRaised,
  },
});

export const neuInset = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.neuShadow,
  },
});

export const skeleton = StyleSheet.create({
  base: {
    backgroundColor: colors.neuShadow,
    borderRadius: 8,
  },
  text: {
    height: 14,
    backgroundColor: colors.neuShadow,
    borderRadius: 4,
    marginBottom: 8,
  },
  textLarge: {
    height: 20,
    backgroundColor: colors.neuShadow,
    borderRadius: 4,
    marginBottom: 8,
  },
  circle: {
    backgroundColor: colors.neuShadow,
    borderRadius: 999,
  },
});

export const errorBanner = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255, 152, 0, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 152, 0, 0.3)',
    padding: 12,
    margin: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  text: {
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
});
