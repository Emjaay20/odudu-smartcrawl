import type { Asked } from '#/shared/service/capabilities';

// A confirmation a usecase asks for, drawn by DialogAsk: what it leaves out
// the dialog decides, and `typed` is what must be typed before it is confirmed.
export interface DialogAsk extends Asked {
  confirmLabel?: string;
  tone?: 'primary' | 'danger';
  typed?: string | null;
}

// An ask that names its own button and tone.
export interface NamedDialog extends DialogAsk {
  confirmLabel: string;
  tone: 'primary' | 'danger';
}
