// Undefined when the text is not JSON, so a caller validates what it gets
// the same way whether the text was malformed or the wrong shape.
export function parseJson(text: string): unknown {
  try {
    const value: unknown = JSON.parse(text);
    return value;
  } catch {
    return undefined;
  }
}
