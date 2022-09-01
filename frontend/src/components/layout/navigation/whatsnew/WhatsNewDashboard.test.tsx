import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { mockGetLocaleModule } from "../../../../../__mocks__/functions/getLocale";
import { mockFluentReact } from "../../../../../__mocks__/modules/fluent__react";
import { mockReactGa } from "../../../../../__mocks__/modules/react-ga";

import { WhatsNewDashboard } from "./WhatsNewDashboard";
import { WhatsNewEntry } from "./WhatsNewMenu";

jest.mock("@fluent/react", () => mockFluentReact);
jest.mock("react-ga", () => mockReactGa);
jest.mock("../../../../functions/getLocale.ts", () => mockGetLocaleModule);
jest.mock("../../../../hooks/gaViewPing.ts");

function getMockEntry(
  id: number,
  options: { expired?: boolean; dismissed?: boolean } = {}
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
    icon: "https://example.com/new-feature-icon.svg",
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
      />
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
      />
    );

    expect(screen.getAllByRole("menuitem")).toHaveLength(2);

    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(2);
    expect(tabs[1]).toHaveTextContent(
      "l10n string: [whatsnew-tab-archive-label], with vars: {}"
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
      />
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
      />
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
      />
    );

    expect(screen.queryByText(allEntries[1].content)).not.toBeInTheDocument();

    const menuItems = screen.getAllByRole("menuitem");
    await userEvent.click(menuItems[1]);

    expect(screen.getByText(allEntries[1].content)).toBeInTheDocument();
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
      />
    );

    expect(screen.queryByText(allEntries[1]?.content)).not.toBeInTheDocument();

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
      />
    );

    expect(
      screen.getByText("l10n string: [whatsnew-empty-message], with vars: {}")
    ).toBeInTheDocument();
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
      />
    );

    const tabs = screen.getAllByRole("tab");
    await userEvent.click(tabs[1]);
    await userEvent.click(tabs[0]);

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
      />
    );

    const menuItems = screen.getAllByRole("menuitem");
    await userEvent.click(menuItems[1]);

    expect(mockReactGa.event).toHaveBeenCalledTimes(1);
    expect(mockReactGa.event).toHaveBeenCalledWith({
      category: "News",
      action: "Open entry",
      label: allEntries[1].title,
    });
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
      />
    );

    const menuItems = screen.getAllByRole("menuitem");
    await userEvent.click(menuItems[1]);

    const goBackButton = screen.getByRole("button", {
      name: "l10n string: [whatsnew-footer-back-label], with vars: {}",
    });
    await userEvent.click(goBackButton);

    expect(mockReactGa.event).toHaveBeenCalledTimes(2);
    expect(mockReactGa.event).toHaveBeenCalledWith({
      category: "News",
      action: "Close entry",
      label: allEntries[1].title,
    });
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
      />
    );

    const clearAllButton = screen.getByRole("button", {
      name: "l10n string: [whatsnew-footer-clear-all-label], with vars: {}",
    });
    await userEvent.click(clearAllButton);

    expect(mockReactGa.event).toHaveBeenCalledTimes(1);
    expect(mockReactGa.event).toHaveBeenCalledWith({
      category: "News",
      action: "Clear all",
      label: "news-dashboard",
      value: newEntries.length,
    });
  });
});
