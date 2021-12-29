import { jest } from "@jest/globals";
import { CustomAliasData, RandomAliasData, useAliases, isRandomAlias, getAllAliases, getFullAddress } from "../../../src/hooks/api/aliases";

jest.mock("../../../src/hooks/api/aliases");

// We know that `jest.mock` has turned exported functions into mock functions,
// but TypeScript can't — so we tell it using a type assertion:
const mockedUseAliases = useAliases as jest.MockedFunction<
  typeof useAliases
>;
const mockedIsRandomAlias = isRandomAlias as jest.MockedFunction<
  typeof isRandomAlias
>;
const mockedGetAllAliases = getAllAliases as jest.MockedFunction<
  typeof getAllAliases
>;
const mockedGetFullAddress = getFullAddress as jest.MockedFunction<
  typeof getFullAddress
>;

// We only need to mock out the functions that make HTTP requests;
// restore the rest:
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const actualModule = jest.requireActual("../../../src/hooks/api/aliases") as any;
mockedIsRandomAlias.mockImplementation(actualModule.isRandomAlias);
mockedGetAllAliases.mockImplementation(actualModule.getAllAliases);
mockedGetFullAddress.mockImplementation(actualModule.getFullAddress);

export function getMockRandomAlias(alias?: Partial<RandomAliasData>): RandomAliasData {
  return {
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
}
export function getMockCustomAlias(alias?: Partial<CustomAliasData>): CustomAliasData {
  return {
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
}

function getReturnValue(aliasesData?: { random?: Array<Partial<RandomAliasData>>, custom?: Array<Partial<CustomAliasData>>}): ReturnType<typeof useAliases> {
  const randomAliasData = (aliasesData?.random || [{}]).map(alias => getMockRandomAlias(alias));
  const customAliasData = (aliasesData?.custom || [{}]).map(alias => getMockCustomAlias(alias));

  return {
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
}

export const setMockAliasesData = (aliasesData?: { random?: Array<Partial<RandomAliasData>>, custom?: Array<Partial<CustomAliasData>>}) => {
  mockedUseAliases.mockReturnValue(getReturnValue(aliasesData));
};

export const setMockAliasesDataOnce = (aliasesData?: { random?: Array<Partial<RandomAliasData>>, custom?: Array<Partial<CustomAliasData>>}) => {
  mockedUseAliases.mockReturnValueOnce(getReturnValue(aliasesData));
};
