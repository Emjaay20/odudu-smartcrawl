export const useNotAStore = Object.assign(() => 1, { getState: () => ({ go: () => 2 }) });

export function useCaller() {
  useNotAStore.getState().go();
  return useNotAStore();
}
