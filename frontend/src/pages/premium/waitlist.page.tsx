import { Localized, useLocalization } from "@fluent/react";
import { NextPage } from "next";
import { WaitlistPage } from "../../components/waitlist/WaitlistPage";

/** These are the languages that marketing can send emails in: */
const supportedLocales = ["en", "es", "pl", "pt", "ja"];

const PremiumWaitlist: NextPage = () => {
  const { l10n } = useLocalization();

  const legalese = (
    <>
      <Localized
        id="waitlist-privacy-policy-agree"
        elems={{
          a: (
            <a
              href="https://www.mozilla.org/privacy/firefox-relay/"
              target="_blank"
              rel="noopener noreferrer"
            />
          ),
        }}
      >
        <p />
      </Localized>
      <p>{l10n.getString("waitlist-privacy-policy-use")}</p>
    </>
  );

  return (
    <WaitlistPage
      supportedLocales={supportedLocales}
      headline={l10n.getString("waitlist-heading")}
      lead={l10n.getString("waitlist-lead")}
      legalese={legalese}
      newsletterId="relay-waitlist"
    />
  );
};

export default PremiumWaitlist;
