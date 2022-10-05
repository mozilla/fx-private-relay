import { act, render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { mockConfigModule } from "../../__mocks__/configMock";
import { setMockProfileData } from "../../__mocks__/hooks/api/profile";
import {
  getMockRuntimeDataWithoutPremium,
  getMockRuntimeDataWithPhones,
  setMockRuntimeData,
  setMockRuntimeDataOnce,
} from "../../__mocks__/hooks/api/runtimeData";
import { mockUseFxaFlowTrackerModule } from "../../__mocks__/hooks/fxaFlowTracker";
import { mockFluentReact } from "../../__mocks__/modules/fluent__react";
import { mockNextRouter } from "../../__mocks__/modules/next__router";
import { mockReactGa } from "../../__mocks__/modules/react-ga";

import Faq from "./faq.page";

jest.mock("@fluent/react", () => mockFluentReact);
jest.mock("next/router", () => mockNextRouter);
jest.mock("react-ga", () => mockReactGa);
jest.mock("../config.ts", () => mockConfigModule);
jest.mock("../hooks/gaViewPing.ts");
jest.mock("../hooks/fxaFlowTracker.ts", () => mockUseFxaFlowTrackerModule);

setMockRuntimeData();
setMockProfileData(null);

describe("The page with Frequently Asked Questions", () => {
  describe("under axe accessibility testing", () => {
    it("passes axe accessibility testing", async () => {
      const { baseElement } = render(<Faq />);

      let results;
      await act(async () => {
        results = await axe(baseElement);
      });

      expect(results).toHaveNoViolations();
    }, 10000); // axe runs a suite of tests that can exceed the default 5s timeout, so we set it to 10s
  });
});

it("displays phone FAQs if phones is available in the user's country", () => {
  setMockRuntimeDataOnce({
    ...getMockRuntimeDataWithPhones(),
    WAFFLE_FLAGS: [["phones", true]],
  });

  render(<Faq />);

  const phoneQuestion = screen.getByRole("heading", {
    name: "l10n string: [phone-masking-faq-question-what-is], with vars: {}",
  });

  expect(phoneQuestion).toBeInTheDocument();
});

it("does not display phone FAQs if phones isn't available in the user's country", () => {
  setMockRuntimeDataOnce({
    ...getMockRuntimeDataWithoutPremium(),
    WAFFLE_FLAGS: [["phones", true]],
  });

  render(<Faq />);

  const phoneQuestion = screen.queryByRole("heading", {
    name: "l10n string: [phone-masking-faq-question-what-is], with vars: {}",
  });

  expect(phoneQuestion).not.toBeInTheDocument();
});
