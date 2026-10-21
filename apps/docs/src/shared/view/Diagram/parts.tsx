import type { ReactElement, ReactNode } from 'react';

// Every colour is a custom property the site already sets for both colour
// modes, so a diagram follows the site's toggle and not the system's setting.
export const INK = {
  ink: 'var(--ink-primary)',
  muted: 'var(--ink-muted)',
  accent: 'var(--signal-active-ink)',
} as const;

export type Tone = 'panel' | 'accent';
export type Ink = keyof typeof INK;

const SURFACE: Record<Tone, { fill: string; stroke: string }> = {
  panel: { fill: 'var(--surface-sunken)', stroke: 'var(--border-strong)' },
  accent: { fill: 'var(--signal-active)', stroke: 'var(--signal-active-ink)' },
};

export const WIDTH = 340;

interface BoxProps {
  x: number;
  y: number;
  w: number;
  h: number;
  tone?: Tone;
}

export function Box({ x, y, w, h, tone = 'panel' }: BoxProps): ReactElement {
  return (
    <rect
      x={x}
      y={y}
      width={w}
      height={h}
      rx={8}
      fill={SURFACE[tone].fill}
      stroke={SURFACE[tone].stroke}
      strokeWidth={1.5}
      data-surface={tone}
    />
  );
}

interface TextProps {
  x: number;
  y: number;
  children: ReactNode;
  ink?: Ink;
  size?: 13 | 14 | 15;
  bold?: boolean;
  mono?: boolean;
  anchor?: 'start' | 'middle' | 'end';
}

export function Txt({
  x,
  y,
  children,
  ink = 'ink',
  size = 13,
  bold = false,
  mono = false,
  anchor = 'middle',
}: TextProps): ReactElement {
  return (
    <text
      x={x}
      y={y}
      fill={INK[ink]}
      fontSize={size}
      fontWeight={bold ? 600 : 400}
      fontFamily={mono ? 'var(--font-mono)' : undefined}
      textAnchor={anchor}
    >
      {children}
    </text>
  );
}

interface ArrowProps {
  d: string;
  head: string;
  dashed?: boolean;
}

export function Arrow({ d, head, dashed = false }: ArrowProps): ReactElement {
  return (
    <path
      d={d}
      fill="none"
      stroke={INK.muted}
      strokeWidth={1.8}
      strokeDasharray={dashed ? '5 4' : undefined}
      markerEnd={`url(#${head})`}
    />
  );
}

export function Wall({ y }: { y: number }): ReactElement {
  return (
    <line
      x1={10}
      x2={WIDTH - 10}
      y1={y}
      y2={y}
      stroke={INK.muted}
      strokeWidth={2}
      strokeDasharray="6 5"
    />
  );
}

export function vertical(x: number, from: number, to: number): string {
  return `M${String(x)} ${String(from)} L${String(x)} ${String(to)}`;
}
