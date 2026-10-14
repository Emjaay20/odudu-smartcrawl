function segment(value: string): string {
  return encodeURIComponent(value.trim());
}
export const path = (id: string): string => segment(id);
