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
      <Txt x={24} y={y + 28} anchor="start" bold size={15}>
        {`Tenant: ${name}`}
      </Txt>
      <Txt x={24} y={y + 48} anchor="start" mono ink="muted">
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
          <Txt x={Number(cx) + 69} y={y + Number(cy) + 20}>
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
        <Txt x={MID} y={34} bold size={15}>
          Public client
        </Txt>
        <Txt x={MID} y={54} ink="muted">
          a browser or mobile app
        </Txt>
        <Txt x={MID} y={72} ink="muted">
          holds no secret
        </Txt>
        <Arrow head={head} d={vertical(MID, 86, 130)} />
        <Txt x={MID + 14} y={114} anchor="start" ink="accent" bold>
          code + PKCE verifier
        </Txt>
        <Box x={10} y={132} w={320} h={124} tone="accent" />
        <Txt x={MID} y={158} bold size={15}>
          The tenant’s token endpoint
        </Txt>
        {[
          'checks the client_id',
          'checks the redirect address',
          'checks the PKCE verifier',
          'checks the secret, if there is one',
        ].map((line, index) => (
          <Txt key={line} x={MID} y={182 + index * 19}>
            {line}
          </Txt>
        ))}
        <Arrow head={head} d={vertical(MID, 300, 258)} />
        <Txt x={MID + 14} y={286} anchor="start" ink="accent" bold>
          code, verifier, secret
        </Txt>
        <Box x={10} y={302} w={320} h={78} />
        <Txt x={MID} y={328} bold size={15}>
          Confidential client
        </Txt>
        <Txt x={MID} y={348} ink="muted">
          a server-side app or service
        </Txt>
        <Txt x={MID} y={366} ink="muted">
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
            <Txt x={MID} y={step.y + 24} bold size={15}>
              {step.title}
            </Txt>
            {step.lines.map((line, row) => (
              <Txt key={line} x={MID} y={step.y + 44 + row * 18} ink="muted">
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
            <Txt x={24} y={387 + index * 32} anchor="start" bold>
              {String(name)}
            </Txt>
            <Txt x={316} y={387 + index * 32} anchor="end">
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
        <Txt x={MID} y={32} mono>
          /engineering
        </Txt>
        <Txt x={MID} y={52} ink="muted">
          role: engineering-lead
        </Txt>
        <Arrow head={head} d={vertical(MID, 66, 98)} />
        <Txt x={MID + 14} y={88} anchor="start" ink="muted">
          roles reach down
        </Txt>
        <Box x={10} y={100} w={320} h={56} />
        <Txt x={MID} y={124} mono>
          /engineering/backend
        </Txt>
        <Txt x={MID} y={144} ink="muted">
          role: reviewer
        </Txt>
        <Arrow head={head} d={vertical(MID, 200, 158)} dashed />
        <Box x={10} y={202} w={320} h={36} tone="accent" />
        <Txt x={MID} y={225}>
          Ada joins only /engineering/backend
        </Txt>
        <Txt x={MID} y={272} bold>
          What Ada’s access token carries
        </Txt>
        <Box x={10} y={284} w={320} h={80} tone="accent" />
        <Txt x={MID} y={308} bold size={15}>
          roles claim
        </Txt>
        <Txt x={MID} y={330} mono>
          reviewer
        </Txt>
        <Txt x={MID} y={350} mono>
          engineering-lead
        </Txt>
        <Box x={10} y={378} w={320} h={80} tone="accent" />
        <Txt x={MID} y={402} bold size={15}>
          groups claim
        </Txt>
        <Txt x={MID} y={424} mono>
          /engineering/backend
        </Txt>
        <Txt x={MID} y={446} ink="muted">
          direct memberships only
        </Txt>
      </>
    ),
  };
}

function sessions(): Drawing {
  const segments: [string, number, boolean][] = [
    ['active', 70, true],
    ['quiet', 44, false],
    ['active', 70, true],
    ['too long', 106, false],
  ];
  // Each segment starts where the one before it ends.
  const lefts = segments.map((_, index) =>
    segments.slice(0, index).reduce((sum, [, width]) => sum + width, 14),
  );
  return {
    height: 360,
    draw: (head) => (
      <>
        <Txt x={14} y={28} anchor="start" ink="accent" bold>
          Sign in
        </Txt>
        <Txt x={326} y={28} anchor="end" ink="accent" bold>
          Ceiling
        </Txt>
        {segments.map(([label, width, busy], index) => {
          const left = lefts[index] ?? 14;
          return (
            <g key={`${label}${String(index)}`}>
              <Box x={left} y={40} w={width} h={34} tone={busy ? 'accent' : 'panel'} />
              <Txt x={left + width / 2} y={62} ink={busy ? 'ink' : 'muted'}>
                {label}
              </Txt>
            </g>
          );
        })}
        <line x1={326} x2={326} y1={36} y2={80} stroke="var(--ink-muted)" strokeWidth={2} />
        <Arrow head={head} d={vertical(274, 108, 78)} />
        <Txt x={MID} y={128}>
          Short quiet stretches keep the session alive.
        </Txt>
        <Txt x={MID} y={148}>
          One longer than the idle limit ends it.
        </Txt>
        <Box x={10} y={170} w={320} h={84} />
        <Txt x={MID} y={196} bold size={15}>
          Idle limit
        </Txt>
        <Txt x={MID} y={218} ink="muted">
          quiet for too long, and it ends
        </Txt>
        <Txt x={MID} y={238} ink="muted">
          default 30 minutes
        </Txt>
        <Box x={10} y={266} w={320} h={84} />
        <Txt x={MID} y={292} bold size={15}>
          Absolute limit
        </Txt>
        <Txt x={MID} y={314} ink="muted">
          however busy, it ends at the ceiling
        </Txt>
        <Txt x={MID} y={334} ink="muted">
          default 10 hours
        </Txt>
      </>
    ),
  };
}

function tokens(): Drawing {
  const cards: [number, number, 'accent' | 'panel', string, string[]][] = [
    [
      36,
      96,
      'accent',
      'Access token',
      ['sent to your API', 'a signed JWT, typed at+jwt', 'lives 300 seconds by default'],
    ],
    [144, 74, 'panel', 'ID token', ['read by the app', 'says who signed in']],
    [
      230,
      96,
      'panel',
      'Refresh token',
      ['kept by the app, opaque', 'trades for new tokens', 'works once'],
    ],
  ];
  return {
    height: 498,
    draw: (head) => (
      <>
        <Txt x={MID} y={20} bold>
          One sign-in gives the app three tokens
        </Txt>
        <path
          d="M12 84 L5 84 L5 278 L12 278 M5 181 L12 181"
          fill="none"
          stroke="var(--ink-muted)"
          strokeWidth={1.8}
        />
        {cards.map(([y, h, tone, title, lines]) => (
          <g key={title}>
            <Box x={14} y={y} w={316} h={h} tone={tone} />
            <Txt x={172} y={y + 24} bold size={15}>
              {title}
            </Txt>
            {lines.map((line, row) => (
              <Txt key={line} x={172} y={y + 44 + row * 18} ink="muted">
                {line}
              </Txt>
            ))}
          </g>
        ))}
        <Txt x={MID} y={360} bold>
          A refresh token used twice
        </Txt>
        {['R1', 'R2', 'R3'].map((name, index) => (
          <g key={name}>
            <Box x={24 + index * 112} y={374} w={72} h={36} tone="accent" />
            <Txt x={60 + index * 112} y={397} mono>
              {name}
            </Txt>
          </g>
        ))}
        <Arrow head={head} d="M98 392 L134 392" />
        <Arrow head={head} d="M210 392 L246 392" />
        <Arrow head={head} d={vertical(60, 414, 444)} dashed />
        <Box x={10} y={446} w={320} h={40} />
        <Txt x={MID} y={471}>
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
        <Txt x={24} y={32} anchor="start" bold size={15}>
          Consent
        </Txt>
        {[
          ['The client asks', 46],
          ['The person decides', 96],
          ['A grant is recorded', 146],
        ].map(([label, y]) => (
          <g key={String(label)}>
            <Box x={24} y={Number(y)} w={292} h={34} tone="accent" />
            <Txt x={MID} y={Number(y) + 22}>
              {String(label)}
            </Txt>
          </g>
        ))}
        <Arrow head={head} d={vertical(MID, 82, 94)} />
        <Arrow head={head} d={vertical(MID, 132, 144)} />
        <Txt x={MID} y={208} ink="muted">
          asked again only for something more
        </Txt>
        <Box x={10} y={240} w={320} h={216} />
        <Txt x={24} y={264} anchor="start" bold size={15}>
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
            <Txt x={MID} y={299 + index * 40}>
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
