import { randomBytes } from 'node:crypto';
import { psql, publish, seed, type Account, type Seeded, inTenant, UNBROKEN } from './stack';

const TENANT_ADMIN = 'odudu-admin:tenant-admin';

function password(): string {
  return randomBytes(18).toString('base64url');
}

function subject(account: Account, ...extra: string[]): void {
  seed([
    'user',
    '--tenant',
    account.tenant,
    '--username',
    account.username,
    // Joined with `=`: a base64url password can begin with `-`, which
    // parseArgs would otherwise read as another option.
    `--password=${account.password}`,
    ...extra,
  ]);
}

function grant(account: Account, role: string): void {
  seed(['grant-role', '--tenant', account.tenant, '--username', account.username, '--role', role]);
}

function administrator(account: Account, ...extra: string[]): void {
  subject(account, ...extra);
  grant(account, TENANT_ADMIN);
}

// The groups and roles the Groups and Roles tests change, each changed by one
// test alone. `deep` nests `middle`, which nests view-users, so its reach is
// deeper than the console reads.
function seedGroupsRoles(tenant: string): void {
  seed(['tenant', '--name', tenant]);
  const groups = [
    ['eng'],
    ['platform', '/eng'],
    ['finance'],
    ['admins'],
    ['oncall', '/admins'],
    ['movable'],
    ['doomed'],
    ['child', '/doomed'],
    ['raced'],
    ['keyed'],
    ['dup'],
    ['dup', '/finance'],
    [UNBROKEN],
    [UNBROKEN, `/${UNBROKEN}`],
  ];
  for (const [name, parent] of groups) {
    seed([
      'group',
      '--tenant',
      tenant,
      '--name',
      name ?? '',
      ...(parent === undefined ? [] : ['--parent', parent]),
    ]);
  }
  seed([
    'map-group-role',
    '--tenant',
    tenant,
    '--group',
    '/admins',
    '--role',
    'odudu-admin:view-users',
  ]);
  seed([
    'client',
    '--tenant',
    tenant,
    '--client-id',
    'portal',
    '--public',
    '--redirect-uri',
    'https://portal.example/callback',
  ]);
  for (const name of ['auditor', 'reader', 'helper', 'middle', 'deep']) {
    seed(['role', '--tenant', tenant, '--name', name]);
  }
  seed(['role', '--tenant', tenant, '--name', 'reader', '--client-id', 'portal']);
  nest(tenant, 'helper', 'odudu-admin:view-users');
  nest(tenant, 'middle', 'odudu-admin:view-users');
  nest(tenant, 'deep', 'middle');
}

// The clients the Clients tests change, each changed by one test alone, and
// one whose name and address are far wider than a phone.
function seedClients(tenant: string): void {
  seed(['tenant', '--name', tenant]);
  const confidential = (clientId: string, ...extra: string[]): void => {
    seed([
      'client',
      '--tenant',
      tenant,
      '--client-id',
      clientId,
      `--client-secret=${password()}`,
      '--redirect-uri',
      `https://${clientId}.example/callback`,
      ...extra,
    ]);
  };
  const own = ['ledger', 'closed', 'doomed', 'held', UNBROKEN];
  // One per test that changes its tokens, scopes, keys, secret or service account.
  const configured = [
    'tokens',
    'scoped',
    'keyed',
    'rotated',
    'serviced',
    'kbtokens',
    'kbadvanced',
    'racedtokens',
    'racedadvanced',
    'racedservice',
  ];
  for (const clientId of [...own, ...configured]) confidential(clientId);
  seed(['scope', '--tenant', tenant, '--name', 'reports:read']);
  seed(['role', '--tenant', tenant, '--name', 'reader']);
  seed(['role', '--tenant', tenant, '--name', 'writer']);
  seed(['role', '--tenant', tenant, '--name', 'approver', '--client-id', 'ledger']);
  confidential('lists', '--web-origin', 'https://lists.example');
  seed([
    'client',
    '--tenant',
    tenant,
    '--client-id',
    'kiosk',
    '--public',
    '--redirect-uri',
    'https://kiosk.example/callback',
  ]);
  // Its service account holds an admin capability, which a caller without it cannot reach past.
  psql(
    `insert into subject_roles (tenant_id, subject_id, role_id) select t.id, c.service_subject_id, r.id from tenants t join clients c on c.tenant_id = t.id and c.client_id = 'held' join roles r on r.tenant_id = t.id and r.name = 'manage-users' and r.client_id = (select id from clients where tenant_id = t.id and client_id = 'odudu-admin') where t.name = '${tenant}'`,
  );
  psql(
    `update clients set name = 'Ledger', description = 'Keeps the books' where client_id = 'ledger' and tenant_id = ${inTenant(tenant)}`,
  );
  psql(
    `update clients set description = '${UNBROKEN.repeat(4)}' where client_id = '${UNBROKEN}' and tenant_id = ${inTenant(tenant)}`,
  );
}

// The scopes the Scopes tests change, each changed by one test alone, a
// public and a confidential client to carry them, and a role reaching a
// capability the operator holding manage-tenant alone lacks.
function seedScopes(tenant: string): void {
  seed(['tenant', '--name', tenant]);
  seed([
    'client',
    '--tenant',
    tenant,
    '--client-id',
    'portal',
    '--public',
    '--redirect-uri',
    'https://portal.example/callback',
  ]);
  seed([
    'client',
    '--tenant',
    tenant,
    '--client-id',
    'billing',
    `--client-secret=${password()}`,
    '--redirect-uri',
    'https://billing.example/callback',
  ]);
  for (const name of ['auditor', 'helper']) seed(['role', '--tenant', tenant, '--name', name]);
  nest(tenant, 'helper', 'odudu-admin:view-users');
  const scopes = ['invoices', 'carried', 'raced', 'keyed', 'doomed', 'staffed', 'mapped', UNBROKEN];
  for (const name of scopes) {
    seed(['scope', '--tenant', tenant, '--name', name, '--description', `The ${name} scope`]);
  }
  seed([
    'assign-scope',
    '--tenant',
    tenant,
    '--client-id',
    'billing',
    '--scope',
    'carried',
    '--assignment',
    'default',
  ]);
  seed([
    'assign-scope',
    '--tenant',
    tenant,
    '--client-id',
    'portal',
    '--scope',
    'carried',
    '--assignment',
    'optional',
  ]);
  seed(['map-role', '--tenant', tenant, '--scope', 'staffed', '--role', 'auditor']);
}

// No seed command nests a role, so the edge goes in as the database owner.
// A child named `client:role` is that client's role; any other a tenant role.
function nest(tenant: string, parent: string, child: string): void {
  const role = (name: string): string => {
    const split = name.indexOf(':');
    const own = name.slice(split + 1);
    const owner =
      split === -1
        ? 'r.client_id is null'
        : `r.client_id = (select c.id from clients c where c.tenant_id = t.id and c.client_id = '${name.slice(0, split)}')`;
    return `(select r.id from roles r where r.tenant_id = t.id and r.name = '${own}' and ${owner})`;
  };
  psql(
    `insert into role_composites (tenant_id, parent_role_id, child_role_id) select t.id, ${role(parent)}, ${role(child)} from tenants t where t.name = '${tenant}'`,
  );
}

// The keys tenants each hold the one active key a tenant starts with.
// The tokens tenant holds five live tokens, of one to five uses, which the
// tests revoke and mint among; the flow tenants hold the flow a tenant starts
// with, less the recovery codes where a test adds them.
function seedAccess(access: Seeded['access']): void {
  const { tokens, flows, keys } = access;
  seed(['tenant', '--name', tokens.admin.tenant]);
  administrator(tokens.admin);
  subject(tokens.tenantOnly);
  grant(tokens.tenantOnly, 'odudu-admin:manage-tenant');
  subject(tokens.clientsOnly);
  grant(tokens.clientsOnly, 'odudu-admin:manage-clients');
  for (const uses of ['1', '2', '3', '4', '5']) {
    seed(['registration-token', '--tenant', tokens.admin.tenant, '--uses', uses, '--ttl', '86400']);
  }
  for (const account of [flows.main, flows.keyed, flows.conflict, flows.refused, flows.fixed]) {
    seed(['tenant', '--name', account.tenant]);
    administrator(account);
  }
  subject(flows.fixedTenantOnly);
  grant(flows.fixedTenantOnly, 'odudu-admin:manage-tenant');
  subject(flows.fixedClientsOnly);
  grant(flows.fixedClientsOnly, 'odudu-admin:manage-clients');
  for (const account of [flows.main, flows.keyed]) {
    psql(
      `delete from authentication_executions where authenticator = 'recovery-code' and tenant_id = ${inTenant(account.tenant)}`,
    );
  }
  for (const account of [keys.main, keys.young, keys.raced, keys.keyed, keys.fixed]) {
    seed(['tenant', '--name', account.tenant]);
    administrator(account);
  }
  subject(keys.fixedKeysOnly);
  grant(keys.fixedKeysOnly, 'odudu-admin:manage-keys');
  subject(keys.fixedTenantOnly);
  grant(keys.fixedTenantOnly, 'odudu-admin:manage-tenant');
}

// A tenant per test that saves its settings or its relay, since one ETag
// covers all of a tenant's settings and two tests would meet in a 412.
function seedConfig(config: Seeded['config']): void {
  const { settings, email } = config;
  const own = [
    ...Object.values(settings).filter((account) => account.username !== 'tesla'),
    ...Object.values(email).filter((account) => account.username !== 'edison'),
  ];
  for (const account of own) {
    seed(['tenant', '--name', account.tenant]);
    administrator(account);
  }
  subject(settings.fixedClientsOnly);
  grant(settings.fixedClientsOnly, 'odudu-admin:manage-clients');
  subject(email.fixedClientsOnly);
  grant(email.fixedClientsOnly, 'odudu-admin:manage-clients');
}

// Names are fresh each run, so a stack kept up between runs seeds again.
export default function globalSetup(): void {
  const run = `e2e-${Date.now().toString(36)}`;
  const admin = { tenant: `${run}-a`, username: 'grace', password: password() };
  const forced = { tenant: admin.tenant, username: 'hopper', password: password() };
  const expiring = { tenant: admin.tenant, username: 'lovelace', password: password() };
  const other = { tenant: `${run}-b`, username: 'ada', password: password() };
  const system = { tenant: 'system', username: `root-${run}`, password: password() };
  const limited = { tenant: admin.tenant, username: 'babbage', password: password() };
  const overview = { tenant: `${run}-c`, username: 'turing', password: password() };
  const resumer = { tenant: 'system', username: `resume-${run}`, password: password() };
  const systemAdmins = {
    candidate: { tenant: 'system', username: `candidate-${run}`, password: password() },
    revokee: { tenant: 'system', username: `revokee-${run}`, password: password() },
    limited: { tenant: 'system', username: `watcher-${run}`, password: password() },
    bystander: { tenant: 'system', username: `bystander-${run}`, password: password() },
    created: `created-${run}`,
  };
  const subjects = {
    admin: { tenant: `${run}-s`, username: 'noether', password: password() },
    viewer: { tenant: `${run}-s`, username: 'watcher', password: password() },
    edited: 'ada',
    conflict: 'augusta',
    typed: 'hypatia',
    keyed: 'euclid',
    measured: 'somerville',
    locked: { tenant: `${run}-s`, username: 'lamarr', password: password() },
    issued: { tenant: `${run}-s`, username: 'franklin', password: password() },
    doomed: 'turing',
    departing: { tenant: `${run}-s`, username: 'meitner', password: password() },
    renamer: { tenant: `${run}-t`, username: 'hamilton', password: password() },
    renamed: 'rena',
    prefix: `made-${run}`,
    member: 'curie',
    asked: { tenant: `${run}-s`, username: 'lise', password: password() },
    holder: 'sklodowska',
    listed: 'yalow',
    ender: { tenant: `${run}-s`, username: 'rosalind', password: password() },
    raced: 'hodgkin',
    resumer: { tenant: `${run}-s`, username: 'kovalevskaya', password: password() },
    drafted: 'germain',
  };
  const groupsRoles = {
    admin: { tenant: `${run}-r`, username: 'ines', password: password() },
    limited: { tenant: `${run}-r`, username: 'kepler', password: password() },
    member: 'curie',
  };
  const clients = {
    admin: { tenant: `${run}-k`, username: 'gauss', password: password() },
    limited: { tenant: `${run}-k`, username: 'euler', password: password() },
    // Holds manage-clients and manage-sessions, and no admin capability a tenant administrator holds.
    sessions: { tenant: `${run}-k`, username: 'noether', password: password() },
    // Signs in through a client, which gives it a session and a grant to list and revoke.
    walkers: [
      { tenant: `${run}-k`, username: 'wiles', password: password() },
      { tenant: `${run}-k`, username: 'tao', password: password() },
      { tenant: `${run}-k`, username: 'ramanujan', password: password() },
    ],
  };
  const scopes = {
    admin: { tenant: `${run}-p`, username: 'cantor', password: password() },
    tenantOnly: { tenant: `${run}-p`, username: 'dedekind', password: password() },
    clientsOnly: { tenant: `${run}-p`, username: 'hilbert', password: password() },
  };
  const access = {
    tokens: {
      admin: { tenant: `${run}-q`, username: 'rutherford', password: password() },
      tenantOnly: { tenant: `${run}-q`, username: 'bohr', password: password() },
      clientsOnly: { tenant: `${run}-q`, username: 'curie', password: password() },
    },
    flows: {
      main: { tenant: `${run}-w1`, username: 'fermi', password: password() },
      keyed: { tenant: `${run}-w2`, username: 'dirac', password: password() },
      conflict: { tenant: `${run}-w3`, username: 'planck', password: password() },
      refused: { tenant: `${run}-w4`, username: 'heisenberg', password: password() },
      fixed: { tenant: `${run}-w5`, username: 'pauli', password: password() },
      fixedTenantOnly: { tenant: `${run}-w5`, username: 'born', password: password() },
      fixedClientsOnly: { tenant: `${run}-w5`, username: 'schrodinger', password: password() },
    },
    keys: {
      main: { tenant: `${run}-y1`, username: 'shannon', password: password() },
      young: { tenant: `${run}-y2`, username: 'turing', password: password() },
      raced: { tenant: `${run}-y3`, username: 'diffie', password: password() },
      keyed: { tenant: `${run}-y4`, username: 'hellman', password: password() },
      fixed: { tenant: `${run}-y5`, username: 'rivest', password: password() },
      fixedKeysOnly: { tenant: `${run}-y5`, username: 'shamir', password: password() },
      fixedTenantOnly: { tenant: `${run}-y5`, username: 'adleman', password: password() },
    },
  };
  const config = {
    settings: {
      main: { tenant: `${run}-s1`, username: 'maxwell', password: password() },
      rebase: { tenant: `${run}-s2`, username: 'faraday', password: password() },
      behind: { tenant: `${run}-s3`, username: 'kelvin', password: password() },
      keyed: { tenant: `${run}-s4`, username: 'joule', password: password() },
      general: { tenant: `${run}-s5`, username: 'ohm', password: password() },
      disable: { tenant: `${run}-s6`, username: 'volta', password: password() },
      fixed: { tenant: `${run}-s7`, username: 'ampere', password: password() },
      fixedClientsOnly: { tenant: `${run}-s7`, username: 'tesla', password: password() },
    },
    email: {
      main: { tenant: `${run}-m1`, username: 'morse', password: password() },
      keyed: { tenant: `${run}-m2`, username: 'bell', password: password() },
      removal: { tenant: `${run}-m3`, username: 'marconi', password: password() },
      refused: { tenant: `${run}-m4`, username: 'baird', password: password() },
      fixed: { tenant: `${run}-m5`, username: 'hertz', password: password() },
      fixedClientsOnly: { tenant: `${run}-m5`, username: 'edison', password: password() },
    },
  };
  const tenants = {
    general: `${run}-d`,
    source: `${run}-e`,
    conflict: `${run}-f`,
    resume: `${run}-g`,
    prefix: `${run}-n`,
  };

  seed(['tenant', '--name', admin.tenant]);
  seed(['tenant', '--name', other.tenant]);
  seed(['tenant', '--name', overview.tenant]);
  for (const name of [tenants.general, tenants.source, tenants.conflict, tenants.resume]) {
    seed(['tenant', '--name', name]);
  }
  seed([
    'client',
    '--tenant',
    tenants.source,
    '--client-id',
    'billing',
    `--client-secret=${password()}`,
    '--redirect-uri',
    'https://billing.example/callback',
  ]);
  administrator(admin);
  administrator(forced, '--require-password-change');
  administrator(expiring);
  administrator(other);
  administrator(overview);
  subject(limited);
  grant(limited, 'odudu-admin:manage-tenant');
  seed(['tenant', '--name', subjects.admin.tenant]);
  administrator(subjects.admin);
  subject(subjects.viewer);
  grant(subjects.viewer, 'odudu-admin:view-users');
  for (const username of [
    subjects.edited,
    subjects.conflict,
    subjects.typed,
    subjects.keyed,
    subjects.measured,
  ]) {
    subject({ tenant: subjects.admin.tenant, username, password: password() });
  }
  subject(subjects.locked);
  subject(subjects.issued);
  subject({ tenant: subjects.admin.tenant, username: subjects.doomed, password: password() });
  administrator(subjects.departing);
  subject(
    { tenant: subjects.admin.tenant, username: subjects.member, password: password() },
    `--email=${subjects.member}@example.test`,
  );
  for (const username of [subjects.holder, subjects.listed, subjects.raced, subjects.drafted]) {
    subject({ tenant: subjects.admin.tenant, username, password: password() });
  }
  subject(subjects.asked);
  grant({ ...subjects.admin, username: subjects.listed }, 'odudu-admin:view-audit');
  administrator(subjects.ender);
  administrator(subjects.resumer);
  for (const name of ['ops', 'finance']) {
    seed(['group', '--tenant', subjects.admin.tenant, '--name', name]);
  }
  for (const name of ['auditor', 'billing-reader']) {
    seed(['role', '--tenant', subjects.admin.tenant, '--name', name]);
  }
  seed([
    'map-group-role',
    '--tenant',
    subjects.admin.tenant,
    '--group',
    '/finance',
    '--role',
    'billing-reader',
  ]);
  seedClients(clients.admin.tenant);
  administrator(clients.admin);
  subject(clients.limited);
  grant(clients.limited, 'odudu-admin:manage-clients');
  subject(clients.sessions);
  grant(clients.sessions, 'odudu-admin:manage-clients');
  grant(clients.sessions, 'odudu-admin:manage-sessions');
  for (const walker of clients.walkers) subject(walker);
  seedScopes(scopes.admin.tenant);
  administrator(scopes.admin);
  subject(scopes.tenantOnly);
  grant(scopes.tenantOnly, 'odudu-admin:manage-tenant');
  subject(scopes.clientsOnly);
  grant(scopes.clientsOnly, 'odudu-admin:manage-clients');
  seedAccess(access);
  seedConfig(config);
  seedGroupsRoles(groupsRoles.admin.tenant);
  administrator(groupsRoles.admin);
  subject(groupsRoles.limited);
  grant(groupsRoles.limited, 'odudu-admin:manage-tenant');
  subject({ tenant: groupsRoles.admin.tenant, username: groupsRoles.member, password: password() });
  seed([
    'join-group',
    '--tenant',
    groupsRoles.admin.tenant,
    '--username',
    groupsRoles.member,
    '--group',
    '/eng',
  ]);
  seed(['tenant', '--name', subjects.renamer.tenant]);
  administrator(subjects.renamer);
  subject({ tenant: subjects.renamer.tenant, username: subjects.renamed, password: password() });
  // Creates the system tenant; its own generated password is not used.
  seed(['admin', '--username', `boot-${run}`]);
  administrator(system);
  administrator(resumer);
  subject(systemAdmins.candidate);
  administrator(systemAdmins.revokee);
  subject(systemAdmins.limited);
  subject(systemAdmins.bystander);
  grant(systemAdmins.limited, 'odudu-admin:manage-tenants');
  grant(systemAdmins.limited, 'odudu-admin:view-users');

  publish({
    admin,
    forced,
    expiring,
    other,
    system,
    limited,
    overview,
    resumer,
    tenants,
    systemAdmins,
    subjects,
    clients,
    groupsRoles,
    scopes,
    access,
    config,
  });
}
