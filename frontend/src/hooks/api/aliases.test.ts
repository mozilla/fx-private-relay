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

describe("useAliases", () => {
  const mockRandomMutate = jest.fn();
  const mockCustomMutate = jest.fn();
  const mockApiFetch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockRandomMutate.mockClear();
    mockCustomMutate.mockClear();
    mockApiFetch.mockClear();

    const api = jest.requireMock("./api");
    api.apiFetch = mockApiFetch;
  });

  it("returns random and custom alias data when fetch succeeds", async () => {
    const useApiV1 = jest.requireMock("./api").useApiV1;
    const mockRandomData: RandomAliasData[] = [
      {
        mask_type: "random",
        enabled: true,
        block_list_emails: false,
        block_level_one_trackers: true,
        description: "Test random alias",
        id: 1,
        address: "test123",
        full_address: "test123@relay.firefox.com",
        domain: 1,
        created_at: "2025-01-01T00:00:00Z",
        last_modified_at: "2025-01-01T00:00:00Z",
        last_used_at: null,
        num_forwarded: 5,
        num_blocked: 2,
        num_spam: 1,
        num_replied: 0,
        num_level_one_trackers_blocked: 3,
        used_on: "example.com",
        generated_for: "example.com",
      },
    ];

    const mockCustomData: CustomAliasData[] = [
      {
        mask_type: "custom",
        enabled: true,
        block_list_emails: false,
        block_level_one_trackers: true,
        description: "Test custom alias",
        id: 2,
        address: "custom",
        full_address: "custom@test.mozmail.com",
        domain: 2,
        created_at: "2025-01-01T00:00:00Z",
        last_modified_at: "2025-01-01T00:00:00Z",
        last_used_at: null,
        num_forwarded: 10,
        num_blocked: 3,
        num_spam: 2,
        num_replied: 1,
        num_level_one_trackers_blocked: 5,
        used_on: "example.org",
      },
    ];

    useApiV1.mockImplementation((route: string) => {
      if (route === "/relayaddresses/") {
        return {
          data: mockRandomData,
          error: undefined,
          isLoading: false,
          isValidating: false,
          mutate: mockRandomMutate,
        };
      }
      if (route === "/domainaddresses/") {
        return {
          data: mockCustomData,
          error: undefined,
          isLoading: false,
          isValidating: false,
          mutate: mockCustomMutate,
        };
      }
    });

    const { result } = renderHook(() => useAliases());

    await waitFor(() => {
      expect(result.current.randomAliasData.data).toEqual(mockRandomData);
      expect(result.current.customAliasData.data).toEqual(mockCustomData);
    });
  });

  it("passes correct routes to useApiV1", () => {
    const useApiV1 = jest.requireMock("./api").useApiV1;

    useApiV1.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: true,
      isValidating: false,
      mutate: jest.fn(),
    });

    renderHook(() => useAliases());

    expect(useApiV1).toHaveBeenCalledWith("/relayaddresses/");
    expect(useApiV1).toHaveBeenCalledWith("/domainaddresses/");
  });

  test.each([
    { functionName: "create" },
    { functionName: "update" },
    { functionName: "delete" },
  ])("includes $functionName function in response", ({ functionName }) => {
    const useApiV1 = jest.requireMock("./api").useApiV1;

    useApiV1.mockReturnValue({
      data: [],
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: jest.fn(),
    });

    const { result } = renderHook(() => useAliases());

    expect(
      result.current[functionName as keyof typeof result.current],
    ).toBeDefined();
    expect(
      typeof result.current[functionName as keyof typeof result.current],
    ).toBe("function");
  });

  it("create makes POST request for random alias", async () => {
    const useApiV1 = jest.requireMock("./api").useApiV1;
    mockApiFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    useApiV1.mockReturnValue({
      data: [],
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: mockRandomMutate,
    });

    const { result } = renderHook(() => useAliases());

    await result.current.create({ mask_type: "random" });

    expect(mockApiFetch).toHaveBeenCalledWith("/relayaddresses/", {
      method: "POST",
      body: JSON.stringify({ enabled: true }),
    });
  });

  it("create calls random mutate after creating random alias", async () => {
    const useApiV1 = jest.requireMock("./api").useApiV1;
    mockApiFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    useApiV1.mockReturnValue({
      data: [],
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: mockRandomMutate,
    });

    const { result } = renderHook(() => useAliases());

    await result.current.create({ mask_type: "random" });

    expect(mockRandomMutate).toHaveBeenCalledTimes(1);
  });

  it("create makes POST request for custom alias", async () => {
    const useApiV1 = jest.requireMock("./api").useApiV1;
    mockApiFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    useApiV1.mockImplementation((route: string) => {
      if (route === "/relayaddresses/") {
        return {
          data: [],
          error: undefined,
          isLoading: false,
          isValidating: false,
          mutate: mockRandomMutate,
        };
      }
      if (route === "/domainaddresses/") {
        return {
          data: [],
          error: undefined,
          isLoading: false,
          isValidating: false,
          mutate: mockCustomMutate,
        };
      }
    });

    const { result } = renderHook(() => useAliases());

    await result.current.create({
      mask_type: "custom",
      address: "myalias",
      blockPromotionals: true,
    });

    expect(mockApiFetch).toHaveBeenCalledWith("/domainaddresses/", {
      method: "POST",
      body: JSON.stringify({
        enabled: true,
        address: "myalias",
        block_list_emails: true,
      }),
    });
  });

  it("create calls custom mutate after creating custom alias", async () => {
    const useApiV1 = jest.requireMock("./api").useApiV1;
    mockApiFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    useApiV1.mockImplementation((route: string) => {
      if (route === "/relayaddresses/") {
        return {
          data: [],
          error: undefined,
          isLoading: false,
          isValidating: false,
          mutate: mockRandomMutate,
        };
      }
      if (route === "/domainaddresses/") {
        return {
          data: [],
          error: undefined,
          isLoading: false,
          isValidating: false,
          mutate: mockCustomMutate,
        };
      }
    });

    const { result } = renderHook(() => useAliases());

    await result.current.create({
      mask_type: "custom",
      address: "test",
      blockPromotionals: false,
    });

    expect(mockCustomMutate).toHaveBeenCalledTimes(1);
  });

  it("update makes PATCH request for random alias", async () => {
    const useApiV1 = jest.requireMock("./api").useApiV1;
    mockApiFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    useApiV1.mockReturnValue({
      data: [],
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: mockRandomMutate,
    });

    const { result } = renderHook(() => useAliases());

    await result.current.update(
      { id: 123, mask_type: "random" },
      { enabled: false, description: "Updated" },
    );

    expect(mockApiFetch).toHaveBeenCalledWith("/relayaddresses/123/", {
      method: "PATCH",
      body: JSON.stringify({ enabled: false, description: "Updated" }),
    });
  });

  it("update calls random mutate after updating random alias", async () => {
    const useApiV1 = jest.requireMock("./api").useApiV1;
    mockApiFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    useApiV1.mockReturnValue({
      data: [],
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: mockRandomMutate,
    });

    const { result } = renderHook(() => useAliases());

    await result.current.update({ id: 456, mask_type: "random" }, {});

    expect(mockRandomMutate).toHaveBeenCalledTimes(1);
  });

  it("update makes PATCH request for custom alias", async () => {
    const useApiV1 = jest.requireMock("./api").useApiV1;
    mockApiFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    useApiV1.mockImplementation((route: string) => {
      if (route === "/relayaddresses/") {
        return {
          data: [],
          error: undefined,
          isLoading: false,
          isValidating: false,
          mutate: mockRandomMutate,
        };
      }
      if (route === "/domainaddresses/") {
        return {
          data: [],
          error: undefined,
          isLoading: false,
          isValidating: false,
          mutate: mockCustomMutate,
        };
      }
    });

    const { result } = renderHook(() => useAliases());

    await result.current.update(
      { id: 789, mask_type: "custom" },
      { enabled: true },
    );

    expect(mockApiFetch).toHaveBeenCalledWith("/domainaddresses/789/", {
      method: "PATCH",
      body: JSON.stringify({ enabled: true }),
    });
  });

  it("update calls custom mutate after updating custom alias", async () => {
    const useApiV1 = jest.requireMock("./api").useApiV1;
    mockApiFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    useApiV1.mockImplementation((route: string) => {
      if (route === "/relayaddresses/") {
        return {
          data: [],
          error: undefined,
          isLoading: false,
          isValidating: false,
          mutate: mockRandomMutate,
        };
      }
      if (route === "/domainaddresses/") {
        return {
          data: [],
          error: undefined,
          isLoading: false,
          isValidating: false,
          mutate: mockCustomMutate,
        };
      }
    });

    const { result } = renderHook(() => useAliases());

    await result.current.update({ id: 999, mask_type: "custom" }, {});

    expect(mockCustomMutate).toHaveBeenCalledTimes(1);
  });

  it("delete makes DELETE request for random alias", async () => {
    const useApiV1 = jest.requireMock("./api").useApiV1;
    mockApiFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    useApiV1.mockReturnValue({
      data: [],
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: mockRandomMutate,
    });

    const { result } = renderHook(() => useAliases());

    const aliasData = {
      id: 123,
      mask_type: "random",
    } as RandomAliasData;

    await result.current.delete(aliasData);

    expect(mockApiFetch).toHaveBeenCalledWith("/relayaddresses/123/", {
      method: "DELETE",
    });
  });

  it("delete calls random mutate after deleting random alias", async () => {
    const useApiV1 = jest.requireMock("./api").useApiV1;
    mockApiFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    useApiV1.mockReturnValue({
      data: [],
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: mockRandomMutate,
    });

    const { result } = renderHook(() => useAliases());

    const aliasData = {
      id: 456,
      mask_type: "random",
    } as RandomAliasData;

    await result.current.delete(aliasData);

    expect(mockRandomMutate).toHaveBeenCalledTimes(1);
  });

  it("delete makes DELETE request for custom alias", async () => {
    const useApiV1 = jest.requireMock("./api").useApiV1;
    mockApiFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    useApiV1.mockImplementation((route: string) => {
      if (route === "/relayaddresses/") {
        return {
          data: [],
          error: undefined,
          isLoading: false,
          isValidating: false,
          mutate: mockRandomMutate,
        };
      }
      if (route === "/domainaddresses/") {
        return {
          data: [],
          error: undefined,
          isLoading: false,
          isValidating: false,
          mutate: mockCustomMutate,
        };
      }
    });

    const { result } = renderHook(() => useAliases());

    const aliasData = {
      id: 789,
      mask_type: "custom",
    } as CustomAliasData;

    await result.current.delete(aliasData);

    expect(mockApiFetch).toHaveBeenCalledWith("/domainaddresses/789/", {
      method: "DELETE",
    });
  });

  it("delete calls custom mutate after deleting custom alias", async () => {
    const useApiV1 = jest.requireMock("./api").useApiV1;
    mockApiFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    useApiV1.mockImplementation((route: string) => {
      if (route === "/relayaddresses/") {
        return {
          data: [],
          error: undefined,
          isLoading: false,
          isValidating: false,
          mutate: mockRandomMutate,
        };
      }
      if (route === "/domainaddresses/") {
        return {
          data: [],
          error: undefined,
          isLoading: false,
          isValidating: false,
          mutate: mockCustomMutate,
        };
      }
    });

    const { result } = renderHook(() => useAliases());

    const aliasData = {
      id: 999,
      mask_type: "custom",
    } as CustomAliasData;

    await result.current.delete(aliasData);

    expect(mockCustomMutate).toHaveBeenCalledTimes(1);
  });
});

describe("aliasEmailTest", () => {
  const mockApiFetch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    const api = jest.requireMock("./api");
    api.apiFetch = mockApiFetch;
  });

  it("makes POST request to first-forwarded-email endpoint", async () => {
    mockApiFetch.mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ success: true }),
    });

    await aliasEmailTest("test@relay.firefox.com");

    expect(mockApiFetch).toHaveBeenCalledWith("/first-forwarded-email/", {
      method: "POST",
      body: JSON.stringify({ mask: "test@relay.firefox.com" }),
    });
  });

  it("returns true when status is 201", async () => {
    mockApiFetch.mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ success: true }),
    });

    const result = await aliasEmailTest("test@relay.firefox.com");

    expect(result).toBe(true);
  });

  it("returns false when status is not 201", async () => {
    mockApiFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: "Bad request" }),
    });

    const result = await aliasEmailTest("invalid");

    expect(result).toBe(false);
  });
});

describe("isRandomAlias", () => {
  it("returns true for random alias", () => {
    const alias: RandomAliasData = {
      mask_type: "random",
      id: 1,
      address: "test",
      full_address: "test@relay.firefox.com",
      domain: 1,
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
      generated_for: "",
    };

    expect(isRandomAlias(alias)).toBe(true);
  });

  it("returns false for custom alias", () => {
    const alias: CustomAliasData = {
      mask_type: "custom",
      id: 1,
      address: "test",
      full_address: "test@test.mozmail.com",
      domain: 2,
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
    };

    expect(isRandomAlias(alias)).toBe(false);
  });
});

describe("getAllAliases", () => {
  it("combines random and custom aliases", () => {
    const randomAliases: RandomAliasData[] = [
      {
        mask_type: "random",
        id: 1,
        address: "test1",
        full_address: "test1@relay.firefox.com",
        domain: 1,
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
        generated_for: "",
      },
    ];

    const customAliases: CustomAliasData[] = [
      {
        mask_type: "custom",
        id: 2,
        address: "test2",
        full_address: "test2@test.mozmail.com",
        domain: 2,
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
      },
    ];

    const result = getAllAliases(randomAliases, customAliases);

    expect(result).toHaveLength(2);
    expect(result[0]).toBe(randomAliases[0]);
    expect(result[1]).toBe(customAliases[0]);
  });

  it("returns empty array when both are empty", () => {
    const result = getAllAliases([], []);

    expect(result).toEqual([]);
  });
});

describe("getFullAddress", () => {
  it("returns full_address from alias", () => {
    const alias: RandomAliasData = {
      mask_type: "random",
      id: 1,
      address: "test",
      full_address: "test@relay.firefox.com",
      domain: 1,
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
      generated_for: "",
    };

    expect(getFullAddress(alias)).toBe("test@relay.firefox.com");
  });
});

describe("isBlockingLevelOneTrackers", () => {
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

  it("returns true when alias has block_level_one_trackers set to true", () => {
    const alias = {
      block_level_one_trackers: true,
    } as AliasData;

    expect(isBlockingLevelOneTrackers(alias, mockProfile)).toBe(true);
  });

  it("returns false when alias has block_level_one_trackers set to false", () => {
    const alias = {
      block_level_one_trackers: false,
    } as AliasData;

    expect(isBlockingLevelOneTrackers(alias, mockProfile)).toBe(false);
  });

  it("returns profile value when alias block_level_one_trackers is not boolean", () => {
    const alias = {
      block_level_one_trackers: undefined,
    } as unknown as AliasData;

    const profile = {
      ...mockProfile,
      remove_level_one_email_trackers: true,
    };

    expect(isBlockingLevelOneTrackers(alias, profile)).toBe(true);
  });

  it("returns false when both alias and profile have falsy values", () => {
    const alias = {
      block_level_one_trackers: undefined,
    } as unknown as AliasData;

    const profile = {
      ...mockProfile,
      remove_level_one_email_trackers: false,
    };

    expect(isBlockingLevelOneTrackers(alias, profile)).toBe(false);
  });
});
