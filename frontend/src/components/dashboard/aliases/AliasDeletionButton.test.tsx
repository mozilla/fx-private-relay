import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { mockConfigModule } from "../../../../__mocks__/configMock";
import { mockLocalizedModule } from "../../../../__mocks__/components/Localized";
import { getMockRandomAlias } from "../../../../__mocks__/hooks/api/aliases";
import { mockUseL10nModule } from "../../../../__mocks__/hooks/l10n";

import { AliasDeletionButton } from "./AliasDeletionButton";

jest.mock("../../../config.ts", () => mockConfigModule);
jest.mock("../../../hooks/gaViewPing.ts");
jest.mock("../../../hooks/l10n.ts", () => mockUseL10nModule);
jest.mock("../../../components/Localized.tsx", () => mockLocalizedModule);

describe("<AliasDeletionButton>", () => {
  it("displays a usable button to delete an alias", () => {
    render(
      <AliasDeletionButton alias={getMockRandomAlias()} onDelete={jest.fn()} />,
    );

    const button = screen.getByRole("button", {
      name: "l10n string: [profile-label-delete], with vars: {}",
      hidden: false,
    });

    expect(button).toBeInTheDocument();
  });

  it("displays a confirmation prompt, with an unchecked checkbox and a disabled button", async () => {
    render(
      <AliasDeletionButton alias={getMockRandomAlias()} onDelete={jest.fn()} />,
    );

    const button = screen.getByRole("button", {
      name: "l10n string: [profile-label-delete], with vars: {}",
      hidden: false,
    });

    await userEvent.click(button);

    const prompt = screen.getByRole("dialog");
    const promptCheckbox = within(prompt).getByRole("checkbox");
    const promptButton = within(prompt).getByRole("button", {
      name: "l10n string: [profile-label-delete], with vars: {}",
    });

    expect(promptCheckbox).not.toBeChecked();
    expect(promptButton).toBeDisabled();
  });

  it("enables the delete button on the confirmation prompt, once the checkbox is checked", async () => {
    render(
      <AliasDeletionButton alias={getMockRandomAlias()} onDelete={jest.fn()} />,
    );

    const button = screen.getByRole("button", {
      name: "l10n string: [profile-label-delete], with vars: {}",
    });

    await userEvent.click(button);

    const prompt = screen.getByRole("dialog");
    const promptCheckbox = screen.getByRole("checkbox");
    const promptButton = within(prompt).getByRole("button", {
      name: "l10n string: [profile-label-delete], with vars: {}",
    });

    await userEvent.click(promptCheckbox);

    expect(promptCheckbox).toBeChecked();
    expect(promptButton).toBeEnabled();
  });

  it("resets the inputs on the confirmation prompt when reopened, after clicking the Cancel button", async () => {
    render(
      <AliasDeletionButton alias={getMockRandomAlias()} onDelete={jest.fn()} />,
    );

    const button = screen.getByRole("button", {
      name: "l10n string: [profile-label-delete], with vars: {}",
    });

    await userEvent.click(button);

    const firstPrompt = screen.getByRole("dialog");
    const firstPromptCheckbox = within(firstPrompt).getByRole("checkbox");
    const firstPromptCancelButton = within(firstPrompt).getByRole("button", {
      name: "l10n string: [profile-label-cancel], with vars: {}",
    });

    // Click confirmation checkbox on modal
    await userEvent.click(firstPromptCheckbox);
    // Click cancel button to dismiss modal
    await userEvent.click(firstPromptCancelButton);
    // Click delete button again
    await userEvent.click(button);

    const secondPrompt = screen.getByRole("dialog");
    const secondPromptDeleteButton = within(secondPrompt).getByRole("button", {
      name: "l10n string: [profile-label-delete], with vars: {}",
    });
    const secondPromptCheckbox = within(secondPrompt).getByRole("checkbox");

    expect(secondPromptCheckbox).not.toBeChecked();
    expect(secondPromptDeleteButton).toBeDisabled();
  });

  it("resets the inputs on the confirmation prompt when reopened, after clicking off the propmt", async () => {
    render(
      <AliasDeletionButton alias={getMockRandomAlias()} onDelete={jest.fn()} />,
    );

    const button = screen.getByRole("button", {
      name: "l10n string: [profile-label-delete], with vars: {}",
    });

    await userEvent.click(button);

    const firstPrompt = screen.getByRole("dialog");
    const firstPromptCheckbox = within(firstPrompt).getByRole("checkbox");

    // Click confirmation checkbox on modal
    await userEvent.click(firstPromptCheckbox);
    // Click outside modal to dismiss modal
    await userEvent.click(document.body);
    // Click delete button again
    await userEvent.click(button);

    const secondPrompt = screen.getByRole("dialog");
    const secondPromptDeleteButton = within(secondPrompt).getByRole("button", {
      name: "l10n string: [profile-label-delete], with vars: {}",
    });
    const secondPromptCheckbox = within(secondPrompt).getByRole("checkbox");

    expect(secondPromptCheckbox).not.toBeChecked();
    expect(secondPromptDeleteButton).toBeDisabled();
  });
});
