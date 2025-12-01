import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import "@testing-library/jest-dom";
import { type Props as CountryPickerProps } from "./CountryPicker";
import { type Props as LocalePickerProps } from "./LocalePicker";
import { mockNextRouter } from "../../../__mocks__/modules/next__router";
import { mockConfigModule } from "../../../__mocks__/configMock";
import { setMockRuntimeData } from "../../../__mocks__/hooks/api/runtimeData";
import { setMockUserData } from "../../../__mocks__/hooks/api/user";
import { setMockProfileData } from "../../../__mocks__/hooks/api/profile";
import { mockUseFxaFlowTrackerModule } from "../../../__mocks__/hooks/fxaFlowTracker";
import { WaitlistPage } from "./WaitlistPage";
import { toast as toastFn } from "react-toastify";

jest.mock("../layout/Layout", () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock("react-toastify", () => ({ toast: jest.fn() }));

const toastMock = toastFn as unknown as jest.Mock;

jest.mock("next/router", () => mockNextRouter);
jest.mock("../../config.ts", () => mockConfigModule);
jest.mock("../../hooks/fxaFlowTracker.ts", () => mockUseFxaFlowTrackerModule);

jest.mock("./CountryPicker.tsx", () => ({
  // We're mocking out the country picker because it dynamically imports the
  // list of available countries, which would mean the test would have to mock
  // out that import's Promise and wait for that to resolve, distracting from
  // the actual test code.
  // Since it's otherwise just a `<select>` element, we can just mock it out by
  // an empty <select>.
  CountryPicker: (props: CountryPickerProps) => (
    <select {...props}>
      <option value="US">United States</option>
      <option value="CA">Canada</option>
      <option value="DE">Germany</option>
      <option value="FR">France</option>
    </select>
  ),
}));
jest.mock("./LocalePicker.tsx", () => ({
  // We're mocking out the locale picker because it dynamically imports the
  // list of available countries, which would mean the test would have to mock
  // out that import's Promise and wait for that to resolve, distracting from
  // the actual test code.
  // Since it's otherwise just a `<select>` element, we can just mock it out by
  // an empty <select>.
  LocalePicker: (allProps: LocalePickerProps) => {
    const { supportedLocales, ...rest } = allProps;
    const current =
      typeof rest.value === "string"
        ? rest.value
        : Array.isArray(rest.value) && typeof rest.value[0] === "string"
          ? rest.value[0]
          : "en";
    const list =
      supportedLocales && supportedLocales.length > 0
        ? supportedLocales
        : [current];
    return (
      <select {...(rest as Omit<LocalePickerProps, "supportedLocales">)}>
        {list.map((loc) => (
          <option key={loc} value={loc}>
            {loc}
          </option>
        ))}
      </select>
    );
  },
}));

setMockRuntimeData();
setMockUserData();
setMockProfileData();

global.fetch = jest.fn();

type SetupOptions = {
  runtimeData?: Record<string, unknown>;
  props?: Partial<React.ComponentProps<typeof WaitlistPage>>;
};

function setup(options: SetupOptions = {}) {
  if (options.runtimeData) {
    setMockRuntimeData(options.runtimeData);
  }

  const defaultProps: React.ComponentProps<typeof WaitlistPage> = {
    headline: "h",
    lead: "l",
    legalese: <>x</>,
    newsletterId: "n",
    supportedLocales: ["en"],
  };

  const props = { ...defaultProps, ...options.props };
  const view = render(<WaitlistPage {...props} />);

  return {
    ...view,
    getEmailInput: () =>
      screen.getByLabelText(
        "l10n string: [waitlist-control-email-label], with vars: {}",
      ),
    getSubmitButton: () =>
      screen.getByRole("button", {
        name: "l10n string: [waitlist-submit-label-2], with vars: {}",
      }),
    getCountrySelect: () =>
      screen.getByLabelText(
        "l10n string: [waitlist-control-country-label-2], with vars: {}",
      ) as HTMLSelectElement,
    getLocaleSelect: () =>
      screen.getByLabelText(
        "l10n string: [waitlist-control-locale-label], with vars: {}",
      ) as HTMLSelectElement,
  };
}

beforeEach(() => {
  (global.fetch as jest.Mock).mockClear();
  toastMock.mockClear();
});

afterEach(() => {
  setMockRuntimeData(); // Reset to defaults
});

describe("The waitlist", () => {
  describe("under axe accessibility testing", () => {
    it("passes axe accessibility testing", async () => {
      const { baseElement } = render(
        <WaitlistPage
          headline="Arbitrary headline"
          lead="Arbitrary lead text"
          legalese={<>Arbitrary legalese footer.</>}
          newsletterId="arbitrary-newsletter-id"
          supportedLocales={["en"]}
        />,
      );
      const results = await axe(baseElement);
      expect(results).toHaveNoViolations();
    }, 10000);
  });

  it("sends the user's email to Basket", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: "ok" }),
    });

    const { getEmailInput, getSubmitButton } = setup();

    await userEvent.clear(getEmailInput());
    await userEvent.type(getEmailInput(), "some_email@example.com");
    await userEvent.click(getSubmitButton());

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ body: expect.any(String) }),
    );
    const requestBody = (global.fetch as jest.Mock).mock.calls[0][1]
      .body as string;
    const params = new URLSearchParams(requestBody);
    expect(params.get("email")).toBe("some_email@example.com");
  });

  it("uses the Basket URL set by the back-end", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: "ok" }),
    });

    const { getEmailInput, getSubmitButton } = setup({
      runtimeData: { BASKET_ORIGIN: "https://some-basket-url.com" },
    });

    await userEvent.clear(getEmailInput());
    await userEvent.type(getEmailInput(), "arbitrary_email@example.com");
    await userEvent.click(getSubmitButton());

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      "https://some-basket-url.com/news/subscribe/",
      expect.anything(),
    );
  });

  it("prefers detected country from runtimeData for CountryPicker default", () => {
    const { getCountrySelect } = setup({
      runtimeData: {
        PERIODICAL_PREMIUM_PLANS: { country_code: "ca" },
      } as unknown as Record<string, unknown>,
    });
    expect(getCountrySelect().value).toBe("CA");
  });

  it("matches locale from navigator.language when supported", async () => {
    const original = Object.getOwnPropertyDescriptor(
      window.navigator,
      "language",
    );
    Object.defineProperty(window.navigator, "language", {
      value: "fr-FR",
      configurable: true,
    });

    const { getLocaleSelect } = setup({
      props: { supportedLocales: ["en", "fr", "de"] },
    });

    expect(getLocaleSelect().value).toBe("fr");

    if (original) Object.defineProperty(window.navigator, "language", original);
  });

  it("falls back to en when navigator.language is unsupported", () => {
    const original = Object.getOwnPropertyDescriptor(
      window.navigator,
      "language",
    );
    Object.defineProperty(window.navigator, "language", {
      value: "sv-SE",
      configurable: true,
    });

    const { getLocaleSelect } = setup({
      props: { supportedLocales: ["en", "fr"] },
    });

    expect(getLocaleSelect().value).toBe("en");

    if (original) Object.defineProperty(window.navigator, "language", original);
  });

  it("updates controlled selects for country and locale before submit", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: "ok" }),
    });

    const {
      getEmailInput,
      getCountrySelect,
      getLocaleSelect,
      getSubmitButton,
    } = setup({
      props: { supportedLocales: ["en", "de"] },
    });

    await userEvent.clear(getEmailInput());
    await userEvent.type(getEmailInput(), "e@example.com");
    await userEvent.selectOptions(getCountrySelect(), "DE");
    await userEvent.selectOptions(getLocaleSelect(), "de");
    await userEvent.click(getSubmitButton());

    const body = (global.fetch as jest.Mock).mock.calls[0][1].body as string;
    const params = new URLSearchParams(body);
    expect(params.get("relay_country")).toBe("DE");
    expect(params.get("lang")).toBe("de");
  });

  it("passes detected country and newsletter id into the request body", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: "ok" }),
    });

    const { getEmailInput, getSubmitButton } = setup({
      runtimeData: {
        BASKET_ORIGIN: "https://basket.mozilla.org",
        PERIODICAL_PREMIUM_PLANS: { country_code: "us" },
      } as unknown as Record<string, unknown>,
      props: { newsletterId: "newsletter-123" },
    });

    await userEvent.clear(getEmailInput());
    await userEvent.type(getEmailInput(), "a@b.co");
    await userEvent.click(getSubmitButton());

    const body = (global.fetch as jest.Mock).mock.calls[0][1].body as string;
    const params = new URLSearchParams(body);
    expect(params.get("country")).toBe("US");
    expect(params.get("newsletters")).toBe("newsletter-123");
    expect(params.get("format")).toBe("html");
    expect(params.get("source_url")).toContain(document.location.origin);
  });

  it("shows success toast when response ok with status ok", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: "ok" }),
    });

    const { getEmailInput, getSubmitButton } = setup();

    await userEvent.clear(getEmailInput());
    await userEvent.type(getEmailInput(), "ok@example.com");
    await userEvent.click(getSubmitButton());

    expect(toastMock).toHaveBeenCalledWith(
      "l10n string: [waitlist-subscribe-success], with vars: {}",
      expect.objectContaining({ type: "success" }),
    );
  });

  it("shows unknown error toast when response not ok or status not ok", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: "error", code: 400, desc: "x" }),
    });

    const { getEmailInput, getSubmitButton } = setup();

    await userEvent.clear(getEmailInput());
    await userEvent.type(getEmailInput(), "bad@example.com");
    await userEvent.click(getSubmitButton());

    expect(toastMock).toHaveBeenCalledWith(
      "l10n string: [waitlist-subscribe-error-unknown], with vars: {}",
      expect.objectContaining({ type: "error" }),
    );
  });

  it("shows connection error toast when fetch rejects", async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error("net"));

    const { getEmailInput, getSubmitButton } = setup();

    await userEvent.clear(getEmailInput());
    await userEvent.type(getEmailInput(), "err@example.com");
    await userEvent.click(getSubmitButton());

    expect(toastMock).toHaveBeenCalledWith(
      "l10n string: [waitlist-subscribe-error-connection], with vars: {}",
      expect.objectContaining({ type: "error" }),
    );
  });
});
