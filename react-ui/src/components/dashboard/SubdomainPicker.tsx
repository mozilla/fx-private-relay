import Link from "next/link";
import { useLocalization } from "@fluent/react";
import { useOverlayTriggerState } from "react-stately";
import { useState } from "react";
import styles from "./SubdomainPicker.module.scss";
import illustration from "../../../../static/images/dashboard-onboarding/man-laptop-email.svg";
import { ProfileData } from "../../hooks/api/profile";
import { SubdomainSearchForm } from "./subdomain/SearchForm";
import { SubdomainConfirmationModal } from "./subdomain/ConfirmationModal";

export type Props = {
  profile: ProfileData;
  onCreate: (subdomain: string) => void;
};

export const SubdomainPicker = (props: Props) => {
  const { l10n } = useLocalization();
  const [chosenSubdomain, setChosenSubdomain] = useState("");

  const modalState = useOverlayTriggerState({});

  if (
    !props.profile.has_premium ||
    typeof props.profile.subdomain === "string"
  ) {
    return null;
  }

  const onPick = (subdomain: string) => {
    setChosenSubdomain(subdomain);
    modalState.open();
  };

  const onConfirm = () => {
    props.onCreate(chosenSubdomain);
    modalState.close();
  };

  const dialog = modalState.isOpen ? (
    <SubdomainConfirmationModal
      subdomain={chosenSubdomain}
      isOpen={modalState.isOpen}
      onClose={() => modalState.close()}
      onConfirm={onConfirm}
    />
  ) : null;

  return (
    <div className={styles.card} id="mpp-choose-subdomain">
      <div className={styles.description}>
        <span aria-hidden={true} className={styles.actionStep}>
          {l10n.getString("banner-label-action")}
        </span>
        <h2>{l10n.getString("banner-register-subdomain-headline-aliases")}</h2>
        <samp className={styles.example} aria-hidden={true}>
          ***@
          <span className={styles.subdomainPart}>
            {l10n.getString("banner-register-subdomain-example-address")}
          </span>
          .{process.env.NEXT_PUBLIC_MOZMAIL_DOMAIN}
        </samp>
        <p className={styles.lead}>
          {l10n.getString("banner-register-subdomain-copy", {
            mozmail: process.env.NEXT_PUBLIC_MOZMAIL_DOMAIN!,
          })}
        </p>
        <Link href="/faq">
          <a>{l10n.getString("banner-label-data-notification-body-cta")}</a>
        </Link>
      </div>
      <div className={styles.search}>
        <SubdomainSearchForm onPick={onPick} />
        <img
          src={illustration.src}
          width={200}
          className={styles.illustration}
          alt=""
        />
      </div>
      {dialog}
    </div>
  );
};
