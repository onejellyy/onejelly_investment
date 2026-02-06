import type { BandLabel, DisclosureCategory } from '@onejellyinvest/shared';
import { BAND_LABELS } from '@onejellyinvest/shared';

export const colors = {
  primary: '#3B82F6',
  background: '#F9FAFB',
  backgroundDark: '#111827',
  card: '#FFFFFF',
  cardDark: '#1F2937',
  text: '#111827',
  textDark: '#F9FAFB',
  textSecondary: '#6B7280',
  textSecondaryDark: '#9CA3AF',
  border: '#E5E7EB',
  borderDark: '#374151',
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

