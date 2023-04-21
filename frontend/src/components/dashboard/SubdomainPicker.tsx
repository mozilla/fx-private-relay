import { useOverlayTriggerState } from "react-stately";
import { useState } from "react";
import Image from "next/image";
import styles from "./SubdomainPicker.module.scss";
import Illustration from "./images/man-laptop-email.svg";
import { ProfileData } from "../../hooks/api/profile";
import { SubdomainSearchForm } from "./subdomain/SearchForm";
import { SubdomainConfirmationModal } from "./subdomain/ConfirmationModal";
import { getRuntimeConfig } from "../../config";
import { useL10n } from "../../hooks/l10n";
import Link from "next/link";
import { useFlaggedAnchorLinks } from "../../hooks/flaggedAnchorLinks";

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

  // When <SubdomainPicker> gets added to the page, if there's an anchor link in the
  // URL pointing to register a subdomain, scroll to that banner:
  useFlaggedAnchorLinks([props.profile], ["mpp-choose-subdomain"]);

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
      onComplete={() => modalState.close()}
    />
  ) : null;

  return (
    <div className={styles.card} id="mpp-choose-subdomain">
      <div className={styles.description}>
        <p aria-hidden={true} className={styles["action-step"]}>
          {l10n.getString("banner-set-email-domain-headline-action-needed")}
        </p>
        <h3>{l10n.getString("banner-set-email-domain-headline")} </h3>
        <p className={styles.lead}>
          <dl className={styles["instruction-item"]}>
            <dt>
              <strong>
                {l10n.getString("banner-set-email-domain-step-one-headline")}
              </strong>
            </dt>
            <dd>{l10n.getString("banner-set-email-domain-step-one-body")}</dd>
          </dl>
          <dl className={styles["instruction-item"]}>
            <dt>
              <strong>
                {l10n.getString("banner-set-email-domain-step-two-headline")}
              </strong>
            </dt>
            <dd>
              {l10n.getString("banner-set-email-domain-step-two-body", {
                mozmail: "mozmail.com",
              })}
            </dd>
          </dl>
        </p>
        <Link
          href="https://support.mozilla.org/en-US/kb/register-your-own-domain-firefox-relay-premium"
          target="_blank"
        >
          {l10n.getString("banner-set-email-domain-learn-more")}
        </Link>
      </div>
      <div className={styles.search}>
        <div className={styles.example} aria-hidden={true}>
          ***@
          <span className={styles["subdomain-part"]}>
            {partialSubdomain !== ""
              ? partialSubdomain
              : l10n.getString("banner-set-email-domain-placeholder")}
          </span>
          .{getRuntimeConfig().mozmailDomain}
        </div>
        <div className={styles["input-wrapper"]}>
          <SubdomainSearchForm onType={onType} onPick={onPick} />
        </div>
        <Image
          src={Illustration}
          width={200}
          className={styles.illustration}
          alt=""
        />
      </div>
      {dialog}
    </div>
  );
};
