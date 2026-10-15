export function credentialsKey(tenant: string, id: string) {
  return ['credentials', tenant, id] as const;
}

export const lockoutKey = (tenant: string, id: string) => ['lockout', tenant, id] as const;
