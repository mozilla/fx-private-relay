import React from "react";
import { render, screen } from "@testing-library/react";
import { ReactAriaI18nProvider } from "./ReactAriaI18nProvider";

const mockI18nProvider = jest.fn();

jest.mock("react-aria", () => ({
  I18nProvider: (props: { locale: string; children: React.ReactNode }) =>
    mockI18nProvider(props),
}));

describe("<ReactAriaI18nProvider>", () => {
  const mockL10n = {
    bundles: [{ locales: ["en-GB"] }],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    global.useL10nImpl = () => mockL10n;
    global.getLocaleMock.mockReturnValue("en-GB");
    mockI18nProvider.mockImplementation(
      (props: { locale: string; children: React.ReactNode }) => (
        <div data-testid="i18n-provider" data-locale={props.locale}>
          {props.children}
        </div>
      ),
    );
  });

  it("calls useL10n hook", () => {
    const useL10nSpy = jest.spyOn(
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("../hooks/l10n"),
      "useL10n",
    );

    render(
      <ReactAriaI18nProvider>
        <div>Test content</div>
      </ReactAriaI18nProvider>,
    );

    expect(useL10nSpy).toHaveBeenCalled();
  });

  it("calls getLocale with l10n instance", () => {
    render(
      <ReactAriaI18nProvider>
        <div>Test content</div>
      </ReactAriaI18nProvider>,
    );

    expect(global.getLocaleMock).toHaveBeenCalledWith(mockL10n);
  });

  it("passes the locale to react-aria I18nProvider", () => {
    render(
      <ReactAriaI18nProvider>
        <div>Test content</div>
      </ReactAriaI18nProvider>,
    );

    expect(mockI18nProvider).toHaveBeenCalledWith(
      expect.objectContaining({
        locale: "en-GB",
      }),
    );
  });

  it("renders children within the I18nProvider", () => {
    render(
      <ReactAriaI18nProvider>
        <div data-testid="test-child">Child content</div>
      </ReactAriaI18nProvider>,
    );

    const provider = screen.getByTestId("i18n-provider");
    expect(provider).toBeInTheDocument();
    expect(provider).toHaveAttribute("data-locale", "en-GB");

    const child = screen.getByTestId("test-child");
    expect(child).toBeInTheDocument();
    expect(child).toHaveTextContent("Child content");
  });

  it("uses the locale from getLocale when l10n changes", () => {
    global.getLocaleMock.mockReturnValue("fr");

    render(
      <ReactAriaI18nProvider>
        <div>Test content</div>
      </ReactAriaI18nProvider>,
    );

    expect(mockI18nProvider).toHaveBeenCalledWith(
      expect.objectContaining({
        locale: "fr",
      }),
    );
  });

  it("handles different locale formats", () => {
    global.getLocaleMock.mockReturnValue("es-ES");

    render(
      <ReactAriaI18nProvider>
        <div>Test content</div>
      </ReactAriaI18nProvider>,
    );

    const provider = screen.getByTestId("i18n-provider");
    expect(provider).toHaveAttribute("data-locale", "es-ES");
  });
});
