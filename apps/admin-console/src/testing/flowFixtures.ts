import { json, type Answer } from '#/testing/fakeTransport';
import { graceRoutes, ACME_ADMIN } from '#/testing/renderConsole';
import { EVERY_TENANT_CAPABILITY } from '#/testing/roleAnswers';
export const FL = `${ACME_ADMIN}/flow/executions`;
export const ST = `${ACME_ADMIN}/settings`;

export const AVAILABLE = ['password', 'passkey', 'otp', 'recovery-code'];

export function step(index: number, authenticator: string, requirement: string) {
  return { index, authenticator, requirement };
}

// What a tenant starts with, less the recovery codes.
export const FLOW_ITEMS = [
  step(0, 'passkey', 'alternative'),
  step(1, 'password', 'alternative'),
  step(2, 'otp', 'conditional'),
];

export function flowBody(items = FLOW_ITEMS) {
  return { items, available: AVAILABLE };
}

export function flowAnswer(items = FLOW_ITEMS, etag = '"f1"'): Answer {
  return json(flowBody(items), 200, { etag });
}

export function settingsAnswer(otpRequired = false, etag = '"s1"'): Answer {
  return json({ display_name: 'Acme', otp_required: otpRequired }, 200, { etag });
}

// grace of acme holding the capabilities given, with the flow above and otp_required off.
export function flowRoutes(
  capabilities: readonly string[] = EVERY_TENANT_CAPABILITY,
  extra: Record<string, Answer> = {},
): Record<string, Answer> {
  return graceRoutes(
    capabilities,
    {
      [`GET ${FL}`]: flowAnswer(),
      [`GET ${ST}`]: settingsAnswer(),
    },
    extra,
  );
}
