import { render, screen } from "@testing-library/react";

jest.mock("../../components/layout/Layout", () => ({
  Layout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="mock-layout">{children}</div>
  ),
}));

jest.mock("../../hooks/l10n", () => ({
  useL10n: () => ({
    getString: (id: string) =>
      id === "api-error-account-is-inactive" ? "Your account is inactive." : id,
  }),
}));

import AccountInactive from "./account_inactive.page";

describe("AccountInactive page", () => {
  it("renders the inactive account error message", () => {
    render(<AccountInactive />);
    expect(screen.getByText("Your account is inactive.")).toBeInTheDocument();
    expect(screen.getByTestId("mock-layout")).toBeInTheDocument();
  });
});
