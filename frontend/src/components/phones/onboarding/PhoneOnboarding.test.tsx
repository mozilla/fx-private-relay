import { render, screen } from "@testing-library/react";
import { PhoneOnboarding } from "./PhoneOnboarding";
import * as realPhoneHook from "../../../hooks/api/realPhone";
import {
  mockedProfiles,
  mockedRuntimeData,
  mockedRealphones,
} from "frontend/__mocks__/api/mockData";
import { RuntimeDataWithPhonesAvailable } from "../../../functions/getPlan";

jest.mock("../../../hooks/api/realPhone");

const mockUseRealPhonesData =
  realPhoneHook.useRealPhonesData as unknown as jest.Mock;

const l10nMock = {
  bundles: [{ locales: ["en"] }],
  getString: jest.fn((key, vars) =>
    vars
      ? `l10n string: [${key}], with vars: ${JSON.stringify(vars)}`
      : `l10n string: [${key}], with vars: {}`,
  ),
  getFragment: jest.fn((key) => `l10n fragment: [${key}]`),
};

const renderComponent = (profileKey: keyof typeof mockedProfiles) =>
  render(
    <PhoneOnboarding
      onComplete={jest.fn()}
      profile={mockedProfiles[profileKey]}
      runtimeData={mockedRuntimeData as RuntimeDataWithPhonesAvailable}
    />,
  );

describe("PhoneOnboarding", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.useL10nImpl = () => l10nMock;
  });

  it("renders nothing if realPhoneData is undefined", () => {
    mockUseRealPhonesData.mockReturnValue({ data: undefined });

    const { container } = renderComponent("empty");

    expect(container).toBeEmptyDOMElement();
  });

  it("renders RealPhoneSetup if no verified phones", async () => {
    mockUseRealPhonesData.mockReturnValue({
      data: mockedRealphones.empty,
      error: null,
      requestPhoneVerification: jest.fn(),
      requestPhoneRemoval: jest.fn(),
      submitPhoneVerification: jest.fn(),
    });

    renderComponent("empty");

    expect(
      await screen.findByText((text) =>
        text.includes("phone-onboarding-step2-headline"),
      ),
    ).toBeInTheDocument();
  });

  it("renders RealPhoneSetup if realPhoneData has error", async () => {
    mockUseRealPhonesData.mockReturnValue({
      data: [],
      error: true,
      requestPhoneVerification: jest.fn(),
      requestPhoneRemoval: jest.fn(),
      submitPhoneVerification: jest.fn(),
    });

    renderComponent("empty");

    expect(
      await screen.findByText((text) =>
        text.includes("phone-onboarding-step2-headline"),
      ),
    ).toBeInTheDocument();
  });

  it("renders RelayNumberIntro if there are verified phones", async () => {
    mockUseRealPhonesData.mockReturnValue({
      data: mockedRealphones.full as realPhoneHook.VerifiedPhone[],
      error: null,
    });

    renderComponent("full");

    expect(
      await screen.findByTestId("relay-number-intro-cta"),
    ).toBeInTheDocument();
  });
});
