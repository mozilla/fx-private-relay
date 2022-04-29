import React from "react";
import { act, render } from "@testing-library/react";
import { axe } from "jest-axe";
import { mockFluentReact } from "../../../__mocks__/modules/fluent__react";
import { mockNextRouter } from "../../../__mocks__/modules/next__router";
import { mockConfigModule } from "../../../__mocks__/configMock";

import PremiumWaitlist from "./waitlist.page";

jest.mock("@fluent/react", () => mockFluentReact);
jest.mock("next/router", () => mockNextRouter);
jest.mock("../../config.ts", () => mockConfigModule);
jest.mock("../../hooks/gaViewPing.ts");

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
});
