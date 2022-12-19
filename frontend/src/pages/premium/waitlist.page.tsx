import { NextPage } from "next";
import { WaitlistPage } from "../../components/waitlist/WaitlistPage";
import { useL10n } from "../../hooks/l10n";
import { Localized } from "../../components/Localized";

/** These are the languages that marketing can send emails in: */
const supportedLocales = ["en", "es", "pl", "pt", "ja"];

const PremiumWaitlist: NextPage = () => {
  const l10n = useL10n();

  const legalese = (
    <>
      <Localized
        id="waitlist-privacy-policy-agree-2"
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
      headline={l10n.getString("waitlist-heading-2")}
      lead={l10n.getString("waitlist-lead-2")}
      legalese={legalese}
      newsletterId="relay-waitlist"
    />
  );
};

export default PremiumWaitlist;
