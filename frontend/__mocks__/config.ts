// This file is used by Jest's automatic mock resolution
// When tests call jest.mock("../../config"), Jest finds this file automatically
export const { getRuntimeConfig } = jest.requireActual(
  "./configMock",
).mockConfigModule;
