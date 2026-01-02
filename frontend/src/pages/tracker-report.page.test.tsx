import { act, render, screen, cleanup } from "@testing-library/react";
import { axe } from "jest-axe";
import { setMockProfileData } from "../../__mocks__/hooks/api/profile";
import { setMockRuntimeData } from "../../__mocks__/hooks/api/runtimeData";

import TrackerReport from "./tracker-report.page";

setMockRuntimeData();
setMockProfileData(null);

const createReportData = (
  sender: any = "test@example.com",
  received_at: any = 1609459200000,
  trackers?: any,
) => ({
  sender,
  received_at,
  ...(trackers !== undefined && { trackers }),
});

const setHashWithReportData = (data: any) => {
  window.location.hash = data ? encodeURIComponent(JSON.stringify(data)) : "";
};

describe("The tracker report page", () => {
  beforeEach(() => {
    jest.spyOn(window, "addEventListener");
    jest.spyOn(window, "removeEventListener");
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("passes axe accessibility testing", async () => {
    setHashWithReportData(
      createReportData("test@example.com", 1234567890000, {
        "ads.facebook.com": 5,
        "tracker.google.com": 3,
      }),
    );
    const { baseElement } = render(<TrackerReport />);
    const results = await act(() =>
      axe(baseElement, {
        rules: { region: { enabled: false } },
      }),
    );
    expect(results).toHaveNoViolations();
  }, 10000);

  it("parses report data from URL hash and handles errors", () => {
    window.location.hash = "invalid-json";
    render(<TrackerReport />);
    expect(
      screen.getByText(
        "l10n string: [trackerreport-load-error], with vars: {}",
      ),
    ).toBeInTheDocument();

    cleanup();
    setHashWithReportData(null);
    render(<TrackerReport />);
    expect(
      screen.getByText(
        "l10n string: [trackerreport-load-error], with vars: {}",
      ),
    ).toBeInTheDocument();

    cleanup();
    setHashWithReportData(
      createReportData("sender@example.com", 1609459200000, {
        "tracker1.com": 5,
        "tracker2.com": 3,
      }),
    );
    render(<TrackerReport />);
    expect(screen.getByText("sender@example.com")).toBeInTheDocument();
    expect(screen.getByText("tracker1.com")).toBeInTheDocument();
    expect(screen.getByText("tracker2.com")).toBeInTheDocument();

    cleanup();
    setHashWithReportData(createReportData());
    render(<TrackerReport />);
    expect(
      screen.getByText(
        "l10n string: [trackerreport-trackers-none], with vars: {}",
      ),
    ).toBeInTheDocument();

    cleanup();
    setHashWithReportData(
      createReportData("test@example.com", 1609459200000, {}),
    );
    render(<TrackerReport />);
    expect(
      screen.getByText(
        "l10n string: [trackerreport-trackers-none], with vars: {}",
      ),
    ).toBeInTheDocument();

    cleanup();
    setHashWithReportData({ received_at: 1609459200000, trackers: {} });
    render(<TrackerReport />);
    expect(
      screen.getByText(
        "l10n string: [trackerreport-load-error], with vars: {}",
      ),
    ).toBeInTheDocument();

    cleanup();
    setHashWithReportData({ sender: "test@example.com", trackers: {} });
    render(<TrackerReport />);
    expect(
      screen.getByText(
        "l10n string: [trackerreport-load-error], with vars: {}",
      ),
    ).toBeInTheDocument();

    cleanup();
    setHashWithReportData({
      sender: 123,
      received_at: "not-a-number",
      trackers: "not-an-object",
    });
    render(<TrackerReport />);
    expect(
      screen.getByText(
        "l10n string: [trackerreport-load-error], with vars: {}",
      ),
    ).toBeInTheDocument();

    cleanup();
    setHashWithReportData(
      createReportData("test@example.com", 1609459200.5, {}),
    );
    render(<TrackerReport />);
    expect(
      screen.getByText(
        "l10n string: [trackerreport-load-error], with vars: {}",
      ),
    ).toBeInTheDocument();

    cleanup();
    setHashWithReportData(
      createReportData("test@example.com", 1609459200000, {
        "tracker.com": "not-a-number",
      }),
    );
    render(<TrackerReport />);
    expect(
      screen.getByText(
        "l10n string: [trackerreport-load-error], with vars: {}",
      ),
    ).toBeInTheDocument();

    cleanup();
    setHashWithReportData(null);
    render(<TrackerReport />);
    expect(
      screen.getByText(
        "l10n string: [trackerreport-load-error], with vars: {}",
      ),
    ).toBeInTheDocument();
  });

  it("displays trackers in sorted table or empty message", () => {
    setHashWithReportData(
      createReportData("test@example.com", 1609459200000, {
        "tracker1.com": 5,
        "tracker2.com": 3,
      }),
    );
    render(<TrackerReport />);
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(
      screen.getByText(
        "l10n string: [trackerreport-trackers-tracker-heading], with vars: {}",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "l10n string: [trackerreport-trackers-count-heading], with vars: {}",
      ),
    ).toBeInTheDocument();

    cleanup();
    setHashWithReportData(
      createReportData("test@example.com", 1609459200000, {
        "tracker1.com": 2,
        "tracker2.com": 10,
        "tracker3.com": 5,
      }),
    );
    render(<TrackerReport />);
    const rows = screen.getAllByRole("row");
    expect(rows[1]).toHaveTextContent("tracker2.com");
    expect(rows[2]).toHaveTextContent("tracker3.com");
    expect(rows[3]).toHaveTextContent("tracker1.com");

    cleanup();
    setHashWithReportData(
      createReportData("test@example.com", 1609459200000, {
        "tracker1.com": 5,
      }),
    );
    render(<TrackerReport />);
    expect(screen.getByLabelText("5")).toBeInTheDocument();
    expect(screen.getByText("tracker1.com")).toBeInTheDocument();

    cleanup();
    setHashWithReportData(
      createReportData("test@example.com", 1609459200000, {}),
    );
    render(<TrackerReport />);
    expect(
      screen.getByText(
        "l10n string: [trackerreport-trackers-none], with vars: {}",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("displays report metadata correctly", () => {
    setHashWithReportData(
      createReportData("sender@example.com", 1609459200000, {}),
    );
    render(<TrackerReport />);
    expect(
      screen.getByText(
        "l10n string: [trackerreport-meta-from-heading], with vars: {}",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("sender@example.com")).toBeInTheDocument();

    expect(
      screen.getByText(
        "l10n string: [trackerreport-meta-receivedat-heading], with vars: {}",
      ),
    ).toBeInTheDocument();
    const date = new Date(1609459200000).toLocaleString();
    expect(screen.getByText(date)).toBeInTheDocument();

    cleanup();
    setHashWithReportData(
      createReportData("test@example.com", 1609459200000, {
        "tracker1.com": 5,
        "tracker2.com": 3,
        "tracker3.com": 2,
      }),
    );
    render(<TrackerReport />);
    expect(
      screen.getByText(
        "l10n string: [trackerreport-meta-count-heading], with vars: {}",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'l10n string: [trackerreport-trackers-value], with vars: {"count":10}',
      ),
    ).toBeInTheDocument();
  });

  it("displays complete page content and sections", () => {
    setHashWithReportData(
      createReportData("test@example.com", 1609459200000, {}),
    );
    render(<TrackerReport />);

    expect(
      screen.getByText("l10n string: [trackerreport-title], with vars: {}"),
    ).toBeInTheDocument();
    expect(
      screen.getByAltText("l10n string: [logo-alt], with vars: {}"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "l10n string: [trackerreport-confidentiality-notice], with vars: {}",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "l10n string: [trackerreport-removal-explainer-heading], with vars: {}",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "l10n string: [trackerreport-removal-explainer-content], with vars: {}",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "l10n string: [trackerreport-trackers-explainer-heading], with vars: {}",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "l10n string: [trackerreport-trackers-explainer-content-part1], with vars: {}",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "l10n string: [trackerreport-trackers-explainer-content-part2], with vars: {}",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "l10n string: [trackerreport-breakage-warning-2], with vars: {}",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "l10n string: [trackerreport-faq-heading], with vars: {}",
      ),
    ).toBeInTheDocument();

    const link = screen.getByRole("link", {
      name: "l10n string: [trackerreport-faq-cta], with vars: {}",
    });
    expect(link).toHaveAttribute("href", "/faq");

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

  it("manages hashchange event listener lifecycle", () => {
    setHashWithReportData(createReportData());
    const { unmount } = render(<TrackerReport />);
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

  it("handles edge cases in report data", () => {
    const longEmail = "a".repeat(100) + "@example.com";
    setHashWithReportData(createReportData(longEmail, 1609459200000, {}));
    render(<TrackerReport />);
    expect(screen.getByText(longEmail)).toBeInTheDocument();

    cleanup();
    setHashWithReportData(
      createReportData("test@example.com", 1609459200000, {
        "tracker.com": 999999,
      }),
    );
    render(<TrackerReport />);
    expect(screen.getByLabelText("999999")).toBeInTheDocument();

    cleanup();
    const trackers: Record<string, number> = {};
    for (let i = 0; i < 50; i++) {
      trackers[`tracker${i}.com`] = i + 1;
    }
    setHashWithReportData(
      createReportData("test@example.com", 1609459200000, trackers),
    );
    render(<TrackerReport />);
    expect(screen.getAllByRole("row")).toHaveLength(51);

    cleanup();
    setHashWithReportData(
      createReportData("test@example.com", 1609459200000, {
        "tracker-with-dash.com": 5,
        "tracker_with_underscore.com": 3,
      }),
    );
    render(<TrackerReport />);
    expect(screen.getByText("tracker-with-dash.com")).toBeInTheDocument();
    expect(screen.getByText("tracker_with_underscore.com")).toBeInTheDocument();

    cleanup();
    setHashWithReportData(createReportData("test@example.com", 0, {}));
    render(<TrackerReport />);
    const date = new Date(0).toLocaleString();
    expect(screen.getByText(date)).toBeInTheDocument();

    cleanup();
    setHashWithReportData(
      createReportData("test@example.com", 1609459200000, { "tracker.com": 0 }),
    );
    render(<TrackerReport />);
    expect(screen.getByLabelText("0")).toBeInTheDocument();
  });
});
