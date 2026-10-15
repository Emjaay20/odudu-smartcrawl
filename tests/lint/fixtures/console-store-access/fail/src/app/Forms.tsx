import { forwardRef, memo } from 'react';
import { useToasts as Toasts } from '#/shared/repository/useToasts';
import { useToasts } from '#/shared/repository/useToasts';

export const Wrapped = forwardRef(() => {
  useToasts.getState().push('a');
  return null;
});

export const Remembered = memo(function Inner() {
  useToasts.getState()['push']('b');
  return null;
});

export function Aliased() {
  const state = useToasts.getState();
  const push = state.push;
  const copy = state;
  copy.push('c');
  push('d');
  return null;
}

export function Selected() {
  const everything = useToasts((state) => state);
  const renamed = Toasts((queue) => queue);
  return [everything, renamed];
}

export function Renamed() {
  Toasts.getState().push('e');
  useToasts['setState']({ toasts: [] });
  return null;
}
