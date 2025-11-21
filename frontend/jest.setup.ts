import React from "react";
import "@testing-library/jest-dom";
import { toHaveNoViolations } from "jest-axe";
import "./__mocks__/components/landingImages.mocks";

import { mockGetLocaleModule } from "./__mocks__/functions/getLocale";
import { mockUseL10nModule } from "./__mocks__/hooks/l10n";

if (!("IntersectionObserver" in global)) {
  class MockIntersectionObserver {
    readonly root: Element | null = null;
    readonly rootMargin: string = "0px";
    readonly thresholds: ReadonlyArray<number> = [0];

    constructor(
      _cb: IntersectionObserverCallback,
      _options?: IntersectionObserverInit,
    ) {}

    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }

  // @ts-expect-error attach to both
  global.IntersectionObserver = MockIntersectionObserver;
  if (typeof window !== "undefined") {
    window.IntersectionObserver = MockIntersectionObserver;
  }
}

jest.mock("./src/components/Image", () => ({
  __esModule: true,
  default: require("./__mocks__/components/ImageMock").default,
}));

jest.mock(require.resolve("./src/components/Icons"), () => {
  const Svg = (props: React.SVGProps<SVGSVGElement> & { alt?: string }) => {
    const ariaLabel = props["aria-label"] || props.alt;
    const { alt, ...svgProps } = props;
    return React.createElement(
      "svg",
      {
        "data-testid": "svg-icon",
        "aria-label": ariaLabel,
        ...svgProps,
      },
      ariaLabel ? React.createElement("title", {}, ariaLabel) : null,
    );
  };

  const moduleObj = new Proxy({ __esModule: true } as Record<string, any>, {
    get: (_target, _prop) => Svg,
  });

  moduleObj.default = new Proxy({}, { get: () => Svg });

  return moduleObj;
});

declare global {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  var gaEventMock: jest.Mock<any, any>;
  var getLocaleMock: jest.Mock<string, unknown[]>;
  var useL10nImpl: () => ReturnType<typeof mockUseL10nModule.useL10n>;
}

beforeEach(() => {
  global.gaEventMock = jest.fn();

  global.getLocaleMock = mockGetLocaleModule.getLocale as unknown as jest.Mock;
  global.getLocaleMock.mockReturnValue("en-GB");

  global.useL10nImpl = mockUseL10nModule.useL10n;
});

jest.mock(require.resolve("./src/hooks/gaEvent"), () => ({
  __esModule: true,
  useGaEvent: () => global.gaEventMock,
}));

jest.mock(require.resolve("./src/hooks/gaViewPing"), () => ({
  __esModule: true,
  useGaViewPing: () => React.createRef<HTMLAnchorElement>(),
}));

jest.mock(require.resolve("./src/functions/getLocale"), () => ({
  __esModule: true,
  getLocale: (...args: unknown[]) => global.getLocaleMock(...args),
}));

jest.mock(require.resolve("./src/hooks/l10n"), () => ({
  __esModule: true,
  useL10n: () => global.useL10nImpl(),
}));

// Next.js router mock
jest.mock(
  "next/router",
  () => require("./__mocks__/modules/next__router").mockNextRouter,
);

// Next.js Link component mock
jest.mock("next/link", () => {
  return {
    __esModule: true,
    default: ({ href, children, ...props }: any) =>
      React.createElement("a", { href, ...props }, children),
  };
});

// Google Analytics mock
jest.mock(
  "react-ga",
  () => require("./__mocks__/modules/react-ga").mockReactGa,
);

// Localized component mock
jest.mock(
  require.resolve("./src/components/Localized"),
  () => require("./__mocks__/components/Localized").mockLocalizedModule,
);

// Config module mock
jest.mock(
  require.resolve("./src/config"),
  () => require("./__mocks__/configMock").mockConfigModule,
);

// FxA Flow Tracker mock
jest.mock(
  require.resolve("./src/hooks/fxaFlowTracker"),
  () => require("./__mocks__/hooks/fxaFlowTracker").mockUseFxaFlowTrackerModule,
);

// React Intersection Observer mock
jest.mock(
  "react-intersection-observer",
  () =>
    require("./__mocks__/modules/react-intersection-observer")
      .mockReactIntersectionObsever,
);

// React Toastify mock
jest.mock("react-toastify", () => ({
  toast: jest.fn(),
  ToastContainer: () => null,
}));

// Waffle flags mock
jest.mock(require.resolve("./src/functions/waffle"), () =>
  require("./__mocks__/functions/waffle"),
);

expect.extend(toHaveNoViolations);
