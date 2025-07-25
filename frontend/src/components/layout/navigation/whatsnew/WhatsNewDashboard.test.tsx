import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { mockGetLocaleModule } from "../../../../../__mocks__/functions/getLocale";
import { mockUseL10nModule } from "../../../../../__mocks__/hooks/l10n";
import { mockUseGoogleAnalyticsModule } from "../../../../../__mocks__/hooks/googleAnalytics";
import { mockReactGa } from "../../../../../__mocks__/modules/react-ga";

import { WhatsNewDashboard } from "./WhatsNewDashboard";
import { WhatsNewEntry } from "./WhatsNewMenu";

jest.mock("react-ga", () => mockReactGa);
jest.mock("../../../../functions/getLocale.ts", () => mockGetLocaleModule);
jest.mock("../../../../hooks/gaViewPing.ts");
jest.mock(
  "../../../../hooks/googleAnalytics.ts",
  () => mockUseGoogleAnalyticsModule,
);
jest.mock("../../../../hooks/l10n.ts", () => mockUseL10nModule);

function getMockEntry(
  id: number,
  options: { expired?: boolean; dismissed?: boolean } = {},
): WhatsNewEntry {
  const subtractTime = options.expired ? 30 * 24 * 60 * 60 * 1000 + 1 : 0;
  const annDate = new Date(Date.now() - subtractTime);
  return {
    title: `New feature ${id}`,
    announcementDate: {
      year: annDate.getFullYear(),
      month: (annDate.getMonth() + 1) as 1,
      day: annDate.getDate(),
    },
    content: `New feature ${id} content`,
    snippet: `New feature ${id} con...`,
    icon: {
      src: "https://example.com/new-feature-icon.svg",
      width: 42,
      height: 42,
    },
    dismissal: {
      dismiss: jest.fn(),
      isDismissed: options.dismissed ?? false,
    },
  };
}

describe("The 'What's new' dashboard", () => {
  it("displays new entries by default", () => {
    const allEntries: WhatsNewEntry[] = [
      getMockEntry(1),
      getMockEntry(2),
      getMockEntry(3),
    ];
    const newEntries = [allEntries[0], allEntries[1]];

    render(
      <WhatsNewDashboard
        new={newEntries}
        archive={allEntries}
        onClose={jest.fn()}
      />,
    );

    const menuItems = screen.getAllByRole("menuitem");

    expect(menuItems).toHaveLength(2);
  });

  it("allows viewing all entries", async () => {
    const allEntries: WhatsNewEntry[] = [
      getMockEntry(1),
      getMockEntry(2),
      getMockEntry(3),
    ];
    const newEntries = [allEntries[0], allEntries[1]];

    render(
      <WhatsNewDashboard
        new={newEntries}
        archive={allEntries}
        onClose={jest.fn()}
      />,
    );

    expect(screen.getAllByRole("menuitem")).toHaveLength(2);

    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(2);
    expect(tabs[1]).toHaveTextContent(
      "l10n string: [whatsnew-tab-archive-label], with vars: {}",
    );

    await userEvent.click(tabs[1]);

    expect(screen.getAllByRole("menuitem")).toHaveLength(3);
  });

  it("dismisses an entry when it is viewed", async () => {
    const allEntries: WhatsNewEntry[] = [
      getMockEntry(1),
      getMockEntry(2),
      getMockEntry(3),
    ];
    const newEntries = [allEntries[0], allEntries[1]];

    render(
      <WhatsNewDashboard
        new={newEntries}
        archive={allEntries}
        onClose={jest.fn()}
      />,
    );

    const menuItems = screen.getAllByRole("menuitem");
    await userEvent.click(menuItems[1]);

    expect(allEntries[1].dismissal.dismiss).toHaveBeenCalledTimes(1);
  });

  it("dismisses all new entries when clicking 'Clear all'", async () => {
    const allEntries: WhatsNewEntry[] = [
      getMockEntry(1),
      getMockEntry(2),
      getMockEntry(3),
    ];
    const newEntries = [allEntries[0], allEntries[1]];

    render(
      <WhatsNewDashboard
        new={newEntries}
        archive={allEntries}
        onClose={jest.fn()}
      />,
    );

    const clearAllButton = screen.getByRole("button", {
      name: "l10n string: [whatsnew-footer-clear-all-label], with vars: {}",
    });
    await userEvent.click(clearAllButton);

    expect(allEntries[0].dismissal.dismiss).toHaveBeenCalledTimes(1);
    expect(allEntries[1].dismissal.dismiss).toHaveBeenCalledTimes(1);
  });

  it("shows an entry's content when clicking it", async () => {
    const allEntries: WhatsNewEntry[] = [
      getMockEntry(1),
      getMockEntry(2),
      getMockEntry(3),
    ];
    const newEntries = [allEntries[0], allEntries[1]];

    render(
      <WhatsNewDashboard
        new={newEntries}
        archive={allEntries}
        onClose={jest.fn()}
      />,
    );

    expect(typeof allEntries[1].content).toBe("string");
    if (typeof allEntries[1].content !== "string") {
      return;
    }
    const new_entry_content = allEntries[1].content;
    expect(screen.queryByText(new_entry_content)).not.toBeInTheDocument();

    const menuItems = screen.getAllByRole("menuitem");
    await userEvent.click(menuItems[1]);

    expect(screen.getByText(new_entry_content)).toBeInTheDocument();
  });

  it("can go back to overview of all new features after clicking one of them", async () => {
    const allEntries: WhatsNewEntry[] = [
      getMockEntry(1),
      getMockEntry(2),
      getMockEntry(3),
    ];
    const newEntries = [allEntries[0], allEntries[1]];

    render(
      <WhatsNewDashboard
        new={newEntries}
        archive={allEntries}
        onClose={jest.fn()}
      />,
    );

    expect(typeof allEntries[1].content).toBe("string");
    if (typeof allEntries[1].content !== "string") {
      return;
    }
    const new_entry_content = allEntries[1].content;
    expect(screen.queryByText(new_entry_content)).not.toBeInTheDocument();

    const menuItems = screen.getAllByRole("menuitem");
    await userEvent.click(menuItems[1]);

    expect(screen.queryByRole("menuitem")).not.toBeInTheDocument();

    const goBackButton = screen.getByRole("button", {
      name: "l10n string: [whatsnew-footer-back-label], with vars: {}",
    });
    await userEvent.click(goBackButton);

    expect(screen.getAllByRole("menuitem")).toHaveLength(2);
  });

  it("shows an empty state view when there are no entries to show", () => {
    const allEntries: WhatsNewEntry[] = [
      getMockEntry(1),
      getMockEntry(2),
      getMockEntry(3),
    ];
    const newEntries: WhatsNewEntry[] = [];

    render(
      <WhatsNewDashboard
        new={newEntries}
        archive={allEntries}
        onClose={jest.fn()}
      />,
    );

    expect(
      screen.getByText("l10n string: [whatsnew-empty-message], with vars: {}"),
    ).toBeInTheDocument();
  });
});

describe.each([true, false])(
  "The 'What's new' dashboard metrics, with googleAnalytics=%s",
  (googleAnalyticsAvailable) => {
    beforeEach(() => {
      mockUseGoogleAnalyticsModule.useGoogleAnalytics.mockReturnValue(
        googleAnalyticsAvailable,
      );
    });
    it("measures how often people switch tabs", async () => {
      const allEntries: WhatsNewEntry[] = [
        getMockEntry(1),
        getMockEntry(2),
        getMockEntry(3),
      ];
      const newEntries = [allEntries[0], allEntries[1]];

      render(
        <WhatsNewDashboard
          new={newEntries}
          archive={allEntries}
          onClose={jest.fn()}
        />,
      );

      const tabs = screen.getAllByRole("tab");
      await userEvent.click(tabs[1]);
      await userEvent.click(tabs[0]);

      if (googleAnalyticsAvailable) {
        expect(mockReactGa.event).toHaveBeenCalledTimes(2);
        expect(mockReactGa.event).toHaveBeenCalledWith({
          category: "News",
          action: "Switch to 'History' tab",
          label: "news-dashboard",
        });
        expect(mockReactGa.event).toHaveBeenCalledWith({
          category: "News",
          action: "Switch to 'News' tab",
          label: "news-dashboard",
        });
      } else {
        expect(mockReactGa.event).not.toHaveBeenCalled();
      }
    });

    it("measures how often entries are opened", async () => {
      const allEntries: WhatsNewEntry[] = [
        getMockEntry(1),
        getMockEntry(2),
        getMockEntry(3),
      ];
      const newEntries = [allEntries[0], allEntries[1]];

      render(
        <WhatsNewDashboard
          new={newEntries}
          archive={allEntries}
          onClose={jest.fn()}
        />,
      );

      const menuItems = screen.getAllByRole("menuitem");
      await userEvent.click(menuItems[1]);

      if (googleAnalyticsAvailable) {
        expect(mockReactGa.event).toHaveBeenCalledTimes(1);
        expect(mockReactGa.event).toHaveBeenCalledWith({
          category: "News",
          action: "Open entry",
          label: allEntries[1].title,
        });
      } else {
        expect(mockReactGa.event).not.toHaveBeenCalled();
      }
    });

    it("measures how often entries are closed", async () => {
      const allEntries: WhatsNewEntry[] = [
        getMockEntry(1),
        getMockEntry(2),
        getMockEntry(3),
      ];
      const newEntries = [allEntries[0], allEntries[1]];

      render(
        <WhatsNewDashboard
          new={newEntries}
          archive={allEntries}
          onClose={jest.fn()}
        />,
      );

      const menuItems = screen.getAllByRole("menuitem");
      await userEvent.click(menuItems[1]);

      const goBackButton = screen.getByRole("button", {
        name: "l10n string: [whatsnew-footer-back-label], with vars: {}",
      });
      await userEvent.click(goBackButton);

      if (googleAnalyticsAvailable) {
        expect(mockReactGa.event).toHaveBeenCalledTimes(2);
        expect(mockReactGa.event).toHaveBeenCalledWith({
          category: "News",
          action: "Close entry",
          label: allEntries[1].title,
        });
      } else {
        expect(mockReactGa.event).not.toHaveBeenCalled();
      }
    });

    it("measures how often all new entries are moved to the 'History' tab at once", async () => {
      const allEntries: WhatsNewEntry[] = [
        getMockEntry(1),
        getMockEntry(2),
        getMockEntry(3),
      ];
      const newEntries = [allEntries[0], allEntries[1]];

      render(
        <WhatsNewDashboard
          new={newEntries}
          archive={allEntries}
          onClose={jest.fn()}
        />,
      );

      const clearAllButton = screen.getByRole("button", {
        name: "l10n string: [whatsnew-footer-clear-all-label], with vars: {}",
      });
      await userEvent.click(clearAllButton);

      if (googleAnalyticsAvailable) {
        expect(mockReactGa.event).toHaveBeenCalledTimes(1);
        expect(mockReactGa.event).toHaveBeenCalledWith({
          category: "News",
          action: "Clear all",
          label: "news-dashboard",
          value: newEntries.length,
        });
      } else {
        expect(mockReactGa.event).not.toHaveBeenCalled();
      }
    });
  },
);
