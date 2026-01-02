import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import {
  GoogleAnalyticsWorkaround,
  sendGAEvent,
} from "./GoogleAnalyticsWorkaround";

jest.mock("next/script", () => {
  return function Script(props: {
    id: string;
    dangerouslySetInnerHTML?: { __html: string };
    src?: string;
    nonce?: string;
  }) {
    if (props.dangerouslySetInnerHTML) {
      return (
        <script
          id={props.id}
          data-testid={props.id}
          data-nonce={props.nonce}
          dangerouslySetInnerHTML={props.dangerouslySetInnerHTML}
        />
      );
    }
    return (
      <script
        id={props.id}
        data-testid={props.id}
        src={props.src}
        data-nonce={props.nonce}
      />
    );
  };
});

describe("GoogleAnalyticsWorkaround", () => {
  let performanceMarkSpy: jest.SpyInstance | undefined;

  beforeEach(() => {
    if (typeof performance.mark !== "function") {
      performance.mark = jest.fn();
    }
    performanceMarkSpy = jest.spyOn(performance, "mark");
  });

  afterEach(() => {
    performanceMarkSpy?.mockRestore();
  });

  it("renders scripts with correct configuration and content", () => {
    let result = render(<GoogleAnalyticsWorkaround gaId="G-TEST123" />);
    let initScript = screen.getByTestId("_next-ga-init");
    let mainScript = screen.getByTestId("_next-ga");
    let scriptContent = initScript.innerHTML;

    expect(mainScript).toHaveAttribute(
      "src",
      "https://www.googletagmanager.com/gtag/js?id=G-TEST123",
    );
    expect(scriptContent).toContain("window['dataLayer']");
    expect(scriptContent).toContain("'debug_mode': undefined");
    expect(scriptContent).toContain("gtag('config', 'G-TEST123'");
    expect(scriptContent).toContain("function gtag()");
    expect(scriptContent).toContain(".push(arguments)");
    expect(scriptContent).toContain("gtag('js', new Date())");
    result.unmount();

    result = render(
      <GoogleAnalyticsWorkaround
        gaId="G-TEST123"
        dataLayerName="customLayer"
      />,
    );
    scriptContent = screen.getByTestId("_next-ga-init").innerHTML;
    expect(scriptContent).toContain("window['customLayer']");
    result.unmount();

    result = render(
      <GoogleAnalyticsWorkaround gaId="G-TEST123" debugMode={true} />,
    );
    scriptContent = screen.getByTestId("_next-ga-init").innerHTML;
    expect(scriptContent).toContain("'debug_mode': true");
    result.unmount();

    result = render(
      <GoogleAnalyticsWorkaround gaId="G-TEST123" debugMode={false} />,
    );
    scriptContent = screen.getByTestId("_next-ga-init").innerHTML;
    expect(scriptContent).toContain("'debug_mode': false");
    result.unmount();

    result = render(
      <GoogleAnalyticsWorkaround gaId="G-TEST123" nonce="test-nonce" />,
    );
    expect(screen.getByTestId("_next-ga-init")).toHaveAttribute(
      "data-nonce",
      "test-nonce",
    );
    expect(screen.getByTestId("_next-ga")).toHaveAttribute(
      "data-nonce",
      "test-nonce",
    );
    result.unmount();

    result = render(
      <GoogleAnalyticsWorkaround
        gaId="G-ALL"
        dataLayerName="myLayer"
        nonce="my-nonce"
        debugMode={true}
      />,
    );
    const allPropsScript = screen.getByTestId("_next-ga-init");
    const allPropsContent = allPropsScript.innerHTML;
    expect(allPropsScript).toHaveAttribute("data-nonce", "my-nonce");
    expect(screen.getByTestId("_next-ga")).toHaveAttribute(
      "data-nonce",
      "my-nonce",
    );
    expect(allPropsContent).toContain("window['myLayer']");
    expect(allPropsContent).toContain("'debug_mode': true");
    expect(allPropsContent).toContain("gtag('config', 'G-ALL'");
  });

  it("calls performance.mark and handles missing API gracefully", () => {
    render(<GoogleAnalyticsWorkaround gaId="G-TEST123" />);
    expect(performanceMarkSpy).toHaveBeenCalledWith("mark_feature_usage", {
      detail: { feature: "next-third-parties-ga" },
    });

    performanceMarkSpy?.mockRestore();
    const originalMark = performance.mark;
    delete (performance as any).mark;
    expect(() =>
      render(<GoogleAnalyticsWorkaround gaId="G-TEST456" />),
    ).not.toThrow();
    performance.mark = originalMark;
  });
});

describe("sendGAEvent", () => {
  let consoleWarnSpy: jest.SpyInstance;
  let originalEnv: string | undefined;

  beforeEach(() => {
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation();
    originalEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
    process.env.NODE_ENV = originalEnv;
  });

  it("handles different environments and dataLayer states", () => {
    process.env.NODE_ENV = "test";
    sendGAEvent("event", "test_event", { test: "data" });
    expect(consoleWarnSpy).not.toHaveBeenCalled();

    process.env.NODE_ENV = "production";
    delete (window as any).dataLayer;
    sendGAEvent("event", "click_event", { button: "submit" });
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "@next/third-parties: GA dataLayer dataLayer does not exist",
    );

    const mockGtag = jest.fn();
    (window as any).gtag = mockGtag;
    (window as any).dataLayer = [];

    sendGAEvent("event", "conversion", { value: 100, currency: "USD" });
    expect(mockGtag).toHaveBeenCalledWith("event", "conversion", {
      value: 100,
      currency: "USD",
    });

    mockGtag.mockClear();
    sendGAEvent("event", "page_view", { page: "/home" });
    expect(mockGtag).toHaveBeenCalledWith("event", "page_view", {
      page: "/home",
    });

    mockGtag.mockClear();
    sendGAEvent("event", "simple_event", {});
    expect(mockGtag).toHaveBeenCalledWith("event", "simple_event", {});

    delete (window as any).gtag;
    delete (window as any).dataLayer;
  });
});
