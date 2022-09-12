export const mockNextRouter = {
  useRouter: jest.fn(() => {
    return {
      pathmame: "/",
      push: jest.fn(),
    };
  }),
};
