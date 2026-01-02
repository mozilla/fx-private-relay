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

const createMockPhone = (verified: boolean): any => ({
  id: 1,
  number: "+15555551234",
  verification_code: "123456",
  verification_sent_date: "2025-01-01T00:00:00Z",
  verified,
  verified_date: verified ? "2025-01-01T00:05:00Z" : null,
  country_code: "US",
});

describe("useRealPhonesData", () => {
  const mockMutate = jest.fn();
  const mockApiFetch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    const api = jest.requireMock("./api");
    api.apiFetch = mockApiFetch;
  });

  it("fetches phone data and handles verification/removal/SMS operations", async () => {
    const useApiV1 = jest.requireMock("./api").useApiV1;

    useApiV1.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: true,
      isValidating: false,
      mutate: mockMutate,
    });

    let { result, rerender } = renderHook(() => useRealPhonesData());

    expect(useApiV1).toHaveBeenCalledWith("/realphone/");
    expect(result.current.isLoading).toBe(true);

    useApiV1.mockReturnValue({
      data: [createMockPhone(true)],
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: mockMutate,
    });

    rerender();
    await waitFor(() => {
      expect(result.current.data).toHaveLength(1);
    });

    useApiV1.mockReturnValue({
      data: undefined,
      error: new Error("Network error"),
      isLoading: false,
      isValidating: false,
      mutate: mockMutate,
    });

    rerender();
    await waitFor(() => {
      expect(result.current.error).toBeDefined();
    });

    useApiV1.mockReturnValue({
      data: [],
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: mockMutate,
    });

    rerender();
    mockApiFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    const verificationResponse =
      await result.current.requestPhoneVerification("+15555551234");
    expect(mockApiFetch).toHaveBeenCalledWith("/realphone/", {
      method: "POST",
      body: JSON.stringify({ number: "+15555551234" }),
    });
    expect(verificationResponse.ok).toBe(true);
    expect(mockMutate).toHaveBeenCalled();

    mockApiFetch.mockClear();
    mockMutate.mockClear();

    const submitResponse = await result.current.submitPhoneVerification(123, {
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
    expect(submitResponse.ok).toBe(true);
    expect(mockMutate).toHaveBeenCalled();

    mockApiFetch.mockClear();
    mockMutate.mockClear();

    const removalResponse = await result.current.requestPhoneRemoval(123);
    expect(mockApiFetch).toHaveBeenCalledWith("/realphone/123/", {
      method: "DELETE",
    });
    expect(removalResponse.ok).toBe(true);
    expect(mockMutate).toHaveBeenCalled();

    mockApiFetch.mockClear();
    mockMutate.mockClear();

    const smsResponse = await result.current.resendWelcomeSMS();
    expect(mockApiFetch).toHaveBeenCalledWith("/realphone/resend_welcome_sms", {
      method: "POST",
    });
    expect(smsResponse.ok).toBe(true);
    expect(mockMutate).toHaveBeenCalled();
  });
});

describe("Helper functions", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2025-01-01T12:00:00Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("isVerified, isNotVerified, and hasPendingVerification work correctly", () => {
    const verifiedPhone: VerifiedPhone = createMockPhone(true);
    const unverifiedPhone: UnverifiedPhone = createMockPhone(false);
    const undefinedVerifiedPhone: UnverifiedPhone = {
      ...createMockPhone(false),
      verified: undefined,
    };

    expect(isVerified(verifiedPhone)).toBe(true);
    expect(isVerified(unverifiedPhone)).toBe(false);
    expect(isVerified(undefinedVerifiedPhone)).toBe(false);

    expect(isNotVerified(verifiedPhone)).toBe(false);
    expect(isNotVerified(unverifiedPhone)).toBe(true);
    expect(isNotVerified(undefinedVerifiedPhone)).toBe(true);

    expect(
      hasPendingVerification({
        ...createMockPhone(false),
        verification_sent_date: undefined,
      } as unknown as RealPhone),
    ).toBe(false);
    expect(
      hasPendingVerification({
        ...createMockPhone(false),
        verification_sent_date: null,
      } as unknown as RealPhone),
    ).toBe(false);
    expect(hasPendingVerification(verifiedPhone)).toBe(false);

    const phoneWithin5Min: UnverifiedPhone = {
      ...createMockPhone(false),
      verification_sent_date: "2025-01-01T11:56:00Z",
    };
    expect(hasPendingVerification(phoneWithin5Min)).toBe(true);

    const phoneAfter5Min: UnverifiedPhone = {
      ...createMockPhone(false),
      verification_sent_date: "2025-01-01T11:54:00Z",
    };
    expect(hasPendingVerification(phoneAfter5Min)).toBe(false);

    const phoneAt5MinBoundary: UnverifiedPhone = {
      ...createMockPhone(false),
      verification_sent_date: "2025-01-01T11:55:00Z",
    };
    expect(hasPendingVerification(phoneAt5MinBoundary)).toBe(true);
  });
});
