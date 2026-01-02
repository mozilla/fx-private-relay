import { act, render, screen } from "@testing-library/react";
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

  describe("under axe accessibility testing", () => {
    it("passes axe accessibility testing", async () => {
      const { baseElement } = render(<VpnRelayWelcome />);
      const results = await act(() => axe(baseElement));
      expect(results).toHaveNoViolations();
    }, 10000);
  });

  describe("profile refresh", () => {
    it("calls authenticatedFetch to refresh profile on mount", async () => {
      render(<VpnRelayWelcome />);

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockedAuthenticatedFetch).toHaveBeenCalledWith(
        "/accounts/profile/refresh",
      );
    });

    it("calls authenticatedFetch only once", async () => {
      render(<VpnRelayWelcome />);

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockedAuthenticatedFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("page content", () => {
    it("displays the headline", () => {
      render(<VpnRelayWelcome />);

      expect(
        screen.getByText(
          "l10n string: [vpn-relay-welcome-headline], with vars: {}",
        ),
      ).toBeInTheDocument();
    });

    it("displays the subheadline", () => {
      render(<VpnRelayWelcome />);

      expect(
        screen.getByText(
          "l10n string: [vpn-relay-welcome-subheadline], with vars: {}",
        ),
      ).toBeInTheDocument();
    });
  });

  describe("Relay panel", () => {
    it("displays Relay logo", () => {
      render(<VpnRelayWelcome />);

      const logos = screen.getAllByAltText(
        "l10n string: [logo-premium-alt], with vars: {}",
      );
      expect(logos.length).toBeGreaterThan(0);
    });

    it("displays Relay body text", () => {
      render(<VpnRelayWelcome />);

      expect(
        screen.getByText(
          "l10n string: [vpn-relay-go-relay-body-3], with vars: {}",
        ),
      ).toBeInTheDocument();
    });

    it("displays link to Relay dashboard", () => {
      render(<VpnRelayWelcome />);

      const relayLink = screen.getByRole("link", {
        name: "l10n string: [vpn-relay-go-relay-cta], with vars: {}",
      });

      expect(relayLink).toBeInTheDocument();
      expect(relayLink).toHaveAttribute("href", "/");
    });
  });

  describe("VPN panel", () => {
    it("displays VPN logo", () => {
      render(<VpnRelayWelcome />);

      const vpnLogos = screen.getAllByAltText(
        "l10n string: [logo-premium-alt], with vars: {}",
      );
      expect(vpnLogos.length).toBeGreaterThan(0);
    });

    it("displays VPN body text", () => {
      render(<VpnRelayWelcome />);

      expect(
        screen.getByText(
          "l10n string: [vpn-relay-go-vpn-body-2], with vars: {}",
        ),
      ).toBeInTheDocument();
    });

    it("displays VPN download link", () => {
      render(<VpnRelayWelcome />);

      const vpnLink = screen.getByRole("link", {
        name: "l10n string: [vpn-relay-go-vpn-cta], with vars: {}",
      });

      expect(vpnLink).toBeInTheDocument();
    });

    it("includes correct UTM parameters in VPN link", () => {
      render(<VpnRelayWelcome />);

      const vpnLink = screen.getByRole("link", {
        name: "l10n string: [vpn-relay-go-vpn-cta], with vars: {}",
      });

      const href = vpnLink.getAttribute("href");
      expect(href).toContain("utm_source=");
      expect(href).toContain("utm_medium=referral");
      expect(href).toContain("utm_campaign=vpn-relay-welcome");
      expect(href).toContain("utm_content=download-button");
    });

    it("opens VPN link in new tab", () => {
      render(<VpnRelayWelcome />);

      const vpnLink = screen.getByRole("link", {
        name: "l10n string: [vpn-relay-go-vpn-cta], with vars: {}",
      });

      expect(vpnLink).toHaveAttribute("target", "_blank");
    });

    it("points to Mozilla VPN download page", () => {
      render(<VpnRelayWelcome />);

      const vpnLink = screen.getByRole("link", {
        name: "l10n string: [vpn-relay-go-vpn-cta], with vars: {}",
      });

      const href = vpnLink.getAttribute("href");
      expect(href).toContain("https://vpn.mozilla.org/vpn/download/");
    });
  });

  describe("referring site URL", () => {
    it("includes utm_source parameter in VPN link", () => {
      render(<VpnRelayWelcome />);

      const vpnLink = screen.getByRole("link", {
        name: "l10n string: [vpn-relay-go-vpn-cta], with vars: {}",
      });

      const href = vpnLink.getAttribute("href");
      expect(href).toContain("utm_source=");
    });

    it("properly encodes referring site URL", () => {
      render(<VpnRelayWelcome />);

      const vpnLink = screen.getByRole("link", {
        name: "l10n string: [vpn-relay-go-vpn-cta], with vars: {}",
      });

      const href = vpnLink.getAttribute("href");
      const url = new URL(href!);
      const utmSource = url.searchParams.get("utm_source");

      expect(utmSource).toBeTruthy();
      expect(typeof utmSource).toBe("string");
    });
  });

  describe("layout", () => {
    it("uses premium theme", () => {
      render(<VpnRelayWelcome />);

      expect(screen.getByRole("main")).toBeInTheDocument();
    });

    it("displays panel art image", () => {
      render(<VpnRelayWelcome />);

      const images = screen.getAllByRole("img");
      expect(images.length).toBeGreaterThan(2);
    });

    it("renders two panels", () => {
      render(<VpnRelayWelcome />);

      const relayPanel = screen.getByText(
        "l10n string: [vpn-relay-go-relay-body-3], with vars: {}",
      );
      const vpnPanel = screen.getByText(
        "l10n string: [vpn-relay-go-vpn-body-2], with vars: {}",
      );

      expect(relayPanel).toBeInTheDocument();
      expect(vpnPanel).toBeInTheDocument();
    });
  });
});
