import type { ReactElement } from 'react';
import {
  ACTIVITY,
  LAYOUTS,
  keyframeName,
  pathData,
  type Box,
  type LayoutName,
  type RouteId,
  type Step,
} from '@site/src/features/landing/service/geometry';
import {
  CHIPS,
  RING_SCALES,
  checkPath,
  chipStarts,
  flag,
  headTransform,
  lamps,
  passRouteOf,
  skeleton,
} from '@site/src/features/landing/service/scene';
import '@site/src/features/landing/view/Scene/travel.css';
import styles from '@site/src/features/landing/view/Scene/Scene.module.css';

interface Props {
  readonly layout: LayoutName;
  readonly step: Step;
  readonly uid: string;
}

const BASE_ROUTES: readonly RouteId[] = ['dh', 'da', 'db', 'ha', 'hb'];

// The shapes a skeleton can be made of, each with the class that paints it.
const LOOKS = {
  bar: styles.bar,
  field: styles.field,
  cta: styles.cta,
  avatar: styles.avatar,
  block: styles.block,
} as const;

function Skeleton({
  box,
  top,
  kind,
}: {
  readonly box: Box;
  readonly top: number;
  readonly kind: 'form' | 'app';
}): ReactElement {
  return (
    <>
      {skeleton(box, top, kind).map((shape) =>
        shape.kind === 'circle' ? (
          <circle
            key={`${shape.look}-${String(shape.x)}-${String(shape.y)}`}
            className={LOOKS[shape.look]}
            cx={shape.x}
            cy={shape.y}
            r={shape.radius}
          />
        ) : (
          <rect
            key={`${shape.look}-${String(shape.x)}-${String(shape.y)}`}
            className={LOOKS[shape.look]}
            x={shape.x}
            y={shape.y}
            width={shape.width}
            height={shape.height}
            rx={shape.radius}
          />
        ),
      )}
    </>
  );
}

function Window({
  box,
  label,
  on,
  kind,
  extra,
}: {
  readonly box: Box;
  readonly label: string;
  readonly on: boolean;
  readonly kind: 'form' | 'app';
  readonly extra?: ReactElement;
}): ReactElement {
  return (
    <>
      <rect
        className={styles.halo}
        data-on={flag(on)}
        x={box.x - 5}
        y={box.y - 5}
        width={box.w + 10}
        height={box.h + 10}
        rx={20}
      />
      <rect className={styles.window} x={box.x} y={box.y} width={box.w} height={box.h} rx={16} />
      <path
        className={styles.rule}
        d={`M${String(box.x)} ${String(box.y + 36)}H${String(box.x + box.w)}`}
      />
      {lamps(box).map(([x, y]) => (
        <circle key={x} className={styles.lamp} cx={x} cy={y} r={3.2} />
      ))}
      <text className={styles.tag} x={box.x + 68} y={box.y + 23}>
        {label}
      </text>
      <Skeleton box={box} top={box.y + 52} kind={kind} />
      {extra}
    </>
  );
}

function Check({
  x,
  y,
  r,
}: {
  readonly x: number;
  readonly y: number;
  readonly r: number;
}): ReactElement {
  return (
    <>
      <circle className={styles.pass} cx={x} cy={y} r={r} />
      <path className={styles.check} d={checkPath(x, y, r)} />
    </>
  );
}

export function Scene({ layout, step, uid }: Props): ReactElement {
  const geometry = LAYOUTS[layout];
  const activity = ACTIVITY[step];
  const { hub } = geometry;
  const cx = hub.x + hub.w / 2;
  const cy = hub.y + hub.h / 2;
  const glow = `glow-${uid}`;
  const starts = chipStarts(cx);
  const passRoute = passRouteOf(activity.pass);
  const passStart =
    passRoute === undefined
      ? ([0, 0] as const)
      : (geometry.routes[passRoute].points[0] ?? ([0, 0] as const));
  return (
    <svg
      className={styles.scene}
      data-layout={layout}
      viewBox={`0 0 ${String(geometry.width)} ${String(geometry.height)}`}
      role="img"
      aria-labelledby={`scene-title-${uid}`}
      aria-describedby={`scene-desc-${uid}`}
    >
      <title id={`scene-title-${uid}`}>How a person signs in through Odudu</title>
      <desc id={`scene-desc-${uid}`}>
        A person's browser on the left, Odudu in the middle with the ways to sign in, and two apps
        on the right. The browser opens an app, the app sends it to Odudu, Odudu signs the person in
        and sends them back with a signed pass. A second app sends them to Odudu, which recognises
        them and sends them straight back.
      </desc>
      <defs>
        <radialGradient id={glow}>
          <stop offset="0" className={styles.glowCore} />
          <stop offset="0.55" className={styles.glowMid} />
          <stop offset="1" className={styles.glowEdge} />
        </radialGradient>
      </defs>

      <circle cx={cx} cy={cy} r={hub.w * 0.95} fill={`url(#${glow})`} />
      {RING_SCALES.map((scale, index) => (
        <circle
          key={scale}
          className={styles.ring}
          data-pulse={flag(activity.pulse)}
          style={{ animationDelay: `${String(index * 220)}ms` }}
          cx={cx}
          cy={cy}
          r={hub.w * scale}
        />
      ))}

      {BASE_ROUTES.map((id) => {
        const route = geometry.routes[id];
        const active =
          activity.routes.includes(id) || (id === 'hb' && activity.routes.includes('bh'));
        return (
          <g key={id}>
            <path className={styles.route} d={pathData(route.points)} />
            <path className={styles.routeOn} data-on={flag(active)} d={pathData(route.points)} />
          </g>
        );
      })}
      {[...BASE_ROUTES, 'bh' as const].map((id) => {
        const { head } = geometry.routes[id];
        const active = activity.routes.includes(id);
        if (id === 'bh' && !active) return null;
        return (
          <path
            key={`head-${id}`}
            className={active ? styles.headOn : styles.head}
            d="M-10 -6L0 0L-10 6z"
            transform={headTransform(head.at, head.angle)}
          />
        );
      })}

      <g className={styles.node} data-on={flag(activity.device)}>
        <Window box={geometry.device} label="Their browser" on={activity.device} kind="form" />
      </g>
      <g className={styles.node} data-on={flag(activity.appA)}>
        <Window
          box={geometry.appA}
          label="App A"
          kind="app"
          on={activity.appA}
          extra={
            <g className={styles.signed} data-on={flag(step === 0 || (step >= 4 && step <= 6))}>
              <Check x={geometry.appA.x + geometry.appA.w - 24} y={geometry.appA.y + 18} r={9} />
            </g>
          }
        />
      </g>
      <g className={styles.late} data-away={flag(!activity.bArrived)}>
        <g className={styles.node} data-on={flag(activity.appB)}>
          <Window
            box={geometry.appB}
            label="App B"
            kind="app"
            on={activity.appB}
            extra={
              <g className={styles.signed} data-on={flag(step === 0 || step === 6)}>
                <Check x={geometry.appB.x + geometry.appB.w - 24} y={geometry.appB.y + 18} r={9} />
              </g>
            }
          />
        </g>
      </g>

      <g className={styles.node} data-on={flag(activity.hub)} data-told={flag(step === 7)}>
        <rect
          className={styles.halo}
          data-on={flag(activity.hub)}
          x={hub.x - 6}
          y={hub.y - 6}
          width={hub.w + 12}
          height={hub.h + 12}
          rx={28}
        />
        <rect className={styles.hub} x={hub.x} y={hub.y} width={hub.w} height={hub.h} rx={22} />
        <rect
          className={styles.sheen}
          x={hub.x + 1}
          y={hub.y + 1}
          width={hub.w - 2}
          height={hub.h - 2}
          rx={21}
        />
        <g
          className={styles.staff}
          transform={`translate(${String(cx)} ${String(hub.y + 62)}) scale(3.3)`}
        >
          <circle cx={0} cy={0} r={4} />
          <path d="M0 4V26M-4 8H4" />
        </g>
        <g className={styles.signed} data-on={flag(step === 0 || step === 6)}>
          <Check x={cx + 38} y={hub.y + 44} r={15} />
        </g>
        <text className={styles.hubName} x={cx} y={hub.y + 182}>
          Odudu
        </text>
        {CHIPS.map((chip, index) => {
          const x = starts[index] ?? 0;
          return (
            <g key={chip.label} data-claim-chip={chip.claim}>
              <rect
                className={styles.chip}
                x={x}
                y={hub.y + 208}
                width={chip.width}
                height={30}
                rx={15}
              />
              <rect
                className={styles.chipOn}
                data-lit={flag(activity.chips)}
                style={{ animationDelay: `${String(index * 1100)}ms` }}
                x={x}
                y={hub.y + 208}
                width={chip.width}
                height={30}
                rx={15}
              />
              <text className={styles.chipText} x={x + chip.width / 2} y={hub.y + 227}>
                {chip.label}
              </text>
            </g>
          );
        })}
      </g>

      <g key={`flow-${String(step)}`}>
        {activity.routes.flatMap((id) => {
          const start = geometry.routes[id].points[0];
          return [0, 1, 2].map((index) => (
            <circle
              key={`${id}-${String(index)}`}
              className={styles.dot}
              cx={start?.[0]}
              cy={start?.[1]}
              r={3.6}
              style={{
                animationName: keyframeName(layout, id),
                animationDelay: `${String(index * 520 + (id === 'hb' && step === 6 ? 1300 : 0))}ms`,
              }}
            />
          ));
        })}
        {passRoute === undefined ? null : (
          <g transform={`translate(${String(passStart[0])} ${String(passStart[1])})`}>
            <g
              className={styles.ticket}
              style={{
                animationName: keyframeName(layout, passRoute, 'pass'),
                animationDelay: step === 6 ? '1300ms' : '300ms',
              }}
            >
              <rect className={styles.pass} x={-30} y={-13} width={60} height={26} rx={13} />
              <path className={styles.checkLine} d="M-13 0L-6 6L8 -6" />
              <path className={styles.tick} d="M14 -4H22M14 3H20" />
            </g>
          </g>
        )}
      </g>
    </svg>
  );
}
