export const mockNextRouter = {
  useRouter: jest.fn(() => {
    return {
      pathname: "/",
      push: jest.fn(),
    };
  }),
};
