import { act, render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { mockConfigModule } from "../../__mocks__/configMock";
import { setMockInboundContactData } from "../../__mocks__/hooks/api/inboundContact";
import {
  setMockProfileData,
  setMockProfileDataOnce,
} from "../../__mocks__/hooks/api/profile";
import {
  getMockVerifiedRealPhone,
  setMockRealPhonesData,
} from "../../__mocks__/hooks/api/realPhone";
import {
  getMockRelayNumber,
  setMockRelayNumberData,
  setMockRelayNumberDataOnce,
} from "../../__mocks__/hooks/api/relayNumber";
import {
  getMockRuntimeDataWithPeriodicalPremium,
  setMockRuntimeData,
  setMockRuntimeDataOnce,
} from "../../__mocks__/hooks/api/runtimeData";
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
setMockRuntimeData();

describe("The Phone dashboard", () => {
  describe("when onboarding", () => {
    beforeEach(() => {
      setMockRelayNumberData([]);
      setMockRealPhonesData([]);
    });

    describe("under axe accessibility testing", () => {
      it("passes axe accessibility testing", async () => {
        setMockRuntimeDataOnce();

        const { baseElement } = render(<PhoneDashboard />);

        let results;
        await act(async () => {
          results = await axe(baseElement);
        });

        expect(results).toHaveNoViolations();
      }, 10000); // axe runs a suite of tests that can exceed the default 5s timeout, so we set it to 10s
    });

    it("redirects the user to /premium if they have not subscribed to the phone plan and it is not available in their current location", async () => {
      setMockRuntimeDataOnce(getMockRuntimeDataWithPeriodicalPremium());
      setMockProfileDataOnce({ has_phone: false });
      const mockedNextRouterModule = jest.requireMock("next/router");
      const mockedPush = jest.fn();
      mockedNextRouterModule.useRouter = jest.fn(() => ({ push: mockedPush }));
      expect(mockedPush).not.toHaveBeenCalled();

      render(<PhoneDashboard />);

      expect(mockedPush).toHaveBeenCalledWith("/premium");
    });

    it("redirects the user to /premium if they have not set up a Relay number yet and the phone plan is not available in their current location", async () => {
      setMockRuntimeDataOnce(getMockRuntimeDataWithPeriodicalPremium());
      setMockProfileDataOnce({ has_phone: true });
      setMockRelayNumberDataOnce([]);
      const mockedNextRouterModule = jest.requireMock("next/router");
      const mockedPush = jest.fn();
      mockedNextRouterModule.useRouter = jest.fn(() => ({ push: mockedPush }));
      expect(mockedPush).not.toHaveBeenCalled();

      render(<PhoneDashboard />);

      expect(mockedPush).toHaveBeenCalledWith("/premium");
    });
  });

  describe("with an initialised account", () => {
    beforeEach(() => {
      setMockRelayNumberData([getMockRelayNumber()]);
      setMockRealPhonesData([getMockVerifiedRealPhone()]);
      setMockInboundContactData();
      setMockProfileData({ has_phone: true });
    });

    describe("under axe accessibility testing", () => {
      it("passes axe accessibility testing", async () => {
        setMockRuntimeDataOnce();

        const { baseElement } = render(<PhoneDashboard />);

        let results;
        await act(async () => {
          results = await axe(baseElement);
        });

        expect(results).toHaveNoViolations();
      }, 10000); // axe runs a suite of tests that can exceed the default 5s timeout, so we set it to 10s
    });

    it("shows the dashboard even if the phone plan isn't available in the user's current location", () => {
      setMockRuntimeDataOnce(getMockRuntimeDataWithPeriodicalPremium());

      render(<PhoneDashboard />);

      const shownPhoneNumbers = screen.getAllByText(/\+1/);

      // The Relay number and the real number should be shown
      expect(shownPhoneNumbers).toHaveLength(2);
      expect(shownPhoneNumbers[0]).toBeInTheDocument();
      expect(shownPhoneNumbers[1]).toBeInTheDocument();
    });
  });
});
