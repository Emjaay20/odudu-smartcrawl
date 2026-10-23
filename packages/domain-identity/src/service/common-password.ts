import { PRODUCT_NAME } from '@odudu/kernel';
import { COMMON_PASSWORDS } from '#/service/common-passwords-data';

// Built once when the module loads and shared by every check: the entries of
// COMMON_PASSWORDS are held as one Set, about 11 MB of heap for the 38,446
// the file holds, and a check is one lookup in memory.
const COMMON = new Set(COMMON_PASSWORDS.split('\n').filter((line) => line !== ''));

export const COMMON_PASSWORD_COUNT = COMMON.size;

function fold(text: string): string {
  return text.normalize('NFKC').toLowerCase();
}

// Whether the whole password is a listed one or one of the words that name
// this account or the service. A password that merely contains one is not
// refused here.
export function isCommonPassword(candidate: string, context: readonly string[]): boolean {
  const folded = fold(candidate);
  if (folded === '') return false;
  if (COMMON.has(folded)) return true;
  return [...context, PRODUCT_NAME].some((word) => fold(word) === folded);
}
