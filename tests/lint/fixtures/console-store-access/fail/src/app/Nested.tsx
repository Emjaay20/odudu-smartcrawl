import { useDrafts } from '#/shared/repository/useDrafts';

export function Nested() {
  return (
    <button
      onClick={() => {
        useDrafts.getState().keep();
      }}
    >
      keep
    </button>
  );
}
