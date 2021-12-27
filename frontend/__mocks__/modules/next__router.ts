import { jest } from "@jest/globals";

export const mockNextRouter = {
  useRouter: jest.fn(() => {
    return {
      pathmame: "/",
    };
  }),
};
