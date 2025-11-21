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

beforeEach(() => {
  (global.fetch as jest.Mock).mockClear();
  toastMock.mockClear();
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

    render(
      <WaitlistPage
        headline="Arbitrary headline"
        lead="Arbitrary lead text"
        legalese={<>Arbitrary legalese footer.</>}
        newsletterId="arbitrary-newsletter-id"
        supportedLocales={["en"]}
      />,
    );

    const emailInput = screen.getByLabelText(
      "l10n string: [waitlist-control-email-label], with vars: {}",
    );
    await userEvent.clear(emailInput);
    await userEvent.type(emailInput, "some_email@example.com");

    const submitButton = screen.getByRole("button", {
      name: "l10n string: [waitlist-submit-label-2], with vars: {}",
    });

    await userEvent.click(submitButton);

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
    setMockRuntimeData({ BASKET_ORIGIN: "https://some-basket-url.com" });

    render(
      <WaitlistPage
        headline="Arbitrary headline"
        lead="Arbitrary lead text"
        legalese={<>Arbitrary legalese footer.</>}
        newsletterId="arbitrary-newsletter-id"
        supportedLocales={["en"]}
      />,
    );

    const emailInput = screen.getByLabelText(
      "l10n string: [waitlist-control-email-label], with vars: {}",
    );
    await userEvent.clear(emailInput);
    await userEvent.type(emailInput, "arbitrary_email@example.com");

    const submitButton = screen.getByRole("button", {
      name: "l10n string: [waitlist-submit-label-2], with vars: {}",
    });

    await userEvent.click(submitButton);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      "https://some-basket-url.com/news/subscribe/",
      expect.anything(),
    );
    setMockRuntimeData();
  });

  it("prefers detected country from runtimeData for CountryPicker default", () => {
    setMockRuntimeData({
      PERIODICAL_PREMIUM_PLANS: { country_code: "ca" },
    } as unknown as Record<string, unknown>);
    render(
      <WaitlistPage
        headline="h"
        lead="l"
        legalese={<>x</>}
        newsletterId="n"
        supportedLocales={["en"]}
      />,
    );
    const countrySelect = screen.getByLabelText(
      "l10n string: [waitlist-control-country-label-2], with vars: {}",
    ) as HTMLSelectElement;
    expect(countrySelect.value).toBe("CA");
    setMockRuntimeData();
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

    render(
      <WaitlistPage
        headline="h"
        lead="l"
        legalese={<>x</>}
        newsletterId="n"
        supportedLocales={["en", "fr", "de"]}
      />,
    );

    const localeSelect = screen.getByLabelText(
      "l10n string: [waitlist-control-locale-label], with vars: {}",
    ) as HTMLSelectElement;
    expect(localeSelect.value).toBe("fr");

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

    render(
      <WaitlistPage
        headline="h"
        lead="l"
        legalese={<>x</>}
        newsletterId="n"
        supportedLocales={["en", "fr"]}
      />,
    );

    const localeSelect = screen.getByLabelText(
      "l10n string: [waitlist-control-locale-label], with vars: {}",
    ) as HTMLSelectElement;
    expect(localeSelect.value).toBe("en");

    if (original) Object.defineProperty(window.navigator, "language", original);
  });

  it("updates controlled selects for country and locale before submit", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: "ok" }),
    });

    render(
      <WaitlistPage
        headline="h"
        lead="l"
        legalese={<>x</>}
        newsletterId="n"
        supportedLocales={["en", "de"]}
      />,
    );

    const emailInput = screen.getByLabelText(
      "l10n string: [waitlist-control-email-label], with vars: {}",
    );
    await userEvent.clear(emailInput);
    await userEvent.type(emailInput, "e@example.com");

    const countrySelect = screen.getByLabelText(
      "l10n string: [waitlist-control-country-label-2], with vars: {}",
    );
    await userEvent.selectOptions(countrySelect, "DE");

    const localeSelect = screen.getByLabelText(
      "l10n string: [waitlist-control-locale-label], with vars: {}",
    );
    await userEvent.selectOptions(localeSelect, "de");

    const submitButton = screen.getByRole("button", {
      name: "l10n string: [waitlist-submit-label-2], with vars: {}",
    });
    await userEvent.click(submitButton);

    const body = (global.fetch as jest.Mock).mock.calls[0][1].body as string;
    const params = new URLSearchParams(body);
    expect(params.get("relay_country")).toBe("DE");
    expect(params.get("lang")).toBe("de");
  });

  it("passes detected country and newsletter id into the request body", async () => {
    setMockRuntimeData({
      BASKET_ORIGIN: "https://basket.mozilla.org",
      PERIODICAL_PREMIUM_PLANS: { country_code: "us" },
    } as unknown as Record<string, unknown>);

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: "ok" }),
    });

    render(
      <WaitlistPage
        headline="h"
        lead="l"
        legalese={<>x</>}
        newsletterId="newsletter-123"
        supportedLocales={["en"]}
      />,
    );

    const emailInput = screen.getByLabelText(
      "l10n string: [waitlist-control-email-label], with vars: {}",
    );
    await userEvent.clear(emailInput);
    await userEvent.type(emailInput, "a@b.co");

    const submitButton = screen.getByRole("button", {
      name: "l10n string: [waitlist-submit-label-2], with vars: {}",
    });
    await userEvent.click(submitButton);

    const body = (global.fetch as jest.Mock).mock.calls[0][1].body as string;
    const params = new URLSearchParams(body);
    expect(params.get("country")).toBe("US");
    expect(params.get("newsletters")).toBe("newsletter-123");
    expect(params.get("format")).toBe("html");
    expect(params.get("source_url")).toContain(document.location.origin);
    setMockRuntimeData();
  });

  it("shows success toast when response ok with status ok", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: "ok" }),
    });

    render(
      <WaitlistPage
        headline="h"
        lead="l"
        legalese={<>x</>}
        newsletterId="n"
        supportedLocales={["en"]}
      />,
    );

    const emailInput = screen.getByLabelText(
      "l10n string: [waitlist-control-email-label], with vars: {}",
    );
    await userEvent.clear(emailInput);
    await userEvent.type(emailInput, "ok@example.com");
    const submitButton = screen.getByRole("button", {
      name: "l10n string: [waitlist-submit-label-2], with vars: {}",
    });
    await userEvent.click(submitButton);

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

    render(
      <WaitlistPage
        headline="h"
        lead="l"
        legalese={<>x</>}
        newsletterId="n"
        supportedLocales={["en"]}
      />,
    );

    const emailInput = screen.getByLabelText(
      "l10n string: [waitlist-control-email-label], with vars: {}",
    );
    await userEvent.clear(emailInput);
    await userEvent.type(emailInput, "bad@example.com");
    const submitButton = screen.getByRole("button", {
      name: "l10n string: [waitlist-submit-label-2], with vars: {}",
    });
    await userEvent.click(submitButton);

    expect(toastMock).toHaveBeenCalledWith(
      "l10n string: [waitlist-subscribe-error-unknown], with vars: {}",
      expect.objectContaining({ type: "error" }),
    );
  });

  it("shows connection error toast when fetch rejects", async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error("net"));

    render(
      <WaitlistPage
        headline="h"
        lead="l"
        legalese={<>x</>}
        newsletterId="n"
        supportedLocales={["en"]}
      />,
    );

    const emailInput = screen.getByLabelText(
      "l10n string: [waitlist-control-email-label], with vars: {}",
    );
    await userEvent.clear(emailInput);
    await userEvent.type(emailInput, "err@example.com");
    const submitButton = screen.getByRole("button", {
      name: "l10n string: [waitlist-submit-label-2], with vars: {}",
    });
    await userEvent.click(submitButton);

    expect(toastMock).toHaveBeenCalledWith(
      "l10n string: [waitlist-subscribe-error-connection], with vars: {}",
      expect.objectContaining({ type: "error" }),
    );
  });
});
