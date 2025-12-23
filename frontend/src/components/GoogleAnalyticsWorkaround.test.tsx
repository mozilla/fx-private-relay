import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import {
  GoogleAnalyticsWorkaround,
  sendGAEvent,
} from "./GoogleAnalyticsWorkaround";

// Mock Next.js Script component
jest.mock("next/script", () => {
  return function Script(props: {
    id: string;
    dangerouslySetInnerHTML?: { __html: string };
    src?: string;
    nonce?: string;
  }) {
    if (props.dangerouslySetInnerHTML) {
      return (
        // eslint-disable-next-line @next/next/no-sync-scripts
        <script
          id={props.id}
          data-testid={props.id}
          data-nonce={props.nonce}
          dangerouslySetInnerHTML={props.dangerouslySetInnerHTML}
        />
      );
    }
    return (
      // eslint-disable-next-line @next/next/no-sync-scripts
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
    // Mock performance.mark if it doesn't exist
    if (typeof performance.mark !== "function") {
      performance.mark = jest.fn();
    }
    performanceMarkSpy = jest.spyOn(performance, "mark");
  });

  afterEach(() => {
    performanceMarkSpy?.mockRestore();
  });

  it("renders both GA scripts with the provided gaId", () => {
    render(<GoogleAnalyticsWorkaround gaId="G-TEST123" />);

    const initScript = screen.getByTestId("_next-ga-init");
    const mainScript = screen.getByTestId("_next-ga");

    expect(initScript).toBeInTheDocument();
    expect(mainScript).toBeInTheDocument();
    expect(mainScript).toHaveAttribute(
      "src",
      "https://www.googletagmanager.com/gtag/js?id=G-TEST123",
    );
  });

  it("uses default dataLayer name when not specified", () => {
    render(<GoogleAnalyticsWorkaround gaId="G-TEST123" />);

    const initScript = screen.getByTestId("_next-ga-init");
    const scriptContent = initScript.innerHTML;

    expect(scriptContent).toContain("window['dataLayer']");
  });

  it("uses custom dataLayer name when specified", () => {
    render(
      <GoogleAnalyticsWorkaround
        gaId="G-TEST123"
        dataLayerName="customLayer"
      />,
    );

    const initScript = screen.getByTestId("_next-ga-init");
    const scriptContent = initScript.innerHTML;

    expect(scriptContent).toContain("window['customLayer']");
  });

  it("passes nonce to both scripts when provided", () => {
    render(
      <GoogleAnalyticsWorkaround gaId="G-TEST123" nonce="test-nonce-123" />,
    );

    const initScript = screen.getByTestId("_next-ga-init");
    const mainScript = screen.getByTestId("_next-ga");

    expect(initScript).toHaveAttribute("data-nonce", "test-nonce-123");
    expect(mainScript).toHaveAttribute("data-nonce", "test-nonce-123");
  });

  it("sets debug_mode to undefined by default", () => {
    render(<GoogleAnalyticsWorkaround gaId="G-TEST123" />);

    const initScript = screen.getByTestId("_next-ga-init");
    const scriptContent = initScript.innerHTML;

    expect(scriptContent).toContain("'debug_mode': undefined");
  });

  it("sets debug_mode to true when debugMode prop is true", () => {
    render(<GoogleAnalyticsWorkaround gaId="G-TEST123" debugMode={true} />);

    const initScript = screen.getByTestId("_next-ga-init");
    const scriptContent = initScript.innerHTML;

    expect(scriptContent).toContain("'debug_mode': true");
  });

  it("calls performance.mark with correct feature usage", () => {
    render(<GoogleAnalyticsWorkaround gaId="G-TEST123" />);

    expect(performanceMarkSpy).toHaveBeenCalledWith("mark_feature_usage", {
      detail: {
        feature: "next-third-parties-ga",
      },
    });
  });

  it("does not crash when performance.mark is not available", () => {
    // Clear the spy and remove performance.mark temporarily
    performanceMarkSpy?.mockRestore();
    const originalMark = performance.mark;
    // @ts-expect-error Testing missing API
    delete performance.mark;

    // Should not throw an error
    expect(() => {
      render(<GoogleAnalyticsWorkaround gaId="G-TEST123" />);
    }).not.toThrow();

    // Restore
    performance.mark = originalMark;
    performanceMarkSpy = jest.spyOn(performance, "mark");
  });

  it("includes gtag configuration with the provided gaId", () => {
    render(<GoogleAnalyticsWorkaround gaId="G-CUSTOM456" />);

    const initScript = screen.getByTestId("_next-ga-init");
    const scriptContent = initScript.innerHTML;

    expect(scriptContent).toContain("gtag('config', 'G-CUSTOM456'");
  });

  it("sets debug_mode to false when debugMode prop is false", () => {
    render(<GoogleAnalyticsWorkaround gaId="G-TEST123" debugMode={false} />);

    const initScript = screen.getByTestId("_next-ga-init");
    const scriptContent = initScript.innerHTML;

    expect(scriptContent).toContain("'debug_mode': false");
  });

  it("includes gtag function definition in the init script", () => {
    render(<GoogleAnalyticsWorkaround gaId="G-TEST123" />);

    const initScript = screen.getByTestId("_next-ga-init");
    const scriptContent = initScript.innerHTML;

    expect(scriptContent).toContain("function gtag()");
    expect(scriptContent).toContain(".push(arguments)");
  });

  it("includes gtag js call with new Date in the init script", () => {
    render(<GoogleAnalyticsWorkaround gaId="G-TEST123" />);

    const initScript = screen.getByTestId("_next-ga-init");
    const scriptContent = initScript.innerHTML;

    expect(scriptContent).toContain("gtag('js', new Date())");
  });

  it("handles nonce being undefined", () => {
    render(<GoogleAnalyticsWorkaround gaId="G-TEST123" nonce={undefined} />);

    const initScript = screen.getByTestId("_next-ga-init");
    const mainScript = screen.getByTestId("_next-ga");

    expect(initScript).toBeInTheDocument();
    expect(mainScript).toBeInTheDocument();
  });

  it("renders correctly with all optional props", () => {
    render(
      <GoogleAnalyticsWorkaround
        gaId="G-ALL-PROPS"
        dataLayerName="myLayer"
        nonce="my-nonce"
        debugMode={true}
      />,
    );

    const initScript = screen.getByTestId("_next-ga-init");
    const mainScript = screen.getByTestId("_next-ga");
    const scriptContent = initScript.innerHTML;

    expect(initScript).toHaveAttribute("data-nonce", "my-nonce");
    expect(mainScript).toHaveAttribute("data-nonce", "my-nonce");
    expect(scriptContent).toContain("window['myLayer']");
    expect(scriptContent).toContain("'debug_mode': true");
    expect(scriptContent).toContain("gtag('config', 'G-ALL-PROPS'");
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

  it("returns early in test environment without calling gtag", () => {
    process.env.NODE_ENV = "test";

    sendGAEvent("event", "test_event", { test: "data" });

    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });

  it("warns when dataLayer does not exist on window", () => {
    process.env.NODE_ENV = "production";

    render(<GoogleAnalyticsWorkaround gaId="G-TEST123" />);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).dataLayer;

    sendGAEvent("event", "click_event", { button: "submit" });

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "@next/third-parties: GA dataLayer dataLayer does not exist",
    );
  });

  it("calls window.gtag when dataLayer exists", () => {
    process.env.NODE_ENV = "production";
    const mockGtag = jest.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).gtag = mockGtag;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).dataLayer = [];

    render(<GoogleAnalyticsWorkaround gaId="G-TEST123" />);

    sendGAEvent("event", "conversion", { value: 100, currency: "USD" });

    expect(mockGtag).toHaveBeenCalledWith("event", "conversion", {
      value: 100,
      currency: "USD",
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).gtag;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).dataLayer;
  });

  it("calls gtag with different event names and arguments", () => {
    process.env.NODE_ENV = "production";
    const mockGtag = jest.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).gtag = mockGtag;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).dataLayer = [];

    render(<GoogleAnalyticsWorkaround gaId="G-TEST123" />);

    sendGAEvent("event", "page_view", { page: "/home" });

    expect(mockGtag).toHaveBeenCalledWith("event", "page_view", {
      page: "/home",
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).gtag;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).dataLayer;
  });

  it("handles empty event arguments", () => {
    process.env.NODE_ENV = "production";
    const mockGtag = jest.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).gtag = mockGtag;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).dataLayer = [];

    render(<GoogleAnalyticsWorkaround gaId="G-TEST123" />);

    sendGAEvent("event", "simple_event", {});

    expect(mockGtag).toHaveBeenCalledWith("event", "simple_event", {});

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).gtag;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).dataLayer;
  });
});
