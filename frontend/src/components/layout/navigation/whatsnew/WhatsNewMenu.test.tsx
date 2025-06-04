import { render, screen, fireEvent } from "@testing-library/react";
import { WhatsNewMenu } from "./WhatsNewMenu";
import { useL10n } from "../../../../hooks/l10n";
import { useGaEvent } from "../../../../hooks/gaEvent";
import { useAddonData } from "../../../../hooks/addon";
import { useLocalDismissal } from "../../../../hooks/localDismissal";
import { isUsingFirefox } from "../../../../functions/userAgent";
import { isFlagActive } from "../../../../functions/waffle";
import {
  mockedRuntimeData,
  mockedProfiles,
} from "../../../../apiMocks/mockData";

jest.mock("../../../../hooks/l10n");
jest.mock("../../../../hooks/gaEvent");
jest.mock("../../../../hooks/addon");
jest.mock("../../../../hooks/localDismissal");
jest.mock("../../../../functions/userAgent");
jest.mock("../../../../functions/waffle");
jest.mock("../../../../functions/getLocale", () => ({ getLocale: () => "en" }));

const l10nMock = {
  getString: jest.fn((key, vars) =>
    vars ? `${key}:${JSON.stringify(vars)}` : `${key}`,
  ),
};

beforeAll(() => {
  class MockIntersectionObserver implements IntersectionObserver {
    readonly root: Element | null = null;
    readonly rootMargin: string = "0px";
    readonly thresholds: ReadonlyArray<number> = [0];
    disconnect() {}
    observe() {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
    unobserve() {}
    constructor() {}
  }
  global.IntersectionObserver =
    MockIntersectionObserver as typeof IntersectionObserver;
});

describe("WhatsNewMenu", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useL10n as jest.Mock).mockReturnValue(l10nMock);
    (useGaEvent as jest.Mock).mockReturnValue(jest.fn());
    (useAddonData as jest.Mock).mockReturnValue({ present: false });
    (isUsingFirefox as jest.Mock).mockReturnValue(false);
    (isFlagActive as unknown as jest.Mock).mockReturnValue(true);
  });

  it("renders trigger when there are visible announcements", () => {
    (useLocalDismissal as jest.Mock).mockImplementation(() => ({
      isDismissed: false,
      dismiss: jest.fn(),
    }));

    render(
      <WhatsNewMenu
        profile={mockedProfiles.full}
        runtimeData={mockedRuntimeData}
        style="test-style"
      />,
    );

    expect(
      screen.getByRole("button", { name: /whatsnew-trigger-label/i }),
    ).toBeInTheDocument();
  });

  it("shows pill when undismissed entries exist", () => {
    (useLocalDismissal as jest.Mock).mockImplementation(() => ({
      isDismissed: false,
      dismiss: jest.fn(),
    }));

    render(
      <WhatsNewMenu
        profile={mockedProfiles.full}
        runtimeData={mockedRuntimeData}
        style="test-style"
      />,
    );

    expect(screen.getByTestId("whatsnew-pill")).toHaveTextContent("1");
  });

  it("opens the overlay and displays the dashboard", () => {
    (useLocalDismissal as jest.Mock).mockImplementation(() => ({
      isDismissed: false,
      dismiss: jest.fn(),
    }));

    render(
      <WhatsNewMenu
        profile={mockedProfiles.full}
        runtimeData={mockedRuntimeData}
        style="test-style"
      />,
    );

    const trigger = screen.getByRole("button");
    fireEvent.click(trigger);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
