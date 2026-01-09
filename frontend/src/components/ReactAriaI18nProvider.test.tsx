import React from "react";
import { render, screen } from "@testing-library/react";
import { ReactAriaI18nProvider } from "./ReactAriaI18nProvider";

const mockI18nProvider = jest.fn();

jest.mock("react-aria", () => ({
  I18nProvider: (props: { locale: string; children: React.ReactNode }) =>
    mockI18nProvider(props),
}));

describe("ReactAriaI18nProvider", () => {
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

  it("integrates l10n with react-aria I18nProvider and renders children", () => {
    const useL10nSpy = jest.spyOn(require("../hooks/l10n"), "useL10n");

    let result = render(
      <ReactAriaI18nProvider>
        <div data-testid="test-child">Child content</div>
      </ReactAriaI18nProvider>,
    );

    expect(useL10nSpy).toHaveBeenCalled();
    expect(global.getLocaleMock).toHaveBeenCalledWith(mockL10n);
    expect(mockI18nProvider).toHaveBeenCalledWith(
      expect.objectContaining({ locale: "en-GB" }),
    );

    let provider = screen.getByTestId("i18n-provider");
    expect(provider).toHaveAttribute("data-locale", "en-GB");
    expect(screen.getByTestId("test-child")).toHaveTextContent("Child content");
    result.unmount();

    global.getLocaleMock.mockReturnValue("fr");
    result = render(
      <ReactAriaI18nProvider>
        <div>French content</div>
      </ReactAriaI18nProvider>,
    );
    expect(mockI18nProvider).toHaveBeenCalledWith(
      expect.objectContaining({ locale: "fr" }),
    );
    result.unmount();

    global.getLocaleMock.mockReturnValue("es-ES");
    result = render(
      <ReactAriaI18nProvider>
        <div>Spanish content</div>
      </ReactAriaI18nProvider>,
    );
    expect(screen.getByTestId("i18n-provider")).toHaveAttribute(
      "data-locale",
      "es-ES",
    );
  });
});
