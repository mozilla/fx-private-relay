import { jest } from "@jest/globals";
import { CustomAliasData, RandomAliasData, useAliases } from "../../../src/hooks/api/aliases";

jest.mock("../../../src/hooks/api/aliases");

// We know that `jest.mock` has turned `useAliases` into a mock function,
// but TypeScript can't — so we tell it using a type assertion:
const mockedUseAliases = useAliases as jest.MockedFunction<
  typeof useAliases
>;

export const setMockAliasesData = (aliasesData?: { random?: Array<Partial<RandomAliasData>>, custom?: Array<Partial<CustomAliasData>>}) => {
  const randomAliasData = (aliasesData?.random || [{}]).map(alias => {
    const randomAlias: RandomAliasData = {
      address: "arbitrary_address",
      created_at: "2021-11-03T13:37:42.000000Z",
      last_modified_at: "2021-11-03T13:37:42.000000Z",
      last_used_at: "2021-11-03T13:37:42.000000Z",
      description: "",
      domain: 1,
      enabled: true,
      generated_for: "",
      id: 0,
      num_blocked: 0,
      num_forwarded: 0,
      num_spam: 0,
      ...alias,
    };
    return randomAlias;
  });
  const customAliasData = (aliasesData?.custom || [{}]).map(alias => {
    const customAlias: CustomAliasData = {
      address: "arbitrary_address",
      created_at: "2021-11-03T13:37:42.000000Z",
      last_modified_at: "2021-11-03T13:37:42.000000Z",
      last_used_at: "2021-11-03T13:37:42.000000Z",
      description: "",
      domain: 2,
      enabled: true,
      id: 0,
      num_blocked: 0,
      num_forwarded: 0,
      num_spam: 0,
      ...alias,
    };
    return customAlias;
  });

  const returnValue: ReturnType<typeof useAliases> = {
    randomAliasData: {
      isValidating: false,
      mutate: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      data: randomAliasData,
    },
    customAliasData: {
      isValidating: false,
      mutate: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      data: customAliasData,
    },
  };

  mockedUseAliases.mockReturnValue(returnValue);
};
