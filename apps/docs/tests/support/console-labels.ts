// Where each bold name on a console page is defined: the files that render
// that control and the text there that gives the name. A name that means
// something in more than one place (a tab, a menu entry, a section) lists each
// place a page uses it. A name built from a template (`Create ${noun}`) lists
// the template and the file that binds each part, and the test expands it. A
// name a page quotes that is not here fails, so a new quotation is a new row,
// read against its screen.
export interface Evidence {
  readonly file: string;
  readonly text: string;
}

export interface Defined {
  readonly evidence: readonly Evidence[];
  // For a template: the values its parts take, which must expand to the name.
  readonly expand?: {
    readonly template: string;
    readonly values: Readonly<Record<string, string>>;
  };
}

const FEATURES = 'apps/admin-console/src/features';
const SHARED = 'apps/admin-console/src/shared';
const MESSAGES = 'packages/protocol-oidc/src/view/messages.ts';

const at = (file: string, ...texts: readonly string[]): Defined => ({
  evidence: texts.map((text) => ({ file, text })),
});

const several = (...parts: readonly Defined[]): Defined => ({
  evidence: parts.flatMap((part) => part.evidence),
});

const feature = (path: string, ...texts: readonly string[]): Defined =>
  at(`${FEATURES}/${path}`, ...texts);
const shared = (path: string, ...texts: readonly string[]): Defined =>
  at(`${SHARED}/${path}`, ...texts);

function template(
  parts: readonly Evidence[],
  pattern: string,
  values: Readonly<Record<string, string>>,
): Defined {
  return { evidence: parts, expand: { template: pattern, values } };
}

const inFeature = (path: string, text: string): Evidence => ({
  file: `${FEATURES}/${path}`,
  text,
});

// The menu entry of an area, whose label areas.ts gives beside its path.
const AREAS = `${FEATURES}/shell/service/areas.ts`;
const rail = (path: string, label: string): Defined => at(AREAS, `area('${path}', '${label}'`);
const heading = (label: string): Defined => at(AREAS, `heading: '${label}'`);

const tab = (feature_: string, key: string, label: string): Defined =>
  feature(`${feature_}/service/tabs.ts`, `${key}: '${label}'`);
const subjectTab = (key: string, label: string): Defined => tab('subjects', key, label);
const clientTab = (key: string, label: string): Defined => tab('clients', key, label);

const FILTERS = 'audit/view/AuditFilters/AuditFilters.tsx';
const AUDIT_KINDS = 'audit/service/filters.ts';
const EMAIL_PAGE = 'email/view/EmailPage/EmailPage.tsx';
const EMAIL_RELAY = 'email/service/relay.ts';
const EMAIL_MAIL = 'email/service/mail.ts';
const ACCESS = 'settings/service/accessSections.ts';
const PLATFORM = 'settings/service/platformSections.ts';
const KEYS_PAGE = 'signing-keys/view/SigningKeysPage/SigningKeysPage.tsx';
const KEYS_CONFIRM = 'signing-keys/service/confirm.ts';
const TOKENS_PAGE = 'registration-tokens/view/RegistrationTokensPage/RegistrationTokensPage.tsx';
const FLOW_REQUIREMENTS = 'flow/service/requirements.ts';
const SCOPE_GENERAL = 'scopes/view/ScopeRecordPage/GeneralTab.tsx';
const SCOPE_VALUES = 'scopes/service/general.ts';
const CLIENT_NEW = 'clients/view/NewClientPage/NewClientPage.tsx';
const TENANT_NEW = 'tenants/view/NewTenantPage/NewTenantPage.tsx';
const TENANT_IMPORT = 'tenants/view/ImportTenantPage/ImportTenantPage.tsx';
const SYSTEM_PAGE = 'system-admins/view/SystemAdministratorsPage/SystemAdministratorsPage.tsx';
const SUBJECT_PROFILE = 'subjects/view/SubjectRecordPage/ProfileTab.tsx';
const CREATION_FORM = `${SHARED}/view/CreationForm/CreationForm.tsx`;
const DELETE_ZONE = `${SHARED}/view/DeleteZone/DeleteZone.tsx`;

const createWith = (noun: string, page: string): Defined =>
  template(
    [{ file: CREATION_FORM, text: '`Create ${noun}`' }, inFeature(page, `noun="${noun}"`)],
    'Create ${noun}',
    { noun },
  );

const deleteNamed = (page: string, subject: string): Defined =>
  template(
    [{ file: DELETE_ZONE, text: '`Delete ${name}`' }, inFeature(page, '<DeleteZone')],
    'Delete ${name}',
    { name: subject },
  );

export const DEFINED: Readonly<Record<string, Defined>> = {
  // Sign-in, as the console and Odudu's own page word it.
  'Continue to sign-in': feature('session/service/labels.ts', "return 'Continue to sign-in'"),
  Username: several(
    at(MESSAGES, "'login.username': 'Username'"),
    feature('subjects/view/NewSubjectPage/NewSubjectPage.tsx', 'label="Username"'),
    feature(TENANT_NEW, 'label="Username"'),
    feature(EMAIL_RELAY, "username: 'Username'"),
    feature('subjects/view/CapabilityHolders/CapabilityHolders.tsx', "label: 'Username'"),
  ),
  Password: at(MESSAGES, "'login.password': 'Password'"),
  'Sign out': feature('shell/view/RailFooter/RailFooter.tsx', 'Sign out'),
  // The panel a failed page is replaced by.
  'Something went wrong': feature(
    'failure/service/wording.ts',
    "FAILURE_TITLE = 'Something went wrong'",
  ),
  'Try again': feature('failure/service/wording.ts', "TRY_AGAIN_LABEL = 'Try again'"),
  'Back to overview': feature(
    'failure/service/wording.ts',
    "BACK_TO_OVERVIEW_LABEL = 'Back to overview'",
  ),
  'Reload the console': feature(
    'failure/service/wording.ts',
    "RELOAD_LABEL = 'Reload the console'",
  ),
  'Error ID': feature('failure/service/report.ts', '`Error ID: ${report.id}`'),
  Copy: shared('view/CopyValue/CopyValue.tsx', 'Copy'),
  'Back to system': shared('view/ContextBar/ContextBar.tsx', 'Back to system'),

  // The menu: its headings and its entries.
  SYSTEM: heading('System'),
  IDENTITY: heading('Identity'),
  APPLICATIONS: heading('Applications'),
  SECURITY: heading('Security'),
  TENANT: heading('Tenant'),
  OBSERVE: heading('Observe'),
  Overview: several(
    at(AREAS, "area('', 'Overview'"),
    feature('overview/view/OverviewPage/OverviewPage.tsx', 'title="Overview"'),
  ),
  Subjects: rail('subjects', 'Subjects'),
  Groups: several(rail('groups', 'Groups'), subjectTab('groups', 'Groups')),
  Roles: several(
    rail('roles', 'Roles'),
    subjectTab('roles', 'Roles'),
    tab('groups', 'roles', 'Roles'),
    tab('scopes', 'roles', 'Roles'),
    clientTab('roles', 'Roles'),
  ),
  Clients: several(rail('clients', 'Clients'), tab('scopes', 'clients', 'Clients')),
  Scopes: several(rail('scopes', 'Scopes'), clientTab('scopes', 'Scopes')),
  'Registration tokens': rail('registration-tokens', 'Registration tokens'),
  'Sign-in flow': rail('flow', 'Sign-in flow'),
  'Signing keys': rail('keys', 'Signing keys'),
  Sessions: several(
    rail('sessions', 'Sessions'),
    subjectTab('sessions', 'Sessions'),
    clientTab('sessions', 'Sessions'),
    feature(ACCESS, "title: 'Sessions'"),
  ),
  Settings: rail('settings', 'Settings'),
  Email: several(
    rail('email', 'Email'),
    feature('subjects/view/NewSubjectPage/NewSubjectPage.tsx', 'label="Email"'),
    feature(TENANT_NEW, 'label="Email"'),
  ),
  Export: several(
    rail('export', 'Export'),
    feature('tenants/view/TenantRecordPage/TenantRecordPage.tsx', "'Export'"),
  ),
  'Audit trail': rail('audit', 'Audit trail'),
  Tenants: rail('tenants', 'Tenants'),
  'System administrators': rail('system-admins', 'System administrators'),

  // Tabs of a record.
  Profile: subjectTab('profile', 'Profile'),
  Credentials: subjectTab('credentials', 'Credentials'),
  'Required actions': feature('subjects/service/tabs.ts', "'required-actions': 'Required actions'"),
  Consents: subjectTab('consents', 'Consents'),
  Grants: subjectTab('grants', 'Grants'),
  Activity: several(
    subjectTab('activity', 'Activity'),
    clientTab('activity', 'Activity'),
    tab('groups', 'activity', 'Activity'),
    tab('roles', 'activity', 'Activity'),
    tab('scopes', 'activity', 'Activity'),
  ),
  General: several(
    clientTab('general', 'General'),
    tab('groups', 'general', 'General'),
    tab('roles', 'general', 'General'),
    tab('scopes', 'general', 'General'),
    feature('tenants/view/GeneralTab/GeneralTab.tsx', 'title="General"'),
    feature(ACCESS, "title: 'General'"),
  ),
  'Redirects & origins': clientTab('redirects', 'Redirects & origins'),
  Tokens: clientTab('tokens', 'Tokens'),
  Logout: clientTab('logout', 'Logout'),
  Advanced: clientTab('advanced', 'Advanced'),
  'Service account': clientTab('service', 'Service account'),
  Members: several(tab('groups', 'members', 'Members'), tab('roles', 'members', 'Members')),
  Composites: tab('roles', 'composites', 'Composites'),
  'Claim mappers': tab('scopes', 'mappers', 'Claim mappers'),
  Administrators: feature('tenants/view/TenantRecordPage/TenantRecordPage.tsx', "'Administrators'"),

  // Creating things.
  'Create a tenant': feature('tenants/view/TenantsPage/TenantsPage.tsx', '> Create a tenant <'),
  'Create a client': feature('clients/view/ClientsPage/ClientsPage.tsx', '> Create a client <'),
  'Create a subject': feature(
    'subjects/view/SubjectsPage/SubjectsPage.tsx',
    '> Create a subject <',
  ),
  'Create a group': feature('groups/view/GroupsPage/GroupsPage.tsx', '> Create a group <'),
  'Create a role': feature('roles/view/RolesPage/RolesPage.tsx', '> Create a role <'),
  'Create a scope': feature('scopes/view/ScopesPage/ScopesPage.tsx', '> Create a scope <'),
  'Restore built-in scopes': feature(
    'scopes/view/ScopesPage/RestoreScopes.tsx',
    '>Restore built-in scopes<',
  ),
  Restore: feature('scopes/view/ScopesPage/RestoreScopes.tsx', 'confirmLabel="Restore"'),
  'Include all roles in tokens': feature(
    'clients/service/tokens.ts',
    "FULL_SCOPE_LABEL = 'Include all roles in tokens'",
  ),
  'Used because nothing is bound': feature(
    'scopes/service/mappers.ts',
    "DEFAULT_MAPPER_NOTE = 'Used because nothing is bound'",
  ),
  'Create a copy': feature('roles/view/RoleRecordPage/RoleRecordPage.tsx', '> Create a copy <'),
  'Import a tenant': several(
    feature('tenants/view/TenantsPage/TenantsPage.tsx', '>Import a tenant<'),
    feature(TENANT_IMPORT, 'title="Import a tenant"'),
  ),
  'Create tenant': feature(TENANT_NEW, "'Create tenant'"),
  'Create client': createWith('client', CLIENT_NEW),
  'Create subject': createWith('subject', 'subjects/view/NewSubjectPage/NewSubjectPage.tsx'),
  'Create group': createWith('group', 'groups/view/NewGroupPage/NewGroupPage.tsx'),
  'Create role': createWith('role', 'roles/view/NewRolePage/NewRolePage.tsx'),
  'Create scope': createWith('scope', 'scopes/view/NewScopePage/NewScopePage.tsx'),
  'Create administrator': feature(TENANT_NEW, "'Create administrator'"),
  'Create a new subject as an administrator': feature(
    SYSTEM_PAGE,
    '>Create a new subject as an administrator<',
  ),
  Name: several(
    feature(TENANT_NEW, 'label="Name"'),
    feature(TENANT_IMPORT, 'label="Name"'),
    feature(CLIENT_NEW, 'label="Name"'),
    at(CREATION_FORM, 'label="Name"'),
  ),
  'Display name': several(
    feature(TENANT_NEW, 'label="Display name"'),
    feature(TENANT_IMPORT, 'label="Display name"'),
    feature('tenants/usecase/useTenantGeneral.ts', "label: 'Display name'"),
  ),
  Description: several(
    at(CREATION_FORM, 'label="Description"'),
    feature(CLIENT_NEW, 'label="Description"'),
  ),
  'Client ID': feature(CLIENT_NEW, 'label="Client ID"'),
  Kind: feature(CLIENT_NEW, 'label="Kind"'),
  'Web application': feature('clients/service/create.ts', "label: 'Web application'"),
  Service: feature('clients/service/create.ts', "label: 'Service'"),
  'Public application': feature('clients/service/create.ts', "label: 'Public application'"),
  'Redirect URIs': several(
    feature(CLIENT_NEW, 'label="Redirect URIs"'),
    feature('clients/view/RedirectsTab/RedirectsTab.tsx', 'label="Redirect URIs"'),
  ),
  'Post-logout redirect URIs': feature(
    'clients/view/LogoutTab/LogoutTab.tsx',
    'label="Post-logout redirect URIs"',
  ),
  Parent: feature('groups/view/NewGroupPage/NewGroupPage.tsx', 'label="Parent"'),
  'Enter demo': template(
    [inFeature('tenants/view/TenantsPage/TenantsPage.tsx', '`Enter ${tenant.name}`')],
    'Enter ${tenant.name}',
    { 'tenant.name': 'demo' },
  ),
  'Open demo': template([inFeature(TENANT_NEW, '`Open ${step.tenant}`')], 'Open ${step.tenant}', {
    'step.tenant': 'demo',
  }),

  // Finding things in a list.
  Capability: feature('subjects/view/SubjectsPage/SubjectsPage.tsx', 'label="Capability"'),
  Status: several(
    feature('subjects/view/SubjectsPage/SubjectsPage.tsx', 'label="Status"'),
    feature('tenants/view/TenantsPage/TenantsPage.tsx', 'label="Status"'),
    feature('subjects/view/CapabilityHolders/CapabilityHolders.tsx', 'label="Status"'),
  ),
  Holds: feature('subjects/view/CapabilityHolders/CapabilityHolders.tsx', 'label="Holds"'),
  'Belongs to': feature('roles/view/RolesPage/RolesPage.tsx', 'label="Belongs to"'),
  Previous: shared('view/Pager/Pager.tsx', 'Previous'),
  Next: shared('view/Pager/Pager.tsx', 'Next'),

  // Subjects.
  'Issue a one-time password': feature(
    'subjects/view/SubjectRecordPage/CredentialsTab.tsx',
    'Issue a one-time password',
  ),
  'Issue password': feature('subjects/service/credentials.ts', "confirmLabel: 'Issue password'"),
  'Send a password reset email': feature(
    'subjects/view/SubjectRecordPage/CredentialsTab.tsx',
    '> Send a password reset email <',
  ),
  'Revoke recovery codes': feature(
    'subjects/service/credentials.ts',
    "confirmLabel: 'Revoke recovery codes'",
  ),
  'Revoke grants': feature(
    'subjects/view/SubjectRecordPage/GrantsTab.tsx',
    'confirmLabel="Revoke grants"',
  ),
  'End session': feature(
    'subjects/view/SubjectRecordPage/SessionsTab.tsx',
    'confirmLabel="End session"',
  ),
  'End every session': several(
    feature('subjects/view/SubjectRecordPage/SessionsTab.tsx', 'confirmLabel="End every session"'),
    feature(
      'tenant-sessions/view/TenantSessionsPage/TenantSessionsPage.tsx',
      'confirmLabel="End every session"',
    ),
  ),
  'Admin capabilities': feature(
    'subjects/view/SubjectRecordPage/CapabilityEditor.tsx',
    'title="Admin capabilities"',
  ),
  'Disable ada': template([inFeature(SUBJECT_PROFILE, '`Disable ${name}`')], 'Disable ${name}', {
    name: 'ada',
  }),
  'Delete ada': template([inFeature(SUBJECT_PROFILE, '`Delete ${name}`')], 'Delete ${name}', {
    name: 'ada',
  }),
  Delete: several(
    at(DELETE_ZONE, 'title="Delete"'),
    feature(SUBJECT_PROFILE, 'title="Delete"'),
    feature(KEYS_PAGE, '> Delete <'),
  ),

  // Groups and roles.
  'Place in the tree': feature(
    'groups/view/GroupRecordPage/GeneralTab.tsx',
    'title="Place in the tree"',
  ),
  'Save Place in the tree': feature(
    'groups/view/GroupRecordPage/GeneralTab.tsx',
    'confirmLabel="Save Place in the tree"',
  ),
  'Save Roles': feature('groups/view/GroupRecordPage/RolesTab.tsx', 'confirmLabel="Save Roles"'),
  'Joined by every new subject': feature(
    'groups/view/GroupRecordPage/GeneralTab.tsx',
    'label="Joined by every new subject"',
  ),
  'Delete /eng and every group beneath it': template(
    [
      inFeature(
        'groups/view/GroupRecordPage/GeneralTab.tsx',
        '`Delete ${path} and every group beneath it`',
      ),
    ],
    'Delete ${path} and every group beneath it',
    { path: '/eng' },
  ),
  'Given to every new subject': feature(
    'roles/view/RoleRecordPage/GeneralTab.tsx',
    'label="Given to every new subject"',
  ),
  'Add a composite': feature(
    'roles/view/RoleRecordPage/CompositesTab.tsx',
    'title="Add a composite"',
  ),
  'Take it out': feature(
    'roles/view/RoleRecordPage/CompositesTab.tsx',
    'confirmLabel="Take it out"',
  ),
  'Delete reader': deleteNamed('roles/view/RoleRecordPage/GeneralTab.tsx', 'reader'),
  'admin capability': shared('service/capabilities/held.ts', "'admin capability'"),

  // Clients.
  'Delete my-app': deleteNamed('clients/view/GeneralTab/GeneralTab.tsx', 'my-app'),
  'Rotate the secret of my-app': template(
    [
      inFeature(
        'clients/view/AdvancedTab/AdvancedTab.tsx',
        '`Rotate the secret of ${client.name}`',
      ),
    ],
    'Rotate the secret of ${client.name}',
    { 'client.name': 'my-app' },
  ),
  'Rotate secret': feature(
    'clients/view/AdvancedTab/AdvancedTab.tsx',
    'confirmLabel="Rotate secret"',
  ),
  'Grace period': feature('clients/service/secret.ts', "GRACE_LABEL = 'Grace period'"),
  'Revoke every token': feature(
    'clients/service/sessions.ts',
    "REVOKE_HEADING = 'Revoke every token'",
  ),
  'Evaluate claims': feature('clients/service/evaluate.ts', "'Evaluate claims'"),

  // Scopes.
  Default: shared('service/assignment.ts', "'Default'"),
  Optional: shared('service/assignment.ts', "'Optional'"),
  'In the ID token': feature(SCOPE_VALUES, "'In the ID token'"),
  'In the access token': feature(SCOPE_VALUES, "'In the access token'"),
  'For a client made from now on': feature(SCOPE_VALUES, "'For a client made from now on'"),
  'Consent text': feature(SCOPE_GENERAL, 'label="Consent text"'),
  'Display order': feature(SCOPE_GENERAL, 'label="Display order"'),
  'Client to assign': feature(
    'scopes/view/ScopeRecordPage/ClientsTab.tsx',
    'label="Client to assign"',
  ),
  'Assign to a client': feature(
    'scopes/view/ScopeRecordPage/ClientsTab.tsx',
    'title="Assign to a client"',
  ),
  'Bound mappers': feature('scopes/view/ScopeRecordPage/MappersTab.tsx', 'label="Bound mappers"'),
  'Delete reports:read': deleteNamed('scopes/view/ScopeRecordPage/GeneralTab.tsx', 'reports:read'),

  // Registration tokens.
  'Mint a registration token': feature(TOKENS_PAGE, 'title="Mint a registration token"'),
  'Mint token': feature(TOKENS_PAGE, "'Mint token'"),
  Uses: feature(TOKENS_PAGE, 'label="Uses"'),
  Lifetime: feature(TOKENS_PAGE, 'label="Lifetime"'),
  'Uses left': feature(TOKENS_PAGE, "header: 'Uses left'"),
  Revoke: feature(TOKENS_PAGE, '> Revoke <'),
  'Revoke token': feature(TOKENS_PAGE, 'confirmLabel="Revoke token"'),
  Policy: feature(PLATFORM, "label: 'Policy'"),
  'Closed: only an administrator creates clients': feature(
    PLATFORM,
    "label: 'Closed: only an administrator creates clients'",
  ),
  'With a registration token': feature(PLATFORM, "label: 'With a registration token'"),

  // The sign-in flow.
  Steps: feature('flow/view/FlowPage/FlowPage.tsx', 'title="Steps"'),
  Required: feature(FLOW_REQUIREMENTS, "label: 'Required'"),
  Alternative: feature(FLOW_REQUIREMENTS, "label: 'Alternative'"),
  Conditional: feature(FLOW_REQUIREMENTS, "label: 'Conditional'"),
  Disabled: feature(FLOW_REQUIREMENTS, "label: 'Disabled'"),
  Up: feature('flow/view/FlowPage/FlowPage.tsx', '> Up <'),
  Down: feature('flow/view/FlowPage/FlowPage.tsx', '> Down <'),
  'Requirement for password': template(
    [inFeature('flow/view/FlowPage/FlowPage.tsx', '`Requirement for ${step.authenticator}`')],
    'Requirement for ${step.authenticator}',
    { 'step.authenticator': 'password' },
  ),
  'Save Steps': template(
    [
      { file: `${SHARED}/view/SaveBar/SaveBar.tsx`, text: '`${verb} ${section}`' },
      { file: `${SHARED}/view/SaveBar/SaveBar.tsx`, text: "(saveLabel ?? 'Save')" },
      inFeature('flow/view/FlowPage/FlowPage.tsx', 'title="Steps"'),
    ],
    'Save ${section}',
    { section: 'Steps' },
  ),
  Save: shared('view/SaveBar/SaveBar.tsx', "(saveLabel ?? 'Save')"),
  'One-time password': feature('flow/service/otp.ts', "OTP_TITLE = 'One-time password'"),
  'Ask every subject for a one-time password': feature(
    'flow/service/otp.ts',
    "OTP_LABEL = 'Ask every subject for a one-time password'",
  ),

  // Signing keys.
  'Stage a key': feature(KEYS_PAGE, 'title="Stage a key"'),
  'Stage key': feature(KEYS_PAGE, "'Stage key'"),
  Algorithm: feature(KEYS_PAGE, 'label="Algorithm"'),
  Rotating: feature('signing-keys/service/lanes.ts', "title: 'Rotating'"),
  Active: feature('signing-keys/service/lanes.ts', "title: 'Active'"),
  Retired: feature('signing-keys/service/lanes.ts', "title: 'Retired'"),
  Promote: feature(KEYS_PAGE, '> Promote <'),
  Retire: feature(KEYS_PAGE, '> Retire <'),
  'Promote key': feature(KEYS_CONFIRM, "confirmLabel: 'Promote key'"),
  'Retire key': feature(KEYS_CONFIRM, "confirmLabel: 'Retire key'"),
  'Delete key': feature(KEYS_CONFIRM, "confirmLabel: 'Delete key'"),
  Ready: feature('signing-keys/service/promotion.ts', "return 'Ready'"),
  'Not ready': feature('signing-keys/service/promotion.ts', "return 'Not ready'"),
  'Changes algorithm': feature('signing-keys/service/promotion.ts', "return 'Changes algorithm'"),

  // Settings.
  'Registration and recovery': feature(ACCESS, "title: 'Registration and recovery'"),
  'Remember me': feature(ACCESS, "title: 'Remember me'"),
  Usernames: feature(ACCESS, "title: 'Usernames'"),
  'Password policy': feature(ACCESS, "title: 'Password policy'"),
  'Brute force': feature(ACCESS, "title: 'Brute force'"),
  'Token lifetimes': feature(PLATFORM, "title: 'Token lifetimes'"),
  'Dynamic client registration': feature(PLATFORM, "title: 'Dynamic client registration'"),
  'Audit retention': feature(PLATFORM, "title: 'Audit retention'"),
  'Idle timeout': feature(ACCESS, "label: 'Idle timeout'"),
  'Maximum lifetime': feature(ACCESS, "label: 'Maximum lifetime'"),
  'Self-registration': feature(ACCESS, "label: 'Self-registration'"),
  'Verify email addresses': feature(ACCESS, "label: 'Verify email addresses'"),
  'Minimum length': feature(ACCESS, "label: 'Minimum length'"),
  'Password lifetime': feature(ACCESS, "label: 'Password lifetime'"),
  'Failures before a lockout': feature(ACCESS, "label: 'Failures before a lockout'"),
  'Keep events for': feature(PLATFORM, "label: 'Keep events for'"),
  Enabled: feature(ACCESS, "label: 'Enabled'"),
  'Clear all lockouts': feature('settings/service/lockouts.ts', "'Clear all lockouts'"),
  'Disable demo': template(
    [inFeature('tenants/view/GeneralTab/GeneralTab.tsx', 'confirmLabel={`Disable ${name}`}')],
    'Disable ${name}',
    { name: 'demo' },
  ),

  // Email.
  'Mail relay': feature('email/usecase/useRelaySection.ts', "'Mail relay'"),
  Host: feature(EMAIL_RELAY, "host: 'Host'"),
  Port: feature(EMAIL_RELAY, "port: 'Port'"),
  'Sender address': feature(EMAIL_RELAY, "from_address: 'Sender address'"),
  'New password': feature(EMAIL_RELAY, "password: 'New password'"),
  'Require TLS (STARTTLS)': feature(EMAIL_RELAY, "starttls: 'Require TLS (STARTTLS)'"),
  'Remove the stored password': feature(
    EMAIL_RELAY,
    "remove_password: 'Remove the stored password'",
  ),
  'Test message': feature(EMAIL_PAGE, 'title="Test message"'),
  'Send to': feature(EMAIL_PAGE, 'label="Send to"'),
  'Send test message': feature(EMAIL_PAGE, "'Send test message'"),
  'Remove the relay': several(
    feature(EMAIL_PAGE, 'title="Remove the relay"'),
    feature(EMAIL_PAGE, 'confirmLabel="Remove the relay"'),
  ),
  Delivery: feature(EMAIL_MAIL, "'Delivery'"),
  Show: feature('email/view/MailDelivery/MailDelivery.tsx', 'label="Show"'),
  Refresh: feature('email/view/MailDelivery/MailDelivery.tsx', '>Refresh<'),
  Queued: feature(EMAIL_MAIL, "'Queued'"),
  Retrying: feature(EMAIL_MAIL, "'Retrying'"),
  Sent: feature(EMAIL_MAIL, "'Sent'"),
  Failed: several(feature(EMAIL_MAIL, "'Failed'"), feature(AUDIT_KINDS, "'Failed'")),
  'not sent': feature('email/service/effective.ts', "return 'not sent'"),
  'deployment sender': feature('email/service/effective.ts', "return 'deployment sender'"),
  'own relay': feature('email/service/effective.ts', "return 'own relay'"),

  // The audit trail.
  'Event type': feature(FILTERS, 'label="Event type"'),
  Outcome: feature(FILTERS, 'label="Outcome"'),
  Action: feature(FILTERS, 'label="Action"'),
  'Resource type': feature(FILTERS, 'label="Resource type"'),
  'Resource id': feature(FILTERS, 'label="Resource id"'),
  'Actor (subject id)': feature(FILTERS, 'label="Actor (subject id)"'),
  From: feature(FILTERS, 'label="From"'),
  To: feature(FILTERS, 'label="To"'),
  'Apply filters': feature(FILTERS, '> Apply filters <'),
  'Admin change': feature(AUDIT_KINDS, "'Admin change'"),
  'Admin access': feature(AUDIT_KINDS, "'Admin access'"),
  Authentication: feature(AUDIT_KINDS, "'Authentication'"),
  Session: feature(AUDIT_KINDS, "'Session'"),
  Token: feature(AUDIT_KINDS, "'Token'"),
  Credential: feature(AUDIT_KINDS, "'Credential'"),
  Allowed: feature(AUDIT_KINDS, "'Allowed'"),
  Refused: feature(AUDIT_KINDS, "'Refused'"),
  Details: shared('view/AuditTable/AuditTable.tsx', '> Details <'),
  'Export these events': feature('audit/view/AuditPage/AuditPage.tsx', "'Export these events'"),

  // The overview.
  'Needs attention': feature(
    'overview/view/AttentionPanel/AttentionPanel.tsx',
    'title="Needs attention"',
  ),
  Counts: feature('overview/view/CountsPanel/CountsPanel.tsx', 'title="Counts"'),
  Discovery: feature('overview/view/DiscoveryPanel/DiscoveryPanel.tsx', 'title="Discovery"'),
  Issuer: feature('overview/view/DiscoveryPanel/DiscoveryPanel.tsx', '>Issuer<'),
  'Latest activity': feature(
    'overview/view/LatestAudit/LatestAudit.tsx',
    'title="Latest activity"',
  ),
  'Open the audit trail': feature(
    'overview/view/LatestAudit/LatestAudit.tsx',
    '> Open the audit trail <',
  ),

  // Tenants and their administrators.
  'Export to a file': feature('tenants/view/ExportPanel/ExportPanel.tsx', "'Export to a file'"),
  'Include subjects': feature(
    'tenants/view/ExportPanel/ExportPanel.tsx',
    'label="Include subjects"',
  ),
  Import: feature(TENANT_IMPORT, "'Import'"),
  'Choose a file…': feature(TENANT_IMPORT, '> Choose a file… <'),
  'Tenant document': feature(TENANT_IMPORT, '> Tenant document <'),
  'Add an administrator': several(
    feature(SYSTEM_PAGE, '> Add an administrator <'),
    feature('tenants/view/AdministratorsTab/AdministratorsTab.tsx', '>Add an administrator<'),
  ),
  'Subject in system': feature(SYSTEM_PAGE, 'label="Subject in system"'),
  'What they hold': several(
    feature(SYSTEM_PAGE, 'label="What they hold"'),
    feature(TENANT_NEW, 'label="What they hold"'),
  ),
  'Give it to the chosen subject': feature(SYSTEM_PAGE, "'Give it to the chosen subject'"),
  'Full (tenant-admin)': at(`${SHARED}/service/capabilities/holdings.ts`, "'Full (tenant-admin)'"),
  'Change admin@odudu.local’s capabilities': template(
    [
      inFeature(
        'subjects/view/CapabilityHolders/CapabilityHolders.tsx',
        '`Change ${holder.name}’s capabilities`',
      ),
    ],
    'Change ${holder.name}’s capabilities',
    { 'holder.name': 'admin@odudu.local' },
  ),
};
