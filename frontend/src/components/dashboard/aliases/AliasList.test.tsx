import React, { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { mockLocalizedModule } from "../../../../__mocks__/components/Localized";
import { mockConfigModule } from "../../../../__mocks__/configMock";
import { mockUseL10nModule } from "../../../../__mocks__/hooks/l10n";
import { getMockRandomAlias } from "../../../../__mocks__/hooks/api/aliases";
import { getMockProfileData } from "../../../../__mocks__/hooks/api/profile";
import * as LocalLabelsMock from "../../../../__mocks__/hooks/localLabels";
import { AliasList } from "./AliasList";

jest.mock("../../../functions/waffle", () =>
  jest.requireActual("frontend/__mocks__/functions/waffle"),
);
import { resetFlags, withFlag } from "frontend/__mocks__/functions/flags";

declare global {
  interface Window {
    __foundAlias?: { address?: string } | undefined;
  }
}

jest.mock("../../../config.ts", () => mockConfigModule);
jest.mock("../../../hooks/l10n.ts", () => mockUseL10nModule);
jest.mock("../../../components/Localized.tsx", () => mockLocalizedModule);

jest.mock("./AliasGenerationButton", () => ({
  AliasGenerationButton: (props: {
    findAliasDataFromPrefix?: (
      prefix: string,
    ) => { address?: string } | undefined;
  }) => (
    <button
      data-testid="gen-btn"
      onClick={() => {
        const found = props.findAliasDataFromPrefix?.("__findme__");
        window.__foundAlias = found;
      }}
    >
      gen
    </button>
  ),
}));

jest.mock("./MaskCard", () => ({
  MaskCard: (props: {
    isOpen?: boolean;
    children?: ReactNode;
    mask: { full_address: string; description: string };
    onUpdate: (fields: { description: string }) => void;
    showLabelEditor?: boolean;
  }) => {
    const [label, setLabel] = React.useState(props.mask.description);
    return (
      <div data-testid="mask-card">
        <div data-testid="mask-card-open">{String(!!props.isOpen)}</div>
        <div>{props.mask.full_address}</div>
        {props.showLabelEditor && (
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={() => props.onUpdate({ description: label })}
          />
        )}
        {props.children}
      </div>
    );
  },
}));

jest.mock("./CategoryFilter", () => ({
  CategoryFilter: () => <div data-testid="category-filter" />,
}));

LocalLabelsMock.setMockLocalLabels();

beforeEach(() => {
  resetFlags();
});

describe("<AliasList>", () => {
  it("sends a request to the back-end to update the label if server-side label storage is enabled", async () => {
    const updateCallback = jest.fn();
    const storeLocalLabelCallback = jest.fn();
    LocalLabelsMock.setMockLocalLabelsOnce(
      LocalLabelsMock.getReturnValueWithoutAddon(storeLocalLabelCallback),
    );
    const { container } = render(
      <AliasList
        aliases={[getMockRandomAlias()]}
        onUpdate={updateCallback}
        onCreate={jest.fn()}
        onDelete={jest.fn()}
        profile={getMockProfileData({ server_storage: true })}
        user={{ email: "arbitrary@example.com" }}
      />,
    );
    expect(container).not.toBeEmptyDOMElement();
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
      LocalLabelsMock.getReturnValueWithAddon([], storeLocalLabelCallback),
    );
    render(
      <AliasList
        aliases={[getMockRandomAlias()]}
        onUpdate={updateCallback}
        onCreate={jest.fn()}
        onDelete={jest.fn()}
        profile={getMockProfileData({ server_storage: false })}
        user={{ email: "arbitrary@example.com" }}
      />,
    );
    const labelField = screen.getByRole("textbox");
    await userEvent.type(labelField, "Some label");
    await userEvent.tab();
    expect(updateCallback).toHaveBeenCalledWith(expect.anything(), {});
    expect(storeLocalLabelCallback).toHaveBeenCalledWith(
      expect.anything(),
      "Some label",
    );
  });

  it("sends to back-end when server-side is enabled, even if add-on is present", async () => {
    const updateCallback = jest.fn();
    const storeLocalLabelCallback = jest.fn();
    LocalLabelsMock.setMockLocalLabelsOnce(
      LocalLabelsMock.getReturnValueWithAddon([], storeLocalLabelCallback),
    );
    render(
      <AliasList
        aliases={[getMockRandomAlias()]}
        onUpdate={updateCallback}
        onCreate={jest.fn()}
        onDelete={jest.fn()}
        profile={getMockProfileData({ server_storage: true })}
        user={{ email: "arbitrary@example.com" }}
      />,
    );
    const labelField = screen.getByRole("textbox");
    await userEvent.type(labelField, "Some label");
    await userEvent.tab();
    expect(updateCallback).toHaveBeenCalledWith(expect.anything(), {
      description: "Some label",
    });
    expect(storeLocalLabelCallback).not.toHaveBeenCalled();
  });

  it("does not provide label edit when server-side disabled and local storage unavailable", async () => {
    LocalLabelsMock.setMockLocalLabelsOnce(
      LocalLabelsMock.getReturnValueWithoutAddon(),
    );
    render(
      <AliasList
        aliases={[getMockRandomAlias()]}
        onUpdate={jest.fn()}
        onCreate={jest.fn()}
        onDelete={jest.fn()}
        profile={getMockProfileData({ server_storage: false })}
        user={{ email: "arbitrary@example.com" }}
      />,
    );
    const labelField = screen.queryByRole("textbox");
    expect(labelField).not.toBeInTheDocument();
  });

  it("allows filtering by server-side labels", async () => {
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
      />,
    );
    const stringFilterField = screen.getByRole("searchbox");
    await userEvent.type(stringFilterField, "some server-side description");
    expect(screen.getByText(mockAlias.full_address)).toBeInTheDocument();
    await userEvent.type(stringFilterField, "arbitrary other description");
    expect(screen.queryByText(mockAlias.full_address)).not.toBeInTheDocument();
  });

  it("also allows filtering when server-side disabled but local label exists", async () => {
    const mockAlias = { ...getMockRandomAlias(), description: "" };
    LocalLabelsMock.setMockLocalLabels(
      LocalLabelsMock.getReturnValueWithAddon(
        [
          {
            ...mockAlias,
            used_on: undefined,
            description: "some local description",
          },
        ],
        jest.fn(),
      ),
    );
    render(
      <AliasList
        aliases={[mockAlias]}
        onUpdate={jest.fn()}
        onCreate={jest.fn()}
        onDelete={jest.fn()}
        profile={getMockProfileData({ server_storage: false })}
        user={{ email: "arbitrary@example.com" }}
      />,
    );
    const stringFilterField = screen.getByRole("searchbox");
    await userEvent.type(stringFilterField, "some local description");
    expect(screen.getByText(mockAlias.full_address)).toBeInTheDocument();
    await userEvent.type(stringFilterField, "arbitrary other description");
    expect(screen.queryByText(mockAlias.full_address)).not.toBeInTheDocument();
  });
});

describe("<AliasList> – extra coverage", () => {
  it("returns null when there are no aliases", () => {
    const { container } = render(
      <AliasList
        aliases={[]}
        onUpdate={jest.fn()}
        onCreate={jest.fn()}
        onDelete={jest.fn()}
        profile={getMockProfileData({ server_storage: true })}
        user={{ email: "u@example.com" }}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows CategoryFilter only for Premium users", async () => {
    const { rerender } = render(
      <AliasList
        aliases={[getMockRandomAlias()]}
        onUpdate={jest.fn()}
        onCreate={jest.fn()}
        onDelete={jest.fn()}
        profile={getMockProfileData({
          server_storage: true,
          has_premium: false,
        })}
        user={{ email: "u@example.com" }}
      />,
    );
    expect(screen.queryByTestId("category-filter")).not.toBeInTheDocument();

    rerender(
      <AliasList
        aliases={[getMockRandomAlias()]}
        onUpdate={jest.fn()}
        onCreate={jest.fn()}
        onDelete={jest.fn()}
        profile={getMockProfileData({
          server_storage: true,
          has_premium: true,
        })}
        user={{ email: "u@example.com" }}
      />,
    );
    expect(screen.getByTestId("category-filter")).toBeInTheDocument();
  });

  it("search toggle works and match-count shows filtered/total", async () => {
    const a1 = { ...getMockRandomAlias(), description: "alpha" };
    const a2 = { ...getMockRandomAlias(), description: "beta" };
    render(
      <AliasList
        aliases={[a1, a2]}
        onUpdate={jest.fn()}
        onCreate={jest.fn()}
        onDelete={jest.fn()}
        profile={getMockProfileData({ server_storage: true })}
        user={{ email: "u@example.com" }}
      />,
    );
    const search = screen.getByRole("searchbox");
    expect(screen.getByText("2/2")).toBeInTheDocument();
    await userEvent.clear(search);
    await userEvent.type(search, "alpha");
    expect(screen.getByText("1/2")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", {
        name: /profile-filter-search-placeholder-2/i,
      }),
    );
  });

  it("removes Unicode 0080–FFFF from the search input value", async () => {
    render(
      <AliasList
        aliases={[getMockRandomAlias()]}
        onUpdate={jest.fn()}
        onCreate={jest.fn()}
        onDelete={jest.fn()}
        profile={getMockProfileData({ server_storage: true })}
        user={{ email: "u@example.com" }}
      />,
    );
    const search = screen.getByRole("searchbox") as HTMLInputElement;
    await userEvent.type(search, "abc😀def");
    expect(search).toHaveValue("abcdef");
  });

  it("uses local label when server storage is disabled and local label exists", async () => {
    const mockAlias = { ...getMockRandomAlias(), description: "" };
    LocalLabelsMock.setMockLocalLabelsOnce(
      LocalLabelsMock.getReturnValueWithAddon(
        [
          {
            ...mockAlias,
            used_on: undefined,
            description: "local label here",
          },
        ],
        jest.fn(),
      ),
    );
    render(
      <AliasList
        aliases={[mockAlias]}
        onUpdate={jest.fn()}
        onCreate={jest.fn()}
        onDelete={jest.fn()}
        profile={getMockProfileData({ server_storage: false })}
        user={{ email: "u@example.com" }}
      />,
    );
    const labelField = screen.getByRole("textbox") as HTMLInputElement;
    expect(labelField).toHaveValue("local label here");
  });

  it("hides controls and renders only the first alias when free_user_onboarding flag is active with onboarding=true", async () => {
    await withFlag("free_user_onboarding", true, async () => {
      render(
        <AliasList
          aliases={[
            { ...getMockRandomAlias(), full_address: "one@example.com" },
            { ...getMockRandomAlias(), full_address: "two@example.com" },
          ]}
          onUpdate={jest.fn()}
          onCreate={jest.fn()}
          onDelete={jest.fn()}
          profile={getMockProfileData({ server_storage: true })}
          user={{ email: "u@example.com" }}
          onboarding
        />,
      );
      expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
      expect(screen.getAllByRole("listitem")).toHaveLength(1);
    });
  });

  it("plumbs findAliasDataFromPrefix into AliasGenerationButton", async () => {
    render(
      <AliasList
        aliases={[
          { ...getMockRandomAlias(), address: "__findme__" },
          { ...getMockRandomAlias(), address: "other" },
        ]}
        onUpdate={jest.fn()}
        onCreate={jest.fn()}
        onDelete={jest.fn()}
        profile={getMockProfileData({ server_storage: true })}
        user={{ email: "u@example.com" }}
      />,
    );
    await userEvent.click(screen.getByTestId("gen-btn"));
    expect(window.__foundAlias?.address).toBe("__findme__");
  });

  it("sorts aliases by created_at descending (newest first)", () => {
    render(
      <AliasList
        aliases={[
          {
            ...getMockRandomAlias(),
            full_address: "older@example.com",
            created_at: "2024-01-01T10:00:00.000Z",
          },
          {
            ...getMockRandomAlias(),
            full_address: "newer@example.com",
            created_at: "2024-01-02T10:00:00.000Z",
          },
        ]}
        onUpdate={jest.fn()}
        onCreate={jest.fn()}
        onDelete={jest.fn()}
        profile={getMockProfileData({ server_storage: true })}
        user={{ email: "u@example.com" }}
      />,
    );
    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("newer@example.com");
    expect(items[1]).toHaveTextContent("older@example.com");
  });
});
