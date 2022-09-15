import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { mockConfigModule } from "../../../../__mocks__/configMock";
import { getMockRandomAlias } from "../../../../__mocks__/hooks/api/aliases";
import { getMockProfileData } from "../../../../__mocks__/hooks/api/profile";
import * as LocalLabelsMock from "../../../../__mocks__/hooks/localLabels";
import { mockFluentReact } from "../../../../__mocks__/modules/fluent__react";
import { AliasList } from "./AliasList";

jest.mock("@fluent/react", () => mockFluentReact);
jest.mock("../../../config.ts", () => mockConfigModule);
LocalLabelsMock.setMockLocalLabels();

describe("<AliasList>", () => {
  it("sends a request to the back-end to update the label if server-side label storage is enabled", async () => {
    const updateCallback = jest.fn();
    const storeLocalLabelCallback = jest.fn();
    LocalLabelsMock.setMockLocalLabelsOnce(
      LocalLabelsMock.getReturnValueWithoutAddon(storeLocalLabelCallback)
    );
    render(
      <AliasList
        aliases={[getMockRandomAlias()]}
        onUpdate={updateCallback}
        onCreate={jest.fn()}
        onDelete={jest.fn()}
        profile={getMockProfileData({ server_storage: true })}
        user={{ email: "arbitrary@example.com" }}
      />
    );

    const labelField = screen.getByRole("textbox");
    await userEvent.type(labelField, "Some label");
    await userEvent.tab();

    expect(updateCallback).toHaveBeenCalledWith(expect.anything(), {
      description: "Some label",
    });
    expect(storeLocalLabelCallback).not.toHaveBeenCalled();
  });

  it("does not send a request to the back-end to update the label if server-side label storage is not enabled", async () => {
    const updateCallback = jest.fn();
    const storeLocalLabelCallback = jest.fn();
    LocalLabelsMock.setMockLocalLabelsOnce(
      LocalLabelsMock.getReturnValueWithAddon([], storeLocalLabelCallback)
    );
    render(
      <AliasList
        aliases={[getMockRandomAlias()]}
        onUpdate={updateCallback}
        onCreate={jest.fn()}
        onDelete={jest.fn()}
        profile={getMockProfileData({ server_storage: false })}
        user={{ email: "arbitrary@example.com" }}
      />
    );

    const labelField = screen.getByRole("textbox");
    await userEvent.type(labelField, "Some label");
    await userEvent.tab();

    // The second argument is the list of updated fields;
    // this should be empty, because we don't want to store the label server-side.
    expect(updateCallback).toHaveBeenCalledWith(expect.anything(), {});
    expect(storeLocalLabelCallback).toHaveBeenCalledWith(
      expect.anything(),
      "Some label"
    );
  });

  it("sends a request to the back-end to update the label if server-side label storage is enabled, even if the add-on is present", async () => {
    const updateCallback = jest.fn();
    const storeLocalLabelCallback = jest.fn();
    LocalLabelsMock.setMockLocalLabelsOnce(
      LocalLabelsMock.getReturnValueWithAddon([], storeLocalLabelCallback)
    );
    render(
      <AliasList
        aliases={[getMockRandomAlias()]}
        onUpdate={updateCallback}
        onCreate={jest.fn()}
        onDelete={jest.fn()}
        profile={getMockProfileData({ server_storage: true })}
        user={{ email: "arbitrary@example.com" }}
      />
    );

    const labelField = screen.getByRole("textbox");
    await userEvent.type(labelField, "Some label");
    await userEvent.tab();

    expect(updateCallback).toHaveBeenCalledWith(expect.anything(), {
      description: "Some label",
    });
    expect(storeLocalLabelCallback).not.toHaveBeenCalled();
  });

  it("does not provide the option to edit the label if server-side storage is disabled, and local storage is not available (i.e. the user does not have the add-on)", async () => {
    LocalLabelsMock.setMockLocalLabelsOnce(
      LocalLabelsMock.getReturnValueWithoutAddon()
    );
    render(
      <AliasList
        aliases={[getMockRandomAlias()]}
        onUpdate={jest.fn()}
        onCreate={jest.fn()}
        onDelete={jest.fn()}
        profile={getMockProfileData({ server_storage: false })}
        user={{ email: "arbitrary@example.com" }}
      />
    );

    const labelField = screen.queryByRole("textbox");

    expect(labelField).not.toBeInTheDocument();
  });

  it("allows filtering aliases by their labels if server-side storage is enables", async () => {
    const mockAlias = {
      ...getMockRandomAlias(),
      description: "some server-side description",
    };
    render(
      <AliasList
        aliases={[mockAlias]}
        onUpdate={jest.fn()}
        onCreate={jest.fn()}
        onDelete={jest.fn()}
        profile={getMockProfileData({ server_storage: true })}
        user={{ email: "arbitrary@example.com" }}
      />
    );

    const stringFilterField = screen.getByRole("searchbox");
    await userEvent.type(stringFilterField, "some server-side description");

    const aliasElementMatchingFilter = screen.getByText(mockAlias.full_address);
    expect(aliasElementMatchingFilter).toBeInTheDocument();

    await userEvent.type(stringFilterField, "arbitrary other description");

    const aliasElementNotMatchingFilter = screen.queryByText(
      mockAlias.full_address
    );
    expect(aliasElementNotMatchingFilter).not.toBeInTheDocument();
  });

  it("also allows filtering aliases by their labels if server-side storage is disabled", async () => {
    const mockAlias = { ...getMockRandomAlias(), description: "" };
    LocalLabelsMock.setMockLocalLabels(
      LocalLabelsMock.getReturnValueWithAddon(
        [{ ...mockAlias, description: "some local description" }],
        jest.fn()
      )
    );
    render(
      <AliasList
        aliases={[mockAlias]}
        onUpdate={jest.fn()}
        onCreate={jest.fn()}
        onDelete={jest.fn()}
        profile={getMockProfileData({ server_storage: false })}
        user={{ email: "arbitrary@example.com" }}
      />
    );

    const stringFilterField = screen.getByRole("searchbox");
    await userEvent.type(stringFilterField, "some local description");

    const aliasElementMatchingFilter = screen.getByText(mockAlias.full_address);
    expect(aliasElementMatchingFilter).toBeInTheDocument();

    await userEvent.type(stringFilterField, "arbitrary other description");

    const aliasElementNotMatchingFilter = screen.queryByText(
      mockAlias.full_address
    );
    expect(aliasElementNotMatchingFilter).not.toBeInTheDocument();
  });
});
