import Link from "next/link";
import { useOverlayTriggerState } from "react-stately";
import { useState } from "react";
import styles from "./SubdomainPicker.module.scss";
import illustration from "./images/man-laptop-email.svg";
import { ProfileData } from "../../hooks/api/profile";
import { SubdomainSearchForm } from "./subdomain/SearchForm";
import { SubdomainConfirmationModal } from "./subdomain/ConfirmationModal";
import { getRuntimeConfig } from "../../config";
import { useL10n } from "../../hooks/l10n";

export type Props = {
  profile: ProfileData;
  onCreate: (subdomain: string) => void;
};

/**
 * Allows the user to search for available subdomains, and pops up a modal to claim it if available.
 */
export const SubdomainPicker = (props: Props) => {
  const l10n = useL10n();
  const [chosenSubdomain, setChosenSubdomain] = useState("");
  const [partialSubdomain, setPartialSubdomain] = useState("");

  const modalState = useOverlayTriggerState({});

  if (
    !props.profile.has_premium ||
    // Don't show if the user already has a subdomain set,
    // unless they *just* set it, i.e. when the modal is still
    // open and showing a confirmation:
    (typeof props.profile.subdomain === "string" && !modalState.isOpen)
  ) {
    return null;
  }

  const onPick = (subdomain: string) => {
    setChosenSubdomain(subdomain);
    modalState.open();
  };

  const onConfirm = () => {
    props.onCreate(chosenSubdomain);
  };

  const onType = (_partial: string) => {
    setPartialSubdomain(_partial);
  };

  const dialog = modalState.isOpen ? (
    <SubdomainConfirmationModal
      subdomain={chosenSubdomain}
      isOpen={modalState.isOpen}
      isSet={typeof props.profile.subdomain === "string"}
      onClose={() => modalState.close()}
      onConfirm={onConfirm}
    />
  ) : null;

  return (
    <div className={styles.card} id="mpp-choose-subdomain">
      <div className={styles.description}>
        <span aria-hidden={true} className={styles["action-step"]}>
          {l10n.getString("banner-label-action")}
        </span>
        <h2>
          {l10n.getString("banner-register-subdomain-headline-aliases-2")}
        </h2>
        <samp className={styles.example} aria-hidden={true}>
          ***@
          <span className={styles["subdomain-part"]}>
            {partialSubdomain !== ""
              ? partialSubdomain
              : l10n.getString("banner-register-subdomain-example-address")}
          </span>
          .{getRuntimeConfig().mozmailDomain}
        </samp>
        <p className={styles.lead}>
          {l10n.getString("banner-register-subdomain-copy-2", {
            mozmail: getRuntimeConfig().mozmailDomain,
          })}
        </p>
        <Link href="/faq">
          {l10n.getString("banner-label-data-notification-body-cta")}
        </Link>
      </div>
      <div className={styles.search}>
        <SubdomainSearchForm onType={onType} onPick={onPick} />
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
