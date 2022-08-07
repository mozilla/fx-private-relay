export const mockReactIntersectionObserver = {
  useInView: jest.fn(() => {
    return [() => undefined, true, undefined];
  }),
};
