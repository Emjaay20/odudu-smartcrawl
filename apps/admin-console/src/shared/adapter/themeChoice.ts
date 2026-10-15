import type { ThemeChoice } from '#/shared/service/theme';
import { browserStorage } from '#/shared/adapter/browserStorage';

const KEY = 'odudu.console.theme';

export function loadThemeChoice(): ThemeChoice {
  try {
    const stored = browserStorage('local')?.getItem(KEY);
    return stored === 'light' || stored === 'dark' ? stored : 'system';
  } catch {
    return 'system';
  }
}

export function storeThemeChoice(choice: ThemeChoice): void {
  try {
    if (choice === 'system') browserStorage('local')?.removeItem(KEY);
    else browserStorage('local')?.setItem(KEY, choice);
  } catch {
    // Unremembered, the choice still holds for this page.
  }
}
