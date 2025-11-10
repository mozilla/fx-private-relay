import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { mockConfigModule } from "../../../../__mocks__/configMock";
import { mockUseL10nModule } from "../../../../__mocks__/hooks/l10n";
import { mockLocalizedModule } from "../../../../__mocks__/components/Localized";
import { getMockRandomAlias } from "../../../../__mocks__/hooks/api/aliases";

import * as aliasApi from "../../../hooks/api/aliases";
import { AliasDeletionButton } from "./AliasDeletionButton";

jest.mock("../../../config.ts", () => mockConfigModule);
jest.mock("../../../hooks/gaViewPing.ts");
jest.mock("../../../hooks/l10n.ts", () => mockUseL10nModule);
jest.mock("../../../components/Localized.tsx", () => mockLocalizedModule);

describe("<AliasDeletionButton>", () => {
  const openLabel = "l10n string: [profile-label-delete], with vars: {}";
  const cancelLabel = "l10n string: [profile-label-cancel], with vars: {}";
  const confirmLabel =
    "l10n string: [modal-delete-confirmation-2], with vars: {}";
  const titleLabel = "l10n string: [modal-delete-headline-2], with vars: {}";
  const usageRandomLabel =
    "l10n string: [modal-delete-warning-upgrade-2], with vars: {}";
  const usageCustomLabel =
    "l10n string: [modal-delete-domain-address-warning-upgrade-2], with vars: {}";

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  const setup = (
    overrides?: Partial<React.ComponentProps<typeof AliasDeletionButton>>,
  ) => {
    const onDelete = jest.fn();
    const props: React.ComponentProps<typeof AliasDeletionButton> = {
      alias: getMockRandomAlias(),
      onDelete,
      ...(overrides ?? {}),
    };

    render(<AliasDeletionButton {...props} />);

    const getTrigger = () => screen.getByRole("button", { name: openLabel });

    const open = async () => {
      await userEvent.click(getTrigger());
      return screen.getByRole("dialog");
    };

    const getPrompt = () => screen.getByRole("dialog");
    const getCheckbox = () => within(getPrompt()).getByRole("checkbox");
    const getDeleteButton = () =>
      within(getPrompt()).getByRole("button", { name: openLabel });
    const getCancelButton = () =>
      within(getPrompt()).getByRole("button", { name: cancelLabel });

    return {
      onDelete,
      getTrigger,
      open,
      getPrompt,
      getCheckbox,
      getDeleteButton,
      getCancelButton,
    };
  };

  it("displays a usable button to delete an alias", () => {
    const { getTrigger } = setup();
    expect(getTrigger()).toBeInTheDocument();
  });

  it("displays a confirmation prompt with an unchecked checkbox and a disabled delete button", async () => {
    const { open, getCheckbox, getDeleteButton } = setup();
    await open();

    expect(getCheckbox()).not.toBeChecked();
    expect(getDeleteButton()).toBeDisabled();
  });

  it("enables the delete button once the checkbox is checked", async () => {
    const { open, getCheckbox, getDeleteButton } = setup();
    await open();

    await userEvent.click(getCheckbox());

    expect(getCheckbox()).toBeChecked();
    expect(getDeleteButton()).toBeEnabled();
  });

  it("resets inputs when reopened after clicking the Cancel button", async () => {
    const { getTrigger, open, getCheckbox, getCancelButton } = setup();

    await open();
    await userEvent.click(getCheckbox());
    await userEvent.click(getCancelButton());

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => expect(getTrigger()).toHaveFocus());

    await userEvent.click(getTrigger());

    const secondCheckbox = within(screen.getByRole("dialog")).getByRole(
      "checkbox",
    );
    const secondDeleteButton = within(screen.getByRole("dialog")).getByRole(
      "button",
      { name: openLabel },
    );

    expect(secondCheckbox).not.toBeChecked();
    expect(secondDeleteButton).toBeDisabled();
  });

  it("resets inputs when reopened after clicking off the prompt", async () => {
    const { getTrigger, open } = setup();

    await open();
    const firstPrompt = screen.getByRole("dialog");
    await userEvent.click(within(firstPrompt).getByRole("checkbox"));
    await userEvent.click(document.body);

    await userEvent.click(getTrigger());

    const secondPrompt = screen.getByRole("dialog");
    const secondCheckbox = within(secondPrompt).getByRole("checkbox");
    const secondDeleteButton = within(secondPrompt).getByRole("button", {
      name: openLabel,
    });

    expect(secondCheckbox).not.toBeChecked();
    expect(secondDeleteButton).toBeDisabled();
  });

  it("closes the dialog when pressing Escape", async () => {
    const { open } = setup();
    await open();
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("calls onDelete and closes when the form is submitted after confirming", async () => {
    const { onDelete, open, getCheckbox, getDeleteButton } = setup();

    await open();

    expect(getDeleteButton()).toBeDisabled();

    await userEvent.click(getCheckbox());
    expect(getDeleteButton()).toBeEnabled();

    await userEvent.click(getDeleteButton());

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders the modal title and the confirmation copy", async () => {
    const { open } = setup();
    await open();

    expect(
      screen.getByRole("heading", { level: 3, name: titleLabel }),
    ).toBeInTheDocument();

    expect(screen.getByText(confirmLabel)).toBeInTheDocument();
  });

  it("shows the address from getFullAddress inside <samp> and uses the 'random' usage warning by default", async () => {
    jest.spyOn(aliasApi, "getFullAddress").mockReturnValue("mask@relay.test");

    const { open } = setup();
    await open();

    expect(screen.getByText("mask@relay.test")).toBeInTheDocument();
    expect(screen.getByText(usageRandomLabel)).toBeInTheDocument();
  });

  it("uses the domain-address usage warning when isRandomAlias is false", async () => {
    jest.spyOn(aliasApi, "isRandomAlias").mockReturnValue(false);
    jest.spyOn(aliasApi, "getFullAddress").mockReturnValue("custom@you.test");

    const { open } = setup({
      // @ts-expect-error: stubbing behavior only; concrete alias fields not needed for this branch
      alias: {},
    });
    await open();

    expect(screen.getByText("custom@you.test")).toBeInTheDocument();
    expect(screen.getByText(usageCustomLabel)).toBeInTheDocument();
  });
});
