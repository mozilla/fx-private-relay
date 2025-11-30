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
});

describe("sendGAEvent", () => {
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation();
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  it("returns early in test environment without calling gtag", () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "test";

    sendGAEvent("event", "test_event", { test: "data" });

    expect(consoleWarnSpy).not.toHaveBeenCalled();

    process.env.NODE_ENV = originalEnv;
  });
});
