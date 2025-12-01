import { render, screen } from "@testing-library/react";

jest.mock("../../components/layout/Layout", () => ({
  Layout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="mock-layout">{children}</div>
  ),
}));

import AccountInactive from "./account_inactive.page";

describe("AccountInactive page", () => {
  it("renders the inactive account error message", () => {
    render(<AccountInactive />);

    expect(
      screen.getByText(
        "l10n string: [api-error-account-is-inactive], with vars: {}",
      ),
    ).toBeInTheDocument();

    expect(screen.getByTestId("mock-layout")).toBeInTheDocument();
  });
});
