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

  it("renders the trigger button", () => {
    render(
      <AliasDeletionButtonPermanent alias={makeAlias()} onDelete={jest.fn()} />,
    );
    expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument();
  });

  it("opens the confirmation modal and shows alias and warnings", async () => {
    render(
      <AliasDeletionButtonPermanent alias={makeAlias()} onDelete={jest.fn()} />,
    );

    await userEvent.click(screen.getByRole("button", { name: /delete/i }));

    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByRole("heading", { name: /delete this mask\?/i }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText("mask-123@example.com"),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(/this action is permanent/i),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(/sign-ins will break/i),
    ).toBeInTheDocument();
    expect(within(dialog).getByTestId("error-icon")).toBeInTheDocument();
  });

  it("closes the modal when Cancel is clicked", async () => {
    render(
      <AliasDeletionButtonPermanent alias={makeAlias()} onDelete={jest.fn()} />,
    );

    await userEvent.click(screen.getByRole("button", { name: /delete/i }));
    const dialog = await screen.findByRole("dialog");
    const cancelBtn = within(dialog).getByRole("button", { name: /cancel/i });
    await userEvent.click(cancelBtn);

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("calls onDelete and closes the modal when Delete is confirmed", async () => {
    const onDelete = jest.fn();
    render(
      <AliasDeletionButtonPermanent alias={makeAlias()} onDelete={onDelete} />,
    );

    await userEvent.click(screen.getByRole("button", { name: /delete/i }));
    const dialog = await screen.findByRole("dialog");
    const confirmBtn = within(dialog).getByRole("button", {
      name: /^delete$/i,
    });
    await userEvent.click(confirmBtn);

    expect(onDelete).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("reports modal open and close via setModalOpenedState", async () => {
    const setModalOpenedState = jest.fn();
    render(
      <AliasDeletionButtonPermanent
        alias={makeAlias()}
        onDelete={jest.fn()}
        setModalOpenedState={setModalOpenedState}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /delete/i }));
    await screen.findByRole("dialog");
    expect(setModalOpenedState).toHaveBeenLastCalledWith(true);

    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: /cancel/i,
      }),
    );
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(setModalOpenedState).toHaveBeenLastCalledWith(false);
  });
});
