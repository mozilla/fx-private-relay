import React from "react";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { type Props as CountryPickerProps } from "../../components/waitlist/CountryPicker";
import { type Props as LocalePickerProps } from "../../components/waitlist/LocalePicker";
import { mockFluentReact } from "../../../__mocks__/modules/fluent__react";
import { mockNextRouter } from "../../../__mocks__/modules/next__router";
import { mockConfigModule } from "../../../__mocks__/configMock";
import { setMockRuntimeData } from "../../../__mocks__/hooks/api/runtimeData";
import { setMockUserData } from "../../../__mocks__/hooks/api/user";
import { setMockProfileData } from "../../../__mocks__/hooks/api/profile";
import { mockUseFxaFlowTrackerModule } from "../../../__mocks__/hooks/fxaFlowTracker";

import PremiumWaitlist from "./waitlist.page";

jest.mock("@fluent/react", () => mockFluentReact);
jest.mock("next/router", () => mockNextRouter);
jest.mock("../../config.ts", () => mockConfigModule);
jest.mock("../../hooks/gaViewPing.ts");
jest.mock("../../hooks/fxaFlowTracker.ts", () => mockUseFxaFlowTrackerModule);
jest.mock("../../components/waitlist/CountryPicker.tsx", () => ({
  // We're mocking out the country picker because it dynamically imports the
  // list of available countries, which would mean the test would have to mock
  // out that import's Promise and wait for that to resolve, distracting from
  // the actual test code.
  // Since it's otherwise just a `<select>` element, we can just mock it out by
  // an empty <select>.
  CountryPicker: (props: CountryPickerProps) => <select {...props} />,
}));
jest.mock("../../components/waitlist/LocalePicker.tsx", () => ({
  // We're mocking out the locale picker because it dynamically imports the
  // list of available countries, which would mean the test would have to mock
  // out that import's Promise and wait for that to resolve, distracting from
  // the actual test code.
  // Since it's otherwise just a `<select>` element, we can just mock it out by
  // an empty <select>.
  LocalePicker: (allProps: LocalePickerProps) => {
    const props: Partial<LocalePickerProps> = {
      ...allProps,
    };
    delete props.supportedLocales;
    return <select {...props} />;
  },
}));

setMockRuntimeData();
setMockUserData();
setMockProfileData();

global.fetch = jest.fn();

beforeEach(() => {
  (global.fetch as jest.Mock).mockClear();
});

describe("The waitlist", () => {
  describe("under axe accessibility testing", () => {
    it("passes axe accessibility testing", async () => {
      const { baseElement } = render(<PremiumWaitlist />);

      let results;
      await act(async () => {
        results = await axe(baseElement);
      });

      expect(results).toHaveNoViolations();
    });
  });

  // Disabled since the upgrade to Jest 28; for some reason, the waitlist form's
  // `onSubmit` callback no longer gets called. For more information, see
  // https://github.com/mozilla/fx-private-relay/pull/2211#issuecomment-1188884809
  it.skip("sends the user's email to Basket", async () => {
    render(<PremiumWaitlist />);

    const emailInput = screen.getByLabelText(
      "l10n string: [waitlist-control-email-label], with vars: {}"
    );
    await userEvent.clear(emailInput);
    await userEvent.type(emailInput, "some_email@example.com");

    const submitButton = screen.getByRole("button", {
      name: "l10n string: [waitlist-submit-label], with vars: {}",
    });
    await userEvent.click(submitButton);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ body: expect.any(String) })
    );
    const requestBody = (global.fetch as jest.Mock).mock.calls[0][1].body;
    const params = new URLSearchParams(requestBody);
    expect(params.get("email")).toBe("some_email@example.com");
  });

  // Disabled since the upgrade to Jest 28; for some reason, the waitlist form's
  // `onSubmit` callback no longer gets called. For more information, see
  // https://github.com/mozilla/fx-private-relay/pull/2211#issuecomment-1188884809
  it.skip("uses the Basket URL set by the back-end", async () => {
    setMockRuntimeData({ BASKET_ORIGIN: "https://some-basket-url.com" });
    render(<PremiumWaitlist />);

    const emailInput = screen.getByLabelText(
      "l10n string: [waitlist-control-email-label], with vars: {}"
    );
    await userEvent.clear(emailInput);
    await userEvent.type(emailInput, "arbitrary_email@example.com");

    const submitButton = screen.getByRole("button", {
      name: "l10n string: [waitlist-submit-label], with vars: {}",
    });
    await userEvent.click(submitButton);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      "https://some-basket-url.com/news/subscribe/",
      expect.anything()
    );
    // Restore the original runtime data mocks:
    setMockRuntimeData();
  });
});
