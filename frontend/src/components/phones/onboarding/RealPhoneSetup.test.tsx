import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { RealPhoneSetup } from "./RealPhoneSetup";
import {
  mockedRuntimeData,
  mockedRealphones,
} from "frontend/src/apiMocks/mockData";
import { UnverifiedPhone } from "../../../hooks/api/realPhone";
import React from "react";

jest.mock("../../../hooks/l10n", () => ({
  useL10n: () => ({
    getString: (id: string) => id,
  }),
}));

jest.mock("../../Localized", () => ({
  Localized: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

jest.mock("../../../hooks/api/realPhone", () => {
  const actual = jest.requireActual("../../../hooks/api/realPhone");
  return {
    ...actual,
    useRealPhonesData: () => ({ data: [] }),
  };
});

describe("RealPhoneSetup", () => {
  const onRequestVerification = jest.fn(() =>
    Promise.resolve({ status: 201, ok: true } as Response),
  );
  const onRequestPhoneRemoval = jest.fn(() =>
    Promise.resolve({ status: 204, ok: true } as Response),
  );
  const onSubmitVerification = jest.fn(() =>
    Promise.resolve({ status: 200, ok: true } as Response),
  );

  const baseProps = {
    runtimeData: mockedRuntimeData,
    onRequestVerification,
    onRequestPhoneRemoval,
    onSubmitVerification,
  };

  it("renders RealPhoneForm when no phonesPendingVerification", () => {
    render(<RealPhoneSetup {...baseProps} unverifiedRealPhones={[]} />);

    expect(
      screen.getByText(/phone-onboarding-step2-headline/),
    ).toBeInTheDocument();
  });

  it("submits phone number for verification", async () => {
    render(<RealPhoneSetup {...baseProps} unverifiedRealPhones={[]} />);

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "4155552671" } });

    const submit = screen.getByRole("button", {
      name: /phone-onboarding-step2-button-cta/,
    });

    fireEvent.click(submit);

    await waitFor(() => {
      expect(onRequestVerification).toHaveBeenCalled();
    });
  });

  it("renders RealPhoneVerification when phones are pending verification", () => {
    const recentPhone: UnverifiedPhone = {
      ...mockedRealphones.full[0],
      verified: false,
      verified_date: null,
      verification_sent_date: new Date().toISOString(),
    };

    render(
      <RealPhoneSetup {...baseProps} unverifiedRealPhones={[recentPhone]} />,
    );

    expect(
      screen.getByText(/phone-onboarding-step2-headline/),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: /phone-onboarding-step3-button-cta/,
      }),
    ).toBeInTheDocument();
  });
});
