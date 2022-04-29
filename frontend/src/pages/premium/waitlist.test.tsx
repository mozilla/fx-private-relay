import React from "react";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { mockFluentReact } from "../../../__mocks__/modules/fluent__react";
import { mockNextRouter } from "../../../__mocks__/modules/next__router";
import { mockConfigModule } from "../../../__mocks__/configMock";
import { setMockRuntimeData } from "../../../__mocks__/hooks/api/runtimeData";
import { setMockUserData } from "../../../__mocks__/hooks/api/user";
import { setMockProfileData } from "../../../__mocks__/hooks/api/profile";

import PremiumWaitlist from "./waitlist.page";

jest.mock("@fluent/react", () => mockFluentReact);
jest.mock("next/router", () => mockNextRouter);
jest.mock("../../config.ts", () => mockConfigModule);
jest.mock("../../hooks/gaViewPing.ts");
jest.mock("../../components/waitlist/countryPicker.tsx", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  CountryPicker: (props: any) => <select {...props} />,
}));
jest.mock("../../components/waitlist/localePicker.tsx", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  LocalePicker: (allProps: any) => {
    const props = {
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

  it("sends the user's email to Basket", async () => {
    render(<PremiumWaitlist />);

    const emailInput = screen.getByLabelText(
      "l10n string: [waitlist-control-email-label], with vars: {}"
    );
    userEvent.clear(emailInput);
    userEvent.type(emailInput, "some_email@example.com");

    const submitButton = screen.getByRole("button", {
      name: "l10n string: [waitlist-submit-label], with vars: {}",
    });
    userEvent.click(submitButton);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      "https://basket.mozilla.org/news/subscribe/",
      expect.objectContaining({ body: expect.stringContaining("") })
    );
    const requestBody = (global.fetch as jest.Mock).mock.calls[0][1].body;
    const params = new URLSearchParams(requestBody);
    expect(params.get("email")).toBe("some_email@example.com");
  });

  it("uses the Basket URL set by the back-end", async () => {
    setMockRuntimeData({ BASKET_ORIGIN: "https://some-basket-url.com" });
    render(<PremiumWaitlist />);

    const emailInput = screen.getByLabelText(
      "l10n string: [waitlist-control-email-label], with vars: {}"
    );
    userEvent.clear(emailInput);
    userEvent.type(emailInput, "arbitrary_email@example.com");

    const submitButton = screen.getByRole("button", {
      name: "l10n string: [waitlist-submit-label], with vars: {}",
    });
    userEvent.click(submitButton);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      "https://some-basket-url.com/news/subscribe/",
      expect.anything()
    );
    // Restore the original runtime data mocks:
    setMockRuntimeData();
  });
});
