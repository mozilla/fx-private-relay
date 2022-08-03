import { act, render } from "@testing-library/react";
import { axe } from "jest-axe";
import { mockConfigModule } from "../../__mocks__/configMock";
import { setMockProfileData } from "../../__mocks__/hooks/api/profile";
import {
  getMockVerifiedRealPhone,
  setMockRealPhonesData,
} from "../../__mocks__/hooks/api/realPhone";
import {
  getMockRelayNumber,
  setMockRelayNumberData,
} from "../../__mocks__/hooks/api/relayNumber";
import { setMockUserData } from "../../__mocks__/hooks/api/user";
import { mockFluentReact } from "../../__mocks__/modules/fluent__react";
import { mockNextRouter } from "../../__mocks__/modules/next__router";
import { mockReactGa } from "../../__mocks__/modules/react-ga";

import PhoneDashboard from "./phone.page";

jest.mock("@fluent/react", () => mockFluentReact);
jest.mock("next/router", () => mockNextRouter);
jest.mock("react-ga", () => mockReactGa);
jest.mock("../config.ts", () => mockConfigModule);
jest.mock("../hooks/gaViewPing.ts");

setMockProfileData();
setMockUserData();

describe("The Phone dashboard", () => {
  describe("when onboarding", () => {
    beforeEach(() => {
      setMockRelayNumberData([]);
      setMockRealPhonesData([]);
    });

    describe("under axe accessibility testing", () => {
      it("passes axe accessibility testing", async () => {
        const { baseElement } = render(<PhoneDashboard />);

        let results;
        await act(async () => {
          results = await axe(baseElement);
        });

        expect(results).toHaveNoViolations();
      });
    });
  });

  describe("with an initialised account", () => {
    beforeEach(() => {
      setMockRelayNumberData([getMockRelayNumber()]);
      setMockRealPhonesData([getMockVerifiedRealPhone()]);
    });

    describe("under axe accessibility testing", () => {
      it("passes axe accessibility testing", async () => {
        const { baseElement } = render(<PhoneDashboard />);

        let results;
        await act(async () => {
          results = await axe(baseElement);
        });

        expect(results).toHaveNoViolations();
      });
    });
  });
});
