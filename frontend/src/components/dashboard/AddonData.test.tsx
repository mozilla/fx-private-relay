import { render, screen } from "@testing-library/react";
import { AddonData } from "./AddonData";
import {
  mockedProfiles,
  mockedRuntimeData,
  mockedRelayaddresses,
  mockedDomainaddresses,
} from "frontend/src/apiMocks/mockData";

const mockProps = {
  profile: mockedProfiles.demo,
  runtimeData: mockedRuntimeData,
  aliases: [...mockedRelayaddresses.demo, ...mockedDomainaddresses.demo],
  totalForwardedEmails: 100,
  totalBlockedEmails: 20,
  totalEmailTrackersRemoved: 5,
};

describe("AddonData", () => {
  it("renders the firefox-private-relay-addon-data element with correct attributes", () => {
    render(<AddonData {...mockProps} />);
    const element = screen.getByTestId("addon-element");

    expect(element).toBeInTheDocument();
    expect(element).toHaveAttribute("id", "profile-main");
    expect(element).toHaveAttribute(
      "data-api-token",
      mockProps.profile.api_token,
    );
    expect(element).toHaveAttribute(
      "data-has-premium",
      String(mockProps.profile.has_premium),
    );
    expect(element).toHaveAttribute(
      "data-fxa-subscriptions-url",
      `${mockProps.runtimeData.FXA_ORIGIN}/subscriptions`,
    );
    expect(element).toHaveAttribute(
      "data-aliases-used-val",
      String(mockProps.aliases.length),
    );
    expect(element).toHaveAttribute("data-emails-forwarded-val", "100");
    expect(element).toHaveAttribute("data-emails-blocked-val", "20");
    expect(element).toHaveAttribute("data-email-trackers-removed-val", "5");

    const expectedSubdomain =
      typeof mockProps.profile.subdomain === "string"
        ? mockProps.profile.subdomain
        : "None";
    expect(element).toHaveAttribute(
      "data-premium-subdomain-set",
      expectedSubdomain,
    );

    expect(element).toHaveAttribute("data-premium-enabled", "True");
  });

  it("uses 'None' for subdomain if not a string", () => {
    render(
      <AddonData
        {...mockProps}
        profile={{ ...mockProps.profile, subdomain: null }}
      />,
    );

    const element = screen.getByTestId("addon-element");
    expect(element).toHaveAttribute("data-premium-subdomain-set", "None");
  });
});
