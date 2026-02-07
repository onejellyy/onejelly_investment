import type { BandLabel, DisclosureCategory } from '@onejellyinvest/shared';
import { BAND_LABELS } from '@onejellyinvest/shared';
import { Platform } from 'react-native';

export const colors = {
  primary: '#2A3F6D',
  accent: '#4CAF50',
  background: '#ECF0F3',
  backgroundDark: '#1A1D2C',
  card: '#FFFFFF',
  cardDark: '#2C3141',
  surface: '#ECF0F3',
  surfaceDark: '#1A1D2C',
  text: '#333333',
  textDark: '#FFFFFF',
  textSecondary: '#666666',
  textSecondaryDark: '#9CA3AF',
  border: '#E5E7EB',
  borderDark: '#374151',
  secondaryOrange: '#FF9800',
  secondaryPurple: '#673AB7',
  // Neumorphism shadow colors (light)
  neuLight: '#F9F9F9',
  neuShadow: '#D1D9E6',
  // Neumorphism shadow colors (dark)
  neuLightDark: '#222639',
  neuShadowDark: '#12141F',
  // Glass
  glassBorder: 'rgba(255, 255, 255, 0.3)',
  glassBorderDark: 'rgba(255, 255, 255, 0.08)',
};

export const shadows = {
  neuRaised: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 4, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
    },
    android: {
      elevation: 4,
    },
  }) as object,
  neuRaisedSm: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 2, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
    },
    android: {
      elevation: 2,
    },
  }) as object,
  glass: Platform.select({
    ios: {
      shadowColor: '#1F2687',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.15,
      shadowRadius: 16,
    },
    android: {
      elevation: 6,
    },
  }) as object,
};

export const bandLabelColors: Record<BandLabel, { bg: string; text: string }> = {
  [BAND_LABELS.TOP]: { bg: '#DCFCE7', text: '#166534' }, // Strong Pos
  [BAND_LABELS.GOOD]: { bg: '#ECFCCB', text: '#3F6212' }, // Mild Pos
  [BAND_LABELS.NEUTRAL]: { bg: '#F3F4F6', text: '#374151' }, // Neutral
  [BAND_LABELS.LOW]: { bg: '#FFEDD5', text: '#9A3412' }, // Mild Neg
  [BAND_LABELS.VERY_LOW]: { bg: '#FEE2E2', text: '#991B1B' }, // Strong Neg
};

export const disclosureCategoryColors: Record<DisclosureCategory, { bg: string; text: string }> = {
  '실적': { bg: '#DBEAFE', text: '#1E40AF' },
  '수주계약': { bg: '#DCFCE7', text: '#166534' },
  '자본': { bg: '#FEF9C3', text: '#854D0E' },
  '주주가치': { bg: '#F3E8FF', text: '#6B21A8' },
  '지배구조': { bg: '#E0E7FF', text: '#3730A3' },
  '리스크': { bg: '#FEE2E2', text: '#991B1B' },
  '기타': { bg: '#F3F4F6', text: '#374151' },
};

export const disclosureCategoryTexts: Record<DisclosureCategory, string> = {
  '실적': '실적',
  '수주계약': '수주/계약',
  '자본': '자본',
  '주주가치': '주주가치',
  '지배구조': '지배구조',
  '리스크': '리스크',
  '기타': '기타',
};
