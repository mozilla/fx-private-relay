import { toast } from "react-toastify";
import { makeToast } from "./makeToast";

// Mock react-toastify
jest.mock("react-toastify", () => ({
  toast: {
    success: jest.fn(),
  },
}));

// Mock cookies module
jest.mock("./cookies", () => ({
  getCookie: jest.fn(),
  clearCookie: jest.fn(),
  setCookie: jest.fn(),
}));

const mockGetCookie = jest.requireMock("./cookies").getCookie;
const mockClearCookie = jest.requireMock("./cookies").clearCookie;

describe("makeToast", () => {
  const mockL10n = {
    getString: jest.fn((key: string, vars?: Record<string, unknown>) => {
      if (vars) {
        return `l10n string: [${key}], with vars: ${JSON.stringify(vars)}`;
      }
      return `l10n string: [${key}], with vars: {}`;
    }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("does not show toast when no cookies are set", () => {
    mockGetCookie.mockReturnValue(undefined);

    makeToast(mockL10n as never);

    expect(toast.success).not.toHaveBeenCalled();
  });

  it("shows sign-out success toast when user-sign-out cookie exists", () => {
    mockGetCookie.mockImplementation((name: string) => {
      if (name === "user-sign-out") return "true";
      return undefined;
    });

    makeToast(mockL10n as never);

    expect(mockClearCookie).toHaveBeenCalledWith("user-sign-out");
    expect(toast.success).toHaveBeenCalledWith(
      "l10n string: [success-signed-out-message], with vars: {}",
    );
  });

  it("shows sign-in success toast when user-sign-in cookie exists and user data is provided", () => {
    mockGetCookie.mockImplementation((name: string) => {
      if (name === "user-sign-in") return "true";
      return undefined;
    });

    const userData = { email: "test@example.com" };
    makeToast(mockL10n as never, userData as never);

    expect(mockClearCookie).toHaveBeenCalledWith("user-sign-in");
    expect(toast.success).toHaveBeenCalledWith(
      'l10n string: [success-signed-in-message], with vars: {"username":"test@example.com"}',
    );
  });

  it("does not show sign-in toast when cookie exists but user data is undefined", () => {
    mockGetCookie.mockImplementation((name: string) => {
      if (name === "user-sign-in") return "true";
      return undefined;
    });

    makeToast(mockL10n as never, undefined);

    expect(mockClearCookie).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("prioritizes sign-out toast over sign-in when both cookies exist", () => {
    mockGetCookie.mockReturnValue("true");

    const userData = { email: "test@example.com" };
    makeToast(mockL10n as never, userData as never);

    expect(mockClearCookie).toHaveBeenCalledWith("user-sign-out");
    expect(mockL10n.getString).toHaveBeenCalledWith(
      "success-signed-out-message",
    );
    expect(mockL10n.getString).not.toHaveBeenCalledWith(
      "success-signed-in-message",
      expect.anything(),
    );
  });
});
