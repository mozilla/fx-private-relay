export const mockReactIntersectionObsever = {
  useInView: jest.fn(() => {
    return [() => undefined, true, undefined];
  }),
};
