import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReactNode } from "react";
import { SubdomainConfirmationForm, Props } from "./ConfirmationForm";

jest.mock("./ConfirmationForm.module.scss", () => ({
  "permanence-warning": "permanence-warning",
  confirm: "confirm",
  buttons: "buttons",
  "cancel-button": "cancel-button",
  subdomain: "subdomain",
}));

jest.mock("../../Button", () => ({
  Button: ({
    children,
    ...rest
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    children: ReactNode;
  }) => <button {...rest}>{children}</button>,
}));

jest.mock("../../../hooks/l10n", () => {
  const { mockUseL10nModule } = jest.requireActual(
    "../../../../__mocks__/hooks/l10n",
  );
  return mockUseL10nModule;
});

jest.mock("../../Localized.tsx");

import { byMsgIdName } from "../../../../__mocks__/hooks/l10n";

describe("SubdomainConfirmationForm", () => {
  const mockOnConfirm = jest.fn();
  const mockOnCancel = jest.fn();
  const defaultProps: Props = {
    subdomain: "my-subdomain",
    onConfirm: mockOnConfirm,
    onCancel: mockOnCancel,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders warning text and checkbox label", () => {
    render(<SubdomainConfirmationForm {...defaultProps} />);
    expect(
      screen.getByText(
        /\[<Localized> with id \[modal-email-domain-available-body\] and vars:/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /\[<Localized> with id \[modal-domain-register-confirmation-checkbox-2\] and vars:/,
      ),
    ).toBeInTheDocument();
  });

  it("gates submission on the checkbox and then calls onConfirm once checked and submitted", async () => {
    const user = userEvent.setup();
    render(<SubdomainConfirmationForm {...defaultProps} />);

    const submitButton = screen.getByRole("button", {
      name: byMsgIdName("modal-email-domain-register"),
    });
    expect(submitButton).toBeDisabled();

    const checkbox = screen.getByRole("checkbox", {
      name: byMsgIdName("modal-domain-register-confirmation-checkbox-2"),
    });
    await user.click(checkbox);

    expect(submitButton).toBeEnabled();

    await user.click(submitButton);
    expect(mockOnConfirm).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when cancel button is clicked", async () => {
    const user = userEvent.setup();
    render(<SubdomainConfirmationForm {...defaultProps} />);
    const cancelButton = screen.getByRole("button", {
      name: byMsgIdName("modal-email-domain-cancel"),
    });
    await user.click(cancelButton);
    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  it("passes subdomain to Localized for checkbox label", () => {
    render(<SubdomainConfirmationForm {...defaultProps} />);
    const checkboxLabelNode = screen.getByText(
      /\[<Localized> with id \[modal-domain-register-confirmation-checkbox-2\] and vars:/,
    );
    expect(checkboxLabelNode).toHaveTextContent("my-subdomain");
  });
});
