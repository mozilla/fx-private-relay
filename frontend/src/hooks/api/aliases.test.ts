import { renderHook, waitFor } from "@testing-library/react";
import {
  useAliases,
  aliasEmailTest,
  isRandomAlias,
  getAllAliases,
  getFullAddress,
  isBlockingLevelOneTrackers,
  RandomAliasData,
  CustomAliasData,
  AliasData,
} from "./aliases";
import { ProfileData } from "./profile";

jest.mock("./api", () => {
  const actual = jest.requireActual("./api");
  return {
    ...actual,
    useApiV1: jest.fn(),
    apiFetch: jest.fn(),
  };
});

const createMockAlias = (type: "random" | "custom", id: number): any => ({
  mask_type: type,
  id,
  address: `test${id}`,
  full_address: `test${id}@${type === "random" ? "relay.firefox.com" : "test.mozmail.com"}`,
  domain: type === "random" ? 1 : 2,
  enabled: true,
  block_list_emails: false,
  block_level_one_trackers: true,
  description: "",
  created_at: "2025-01-01T00:00:00Z",
  last_modified_at: "2025-01-01T00:00:00Z",
  last_used_at: null,
  num_forwarded: 0,
  num_blocked: 0,
  num_spam: 0,
  num_replied: 0,
  num_level_one_trackers_blocked: 0,
  used_on: "",
  ...(type === "random" ? { generated_for: "" } : {}),
});

describe("useAliases", () => {
  const mockRandomMutate = jest.fn();
  const mockCustomMutate = jest.fn();
  const mockApiFetch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    const api = jest.requireMock("./api");
    api.apiFetch = mockApiFetch;
  });

  it("fetches data and handles full CRUD lifecycle", async () => {
    const useApiV1 = jest.requireMock("./api").useApiV1;
    mockApiFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    useApiV1.mockImplementation((route: string) => ({
      data:
        route === "/relayaddresses/"
          ? [createMockAlias("random", 1)]
          : [createMockAlias("custom", 2)],
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate:
        route === "/relayaddresses/" ? mockRandomMutate : mockCustomMutate,
    }));

    const { result } = renderHook(() => useAliases());

    expect(useApiV1).toHaveBeenCalledWith("/relayaddresses/");
    expect(useApiV1).toHaveBeenCalledWith("/domainaddresses/");

    await waitFor(() => {
      expect(result.current.randomAliasData.data).toHaveLength(1);
      expect(result.current.customAliasData.data).toHaveLength(1);
    });

    expect(result.current.create).toBeDefined();
    expect(result.current.update).toBeDefined();
    expect(result.current.delete).toBeDefined();

    await result.current.create({ mask_type: "random" });
    expect(mockApiFetch).toHaveBeenCalledWith("/relayaddresses/", {
      method: "POST",
      body: JSON.stringify({ enabled: true }),
    });
    expect(mockRandomMutate).toHaveBeenCalled();

    mockApiFetch.mockClear();
    mockRandomMutate.mockClear();
    await result.current.create({
      mask_type: "custom",
      address: "test",
      blockPromotionals: true,
    });
    expect(mockApiFetch).toHaveBeenCalledWith("/domainaddresses/", {
      method: "POST",
      body: JSON.stringify({
        enabled: true,
        address: "test",
        block_list_emails: true,
      }),
    });
    expect(mockCustomMutate).toHaveBeenCalled();

    mockApiFetch.mockClear();
    await result.current.update(
      { id: 123, mask_type: "random" },
      { enabled: false },
    );
    expect(mockApiFetch).toHaveBeenCalledWith("/relayaddresses/123/", {
      method: "PATCH",
      body: JSON.stringify({ enabled: false }),
    });
    expect(mockRandomMutate).toHaveBeenCalled();

    mockApiFetch.mockClear();
    mockRandomMutate.mockClear();
    await result.current.update(
      { id: 456, mask_type: "custom" },
      { description: "Updated" },
    );
    expect(mockApiFetch).toHaveBeenCalledWith("/domainaddresses/456/", {
      method: "PATCH",
      body: JSON.stringify({ description: "Updated" }),
    });
    expect(mockCustomMutate).toHaveBeenCalled();

    mockApiFetch.mockClear();
    await result.current.delete({
      id: 789,
      mask_type: "random",
    } as RandomAliasData);
    expect(mockApiFetch).toHaveBeenCalledWith("/relayaddresses/789/", {
      method: "DELETE",
    });
    expect(mockRandomMutate).toHaveBeenCalled();

    mockApiFetch.mockClear();
    mockRandomMutate.mockClear();
    await result.current.delete({
      id: 999,
      mask_type: "custom",
    } as CustomAliasData);
    expect(mockApiFetch).toHaveBeenCalledWith("/domainaddresses/999/", {
      method: "DELETE",
    });
    expect(mockCustomMutate).toHaveBeenCalled();
  });
});

describe("API and helper functions", () => {
  it("aliasEmailTest handles POST requests correctly", async () => {
    const mockApiFetch = jest.fn();
    const api = jest.requireMock("./api");
    api.apiFetch = mockApiFetch;

    mockApiFetch.mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({}),
    });
    let result = await aliasEmailTest("test@relay.firefox.com");
    expect(mockApiFetch).toHaveBeenCalledWith("/first-forwarded-email/", {
      method: "POST",
      body: JSON.stringify({ mask: "test@relay.firefox.com" }),
    });
    expect(result).toBe(true);

    mockApiFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({}),
    });
    result = await aliasEmailTest("invalid");
    expect(result).toBe(false);
  });

  it("helper functions work correctly", () => {
    const randomAlias = createMockAlias("random", 1);
    const customAlias = createMockAlias("custom", 2);

    expect(isRandomAlias(randomAlias)).toBe(true);
    expect(isRandomAlias(customAlias)).toBe(false);

    const combined = getAllAliases([randomAlias], [customAlias]);
    expect(combined).toHaveLength(2);
    expect(combined[0]).toBe(randomAlias);
    expect(combined[1]).toBe(customAlias);
    expect(getAllAliases([], [])).toEqual([]);

    expect(getFullAddress(randomAlias)).toBe("test1@relay.firefox.com");

    const mockProfile: ProfileData = {
      id: 1,
      server_storage: true,
      has_premium: true,
      has_phone: false,
      has_vpn: false,
      has_megabundle: false,
      subdomain: null,
      onboarding_state: 0,
      onboarding_free_state: 0,
      forwarded_first_reply: false,
      avatar: "",
      date_subscribed: null,
      remove_level_one_email_trackers: true,
      next_email_try: "2025-01-01T00:00:00Z",
      bounce_status: [false, ""],
      api_token: "",
      emails_blocked: 0,
      emails_forwarded: 0,
      emails_replied: 0,
      level_one_trackers_blocked: 0,
      store_phone_log: false,
      metrics_enabled: false,
    };

    expect(
      isBlockingLevelOneTrackers(
        { block_level_one_trackers: true } as AliasData,
        mockProfile,
      ),
    ).toBe(true);
    expect(
      isBlockingLevelOneTrackers(
        { block_level_one_trackers: false } as AliasData,
        mockProfile,
      ),
    ).toBe(false);
    expect(
      isBlockingLevelOneTrackers(
        { block_level_one_trackers: undefined } as unknown as AliasData,
        { ...mockProfile, remove_level_one_email_trackers: true },
      ),
    ).toBe(true);
    expect(
      isBlockingLevelOneTrackers(
        { block_level_one_trackers: undefined } as unknown as AliasData,
        { ...mockProfile, remove_level_one_email_trackers: false },
      ),
    ).toBe(false);
  });
});
