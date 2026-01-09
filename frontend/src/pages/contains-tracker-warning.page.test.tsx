import React from "react";
// eslint-disable-next-line testing-library/no-manual-cleanup
import { act, render, screen, cleanup } from "@testing-library/react";
import { axe } from "jest-axe";
import { setMockProfileData } from "../../__mocks__/hooks/api/profile";
import { setMockRuntimeData } from "../../__mocks__/hooks/api/runtimeData";
import { expectL10nStrings } from "../../__mocks__/testHelpers";
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
  sender: unknown = "test@example.com",
  received_at: unknown = 1609459200000,
  original_link: unknown = "https://example.com/link",
) => ({ sender, received_at, original_link });

const setHashWithTrackerData = (data: unknown) => {
  window.location.hash = data ? encodeURIComponent(JSON.stringify(data)) : "";
};

const expectViewLink = (href: string) => {
  const link = screen.getByRole("link", {
    name: "l10n string: [contains-tracker-warning-view-link-cta], with vars: {}",
  });
  expect(link).toHaveAttribute("href", href);
  return link;
};

const expectNoViewLink = () => {
  expect(
    screen.queryByRole("link", {
      name: "l10n string: [contains-tracker-warning-view-link-cta], with vars: {}",
    }),
  ).not.toBeInTheDocument();
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
    expectL10nStrings(screen, ["contains-tracker-title"]);

    cleanup();
    window.location.hash = "invalid-json";
    render(<ContainsTracker />);
    expectL10nStrings(screen, ["contains-tracker-title"]);

    cleanup();
    setHashWithTrackerData({ sender: "test@example.com" });
    render(<ContainsTracker />);
    expectNoViewLink();

    cleanup();
    setHashWithTrackerData({
      sender: 123,
      received_at: "not-a-number",
      original_link: true,
    });
    render(<ContainsTracker />);
    expectNoViewLink();

    cleanup();
    setHashWithTrackerData(null);
    render(<ContainsTracker />);
    expectNoViewLink();
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
    expectL10nStrings(screen, [
      "contains-tracker-warning-title",
      "contains-tracker-warning-description",
    ]);

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
    const link = expectViewLink("https://example.com/tracked-link");
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
    expectViewLink("https://example.com/tracked-link");

    cleanup();
    mockedUseMetrics.mockReturnValue("enabled");
    window.location.hash = "invalid";
    render(<ContainsTracker />);
    expectNoViewLink();
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
    expect(screen.getByRole("main")).toBeInTheDocument();
    expectL10nStrings(screen, [
      "contains-tracker-title",
      "contains-tracker-faq-section-title",
      "faq-question-define-tracker-question",
      "faq-question-disable-trackerremoval-question",
      "faq-question-bulk-trackerremoval-question",
      "faq-question-trackerremoval-breakage-question",
    ]);
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
    expectViewLink("https://example.com/link?param1=value&param2=value#anchor");

    cleanup();
    setHashWithTrackerData(createTrackerData("test@example.com", 1609459200.5));
    render(<ContainsTracker />);
    expectNoViewLink();
  });
});
