import { renderHook, waitFor } from "@testing-library/react";
import {
  useRealPhonesData,
  isVerified,
  isNotVerified,
  hasPendingVerification,
  RealPhone,
  VerifiedPhone,
  UnverifiedPhone,
} from "./realPhone";

jest.mock("./api", () => {
  const actual = jest.requireActual("./api");
  return {
    ...actual,
    useApiV1: jest.fn(),
    apiFetch: jest.fn(),
  };
});

describe("useRealPhonesData", () => {
  const mockMutate = jest.fn();
  const mockApiFetch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockMutate.mockClear();
    mockApiFetch.mockClear();

    const api = jest.requireMock("./api");
    api.apiFetch = mockApiFetch;
  });

  it("returns real phone data when fetch succeeds", async () => {
    const useApiV1 = jest.requireMock("./api").useApiV1;
    const mockData: VerifiedPhone[] = [
      {
        id: 1,
        number: "+15555551234",
        verification_code: "123456",
        verification_sent_date: "2025-01-01T00:00:00Z",
        verified: true,
        verified_date: "2025-01-01T00:05:00Z",
        country_code: "US",
      },
    ];

    useApiV1.mockReturnValue({
      data: mockData,
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: mockMutate,
    });

    const { result } = renderHook(() => useRealPhonesData());

    await waitFor(() => {
      expect(result.current.data).toEqual(mockData);
    });
  });

  it("returns error when fetch fails", async () => {
    const useApiV1 = jest.requireMock("./api").useApiV1;
    const mockError = new Error("Network error");

    useApiV1.mockReturnValue({
      data: undefined,
      error: mockError,
      isLoading: false,
      isValidating: false,
      mutate: mockMutate,
    });

    const { result } = renderHook(() => useRealPhonesData());

    await waitFor(() => {
      expect(result.current.error).toBe(mockError);
    });
  });

  it("returns loading state while fetching", () => {
    const useApiV1 = jest.requireMock("./api").useApiV1;

    useApiV1.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: true,
      isValidating: false,
      mutate: mockMutate,
    });

    const { result } = renderHook(() => useRealPhonesData());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it("passes correct route to useApiV1", () => {
    const useApiV1 = jest.requireMock("./api").useApiV1;

    useApiV1.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: true,
      isValidating: false,
      mutate: mockMutate,
    });

    renderHook(() => useRealPhonesData());

    expect(useApiV1).toHaveBeenCalledWith("/realphone/");
  });

  it("includes requestPhoneVerification function in response", () => {
    const useApiV1 = jest.requireMock("./api").useApiV1;

    useApiV1.mockReturnValue({
      data: [],
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: mockMutate,
    });

    const { result } = renderHook(() => useRealPhonesData());

    expect(result.current.requestPhoneVerification).toBeDefined();
    expect(typeof result.current.requestPhoneVerification).toBe("function");
  });

  it("includes submitPhoneVerification function in response", () => {
    const useApiV1 = jest.requireMock("./api").useApiV1;

    useApiV1.mockReturnValue({
      data: [],
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: mockMutate,
    });

    const { result } = renderHook(() => useRealPhonesData());

    expect(result.current.submitPhoneVerification).toBeDefined();
    expect(typeof result.current.submitPhoneVerification).toBe("function");
  });

  it("includes requestPhoneRemoval function in response", () => {
    const useApiV1 = jest.requireMock("./api").useApiV1;

    useApiV1.mockReturnValue({
      data: [],
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: mockMutate,
    });

    const { result } = renderHook(() => useRealPhonesData());

    expect(result.current.requestPhoneRemoval).toBeDefined();
    expect(typeof result.current.requestPhoneRemoval).toBe("function");
  });

  it("includes resendWelcomeSMS function in response", () => {
    const useApiV1 = jest.requireMock("./api").useApiV1;

    useApiV1.mockReturnValue({
      data: [],
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: mockMutate,
    });

    const { result } = renderHook(() => useRealPhonesData());

    expect(result.current.resendWelcomeSMS).toBeDefined();
    expect(typeof result.current.resendWelcomeSMS).toBe("function");
  });

  it("requestPhoneVerification makes POST request with phone number", async () => {
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
      mutate: mockMutate,
    });

    const { result } = renderHook(() => useRealPhonesData());

    await result.current.requestPhoneVerification("+15555551234");

    expect(mockApiFetch).toHaveBeenCalledWith("/realphone/", {
      method: "POST",
      body: JSON.stringify({ number: "+15555551234" }),
    });
  });

  it("requestPhoneVerification calls mutate after successful request", async () => {
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
      mutate: mockMutate,
    });

    const { result } = renderHook(() => useRealPhonesData());

    await result.current.requestPhoneVerification("+15555551234");

    expect(mockMutate).toHaveBeenCalledTimes(1);
  });

  it("requestPhoneVerification returns response from API", async () => {
    const useApiV1 = jest.requireMock("./api").useApiV1;
    const mockResponse = {
      ok: true,
      json: async () => ({ success: true }),
    };
    mockApiFetch.mockResolvedValue(mockResponse);

    useApiV1.mockReturnValue({
      data: [],
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: mockMutate,
    });

    const { result } = renderHook(() => useRealPhonesData());

    const response =
      await result.current.requestPhoneVerification("+15555551234");

    expect(response).toBe(mockResponse);
  });

  it("submitPhoneVerification makes PATCH request with verification data", async () => {
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
      mutate: mockMutate,
    });

    const { result } = renderHook(() => useRealPhonesData());

    await result.current.submitPhoneVerification(123, {
      number: "+15555551234",
      verification_code: "123456",
    });

    expect(mockApiFetch).toHaveBeenCalledWith("/realphone/123/", {
      method: "PATCH",
      body: JSON.stringify({
        number: "+15555551234",
        verification_code: "123456",
      }),
    });
  });

  it("submitPhoneVerification calls mutate after successful request", async () => {
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
      mutate: mockMutate,
    });

    const { result } = renderHook(() => useRealPhonesData());

    await result.current.submitPhoneVerification(456, {
      number: "+15555551234",
      verification_code: "123456",
    });

    expect(mockMutate).toHaveBeenCalledTimes(1);
  });

  it("submitPhoneVerification returns response from API", async () => {
    const useApiV1 = jest.requireMock("./api").useApiV1;
    const mockResponse = {
      ok: true,
      json: async () => ({ success: true }),
    };
    mockApiFetch.mockResolvedValue(mockResponse);

    useApiV1.mockReturnValue({
      data: [],
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: mockMutate,
    });

    const { result } = renderHook(() => useRealPhonesData());

    const response = await result.current.submitPhoneVerification(789, {
      number: "+15555551234",
      verification_code: "123456",
    });

    expect(response).toBe(mockResponse);
  });

  it("requestPhoneRemoval makes DELETE request", async () => {
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
      mutate: mockMutate,
    });

    const { result } = renderHook(() => useRealPhonesData());

    await result.current.requestPhoneRemoval(123);

    expect(mockApiFetch).toHaveBeenCalledWith("/realphone/123/", {
      method: "DELETE",
    });
  });

  it("requestPhoneRemoval calls mutate after successful request", async () => {
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
      mutate: mockMutate,
    });

    const { result } = renderHook(() => useRealPhonesData());

    await result.current.requestPhoneRemoval(456);

    expect(mockMutate).toHaveBeenCalledTimes(1);
  });

  it("requestPhoneRemoval returns response from API", async () => {
    const useApiV1 = jest.requireMock("./api").useApiV1;
    const mockResponse = {
      ok: true,
      json: async () => ({ success: true }),
    };
    mockApiFetch.mockResolvedValue(mockResponse);

    useApiV1.mockReturnValue({
      data: [],
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: mockMutate,
    });

    const { result } = renderHook(() => useRealPhonesData());

    const response = await result.current.requestPhoneRemoval(789);

    expect(response).toBe(mockResponse);
  });

  it("resendWelcomeSMS makes POST request", async () => {
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
      mutate: mockMutate,
    });

    const { result } = renderHook(() => useRealPhonesData());

    await result.current.resendWelcomeSMS();

    expect(mockApiFetch).toHaveBeenCalledWith("/realphone/resend_welcome_sms", {
      method: "POST",
    });
  });

  it("resendWelcomeSMS calls mutate after successful request", async () => {
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
      mutate: mockMutate,
    });

    const { result } = renderHook(() => useRealPhonesData());

    await result.current.resendWelcomeSMS();

    expect(mockMutate).toHaveBeenCalledTimes(1);
  });

  it("resendWelcomeSMS returns response from API", async () => {
    const useApiV1 = jest.requireMock("./api").useApiV1;
    const mockResponse = {
      ok: true,
      json: async () => ({ success: true }),
    };
    mockApiFetch.mockResolvedValue(mockResponse);

    useApiV1.mockReturnValue({
      data: [],
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: mockMutate,
    });

    const { result } = renderHook(() => useRealPhonesData());

    const response = await result.current.resendWelcomeSMS();

    expect(response).toBe(mockResponse);
  });
});

describe("isVerified", () => {
  it("returns true for verified phone", () => {
    const phone: VerifiedPhone = {
      id: 1,
      number: "+15555551234",
      verification_code: "123456",
      verification_sent_date: "2025-01-01T00:00:00Z",
      verified: true,
      verified_date: "2025-01-01T00:05:00Z",
      country_code: "US",
    };

    expect(isVerified(phone)).toBe(true);
  });

  it("returns false for unverified phone", () => {
    const phone: UnverifiedPhone = {
      id: 1,
      number: "+15555551234",
      verification_code: "123456",
      verification_sent_date: "2025-01-01T00:00:00Z",
      verified: false,
      verified_date: null,
      country_code: "US",
    };

    expect(isVerified(phone)).toBe(false);
  });

  it("returns false when verified is undefined", () => {
    const phone: UnverifiedPhone = {
      id: 1,
      number: "+15555551234",
      verification_code: "123456",
      verification_sent_date: "2025-01-01T00:00:00Z",
      verified: undefined,
      verified_date: null,
      country_code: "US",
    };

    expect(isVerified(phone)).toBe(false);
  });
});

describe("isNotVerified", () => {
  it("returns false for verified phone", () => {
    const phone: VerifiedPhone = {
      id: 1,
      number: "+15555551234",
      verification_code: "123456",
      verification_sent_date: "2025-01-01T00:00:00Z",
      verified: true,
      verified_date: "2025-01-01T00:05:00Z",
      country_code: "US",
    };

    expect(isNotVerified(phone)).toBe(false);
  });

  it("returns true for unverified phone", () => {
    const phone: UnverifiedPhone = {
      id: 1,
      number: "+15555551234",
      verification_code: "123456",
      verification_sent_date: "2025-01-01T00:00:00Z",
      verified: false,
      verified_date: null,
      country_code: "US",
    };

    expect(isNotVerified(phone)).toBe(true);
  });

  it("returns true when verified is undefined", () => {
    const phone: UnverifiedPhone = {
      id: 1,
      number: "+15555551234",
      verification_code: "123456",
      verification_sent_date: "2025-01-01T00:00:00Z",
      verified: undefined,
      verified_date: null,
      country_code: "US",
    };

    expect(isNotVerified(phone)).toBe(true);
  });
});

describe("hasPendingVerification", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2025-01-01T12:00:00Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns false when verification_sent_date is undefined", () => {
    const phone = {
      id: 1,
      number: "+15555551234",
      verification_code: "123456",
      verification_sent_date: undefined,
      verified: false,
      verified_date: null,
      country_code: "US",
    } as unknown as RealPhone;

    expect(hasPendingVerification(phone)).toBe(false);
  });

  it("returns false when verification_sent_date is null", () => {
    const phone = {
      id: 1,
      number: "+15555551234",
      verification_code: "123456",
      verification_sent_date: null,
      verified: false,
      verified_date: null,
      country_code: "US",
    } as unknown as RealPhone;

    expect(hasPendingVerification(phone)).toBe(false);
  });

  it("returns false when phone is already verified", () => {
    const phone: VerifiedPhone = {
      id: 1,
      number: "+15555551234",
      verification_code: "123456",
      verification_sent_date: "2025-01-01T11:56:00Z",
      verified: true,
      verified_date: "2025-01-01T11:57:00Z",
      country_code: "US",
    };

    expect(hasPendingVerification(phone)).toBe(false);
  });

  it("returns true when verification was sent within 5 minutes", () => {
    const phone: UnverifiedPhone = {
      id: 1,
      number: "+15555551234",
      verification_code: "123456",
      verification_sent_date: "2025-01-01T11:56:00Z",
      verified: false,
      verified_date: null,
      country_code: "US",
    };

    expect(hasPendingVerification(phone)).toBe(true);
  });

  it("returns false when verification was sent more than 5 minutes ago", () => {
    const phone: UnverifiedPhone = {
      id: 1,
      number: "+15555551234",
      verification_code: "123456",
      verification_sent_date: "2025-01-01T11:54:00Z",
      verified: false,
      verified_date: null,
      country_code: "US",
    };

    expect(hasPendingVerification(phone)).toBe(false);
  });

  it("returns true exactly at 5 minute boundary", () => {
    const phone: UnverifiedPhone = {
      id: 1,
      number: "+15555551234",
      verification_code: "123456",
      verification_sent_date: "2025-01-01T11:55:00Z",
      verified: false,
      verified_date: null,
      country_code: "US",
    };

    expect(hasPendingVerification(phone)).toBe(true);
  });
});
