import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { mockConfigModule } from "../../../../__mocks__/configMock";
import { mockLocalizedModule } from "../../../../__mocks__/components/Localized";
import { getMockRandomAlias } from "../../../../__mocks__/hooks/api/aliases";
import { mockUseL10nModule } from "../../../../__mocks__/hooks/l10n";

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

  it("displays a usable button to delete an alias", () => {
    render(
      <AliasDeletionButton alias={getMockRandomAlias()} onDelete={jest.fn()} />,
    );

    const button = screen.getByRole("button", {
      name: openLabel,
      hidden: false,
    });
    expect(button).toBeInTheDocument();
  });

  it("displays a confirmation prompt, with an unchecked checkbox and a disabled button", async () => {
    render(
      <AliasDeletionButton alias={getMockRandomAlias()} onDelete={jest.fn()} />,
    );

    const button = screen.getByRole("button", {
      name: openLabel,
      hidden: false,
    });
    await userEvent.click(button);

    const prompt = screen.getByRole("dialog");
    const promptCheckbox = within(prompt).getByRole("checkbox");
    const promptButton = within(prompt).getByRole("button", {
      name: openLabel,
    });

    expect(promptCheckbox).not.toBeChecked();
    expect(promptButton).toBeDisabled();
  });

  it("enables the delete button on the confirmation prompt, once the checkbox is checked", async () => {
    render(
      <AliasDeletionButton alias={getMockRandomAlias()} onDelete={jest.fn()} />,
    );

    await userEvent.click(screen.getByRole("button", { name: openLabel }));
    const prompt = screen.getByRole("dialog");
    const promptCheckbox = within(prompt).getByRole("checkbox");
    const promptButton = within(prompt).getByRole("button", {
      name: openLabel,
    });

    await userEvent.click(promptCheckbox);

    expect(promptCheckbox).toBeChecked();
    expect(promptButton).toBeEnabled();
  });

  it("resets the inputs on the confirmation prompt when reopened, after clicking the Cancel button", async () => {
    render(
      <AliasDeletionButton alias={getMockRandomAlias()} onDelete={jest.fn()} />,
    );

    const trigger = screen.getByRole("button", { name: openLabel });

    await userEvent.click(trigger);

    const firstPrompt = screen.getByRole("dialog");
    const firstPromptCheckbox = within(firstPrompt).getByRole("checkbox");
    const firstPromptCancelButton = within(firstPrompt).getByRole("button", {
      name: cancelLabel,
    });

    await userEvent.click(firstPromptCheckbox);
    await userEvent.click(firstPromptCancelButton);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());

    await userEvent.click(trigger);

    const secondPrompt = screen.getByRole("dialog");
    const secondPromptDeleteButton = within(secondPrompt).getByRole("button", {
      name: openLabel,
    });
    const secondPromptCheckbox = within(secondPrompt).getByRole("checkbox");

    expect(secondPromptCheckbox).not.toBeChecked();
    expect(secondPromptDeleteButton).toBeDisabled();
  });

  it("resets the inputs on the confirmation prompt when reopened, after clicking off the prompt", async () => {
    render(
      <AliasDeletionButton alias={getMockRandomAlias()} onDelete={jest.fn()} />,
    );

    const trigger = screen.getByRole("button", { name: openLabel });
    await userEvent.click(trigger);

    const firstPrompt = screen.getByRole("dialog");
    const firstPromptCheckbox = within(firstPrompt).getByRole("checkbox");

    await userEvent.click(firstPromptCheckbox);
    await userEvent.click(document.body);

    await userEvent.click(trigger);

    const secondPrompt = screen.getByRole("dialog");
    const secondPromptDeleteButton = within(secondPrompt).getByRole("button", {
      name: openLabel,
    });
    const secondPromptCheckbox = within(secondPrompt).getByRole("checkbox");

    expect(secondPromptCheckbox).not.toBeChecked();
    expect(secondPromptDeleteButton).toBeDisabled();
  });

  it("closes the dialog when pressing Escape", async () => {
    render(
      <AliasDeletionButton alias={getMockRandomAlias()} onDelete={jest.fn()} />,
    );

    await userEvent.click(screen.getByRole("button", { name: openLabel }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("calls onDelete and closes when the form is submitted after confirming", async () => {
    const onDelete = jest.fn();
    render(
      <AliasDeletionButton alias={getMockRandomAlias()} onDelete={onDelete} />,
    );

    await userEvent.click(screen.getByRole("button", { name: openLabel }));

    const prompt = screen.getByRole("dialog");
    const checkbox = within(prompt).getByRole("checkbox");
    const submit = within(prompt).getByRole("button", { name: openLabel });

    expect(submit).toBeDisabled();

    await userEvent.click(checkbox);
    expect(submit).toBeEnabled();

    await userEvent.click(submit);

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders the modal title and the confirmation copy", async () => {
    render(
      <AliasDeletionButton alias={getMockRandomAlias()} onDelete={jest.fn()} />,
    );

    await userEvent.click(screen.getByRole("button", { name: openLabel }));

    const heading = screen.getByRole("heading", { level: 3, name: titleLabel });
    expect(heading).toBeInTheDocument();

    expect(screen.getByText(confirmLabel)).toBeInTheDocument();
  });

  it("shows the address from getFullAddress inside <samp> and uses the 'random' usage warning by default", async () => {
    jest.spyOn(aliasApi, "getFullAddress").mockReturnValue("mask@relay.test");

    render(
      <AliasDeletionButton alias={getMockRandomAlias()} onDelete={jest.fn()} />,
    );

    await userEvent.click(screen.getByRole("button", { name: openLabel }));

    expect(screen.getByText("mask@relay.test")).toBeInTheDocument();

    expect(screen.getByText(usageRandomLabel)).toBeInTheDocument();
  });

  it("uses the domain-address usage warning when isRandomAlias is false", async () => {
    jest.spyOn(aliasApi, "isRandomAlias").mockReturnValue(false);
    jest.spyOn(aliasApi, "getFullAddress").mockReturnValue("custom@you.test");

    render(
      // @ts-expect-error: we stub out behavior, so the concrete fields aren't needed
      <AliasDeletionButton alias={{}} onDelete={jest.fn()} />,
    );

    await userEvent.click(screen.getByRole("button", { name: openLabel }));

    expect(screen.getByText("custom@you.test")).toBeInTheDocument();
    expect(screen.getByText(usageCustomLabel)).toBeInTheDocument();
  });
});
