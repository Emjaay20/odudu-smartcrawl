import type { InitReport } from '#/cli/init-plan';

// The only place a generated password is printed. The ` password:` line is
// read by the quickstart proof, so its shape is part of the contract.
export function renderBanner(report: InitReport): string {
  const lines = [
    '',
    'Odudu is ready.',
    '',
    ` console:  ${report.consoleUrl}`,
    ` email:    ${report.adminEmail}`,
  ];
  if (report.generatedPassword === undefined) {
    lines.push('', 'Sign in with the password you chose.');
    if (report.passwordFromEnv === true) {
      lines.push(
        'It stays in the setup container environment until that container',
        'is removed: docker compose rm -f setup',
      );
    }
  } else {
    lines.push(
      ` password: ${report.generatedPassword}`,
      '',
      'The password is shown once and must be changed at first sign-in.',
      'To remove it from the setup container log afterwards, run:',
      '',
      '  docker compose rm -f setup',
    );
  }
  lines.push('');
  return lines.join('\n');
}
