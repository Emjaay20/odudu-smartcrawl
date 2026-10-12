export function disablesTenant(was: boolean, now: boolean): boolean {
  return was && !now;
}

export function disableConsequence(tenant: string): string {
  return `Nobody can sign in to ${tenant} while it is disabled, including you: the console session ends and the tenant answers as one that does not exist. Only a system administrator can enable it again.`;
}
