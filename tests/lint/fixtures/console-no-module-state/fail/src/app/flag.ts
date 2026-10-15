const makeLatch = () => {
  let open = false;
  return { close: () => (open = false), open: () => (open = true), isOpen: () => open };
};

export const latch = makeLatch();
