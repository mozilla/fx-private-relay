import { createElement } from "react";
import { AliasData } from "../../hooks/api/aliases";
import { ProfileData } from "../../hooks/api/profile";
import { RuntimeData } from "../../hooks/api/runtimeData";

export type Props = {
  profile: ProfileData;
  runtimeData: RuntimeData;
  aliases: AliasData[];
  totalForwardedEmails: number;
  totalBlockedEmails: number;
  totalEmailTrackersRemoved: number;
};

export const AddonData = (props: Props) => {
  return createElement("firefox-private-relay-addon-data", {
    // #profile-main is used by the add-on to look up the API token.
    // TODO: Make it look for this custom element instead.
    id: "profile-main",
    "data-api-token": props.profile.api_token,
    "data-has-premium": String(props.profile.has_premium),
    "data-fxa-subscriptions-url": `${props.runtimeData.FXA_ORIGIN}/subscriptions`,
    "data-aliases-used-val": props.aliases.length,
    "data-emails-forwarded-val": props.totalForwardedEmails,
    "data-emails-blocked-val": props.totalBlockedEmails,
    "data-email-trackers-removed-val": props.totalEmailTrackersRemoved,
    "data-premium-subdomain-set":
      typeof props.profile.subdomain === "string"
        ? props.profile.subdomain
        : "None",
    "data-premium-enabled": "True",
  });
};
