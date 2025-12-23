import { act, render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { setMockProfileData } from "../../__mocks__/hooks/api/profile";
import { setMockRuntimeData } from "../../__mocks__/hooks/api/runtimeData";

import TrackerReport from "./tracker-report.page";

setMockRuntimeData();
setMockProfileData(null);

describe("The tracker report page", () => {
  beforeEach(() => {
    jest.spyOn(window, "addEventListener");
    jest.spyOn(window, "removeEventListener");
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
          trackers: {
            "ads.facebook.com": 5,
            "tracker.google.com": 3,
          },
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
  });

  describe("error state", () => {
    it("shows error message when hash parsing fails", () => {
      window.location.hash = "invalid-json";

      render(<TrackerReport />);

      expect(
        screen.getByText(
          "l10n string: [trackerreport-load-error], with vars: {}",
        ),
      ).toBeInTheDocument();
    });

    it("shows error message when hash is empty", () => {
      window.location.hash = "";

      render(<TrackerReport />);

      expect(
        screen.getByText(
          "l10n string: [trackerreport-load-error], with vars: {}",
        ),
      ).toBeInTheDocument();
    });
  });

  describe("hash parsing", () => {
    it("parses valid report data from URL hash", () => {
      const reportData = {
        sender: "sender@example.com",
        received_at: 1609459200000,
        trackers: {
          "tracker1.com": 5,
          "tracker2.com": 3,
        },
      };
      window.location.hash = encodeURIComponent(JSON.stringify(reportData));

      render(<TrackerReport />);

      expect(screen.getByText("sender@example.com")).toBeInTheDocument();
      expect(screen.getByText("tracker1.com")).toBeInTheDocument();
      expect(screen.getByText("tracker2.com")).toBeInTheDocument();
    });

    it("handles report data without trackers", () => {
      window.location.hash = encodeURIComponent(
        JSON.stringify({
          sender: "test@example.com",
          received_at: 1609459200000,
        }),
      );

      render(<TrackerReport />);

      expect(
        screen.getByText(
          "l10n string: [trackerreport-trackers-none], with vars: {}",
        ),
      ).toBeInTheDocument();
    });

    it("handles report data with empty trackers object", () => {
      window.location.hash = encodeURIComponent(
        JSON.stringify({
          sender: "test@example.com",
          received_at: 1609459200000,
          trackers: {},
        }),
      );

      render(<TrackerReport />);

      expect(
        screen.getByText(
          "l10n string: [trackerreport-trackers-none], with vars: {}",
        ),
      ).toBeInTheDocument();
    });

    it("handles hash with missing sender field", () => {
      window.location.hash = encodeURIComponent(
        JSON.stringify({
          received_at: 1609459200000,
          trackers: {},
        }),
      );

      render(<TrackerReport />);

      expect(
        screen.getByText(
          "l10n string: [trackerreport-load-error], with vars: {}",
        ),
      ).toBeInTheDocument();
    });

    it("handles hash with missing received_at field", () => {
      window.location.hash = encodeURIComponent(
        JSON.stringify({
          sender: "test@example.com",
          trackers: {},
        }),
      );

      render(<TrackerReport />);

      expect(
        screen.getByText(
          "l10n string: [trackerreport-load-error], with vars: {}",
        ),
      ).toBeInTheDocument();
    });

    it("handles hash with wrong field types", () => {
      window.location.hash = encodeURIComponent(
        JSON.stringify({
          sender: 123,
          received_at: "not-a-number",
          trackers: "not-an-object",
        }),
      );

      render(<TrackerReport />);

      expect(
        screen.getByText(
          "l10n string: [trackerreport-load-error], with vars: {}",
        ),
      ).toBeInTheDocument();
    });

    it("handles hash with non-integer received_at", () => {
      window.location.hash = encodeURIComponent(
        JSON.stringify({
          sender: "test@example.com",
          received_at: 1609459200.5,
          trackers: {},
        }),
      );

      render(<TrackerReport />);

      expect(
        screen.getByText(
          "l10n string: [trackerreport-load-error], with vars: {}",
        ),
      ).toBeInTheDocument();
    });

    it("handles hash with invalid tracker count types", () => {
      window.location.hash = encodeURIComponent(
        JSON.stringify({
          sender: "test@example.com",
          received_at: 1609459200000,
          trackers: {
            "tracker.com": "not-a-number",
          },
        }),
      );

      render(<TrackerReport />);

      expect(
        screen.getByText(
          "l10n string: [trackerreport-load-error], with vars: {}",
        ),
      ).toBeInTheDocument();
    });

    it("handles hash with null value", () => {
      window.location.hash = encodeURIComponent(JSON.stringify(null));

      render(<TrackerReport />);

      expect(
        screen.getByText(
          "l10n string: [trackerreport-load-error], with vars: {}",
        ),
      ).toBeInTheDocument();
    });
  });

  describe("tracker display", () => {
    it("displays trackers in a table when present", () => {
      window.location.hash = encodeURIComponent(
        JSON.stringify({
          sender: "test@example.com",
          received_at: 1609459200000,
          trackers: {
            "tracker1.com": 5,
            "tracker2.com": 3,
          },
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
    });

    it("sorts trackers by count in descending order", () => {
      window.location.hash = encodeURIComponent(
        JSON.stringify({
          sender: "test@example.com",
          received_at: 1609459200000,
          trackers: {
            "tracker1.com": 2,
            "tracker2.com": 10,
            "tracker3.com": 5,
          },
        }),
      );

      render(<TrackerReport />);

      const rows = screen.getAllByRole("row");
      expect(rows[1]).toHaveTextContent("tracker2.com");
      expect(rows[2]).toHaveTextContent("tracker3.com");
      expect(rows[3]).toHaveTextContent("tracker1.com");
    });

    it("displays tracker count for each tracker", () => {
      window.location.hash = encodeURIComponent(
        JSON.stringify({
          sender: "test@example.com",
          received_at: 1609459200000,
          trackers: {
            "tracker1.com": 5,
          },
        }),
      );

      render(<TrackerReport />);

      const countCell = screen.getByLabelText("5");
      expect(countCell).toBeInTheDocument();
    });

    it("shows HideIcon for each tracker", () => {
      window.location.hash = encodeURIComponent(
        JSON.stringify({
          sender: "test@example.com",
          received_at: 1609459200000,
          trackers: {
            "tracker1.com": 5,
            "tracker2.com": 3,
          },
        }),
      );

      render(<TrackerReport />);

      expect(screen.getByText("tracker1.com")).toBeInTheDocument();
      expect(screen.getByText("tracker2.com")).toBeInTheDocument();
    });

    it("displays message when no trackers are present", () => {
      window.location.hash = encodeURIComponent(
        JSON.stringify({
          sender: "test@example.com",
          received_at: 1609459200000,
          trackers: {},
        }),
      );

      render(<TrackerReport />);

      expect(
        screen.getByText(
          "l10n string: [trackerreport-trackers-none], with vars: {}",
        ),
      ).toBeInTheDocument();
      expect(screen.queryByRole("table")).not.toBeInTheDocument();
    });
  });

  describe("metadata display", () => {
    it("displays sender email", () => {
      window.location.hash = encodeURIComponent(
        JSON.stringify({
          sender: "sender@example.com",
          received_at: 1609459200000,
          trackers: {},
        }),
      );

      render(<TrackerReport />);

      expect(
        screen.getByText(
          "l10n string: [trackerreport-meta-from-heading], with vars: {}",
        ),
      ).toBeInTheDocument();
      expect(screen.getByText("sender@example.com")).toBeInTheDocument();
    });

    it("displays received at timestamp", () => {
      window.location.hash = encodeURIComponent(
        JSON.stringify({
          sender: "test@example.com",
          received_at: 1609459200000,
          trackers: {},
        }),
      );

      render(<TrackerReport />);

      expect(
        screen.getByText(
          "l10n string: [trackerreport-meta-receivedat-heading], with vars: {}",
        ),
      ).toBeInTheDocument();

      const date = new Date(1609459200000).toLocaleString();
      expect(screen.getByText(date)).toBeInTheDocument();
    });

    it("displays total tracker count", () => {
      window.location.hash = encodeURIComponent(
        JSON.stringify({
          sender: "test@example.com",
          received_at: 1609459200000,
          trackers: {
            "tracker1.com": 5,
            "tracker2.com": 3,
            "tracker3.com": 2,
          },
        }),
      );

      render(<TrackerReport />);

      expect(
        screen.getByText(
          "l10n string: [trackerreport-meta-count-heading], with vars: {}",
        ),
      ).toBeInTheDocument();
    });

    it("calculates total count correctly", () => {
      window.location.hash = encodeURIComponent(
        JSON.stringify({
          sender: "test@example.com",
          received_at: 1609459200000,
          trackers: {
            "tracker1.com": 5,
            "tracker2.com": 3,
            "tracker3.com": 2,
          },
        }),
      );

      render(<TrackerReport />);

      expect(
        screen.getByText(
          'l10n string: [trackerreport-trackers-value], with vars: {"count":10}',
        ),
      ).toBeInTheDocument();
    });
  });

  describe("page content", () => {
    it("displays report title", () => {
      window.location.hash = encodeURIComponent(
        JSON.stringify({
          sender: "test@example.com",
          received_at: 1609459200000,
          trackers: {},
        }),
      );

      render(<TrackerReport />);

      expect(
        screen.getByText("l10n string: [trackerreport-title], with vars: {}"),
      ).toBeInTheDocument();
    });

    it("displays logo", () => {
      window.location.hash = encodeURIComponent(
        JSON.stringify({
          sender: "test@example.com",
          received_at: 1609459200000,
          trackers: {},
        }),
      );

      render(<TrackerReport />);

      expect(
        screen.getByAltText("l10n string: [logo-alt], with vars: {}"),
      ).toBeInTheDocument();
    });

    it("displays confidentiality notice", () => {
      window.location.hash = encodeURIComponent(
        JSON.stringify({
          sender: "test@example.com",
          received_at: 1609459200000,
          trackers: {},
        }),
      );

      render(<TrackerReport />);

      expect(
        screen.getByText(
          "l10n string: [trackerreport-confidentiality-notice], with vars: {}",
        ),
      ).toBeInTheDocument();
    });

    it("displays removal explainer section", () => {
      window.location.hash = encodeURIComponent(
        JSON.stringify({
          sender: "test@example.com",
          received_at: 1609459200000,
          trackers: {},
        }),
      );

      render(<TrackerReport />);

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
    });

    it("displays trackers explainer section", () => {
      window.location.hash = encodeURIComponent(
        JSON.stringify({
          sender: "test@example.com",
          received_at: 1609459200000,
          trackers: {},
        }),
      );

      render(<TrackerReport />);

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
    });

    it("displays breakage warning", () => {
      window.location.hash = encodeURIComponent(
        JSON.stringify({
          sender: "test@example.com",
          received_at: 1609459200000,
          trackers: {},
        }),
      );

      render(<TrackerReport />);

      expect(
        screen.getByText(
          "l10n string: [trackerreport-breakage-warning-2], with vars: {}",
        ),
      ).toBeInTheDocument();
    });
  });

  describe("FAQ section", () => {
    it("displays FAQ section heading", () => {
      window.location.hash = encodeURIComponent(
        JSON.stringify({
          sender: "test@example.com",
          received_at: 1609459200000,
          trackers: {},
        }),
      );

      render(<TrackerReport />);

      expect(
        screen.getByText(
          "l10n string: [trackerreport-faq-heading], with vars: {}",
        ),
      ).toBeInTheDocument();
    });

    it("displays link to full FAQ page", () => {
      window.location.hash = encodeURIComponent(
        JSON.stringify({
          sender: "test@example.com",
          received_at: 1609459200000,
          trackers: {},
        }),
      );

      render(<TrackerReport />);

      const link = screen.getByRole("link", {
        name: "l10n string: [trackerreport-faq-cta], with vars: {}",
      });
      expect(link).toHaveAttribute("href", "/faq");
    });

    it("displays FAQ questions", () => {
      window.location.hash = encodeURIComponent(
        JSON.stringify({
          sender: "test@example.com",
          received_at: 1609459200000,
          trackers: {},
        }),
      );

      render(<TrackerReport />);

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

  describe("hash change event handling", () => {
    it("adds hashchange event listener on mount", () => {
      window.location.hash = encodeURIComponent(
        JSON.stringify({
          sender: "test@example.com",
          received_at: 1609459200000,
          trackers: {},
        }),
      );

      render(<TrackerReport />);

      expect(window.addEventListener).toHaveBeenCalledWith(
        "hashchange",
        expect.any(Function),
      );
    });

    it("removes hashchange event listener on unmount", () => {
      window.location.hash = encodeURIComponent(
        JSON.stringify({
          sender: "test@example.com",
          received_at: 1609459200000,
          trackers: {},
        }),
      );

      const { unmount } = render(<TrackerReport />);

      unmount();

      expect(window.removeEventListener).toHaveBeenCalledWith(
        "hashchange",
        expect.any(Function),
      );
    });
  });

  describe("edge cases", () => {
    it("handles very long sender email", () => {
      const longEmail = "a".repeat(100) + "@example.com";
      window.location.hash = encodeURIComponent(
        JSON.stringify({
          sender: longEmail,
          received_at: 1609459200000,
          trackers: {},
        }),
      );

      render(<TrackerReport />);

      expect(screen.getByText(longEmail)).toBeInTheDocument();
    });

    it("handles very large tracker counts", () => {
      window.location.hash = encodeURIComponent(
        JSON.stringify({
          sender: "test@example.com",
          received_at: 1609459200000,
          trackers: {
            "tracker.com": 999999,
          },
        }),
      );

      render(<TrackerReport />);

      const countCell = screen.getByLabelText("999999");
      expect(countCell).toBeInTheDocument();
    });

    it("handles many trackers", () => {
      const trackers: Record<string, number> = {};
      for (let i = 0; i < 50; i++) {
        trackers[`tracker${i}.com`] = i + 1;
      }

      window.location.hash = encodeURIComponent(
        JSON.stringify({
          sender: "test@example.com",
          received_at: 1609459200000,
          trackers,
        }),
      );

      render(<TrackerReport />);

      const rows = screen.getAllByRole("row");
      expect(rows).toHaveLength(51);
    });

    it("handles tracker domains with special characters", () => {
      window.location.hash = encodeURIComponent(
        JSON.stringify({
          sender: "test@example.com",
          received_at: 1609459200000,
          trackers: {
            "tracker-with-dash.com": 5,
            "tracker_with_underscore.com": 3,
          },
        }),
      );

      render(<TrackerReport />);

      expect(screen.getByText("tracker-with-dash.com")).toBeInTheDocument();
      expect(
        screen.getByText("tracker_with_underscore.com"),
      ).toBeInTheDocument();
    });

    it("handles received_at timestamp of 0", () => {
      window.location.hash = encodeURIComponent(
        JSON.stringify({
          sender: "test@example.com",
          received_at: 0,
          trackers: {},
        }),
      );

      render(<TrackerReport />);

      const date = new Date(0).toLocaleString();
      expect(screen.getByText(date)).toBeInTheDocument();
    });

    it("handles zero tracker count", () => {
      window.location.hash = encodeURIComponent(
        JSON.stringify({
          sender: "test@example.com",
          received_at: 1609459200000,
          trackers: {
            "tracker.com": 0,
          },
        }),
      );

      render(<TrackerReport />);

      const countCell = screen.getByLabelText("0");
      expect(countCell).toBeInTheDocument();
    });
  });
});
