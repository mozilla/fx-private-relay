import { act, render, screen, cleanup } from "@testing-library/react";
import { axe } from "jest-axe";
import { setMockProfileData } from "../../__mocks__/hooks/api/profile";
import { setMockRuntimeData } from "../../__mocks__/hooks/api/runtimeData";
import { authenticatedFetch, useApiV1 } from "../hooks/api/api";

jest.mock("../hooks/api/api", () => ({
  authenticatedFetch: jest.fn(),
  useApiV1: jest.fn(),
}));

import VpnRelayWelcome from "./vpn-relay-welcome.page";

const mockedAuthenticatedFetch = authenticatedFetch as jest.MockedFunction<
  typeof authenticatedFetch
>;
const mockedUseApiV1 = useApiV1 as jest.MockedFunction<typeof useApiV1>;

setMockRuntimeData();
setMockProfileData(null);

describe("The VPN + Relay welcome page", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockedAuthenticatedFetch.mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response);

    mockedUseApiV1.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: jest.fn(),
    });
  });

  it("passes axe accessibility testing", async () => {
    const { baseElement } = render(<VpnRelayWelcome />);
    const results = await act(() => axe(baseElement));
    expect(results).toHaveNoViolations();
  }, 10000);

  it("refreshes profile on mount", async () => {
    render(<VpnRelayWelcome />);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mockedAuthenticatedFetch).toHaveBeenCalledWith(
      "/accounts/profile/refresh",
    );
    expect(mockedAuthenticatedFetch).toHaveBeenCalledTimes(1);
  });

  it("displays page content and layout structure", () => {
    render(<VpnRelayWelcome />);

    expect(
      screen.getByText(
        "l10n string: [vpn-relay-welcome-headline], with vars: {}",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "l10n string: [vpn-relay-welcome-subheadline], with vars: {}",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getAllByRole("img").length).toBeGreaterThan(2);

    const relayPanel = screen.getByText(
      "l10n string: [vpn-relay-go-relay-body-3], with vars: {}",
    );
    const vpnPanel = screen.getByText(
      "l10n string: [vpn-relay-go-vpn-body-2], with vars: {}",
    );
    expect(relayPanel).toBeInTheDocument();
    expect(vpnPanel).toBeInTheDocument();
  });

  it("displays Relay panel with content and link", () => {
    render(<VpnRelayWelcome />);

    expect(
      screen.getAllByAltText("l10n string: [logo-premium-alt], with vars: {}")
        .length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByText(
        "l10n string: [vpn-relay-go-relay-body-3], with vars: {}",
      ),
    ).toBeInTheDocument();

    const relayLink = screen.getByRole("link", {
      name: "l10n string: [vpn-relay-go-relay-cta], with vars: {}",
    });
    expect(relayLink).toBeInTheDocument();
    expect(relayLink).toHaveAttribute("href", "/");
  });

  it("displays VPN panel with link and UTM parameters", () => {
    render(<VpnRelayWelcome />);

    expect(
      screen.getAllByAltText("l10n string: [logo-premium-alt], with vars: {}")
        .length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByText("l10n string: [vpn-relay-go-vpn-body-2], with vars: {}"),
    ).toBeInTheDocument();

    const vpnLink = screen.getByRole("link", {
      name: "l10n string: [vpn-relay-go-vpn-cta], with vars: {}",
    });
    expect(vpnLink).toBeInTheDocument();
    expect(vpnLink).toHaveAttribute("target", "_blank");

    const href = vpnLink.getAttribute("href");
    expect(href).toContain("https://vpn.mozilla.org/vpn/download/");
    expect(href).toContain("utm_source=");
    expect(href).toContain("utm_medium=referral");
    expect(href).toContain("utm_campaign=vpn-relay-welcome");
    expect(href).toContain("utm_content=download-button");

    const url = new URL(href!);
    const utmSource = url.searchParams.get("utm_source");
    expect(utmSource).toBeTruthy();
    expect(typeof utmSource).toBe("string");
  });
});
