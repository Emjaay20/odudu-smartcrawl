import type { ThemeChoice } from '#/shared/service/theme';
import { themeCookie } from '#/shared/service/theme';

export function writeThemeCookie(choice: ThemeChoice): void {
  try {
    document.cookie = themeCookie(choice, window.location.protocol === 'https:');
  } catch {
    // Without the cookie the server pages follow the system; the console
    // itself is unaffected.
  }
}
