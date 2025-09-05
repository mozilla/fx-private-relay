import React from "react";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AliasDeletionButtonPermanent } from "./AliasDeletionButtonPermanent";
import type { AliasData } from "../../../hooks/api/aliases";

jest.mock("./AliasDeletionButtonPermanent.module.scss", () => {
  const proxy = new Proxy({}, { get: (_t, p) => String(p) });
  return proxy;
});

jest.mock("../../Button", () => ({
  Button: ({
    children,
    ...rest
  }: React.PropsWithChildren<Record<string, unknown>>) => (
    <button {...rest}>{children}</button>
  ),
}));

jest.mock("../../Icons", () => ({
  ErrorTriangleIcon: (props: Record<string, unknown>) => (
    <span data-testid="error-icon" {...props} />
  ),
}));

const STRINGS: Record<string, string> = {
  "profile-label-delete": "Delete",
  "profile-label-cancel": "Cancel",
  "mask-deletion-header": "Delete this mask?",
  "mask-deletion-warning-no-recovery":
    "This action is permanent. You can’t recover this mask.",
  "mask-deletion-warning-sign-ins":
    "If you use this mask to sign in anywhere, those sign-ins will break.",
};

jest.mock("../../../hooks/l10n", () => ({
  useL10n: () => ({
    getString: (id: string) => STRINGS[id] ?? id,
  }),
}));

jest.mock("../../../hooks/api/aliases", () => {
  const actual = jest.requireActual("../../../hooks/api/aliases");
  return {
    ...actual,
    getFullAddress: jest.fn(() => "mask-123@example.com"),
  };
});

describe("AliasDeletionButtonPermanent", () => {
  const makeAlias = (): AliasData => ({}) as AliasData;

  const makeProps = (
    overrides?: Partial<
      React.ComponentProps<typeof AliasDeletionButtonPermanent>
    >,
  ): React.ComponentProps<typeof AliasDeletionButtonPermanent> => ({
    alias: makeAlias(),
    onDelete: jest.fn(),
    ...(overrides ?? {}),
  });

  const setup = (
    overrides?: Partial<
      React.ComponentProps<typeof AliasDeletionButtonPermanent>
    >,
  ) => {
    const props = makeProps(overrides);
    render(<AliasDeletionButtonPermanent {...props} />);

    const getTrigger = () =>
      screen.getByRole("button", { name: STRINGS["profile-label-delete"] });
    const open = async () => {
      await userEvent.click(getTrigger());
      return screen.findByRole("dialog");
    };
    const getDialog = () => screen.getByRole("dialog");
    const getCancelButton = () =>
      within(getDialog()).getByRole("button", {
        name: STRINGS["profile-label-cancel"],
      });
    const getConfirmButton = () =>
      within(getDialog()).getByRole("button", {
        name: STRINGS["profile-label-delete"],
      });

    return {
      props,
      getTrigger,
      open,
      getDialog,
      getCancelButton,
      getConfirmButton,
    };
  };

  it("renders the trigger button", () => {
    const { getTrigger } = setup();
    expect(getTrigger()).toBeInTheDocument();
  });

  it("opens the confirmation modal and shows alias and warnings", async () => {
    const { open, getDialog } = setup();

    await open();

    const dialog = getDialog();

    expect(
      within(dialog).getByRole("heading", {
        name: STRINGS["mask-deletion-header"],
      }),
    ).toBeInTheDocument();

    expect(
      within(dialog).getByText("mask-123@example.com"),
    ).toBeInTheDocument();

    expect(
      within(dialog).getByText(STRINGS["mask-deletion-warning-no-recovery"]),
    ).toBeInTheDocument();

    expect(
      within(dialog).getByText(STRINGS["mask-deletion-warning-sign-ins"]),
    ).toBeInTheDocument();

    expect(within(dialog).getByTestId("error-icon")).toBeInTheDocument();
  });

  it("closes the modal when Cancel is clicked", async () => {
    const { open, getCancelButton } = setup();

    await open();
    await userEvent.click(getCancelButton());

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("calls onDelete and closes the modal when Delete is confirmed", async () => {
    const onDelete = jest.fn();
    const { open, getConfirmButton } = setup({ onDelete });

    await open();
    await userEvent.click(getConfirmButton());

    expect(onDelete).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("reports modal open and close via setModalOpenedState", async () => {
    const setModalOpenedState = jest.fn();
    const { open, getCancelButton } = setup({ setModalOpenedState });

    await open();
    expect(setModalOpenedState).toHaveBeenLastCalledWith(true);

    await userEvent.click(getCancelButton());
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(setModalOpenedState).toHaveBeenLastCalledWith(false);
  });
});
