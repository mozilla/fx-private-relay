import { render, screen, act } from "@testing-library/react";
import { SubdomainPicker } from "./SubdomainPicker";
import { mockedProfiles } from "../../apiMocks/mockData";
import { useL10n } from "../../hooks/l10n";
import { getRuntimeConfig } from "../../config";
import { SubdomainSearchForm } from "./subdomain/SearchForm";
import { SubdomainConfirmationModal } from "./subdomain/ConfirmationModal";

jest.mock("../../hooks/l10n", () => ({
  useL10n: jest.fn(),
}));

jest.mock("../../hooks/flaggedAnchorLinks", () => ({
  useFlaggedAnchorLinks: jest.fn(),
}));

jest.mock("../../config", () => ({
  getRuntimeConfig: jest.fn(),
}));

jest.mock("./subdomain/SearchForm", () => ({
  SubdomainSearchForm: jest.fn(() => (
    <div data-testid="subdomain-search-form" />
  )),
}));

jest.mock("./subdomain/ConfirmationModal", () => ({
  SubdomainConfirmationModal: jest.fn(() => (
    <div data-testid="confirmation-modal" />
  )),
}));

describe("SubdomainPicker", () => {
  const mockL10nStrings = {
    getString: (key: string, vars?: Record<string, string>) =>
      `${key}${vars?.mozmail ? `: ${vars.mozmail}` : ""}`,
  };

  beforeEach(() => {
    (useL10n as jest.Mock).mockReturnValue(mockL10nStrings);
    (getRuntimeConfig as jest.Mock).mockReturnValue({
      mozmailDomain: "mozmail.com",
    });
    jest.clearAllMocks();
  });

  it("does not render if user is not premium", () => {
    render(
      <SubdomainPicker
        profile={{ ...mockedProfiles.demo, has_premium: false }}
        onCreate={jest.fn()}
      />,
    );
    expect(
      screen.queryByTestId("subdomain-search-form"),
    ).not.toBeInTheDocument();
  });

  it("does not render if user has a subdomain and modal is not open", () => {
    render(
      <SubdomainPicker
        profile={{ ...mockedProfiles.full, subdomain: "myname" }}
        onCreate={jest.fn()}
      />,
    );
    expect(
      screen.queryByTestId("subdomain-search-form"),
    ).not.toBeInTheDocument();
  });

  it("renders if user is premium and does not have a subdomain", () => {
    const profile = { ...mockedProfiles.full, subdomain: null };
    render(<SubdomainPicker profile={profile} onCreate={jest.fn()} />);
    expect(screen.getByTestId("subdomain-search-form")).toBeInTheDocument();
    expect(
      screen.getByText("banner-set-email-domain-headline"),
    ).toBeInTheDocument();
  });

  it("renders placeholder subdomain if none typed", () => {
    const profile = { ...mockedProfiles.full, subdomain: null };
    render(<SubdomainPicker profile={profile} onCreate={jest.fn()} />);

    const matches = screen.getAllByText(
      (_, el) =>
        el?.textContent ===
        "***@banner-set-email-domain-placeholder.mozmail.com",
    );
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it("renders partial subdomain if typed", () => {
    const profile = { ...mockedProfiles.full, subdomain: null };
    const { rerender } = render(
      <SubdomainPicker profile={profile} onCreate={jest.fn()} />,
    );

    const searchFormProps = (SubdomainSearchForm as jest.Mock).mock.calls[0][0];
    act(() => {
      searchFormProps.onType("customname");
    });

    rerender(<SubdomainPicker profile={profile} onCreate={jest.fn()} />);

    const matches = screen.getAllByText(
      (_, el) => el?.textContent === "***@customname.mozmail.com",
    );
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it("opens confirmation modal onPick and calls onCreate on confirm", () => {
    const onCreate = jest.fn();
    const profile = { ...mockedProfiles.full, subdomain: null };
    const { rerender } = render(
      <SubdomainPicker profile={profile} onCreate={onCreate} />,
    );

    const searchFormProps = (SubdomainSearchForm as jest.Mock).mock.calls[0][0];
    act(() => {
      searchFormProps.onPick("coolname");
    });

    rerender(<SubdomainPicker profile={profile} onCreate={onCreate} />);
    expect(screen.getByTestId("confirmation-modal")).toBeInTheDocument();

    const modalProps = (SubdomainConfirmationModal as jest.Mock).mock
      .calls[0][0];
    modalProps.onConfirm();
    expect(onCreate).toHaveBeenCalledWith("coolname");
  });
});
