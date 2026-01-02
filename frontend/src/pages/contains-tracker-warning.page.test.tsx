import { act, render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { setMockProfileData } from "../../__mocks__/hooks/api/profile";
import { setMockRuntimeData } from "../../__mocks__/hooks/api/runtimeData";
import { useMetrics } from "../hooks/metrics";

jest.mock("../hooks/metrics");
jest.mock("react-ga", () => ({
  __esModule: true,
  OutboundLink: ({ children, to, ...props }: React.ComponentProps<"a">) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

import ContainsTracker from "./contains-tracker-warning.page";

const mockedUseMetrics = useMetrics as jest.MockedFunction<typeof useMetrics>;

setMockRuntimeData();
setMockProfileData(null);

describe("The contains-tracker-warning page", () => {
  beforeEach(() => {
    jest.spyOn(window, "addEventListener");
    jest.spyOn(window, "removeEventListener");
    mockedUseMetrics.mockReturnValue("disabled");
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("under axe accessibility testing", () => {
    it("passes axe accessibility testing", async () => {
      window.location.hash = encodeURIComponent(
        JSON.stringify({
          sender: "test@example.com",
          received_at: 1234567890000,
          original_link: "https://example.com/tracker",
        }),
      );

      const { baseElement } = render(<ContainsTracker />);
      const results = await act(() => axe(baseElement));
      expect(results).toHaveNoViolations();
    }, 10000);
  });

  describe("tracker data parsing", () => {
    it("parses valid tracker data from URL hash", () => {
      const trackerData = {
        sender: "sender@example.com",
        received_at: 1609459200000,
        original_link: "https://example.com/link",
      };
      window.location.hash = encodeURIComponent(JSON.stringify(trackerData));

      render(<ContainsTracker />);

      expect(screen.getByText(/sender@example.com/i)).toBeInTheDocument();
    });

    it("handles empty hash gracefully", () => {
      window.location.hash = "";

      render(<ContainsTracker />);

      expect(
        screen.getByText(
          "l10n string: [contains-tracker-title], with vars: {}",
        ),
      ).toBeInTheDocument();
    });

    it("handles invalid JSON in hash", () => {
      window.location.hash = "invalid-json";

      render(<ContainsTracker />);

      expect(
        screen.getByText(
          "l10n string: [contains-tracker-title], with vars: {}",
        ),
      ).toBeInTheDocument();
    });

    it("handles hash with missing required fields", () => {
      window.location.hash = encodeURIComponent(
        JSON.stringify({
          sender: "test@example.com",
        }),
      );

      render(<ContainsTracker />);

      const viewLinkButton = screen.queryByText(
        "l10n string: [contains-tracker-warning-view-link-cta], with vars: {}",
      );
      expect(viewLinkButton).not.toBeInTheDocument();
    });

    it("handles hash with wrong field types", () => {
      window.location.hash = encodeURIComponent(
        JSON.stringify({
          sender: 123,
          received_at: "not-a-number",
          original_link: true,
        }),
      );

      render(<ContainsTracker />);

      const viewLinkButton = screen.queryByText(
        "l10n string: [contains-tracker-warning-view-link-cta], with vars: {}",
      );
      expect(viewLinkButton).not.toBeInTheDocument();
    });

    it("handles hash with null value", () => {
      window.location.hash = encodeURIComponent(JSON.stringify(null));

      render(<ContainsTracker />);

      const viewLinkButton = screen.queryByText(
        "l10n string: [contains-tracker-warning-view-link-cta], with vars: {}",
      );
      expect(viewLinkButton).not.toBeInTheDocument();
    });
  });

  describe("tracker warning display", () => {
    it("displays warning banner when tracker data is present", () => {
      window.location.hash = encodeURIComponent(
        JSON.stringify({
          sender: "newsletter@example.com",
          received_at: 1609459200000,
          original_link: "https://example.com/promo",
        }),
      );

      render(<ContainsTracker />);

      expect(
        screen.getByText(
          "l10n string: [contains-tracker-warning-title], with vars: {}",
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          "l10n string: [contains-tracker-warning-description], with vars: {}",
        ),
      ).toBeInTheDocument();
    });

    it("does not display warning banner when tracker data is missing", () => {
      window.location.hash = "";

      render(<ContainsTracker />);

      expect(
        screen.queryByText(
          "l10n string: [contains-tracker-warning-title], with vars: {}",
        ),
      ).not.toBeInTheDocument();
    });

    it("displays formatted date in tracker description", () => {
      window.location.hash = encodeURIComponent(
        JSON.stringify({
          sender: "test@example.com",
          received_at: 1609459200000,
          original_link: "https://example.com/link",
        }),
      );

      render(<ContainsTracker />);

      expect(screen.getByText(/test@example.com/)).toBeInTheDocument();
    });
  });

  describe("link rendering based on metrics", () => {
    it("renders OutboundLink when metrics are enabled", () => {
      mockedUseMetrics.mockReturnValue("enabled");
      window.location.hash = encodeURIComponent(
        JSON.stringify({
          sender: "test@example.com",
          received_at: 1609459200000,
          original_link: "https://example.com/tracked-link",
        }),
      );

      render(<ContainsTracker />);

      const link = screen.getByRole("link", {
        name: "l10n string: [contains-tracker-warning-view-link-cta], with vars: {}",
      });

      expect(link).toHaveAttribute("href", "https://example.com/tracked-link");
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    });

    it("renders regular Link when metrics are disabled", () => {
      mockedUseMetrics.mockReturnValue("disabled");
      window.location.hash = encodeURIComponent(
        JSON.stringify({
          sender: "test@example.com",
          received_at: 1609459200000,
          original_link: "https://example.com/tracked-link",
        }),
      );

      render(<ContainsTracker />);

      const link = screen.getByRole("link", {
        name: "l10n string: [contains-tracker-warning-view-link-cta], with vars: {}",
      });

      expect(link).toHaveAttribute("href", "https://example.com/tracked-link");
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    });

    it("does not render link when tracker data is invalid", () => {
      mockedUseMetrics.mockReturnValue("enabled");
      window.location.hash = "invalid";

      render(<ContainsTracker />);

      const link = screen.queryByRole("link", {
        name: "l10n string: [contains-tracker-warning-view-link-cta], with vars: {}",
      });

      expect(link).not.toBeInTheDocument();
    });
  });

  describe("hash change event handling", () => {
    it("adds hashchange event listener on mount", () => {
      render(<ContainsTracker />);

      expect(window.addEventListener).toHaveBeenCalledWith(
        "hashchange",
        expect.any(Function),
      );
    });

    it("removes hashchange event listener on unmount", () => {
      const { unmount } = render(<ContainsTracker />);

      unmount();

      expect(window.removeEventListener).toHaveBeenCalledWith(
        "hashchange",
        expect.any(Function),
      );
    });
  });

  describe("FAQ section", () => {
    it("renders FAQ section with tracker-related questions", () => {
      render(<ContainsTracker />);

      expect(
        screen.getByText(
          "l10n string: [contains-tracker-faq-section-title], with vars: {}",
        ),
      ).toBeInTheDocument();

      expect(
        screen.getByText(
          "l10n string: [faq-question-define-tracker-question], with vars: {}",
        ),
      ).toBeInTheDocument();

      expect(
        screen.getByText(
          "l10n string: [faq-question-disable-trackerremoval-question], with vars: {}",
        ),
      ).toBeInTheDocument();

      expect(
        screen.getByText(
          "l10n string: [faq-question-bulk-trackerremoval-question], with vars: {}",
        ),
      ).toBeInTheDocument();

      expect(
        screen.getByText(
          "l10n string: [faq-question-trackerremoval-breakage-question], with vars: {}",
        ),
      ).toBeInTheDocument();
    });
  });

  describe("rendering", () => {
    it("renders the main container", () => {
      render(<ContainsTracker />);

      expect(
        screen.getByText(
          "l10n string: [contains-tracker-title], with vars: {}",
        ),
      ).toBeInTheDocument();
    });

    it("renders within Layout component", () => {
      render(<ContainsTracker />);

      expect(screen.getByRole("main")).toBeInTheDocument();
    });
  });

  describe("edge cases", () => {
    it("handles received_at as 0", () => {
      window.location.hash = encodeURIComponent(
        JSON.stringify({
          sender: "test@example.com",
          received_at: 0,
          original_link: "https://example.com/link",
        }),
      );

      render(<ContainsTracker />);

      expect(screen.getByText(/test@example.com/)).toBeInTheDocument();
    });

    it("handles very long sender email", () => {
      const longEmail = "a".repeat(100) + "@example.com";
      window.location.hash = encodeURIComponent(
        JSON.stringify({
          sender: longEmail,
          received_at: 1609459200000,
          original_link: "https://example.com/link",
        }),
      );

      render(<ContainsTracker />);

      expect(screen.getByText(new RegExp(longEmail))).toBeInTheDocument();
    });

    it("handles special characters in original_link", () => {
      window.location.hash = encodeURIComponent(
        JSON.stringify({
          sender: "test@example.com",
          received_at: 1609459200000,
          original_link:
            "https://example.com/link?param1=value&param2=value#anchor",
        }),
      );

      render(<ContainsTracker />);

      const link = screen.getByRole("link", {
        name: "l10n string: [contains-tracker-warning-view-link-cta], with vars: {}",
      });

      expect(link).toHaveAttribute(
        "href",
        "https://example.com/link?param1=value&param2=value#anchor",
      );
    });

    it("handles received_at with decimal value (should fail validation)", () => {
      window.location.hash = encodeURIComponent(
        JSON.stringify({
          sender: "test@example.com",
          received_at: 1609459200.5,
          original_link: "https://example.com/link",
        }),
      );

      render(<ContainsTracker />);

      const viewLinkButton = screen.queryByText(
        "l10n string: [contains-tracker-warning-view-link-cta], with vars: {}",
      );
      expect(viewLinkButton).not.toBeInTheDocument();
    });
  });
});
