import { act, render, screen, cleanup } from "@testing-library/react";
import { axe } from "jest-axe";
import type { AppProps } from "next/app";
import { useRouter } from "next/router";
import ReactGa from "react-ga";
import { setMockProfileData } from "../../__mocks__/hooks/api/profile";
import { setMockRuntimeData } from "../../__mocks__/hooks/api/runtimeData";

jest.mock("next/router");
jest.mock("../hooks/session");
jest.mock("../hooks/metrics");
jest.mock("../hooks/googleAnalytics");
jest.mock("../hooks/addon");
jest.mock("../functions/getL10n");
jest.mock("react-ga", () => ({
  __esModule: true,
  default: {
    pageview: jest.fn(),
  },
}));

jest.mock("../../__mocks__/api/initialise", () => ({
  initialiseApiMocks: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("../../__mocks__/api/mockData", () => ({
  mockIds: ["test-id-1", "test-id-2"],
}));

import MyApp from "./_app.page";
import { useIsLoggedIn } from "../hooks/session";
import { useMetrics } from "../hooks/metrics";
import {
  useGoogleAnalytics,
  initGoogleAnalytics,
} from "../hooks/googleAnalytics";
import { useAddonElementWatcher } from "../hooks/addon";
import { getL10n } from "../functions/getL10n";

const mockedUseIsLoggedIn = useIsLoggedIn as jest.MockedFunction<
  typeof useIsLoggedIn
>;
const mockedUseMetrics = useMetrics as jest.MockedFunction<typeof useMetrics>;
const mockedUseGoogleAnalytics = useGoogleAnalytics as jest.MockedFunction<
  typeof useGoogleAnalytics
>;
const mockedInitGoogleAnalytics = initGoogleAnalytics as jest.MockedFunction<
  typeof initGoogleAnalytics
>;
const mockedUseAddonElementWatcher =
  useAddonElementWatcher as jest.MockedFunction<typeof useAddonElementWatcher>;
const mockedGetL10n = getL10n as jest.MockedFunction<typeof getL10n>;
const mockedUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;

setMockProfileData();
setMockRuntimeData();

const mockL10n = {
  bundles: [{ locales: ["en"] }],
} as unknown as ReactLocalization;

const MockComponent = () => <div>Test Component</div>;

const createMockRouter = (pathname = "/", asPath = "/") => ({
  pathname,
  asPath,
  push: jest.fn(),
  query: {},
  route: pathname,
  events: { on: jest.fn(), off: jest.fn(), emit: jest.fn() },
  isFallback: false,
  isReady: true,
  isPreview: false,
  basePath: "",
  locale: undefined,
  locales: undefined,
  defaultLocale: undefined,
  isLocaleDomain: false,
  beforePopState: jest.fn(),
  prefetch: jest.fn(),
  back: jest.fn(),
  reload: jest.fn(),
  replace: jest.fn(),
  forward: jest.fn(),
});

const defaultAppProps: AppProps = {
  Component: MockComponent,
  pageProps: {},
  router: {
    pathname: "/",
    route: "/",
    query: {},
    asPath: "/",
    basePath: "",
    isLocaleDomain: false,
    push: jest.fn(),
    replace: jest.fn(),
    reload: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    prefetch: jest.fn(),
    beforePopState: jest.fn(),
    events: {
      on: jest.fn(),
      off: jest.fn(),
      emit: jest.fn(),
    },
    isFallback: false,
    isReady: true,
    isPreview: false,
  },
};

const waitForNextTick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("MyApp component", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.NEXT_PUBLIC_MOCK_API;

    mockedUseIsLoggedIn.mockReturnValue("logged-out");
    mockedUseMetrics.mockReturnValue("disabled");
    mockedUseGoogleAnalytics.mockReturnValue(false);
    mockedUseAddonElementWatcher.mockReturnValue({
      present: false,
      localLabels: [],
      sendEvent: jest.fn(),
    });
    mockedGetL10n.mockReturnValue(mockL10n);
    mockedUseRouter.mockReturnValue(createMockRouter());
  });

  it("passes axe accessibility testing", async () => {
    const { baseElement } = render(<MyApp {...defaultAppProps} />);
    const results = await act(() =>
      axe(baseElement, {
        rules: { region: { enabled: false } },
      }),
    );
    expect(results).toHaveNoViolations();
  }, 10000);

  it("initializes l10n, renders providers, and handles component rendering", async () => {
    render(<MyApp {...defaultAppProps} />);
    expect(mockedGetL10n).toHaveBeenCalledWith({ deterministicLocales: true });

    await waitForNextTick();
    expect(mockedGetL10n).toHaveBeenCalledWith({ deterministicLocales: false });

    expect(screen.getByText("Test Component")).toBeInTheDocument();
    const overlayProvider = document.querySelector('[id="overlayProvider"]');
    expect(overlayProvider).toBeInTheDocument();
  });

  it("handles Google Analytics initialization and pageview tracking", async () => {
    mockedUseMetrics.mockReturnValue("enabled");
    mockedUseGoogleAnalytics.mockReturnValue(false);

    render(<MyApp {...defaultAppProps} />);
    await waitForNextTick();
    expect(mockedInitGoogleAnalytics).toHaveBeenCalled();

    cleanup();
    jest.clearAllMocks();
    mockedUseMetrics.mockReturnValue("disabled");
    render(<MyApp {...defaultAppProps} />);
    await waitForNextTick();
    expect(mockedInitGoogleAnalytics).not.toHaveBeenCalled();

    cleanup();
    jest.clearAllMocks();
    mockedUseMetrics.mockReturnValue("enabled");
    mockedUseGoogleAnalytics.mockReturnValue(true);
    render(<MyApp {...defaultAppProps} />);
    await waitForNextTick();
    expect(mockedInitGoogleAnalytics).not.toHaveBeenCalled();

    cleanup();
    jest.clearAllMocks();
    mockedUseRouter.mockReturnValue(createMockRouter("/test", "/test"));
    render(<MyApp {...defaultAppProps} />);
    await waitForNextTick();
    expect(ReactGa.pageview).toHaveBeenCalledWith("/test");

    cleanup();
    jest.clearAllMocks();
    mockedUseGoogleAnalytics.mockReturnValue(false);
    render(<MyApp {...defaultAppProps} />);
    await waitForNextTick();
    expect(ReactGa.pageview).not.toHaveBeenCalled();
  });

  it("provides addon data context and sets element attributes based on login state", () => {
    const mockAddonData = {
      present: true,
      localLabels: [{ id: 1, label: "test" }],
      sendEvent: jest.fn(),
    };
    mockedUseAddonElementWatcher.mockReturnValue(mockAddonData);

    render(<MyApp {...defaultAppProps} />);
    expect(mockedUseAddonElementWatcher).toHaveBeenCalled();

    let addonElement = document.querySelector("firefox-private-relay-addon");
    expect(addonElement).toBeInTheDocument();
    expect(addonElement).toHaveAttribute("data-addon-installed");
    expect(addonElement).toHaveAttribute(
      "data-local-labels",
      JSON.stringify([{ id: 1, label: "test" }]),
    );

    cleanup();
    mockedUseIsLoggedIn.mockReturnValue("logged-in");
    render(<MyApp {...defaultAppProps} />);
    addonElement = document.querySelector("firefox-private-relay-addon");
    expect(addonElement).toHaveAttribute("data-user-logged-in", "True");

    cleanup();
    mockedUseIsLoggedIn.mockReturnValue("logged-out");
    render(<MyApp {...defaultAppProps} />);
    addonElement = document.querySelector("firefox-private-relay-addon");
    expect(addonElement).toHaveAttribute("data-user-logged-in", "False");

    cleanup();
    mockedUseIsLoggedIn.mockReturnValue("unknown");
    render(<MyApp {...defaultAppProps} />);
    addonElement = document.querySelector("firefox-private-relay-addon");
    expect(addonElement).toHaveAttribute("data-user-logged-in", "False");
  });

  it("handles MSW mock API initialization based on NEXT_PUBLIC_MOCK_API", () => {
    delete (global as any).URLSearchParams;
    delete (global as any).document;

    process.env.NEXT_PUBLIC_MOCK_API = "true";
    render(<MyApp {...defaultAppProps} />);
    expect(screen.queryByText("Test Component")).not.toBeInTheDocument();

    cleanup();
    process.env.NEXT_PUBLIC_MOCK_API = "false";
    render(<MyApp {...defaultAppProps} />);
    expect(screen.getByText("Test Component")).toBeInTheDocument();

    cleanup();
    delete process.env.NEXT_PUBLIC_MOCK_API;
    render(<MyApp {...defaultAppProps} />);
    expect(screen.getByText("Test Component")).toBeInTheDocument();
  });
});
