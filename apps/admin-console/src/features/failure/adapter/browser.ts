export function randomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

// Vite replaces this with a constant, so a production build holds no branch.
export function isDevelopment(): boolean {
  return import.meta.env.DEV;
}

export function logError(line: string, error: unknown, componentStack?: string): void {
  if (componentStack === undefined) console.error(line, error);
  else console.error(line, error, componentStack);
}

export function reloadPage(): void {
  window.location.reload();
}
