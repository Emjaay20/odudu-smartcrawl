import type { ReactElement } from 'react';
import { Arrow, Box, Txt, vertical, Wall, WIDTH } from '@site/src/components/Diagram/parts';

export interface Drawing {
  readonly height: number;
  readonly draw: (head: string) => ReactElement;
}

const MID = WIDTH / 2;

function tenants(): Drawing {
  const tenant = (y: number, name: string): ReactElement => (
    <g key={name}>
      <Box x={10} y={y} w={320} h={140} />
      <Txt x={24} y={y + 28} anchor="start" bold size={15} on="panel">
        {`Tenant: ${name}`}
      </Txt>
      <Txt x={24} y={y + 48} anchor="start" mono ink="muted" on="panel">
        {`/tenants/${name}/…`}
      </Txt>
      {[
        ['Users', 24, 62],
        ['Clients', 178, 62],
        ['Signing keys', 24, 100],
        ['Sessions', 178, 100],
      ].map(([label, cx, cy]) => (
        <g key={String(label)}>
          <Box x={Number(cx)} y={y + Number(cy)} w={138} h={30} tone="accent" />
          <Txt x={Number(cx) + 69} y={y + Number(cy) + 20} on="accent">
            {String(label)}
          </Txt>
        </g>
      ))}
    </g>
  );
  return {
    height: 380,
    draw: () => (
      <>
        {tenant(8, 'demo')}
        <Wall y={166} />
        <Txt x={MID} y={188} ink="muted">
          one tenant never reads the other’s rows
        </Txt>
        {tenant(204, 'acme')}
        <Txt x={MID} y={370}>
          The tenant is named in every address
        </Txt>
      </>
    ),
  };
}

function clients(): Drawing {
  return {
    height: 392,
    draw: (head) => (
      <>
        <Box x={10} y={8} w={320} h={76} />
        <Txt x={MID} y={34} bold size={15} on="panel">
          Public client
        </Txt>
        <Txt x={MID} y={54} ink="muted" on="panel">
          a browser or mobile app
        </Txt>
        <Txt x={MID} y={72} ink="muted" on="panel">
          holds no secret
        </Txt>
        <Arrow head={head} d={vertical(MID, 86, 130)} />
        <Txt x={MID + 14} y={114} anchor="start" ink="accent" bold>
          PKCE
        </Txt>
        <Box x={10} y={132} w={320} h={124} tone="accent" />
        <Txt x={MID} y={158} bold size={15} on="accent">
          The tenant’s token endpoint
        </Txt>
        {[
          'checks the client_id',
          'checks the redirect address',
          'checks the PKCE verifier',
          'checks the secret, if there is one',
        ].map((line, index) => (
          <Txt key={line} x={MID} y={182 + index * 19} on="accent">
            {line}
          </Txt>
        ))}
        <Arrow head={head} d={vertical(MID, 300, 258)} />
        <Txt x={MID + 14} y={286} anchor="start" ink="accent" bold>
          PKCE and secret
        </Txt>
        <Box x={10} y={302} w={320} h={78} />
        <Txt x={MID} y={328} bold size={15} on="panel">
          Confidential client
        </Txt>
        <Txt x={MID} y={348} ink="muted" on="panel">
          a server-side app or service
        </Txt>
        <Txt x={MID} y={366} ink="muted" on="panel">
          holds a secret and proves it
        </Txt>
      </>
    ),
  };
}

function scopes(): Drawing {
  const steps: {
    y: number;
    h: number;
    tone: 'panel' | 'accent';
    title: string;
    lines: string[];
  }[] = [
    { y: 8, h: 54, tone: 'panel', title: 'The client asks', lines: ['scope=openid email'] },
    {
      y: 84,
      h: 72,
      tone: 'panel',
      title: 'Sorted against its scopes',
      lines: ['default: always given', 'optional: the person chooses'],
    },
    {
      y: 178,
      h: 72,
      tone: 'accent',
      title: 'Consent',
      lines: ['shown if required', 'or if the request says prompt=consent'],
    },
    { y: 272, h: 54, tone: 'panel', title: 'Granted', lines: ['what the person allowed'] },
  ];
  return {
    height: 470,
    draw: (head) => (
      <>
        {steps.map((step, index) => (
          <g key={step.title}>
            <Box x={10} y={step.y} w={320} h={step.h} tone={step.tone} />
            <Txt x={MID} y={step.y + 24} bold size={15} on={step.tone}>
              {step.title}
            </Txt>
            {step.lines.map((line, row) => (
              <Txt key={line} x={MID} y={step.y + 44 + row * 18} ink="muted" on={step.tone}>
                {line}
              </Txt>
            ))}
            {index < steps.length - 1 ? (
              <Arrow
                head={head}
                d={vertical(MID, step.y + step.h + 2, (steps[index + 1]?.y ?? 0) - 2)}
              />
            ) : null}
          </g>
        ))}
        <Txt x={MID} y={356}>
          Where the granted scopes show up
        </Txt>
        {[
          ['Access token', 'roles, groups, scope'],
          ['ID token', 'who signed in'],
          ['UserInfo', 'only the claims asked for'],
        ].map(([name, note], index) => (
          <g key={String(name)}>
            <Box x={10} y={368 + index * 32} w={320} h={28} tone="accent" />
            <Txt x={24} y={387 + index * 32} anchor="start" on="accent" bold>
              {String(name)}
            </Txt>
            <Txt x={316} y={387 + index * 32} anchor="end" on="accent">
              {String(note)}
            </Txt>
          </g>
        ))}
      </>
    ),
  };
}

function rolesAndGroups(): Drawing {
  return {
    height: 470,
    draw: (head) => (
      <>
        <Box x={10} y={8} w={320} h={56} />
        <Txt x={MID} y={32} mono on="panel">
          /engineering
        </Txt>
        <Txt x={MID} y={52} ink="muted" on="panel">
          role: engineering-lead
        </Txt>
        <Arrow head={head} d={vertical(MID, 66, 98)} />
        <Txt x={MID + 14} y={88} anchor="start" ink="muted">
          roles reach down
        </Txt>
        <Box x={10} y={100} w={320} h={56} />
        <Txt x={MID} y={124} mono on="panel">
          /engineering/backend
        </Txt>
        <Txt x={MID} y={144} ink="muted" on="panel">
          role: reviewer
        </Txt>
        <Arrow head={head} d={vertical(MID, 200, 158)} dashed />
        <Box x={10} y={202} w={320} h={36} tone="accent" />
        <Txt x={MID} y={225} on="accent">
          Ada joins only /engineering/backend
        </Txt>
        <Txt x={MID} y={272} bold>
          What Ada’s access token carries
        </Txt>
        <Box x={10} y={284} w={320} h={80} tone="accent" />
        <Txt x={MID} y={308} bold size={15} on="accent">
          roles claim
        </Txt>
        <Txt x={MID} y={330} mono on="accent">
          reviewer
        </Txt>
        <Txt x={MID} y={350} mono on="accent">
          engineering-lead
        </Txt>
        <Box x={10} y={378} w={320} h={80} tone="accent" />
        <Txt x={MID} y={402} bold size={15} on="accent">
          groups claim
        </Txt>
        <Txt x={MID} y={424} mono on="accent">
          /engineering/backend
        </Txt>
        <Txt x={MID} y={446} ink="muted" on="accent">
          direct memberships only
        </Txt>
      </>
    ),
  };
}

function sessions(): Drawing {
  const segments: [string, number, boolean][] = [
    ['active', 96, true],
    ['quiet', 56, false],
    ['active', 96, true],
    ['quiet', 56, false],
  ];
  let x = 14;
  return {
    height: 360,
    draw: () => (
      <>
        <Txt x={14} y={28} anchor="start" ink="accent" bold>
          Sign in
        </Txt>
        <Txt x={326} y={28} anchor="end" ink="accent" bold>
          Ceiling
        </Txt>
        {segments.map(([label, width, busy], index) => {
          const left = x;
          x += width;
          return (
            <g key={`${label}${String(index)}`}>
              <Box x={left} y={40} w={width} h={34} tone={busy ? 'accent' : 'panel'} />
              <Txt
                x={left + width / 2}
                y={62}
                on={busy ? 'accent' : 'panel'}
                ink={busy ? 'ink' : 'muted'}
              >
                {label}
              </Txt>
            </g>
          );
        })}
        <line x1={326} x2={326} y1={36} y2={80} stroke="var(--ink-muted)" strokeWidth={2} />
        <Txt x={MID} y={110}>
          Quiet stretches shorter than the idle limit
        </Txt>
        <Txt x={MID} y={130}>
          keep the session alive.
        </Txt>
        <Box x={10} y={158} w={320} h={84} />
        <Txt x={MID} y={184} bold size={15} on="panel">
          Idle limit
        </Txt>
        <Txt x={MID} y={206} ink="muted" on="panel">
          quiet for too long, and it ends
        </Txt>
        <Txt x={MID} y={226} ink="muted" on="panel">
          default 30 minutes
        </Txt>
        <Box x={10} y={258} w={320} h={84} />
        <Txt x={MID} y={284} bold size={15} on="panel">
          Absolute limit
        </Txt>
        <Txt x={MID} y={306} ink="muted" on="panel">
          however busy, it ends at the ceiling
        </Txt>
        <Txt x={MID} y={326} ink="muted" on="panel">
          default 10 hours
        </Txt>
      </>
    ),
  };
}

function tokens(): Drawing {
  const cards: [number, number, 'accent' | 'panel', string, string[]][] = [
    [
      8,
      96,
      'accent',
      'Access token',
      ['sent to your API', 'a signed JWT, typed at+jwt', 'lives 300 seconds by default'],
    ],
    [116, 74, 'panel', 'ID token', ['read by the app', 'says who signed in']],
    [
      202,
      96,
      'panel',
      'Refresh token',
      ['kept by the app, opaque', 'trades for new tokens', 'works once'],
    ],
  ];
  return {
    height: 470,
    draw: (head) => (
      <>
        {cards.map(([y, h, tone, title, lines]) => (
          <g key={title}>
            <Box x={10} y={y} w={320} h={h} tone={tone} />
            <Txt x={MID} y={y + 24} bold size={15} on={tone}>
              {title}
            </Txt>
            {lines.map((line, row) => (
              <Txt key={line} x={MID} y={y + 44 + row * 18} ink="muted" on={tone}>
                {line}
              </Txt>
            ))}
          </g>
        ))}
        <Txt x={MID} y={332} bold>
          A refresh token used twice
        </Txt>
        {['R1', 'R2', 'R3'].map((name, index) => (
          <g key={name}>
            <Box x={24 + index * 112} y={346} w={72} h={36} tone="accent" />
            <Txt x={60 + index * 112} y={369} mono on="accent">
              {name}
            </Txt>
          </g>
        ))}
        <Arrow head={head} d="M98 364 L134 364" />
        <Arrow head={head} d="M210 364 L246 364" />
        <Arrow head={head} d="M60 386 L60 416" dashed />
        <Box x={10} y={418} w={320} h={40} />
        <Txt x={MID} y={443} on="panel">
          R1 again: the whole family is revoked
        </Txt>
      </>
    ),
  };
}

function consentAndAudit(): Drawing {
  return {
    height: 540,
    draw: (head) => (
      <>
        <Box x={10} y={8} w={320} h={216} />
        <Txt x={24} y={32} anchor="start" bold size={15} on="panel">
          Consent
        </Txt>
        {[
          ['The client asks', 46],
          ['The person decides', 96],
          ['A grant is recorded', 146],
        ].map(([label, y]) => (
          <g key={String(label)}>
            <Box x={24} y={Number(y)} w={292} h={34} tone="accent" />
            <Txt x={MID} y={Number(y) + 22} on="accent">
              {String(label)}
            </Txt>
          </g>
        ))}
        <Arrow head={head} d={vertical(MID, 82, 94)} />
        <Arrow head={head} d={vertical(MID, 132, 144)} />
        <Txt x={MID} y={208} ink="muted" on="panel">
          asked again only for something more
        </Txt>
        <Box x={10} y={240} w={320} h={216} />
        <Txt x={24} y={264} anchor="start" bold size={15} on="panel">
          Audit trail
        </Txt>
        {[
          'sign-ins and refusals',
          'sessions started and ended',
          'tokens issued and revoked',
          'changes an admin made',
        ].map((row, index) => (
          <g key={row}>
            <Box x={24} y={278 + index * 40} w={292} h={32} tone="accent" />
            <Txt x={MID} y={299 + index * 40} on="accent">
              {row}
            </Txt>
          </g>
        ))}
        <Txt x={MID} y={486}>
          Both are kept for each tenant.
        </Txt>
        <Txt x={MID} y={506}>
          Audit events: 90 days by default.
        </Txt>
        <Txt x={MID} y={526} ink="muted">
          Refusals are bounded for each client.
        </Txt>
      </>
    ),
  };
}

export const DRAWINGS = {
  tenants: tenants(),
  clients: clients(),
  scopes: scopes(),
  'roles-and-groups': rolesAndGroups(),
  sessions: sessions(),
  tokens: tokens(),
  'consent-and-audit': consentAndAudit(),
} satisfies Record<string, Drawing>;

export type DiagramName = keyof typeof DRAWINGS;
