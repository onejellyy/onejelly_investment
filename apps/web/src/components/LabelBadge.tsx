'use client';

import type { BandLabel } from '@onejellyinvest/shared';
import { BAND_LABELS } from '@onejellyinvest/shared';

interface LabelBadgeProps {
  label: BandLabel | null;
}

// Map BandLabel values to CSS classes for styling
const LABEL_CLASS_MAP: Record<BandLabel, string> = {
  [BAND_LABELS.TOP]: 'label-badge-top',
  [BAND_LABELS.GOOD]: 'label-badge-good',
  [BAND_LABELS.NEUTRAL]: 'label-badge-neutral',
  [BAND_LABELS.LOW]: 'label-badge-low',
  [BAND_LABELS.VERY_LOW]: 'label-badge-very-low',
};

export default function LabelBadge({ label }: LabelBadgeProps) {
  if (!label) {
    return (
      <span className={`label-badge label-badge-neutral`}>
        {BAND_LABELS.NEUTRAL}
      </span>
    );
  }

  const className = LABEL_CLASS_MAP[label] || 'label-badge-neutral';

  return (
    <span className={`label-badge ${className}`}>
      {label}
    </span>
  );
}

