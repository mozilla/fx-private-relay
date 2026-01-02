import { act, render, screen, cleanup } from "@testing-library/react";
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

const createTrackerData = (
  sender: any = "test@example.com",
  received_at: any = 1609459200000,
  original_link: any = "https://example.com/link",
) => ({ sender, received_at, original_link });

const setHashWithTrackerData = (data: any) => {
  window.location.hash = data ? encodeURIComponent(JSON.stringify(data)) : "";
};

describe("The contains-tracker-warning page", () => {
  beforeEach(() => {
    jest.spyOn(window, "addEventListener");
    jest.spyOn(window, "removeEventListener");
    mockedUseMetrics.mockReturnValue("disabled");
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("passes axe accessibility testing", async () => {
    setHashWithTrackerData(createTrackerData());
    const { baseElement } = render(<ContainsTracker />);
    const results = await act(() => axe(baseElement));
    expect(results).toHaveNoViolations();
  }, 10000);

  it("parses tracker data from URL hash and handles invalid cases", () => {
    setHashWithTrackerData(createTrackerData("sender@example.com"));
    render(<ContainsTracker />);
    expect(screen.getByText(/sender@example.com/i)).toBeInTheDocument();

    cleanup();
    setHashWithTrackerData(null);
    render(<ContainsTracker />);
    expect(
      screen.getByText("l10n string: [contains-tracker-title], with vars: {}"),
    ).toBeInTheDocument();

    cleanup();
    window.location.hash = "invalid-json";
    render(<ContainsTracker />);
    expect(
      screen.getByText("l10n string: [contains-tracker-title], with vars: {}"),
    ).toBeInTheDocument();

    cleanup();
    setHashWithTrackerData({ sender: "test@example.com" });
    render(<ContainsTracker />);
    expect(
      screen.queryByText(
        "l10n string: [contains-tracker-warning-view-link-cta], with vars: {}",
      ),
    ).not.toBeInTheDocument();

    cleanup();
    setHashWithTrackerData({
      sender: 123,
      received_at: "not-a-number",
      original_link: true,
    });
    render(<ContainsTracker />);
    expect(
      screen.queryByText(
        "l10n string: [contains-tracker-warning-view-link-cta], with vars: {}",
      ),
    ).not.toBeInTheDocument();

    cleanup();
    setHashWithTrackerData(null);
    render(<ContainsTracker />);
    expect(
      screen.queryByText(
        "l10n string: [contains-tracker-warning-view-link-cta], with vars: {}",
      ),
    ).not.toBeInTheDocument();
  });

  it("displays tracker warning banner and formatted content when valid data present", () => {
    setHashWithTrackerData(
      createTrackerData(
        "newsletter@example.com",
        1609459200000,
        "https://example.com/promo",
      ),
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

    cleanup();
    setHashWithTrackerData(null);
    render(<ContainsTracker />);
    expect(
      screen.queryByText(
        "l10n string: [contains-tracker-warning-title], with vars: {}",
      ),
    ).not.toBeInTheDocument();

    cleanup();
    setHashWithTrackerData(createTrackerData());
    render(<ContainsTracker />);
    expect(screen.getByText(/test@example.com/)).toBeInTheDocument();
  });

  it("renders appropriate link component based on metrics state", () => {
    mockedUseMetrics.mockReturnValue("enabled");
    setHashWithTrackerData(
      createTrackerData(
        "test@example.com",
        1609459200000,
        "https://example.com/tracked-link",
      ),
    );
    render(<ContainsTracker />);
    let link = screen.getByRole("link", {
      name: "l10n string: [contains-tracker-warning-view-link-cta], with vars: {}",
    });
    expect(link).toHaveAttribute("href", "https://example.com/tracked-link");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");

    cleanup();
    mockedUseMetrics.mockReturnValue("disabled");
    setHashWithTrackerData(
      createTrackerData(
        "test@example.com",
        1609459200000,
        "https://example.com/tracked-link",
      ),
    );
    render(<ContainsTracker />);
    link = screen.getByRole("link", {
      name: "l10n string: [contains-tracker-warning-view-link-cta], with vars: {}",
    });
    expect(link).toHaveAttribute("href", "https://example.com/tracked-link");

    cleanup();
    mockedUseMetrics.mockReturnValue("enabled");
    window.location.hash = "invalid";
    render(<ContainsTracker />);
    expect(
      screen.queryByRole("link", {
        name: "l10n string: [contains-tracker-warning-view-link-cta], with vars: {}",
      }),
    ).not.toBeInTheDocument();
  });

  it("manages hashchange event listener lifecycle", () => {
    const { unmount } = render(<ContainsTracker />);
    expect(window.addEventListener).toHaveBeenCalledWith(
      "hashchange",
      expect.any(Function),
    );

    unmount();
    expect(window.removeEventListener).toHaveBeenCalledWith(
      "hashchange",
      expect.any(Function),
    );
  });

  it("renders page structure with FAQ section and layout", () => {
    render(<ContainsTracker />);
    expect(
      screen.getByText("l10n string: [contains-tracker-title], with vars: {}"),
    ).toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
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

  it("handles edge cases in tracker data", () => {
    setHashWithTrackerData(createTrackerData("test@example.com", 0));
    render(<ContainsTracker />);
    expect(screen.getByText(/test@example.com/)).toBeInTheDocument();

    cleanup();
    const longEmail = "a".repeat(100) + "@example.com";
    setHashWithTrackerData(createTrackerData(longEmail));
    render(<ContainsTracker />);
    expect(screen.getByText(new RegExp(longEmail))).toBeInTheDocument();

    cleanup();
    setHashWithTrackerData(
      createTrackerData(
        "test@example.com",
        1609459200000,
        "https://example.com/link?param1=value&param2=value#anchor",
      ),
    );
    render(<ContainsTracker />);
    const link = screen.getByRole("link", {
      name: "l10n string: [contains-tracker-warning-view-link-cta], with vars: {}",
    });
    expect(link).toHaveAttribute(
      "href",
      "https://example.com/link?param1=value&param2=value#anchor",
    );

    cleanup();
    setHashWithTrackerData(createTrackerData("test@example.com", 1609459200.5));
    render(<ContainsTracker />);
    expect(
      screen.queryByText(
        "l10n string: [contains-tracker-warning-view-link-cta], with vars: {}",
      ),
    ).not.toBeInTheDocument();
  });
});
