import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Props } from "./Onboarding";
import type { AliasData } from "../../hooks/api/aliases";
import { Onboarding } from "./Onboarding";

describe("Onboarding", () => {
  const mockOnCreate = jest.fn();

  const defaultProps: Props = {
    aliases: [],
    onCreate: mockOnCreate,
  };

  it("renders onboarding steps when no aliases are present", () => {
    render(<Onboarding {...defaultProps} />);

    expect(
      screen.getByRole("heading", { level: 2, name: /onboarding-headline-2/ }),
    ).toBeInTheDocument();

    expect(screen.getAllByRole("listitem")).toHaveLength(3);

    expect(
      screen.getByRole("button", {
        name: /profile-label-generate-new-alias-2/,
      }),
    ).toBeInTheDocument();

    expect(screen.getAllByTestId("mocked-image")).toHaveLength(2);
  });

  it("does not render anything if aliases are present", () => {
    const mockAlias: AliasData = {
      id: 1,
      mask_type: "random",
      enabled: true,
      block_list_emails: false,
      block_level_one_trackers: false,
      description: "",
      address: "alias123",
      full_address: "alias123@relay.firefox.com",
      domain: 1,
      created_at: "2024-01-01T00:00:00Z",
      last_modified_at: "2024-01-02T00:00:00Z",
      last_used_at: null,
      num_forwarded: 0,
      num_blocked: 0,
      num_spam: 0,
      num_replied: 0,
      num_level_one_trackers_blocked: 0,
      used_on: "",
      generated_for: "",
    };

    render(<Onboarding {...defaultProps} aliases={[mockAlias]} />);
    expect(screen.queryByRole("heading", { level: 2 })).not.toBeInTheDocument();
  });

  it("calls onCreate when the button is clicked", async () => {
    const user = userEvent.setup();
    render(<Onboarding {...defaultProps} />);
    await user.click(
      screen.getByRole("button", {
        name: /profile-label-generate-new-alias-2/,
      }),
    );
    expect(mockOnCreate).toHaveBeenCalledTimes(1);
  });
});
