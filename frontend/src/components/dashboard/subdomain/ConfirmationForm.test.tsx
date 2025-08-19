import { render, screen, fireEvent } from "@testing-library/react";
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

const mockGetString = jest.fn((id: string) => id);
jest.mock("../../../hooks/l10n", () => ({
  useL10n: () => ({ getString: mockGetString }),
}));

interface LocalizedProps {
  id: string;
  vars?: Record<string, string>;
  elems?: Record<string, ReactNode>;
  children?: ReactNode;
}
jest.mock("../../Localized", () => ({
  Localized: ({ id, vars }: LocalizedProps) => {
    const text = id + (vars && vars.subdomain ? ` ${vars.subdomain}` : "");
    return <span data-testid={id}>{text}</span>;
  },
}));

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
      screen.getByTestId("modal-email-domain-available-body"),
    ).toBeInTheDocument();

    expect(
      screen.getByTestId("modal-domain-register-confirmation-checkbox-2"),
    ).toBeInTheDocument();
  });

  it("disables submit button until checkbox is checked", () => {
    render(<SubdomainConfirmationForm {...defaultProps} />);

    const submitButton = screen.getByRole("button", {
      name: "modal-email-domain-register",
    });
    expect(submitButton).toBeDisabled();

    const checkbox = screen.getByRole("checkbox", {
      name: /modal-domain-register-confirmation-checkbox-2/i,
    });
    fireEvent.click(checkbox);

    expect(submitButton).toBeEnabled();
  });

  it("calls onConfirm when form is submitted with checkbox checked", () => {
    render(<SubdomainConfirmationForm {...defaultProps} />);

    const checkbox = screen.getByRole("checkbox", {
      name: /modal-domain-register-confirmation-checkbox-2/i,
    });
    fireEvent.click(checkbox);

    const submitButton = screen.getByRole("button", {
      name: "modal-email-domain-register",
    });
    fireEvent.click(submitButton);

    expect(mockOnConfirm).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when cancel button is clicked", () => {
    render(<SubdomainConfirmationForm {...defaultProps} />);

    const cancelButton = screen.getByRole("button", {
      name: "modal-email-domain-cancel",
    });
    fireEvent.click(cancelButton);

    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  it("passes subdomain variable to Localized for checkbox label", () => {
    render(<SubdomainConfirmationForm {...defaultProps} />);

    const checkboxLabelNode = screen.getByTestId(
      "modal-domain-register-confirmation-checkbox-2",
    );
    expect(checkboxLabelNode).toHaveTextContent("my-subdomain");
  });
});
