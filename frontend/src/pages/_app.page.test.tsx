import { act, render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import type { AppProps } from "next/app";
import { useRouter } from "next/router";
import ReactGa from "react-ga";
import { setMockProfileData } from "../../__mocks__/hooks/api/profile";
import { setMockRuntimeData } from "../../__mocks__/hooks/api/runtimeData";

jest.mock(
  "next/router",
  () =>
    jest.requireActual("../../__mocks__/modules/next__router").mockNextRouter,
);
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
    mockedUseRouter.mockReturnValue({
      pathname: "/",
      asPath: "/",
      push: jest.fn(),
      query: {},
      route: "/",
      events: {
        on: jest.fn(),
        off: jest.fn(),
        emit: jest.fn(),
      },
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
  });

  describe("under axe accessibility testing", () => {
    it("passes axe accessibility testing", async () => {
      const { baseElement } = render(<MyApp {...defaultAppProps} />);
      const results = await act(() =>
        axe(baseElement, {
          rules: { region: { enabled: false } },
        }),
      );
      expect(results).toHaveNoViolations();
    }, 10000);
  });

  describe("localization", () => {
    it("initializes l10n with deterministic locales on first render", () => {
      render(<MyApp {...defaultAppProps} />);
      expect(mockedGetL10n).toHaveBeenCalledWith({
        deterministicLocales: true,
      });
    });

    it("updates l10n to user-preferred locales after mount", async () => {
      render(<MyApp {...defaultAppProps} />);

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockedGetL10n).toHaveBeenCalledWith({
        deterministicLocales: false,
      });
    });
  });

  describe("Google Analytics", () => {
    it("initializes Google Analytics when metrics are enabled", async () => {
      mockedUseMetrics.mockReturnValue("enabled");
      mockedUseGoogleAnalytics.mockReturnValue(false);

      render(<MyApp {...defaultAppProps} />);

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockedInitGoogleAnalytics).toHaveBeenCalled();
    });

    it("does not initialize Google Analytics when metrics are disabled", async () => {
      mockedUseMetrics.mockReturnValue("disabled");

      render(<MyApp {...defaultAppProps} />);

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockedInitGoogleAnalytics).not.toHaveBeenCalled();
    });

    it("does not initialize Google Analytics when already initialized", async () => {
      mockedUseMetrics.mockReturnValue("enabled");
      mockedUseGoogleAnalytics.mockReturnValue(true);

      render(<MyApp {...defaultAppProps} />);

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockedInitGoogleAnalytics).not.toHaveBeenCalled();
    });

    it("tracks pageview when Google Analytics is initialized", async () => {
      mockedUseGoogleAnalytics.mockReturnValue(true);
      mockedUseRouter.mockReturnValue({
        pathname: "/test",
        asPath: "/test",
        push: jest.fn(),
        query: {},
        route: "/test",
        events: {
          on: jest.fn(),
          off: jest.fn(),
          emit: jest.fn(),
        },
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

      render(<MyApp {...defaultAppProps} />);

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(ReactGa.pageview).toHaveBeenCalledWith("/test");
    });

    it("does not track pageview when Google Analytics is not initialized", async () => {
      mockedUseGoogleAnalytics.mockReturnValue(false);

      render(<MyApp {...defaultAppProps} />);

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(ReactGa.pageview).not.toHaveBeenCalled();
    });
  });

  describe("addon data context", () => {
    it("provides addon data to child components", () => {
      const mockAddonData = {
        present: true,
        localLabels: [{ id: 1, label: "test" }],
        sendEvent: jest.fn(),
      };
      mockedUseAddonElementWatcher.mockReturnValue(mockAddonData);

      render(<MyApp {...defaultAppProps} />);

      expect(mockedUseAddonElementWatcher).toHaveBeenCalled();
    });

    it("sets addon element attributes based on addon data", () => {
      const mockAddonData = {
        present: true,
        localLabels: [{ id: 1, label: "test" }],
        sendEvent: jest.fn(),
      };
      mockedUseAddonElementWatcher.mockReturnValue(mockAddonData);

      render(<MyApp {...defaultAppProps} />);
      // eslint-disable-next-line testing-library/no-node-access
      const addonElement = document.querySelector(
        "firefox-private-relay-addon",
      );

      expect(addonElement).toBeInTheDocument();
      expect(addonElement).toHaveAttribute("data-addon-installed");
      expect(addonElement).toHaveAttribute(
        "data-local-labels",
        JSON.stringify([{ id: 1, label: "test" }]),
      );
    });

    it("sets user-logged-in attribute to 'True' when logged in", () => {
      mockedUseIsLoggedIn.mockReturnValue("logged-in");

      render(<MyApp {...defaultAppProps} />);
      // eslint-disable-next-line testing-library/no-node-access
      const addonElement = document.querySelector(
        "firefox-private-relay-addon",
      );

      expect(addonElement).toHaveAttribute("data-user-logged-in", "True");
    });

    it("sets user-logged-in attribute to 'False' when logged out", () => {
      mockedUseIsLoggedIn.mockReturnValue("logged-out");

      render(<MyApp {...defaultAppProps} />);
      // eslint-disable-next-line testing-library/no-node-access
      const addonElement = document.querySelector(
        "firefox-private-relay-addon",
      );

      expect(addonElement).toHaveAttribute("data-user-logged-in", "False");
    });

    it("sets user-logged-in attribute to 'False' when login state is unknown", () => {
      mockedUseIsLoggedIn.mockReturnValue("unknown");

      render(<MyApp {...defaultAppProps} />);
      // eslint-disable-next-line testing-library/no-node-access
      const addonElement = document.querySelector(
        "firefox-private-relay-addon",
      );

      expect(addonElement).toHaveAttribute("data-user-logged-in", "False");
    });
  });

  describe("MSW mock API initialization", () => {
    beforeEach(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (global as any).URLSearchParams;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (global as any).document;
    });

    it("waits for MSW to initialize when NEXT_PUBLIC_MOCK_API is true", () => {
      process.env.NEXT_PUBLIC_MOCK_API = "true";

      render(<MyApp {...defaultAppProps} />);

      expect(screen.queryByText("Test Component")).not.toBeInTheDocument();
    });

    it("does not wait for MSW when NEXT_PUBLIC_MOCK_API is false", () => {
      process.env.NEXT_PUBLIC_MOCK_API = "false";

      render(<MyApp {...defaultAppProps} />);

      expect(screen.getByText("Test Component")).toBeInTheDocument();
    });

    it("renders app immediately when NEXT_PUBLIC_MOCK_API is not set", () => {
      render(<MyApp {...defaultAppProps} />);

      expect(screen.getByText("Test Component")).toBeInTheDocument();
    });
  });

  describe("rendering", () => {
    it("renders the Component prop with pageProps", () => {
      render(<MyApp {...defaultAppProps} />);

      expect(screen.getByText("Test Component")).toBeInTheDocument();
    });

    it("wraps component in required providers", () => {
      render(<MyApp {...defaultAppProps} />);

      // eslint-disable-next-line testing-library/no-node-access
      const overlayProvider = document.querySelector('[id="overlayProvider"]');
      expect(overlayProvider).toBeInTheDocument();
    });
  });
});
