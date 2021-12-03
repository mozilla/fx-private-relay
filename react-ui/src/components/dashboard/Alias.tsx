import { useLocalization } from "@fluent/react";
import styles from "./Alias.module.scss";
import copyIcon from "../../../../static/images/copy-to-clipboard.svg";
import arrowDownIcon from "../../../../static/images/arrowhead.svg";
import { AliasData, getFullAddress } from "../../hooks/api/aliases";
import { ProfileData } from "../../hooks/api/profile";
import { useRef, useState } from "react";
import { useToggleState } from "@react-stately/toggle";
import { useToggleButton } from "@react-aria/button";
import { LabelEditor } from "./LabelEditor";
import { UserData } from "../../hooks/api/user";
import { renderDate } from "../../functions/renderDate";
import { AliasDeletionButton } from "./AliasDeletionButton";

export type Props = {
  alias: AliasData;
  profile: ProfileData;
  user: UserData;
  onUpdate: (updatedFields: Partial<AliasData>) => void;
  onDelete: () => void;
};

export const Alias = (props: Props) => {
  const { l10n } = useLocalization();
  const [justCopied, setJustCopied] = useState(false);
  const toggleButtonState = useToggleState({
    defaultSelected: props.alias.enabled,
    onChange: (isEnabled) => props.onUpdate({ enabled: isEnabled }),
  });
  const toggleButtonRef = useRef<HTMLButtonElement>(null);
  const { buttonProps } = useToggleButton(
    {},
    toggleButtonState,
    toggleButtonRef
  );

  const expandButtonRef = useRef<HTMLButtonElement>(null);
  const expandButtonState = useToggleState({ defaultSelected: false });
  const expandButtonProps = useToggleButton(
    {},
    expandButtonState,
    expandButtonRef
  ).buttonProps;

  const address = getFullAddress(props.alias, props.profile);

  const copyAddressToClipboard = () => {
    navigator.clipboard.writeText(address);
    setJustCopied(true);
    setTimeout(() => {
      setJustCopied(false);
    }, 1 * 1000);
  };

  const labelEditor = props.profile.server_storage ? (
    <LabelEditor
      label={props.alias.description}
      onSubmit={(newLabel) => props.onUpdate({ description: newLabel })}
    />
  ) : null;

  return (
    <div
      className={`${styles.aliasCard} ${
        toggleButtonState.isSelected ? styles.isEnabled : styles.isDisabled
      } ${
        expandButtonState.isSelected ? styles.isExpanded : styles.isCollapsed
      }`}
    >
      <div className={styles.mainData}>
        <div className={styles.controls}>
          <button
            {...buttonProps}
            ref={toggleButtonRef}
            className={styles.toggleButton}
            aria-label={l10n.getString(
              toggleButtonState.isSelected
                ? "profile-label-disable-forwarding-button"
                : "profile-label-enable-forwarding-button"
            )}
          ></button>
          {labelEditor}
          <span className={styles.copyControls}>
            <span className={styles.copyButtonWrapper}>
              <button
                className={styles.copyButton}
                title={l10n.getString("profile-label-click-to-copy")}
                aria-label={l10n.getString("profile-label-click-to-copy-alt", {
                  address: address,
                })}
                onClick={copyAddressToClipboard}
              >
                <samp className={styles.address}>{address}</samp>
                <img src={copyIcon.src} alt="" className={styles.copyIcon} />
              </button>
              <span
                aria-hidden={!justCopied}
                className={`${styles.copiedConfirmation} ${
                  justCopied ? styles.isShown : ""
                }`}
              >
                {l10n.getString("profile-label-copied")}
              </span>
            </span>
          </span>
        </div>
        <div className={styles.aliasStats}>
          <span
            title={l10n.getString("profile-blocked-copy")}
            className={`${styles.stat} ${styles.blockedStat}`}
          >
            <span className={styles.number}>{props.alias.num_blocked}</span>
            <span className={styles.label}>
              {l10n.getString("profile-label-blocked")}
            </span>
          </span>
          <span
            title={`${l10n.getString(
              "profile-forwarded-copy"
            )}\n${l10n.getString("profile-forwarded-note")} ${l10n.getString(
              "profile-forwarded-note-copy",
              {
                size: process.env.NEXT_PUBLIC_EMAIL_SIZE_LIMIT_NUMBER!,
                unit: process.env.NEXT_PUBLIC_EMAIL_SIZE_LIMIT_UNIT!,
              }
            )}`}
            className={`${styles.stat} ${styles.forwardedStat}`}
          >
            <span className={styles.number}>{props.alias.num_forwarded}</span>
            <span className={styles.label}>
              {l10n.getString("profile-label-forwarded")}
            </span>
          </span>
        </div>
        <div className={styles.expandToggle}>
          <button {...expandButtonProps} ref={expandButtonRef}>
            <img
              src={arrowDownIcon.src}
              alt={l10n.getString(
                expandButtonState.isSelected
                  ? "profile-details-collapse"
                  : "profile-details-expand"
              )}
              width={16}
              height={16}
            />
          </button>
        </div>
      </div>
      <div className={styles.secondaryData}>
        <dl>
          <div className={`${styles.forwardTarget} ${styles.metadata}`}>
            <dt>{l10n.getString("profile-label-forward-emails")}</dt>
            <dd>{props.user.email}</dd>
          </div>
          <div className={`${styles.dateCreated} ${styles.metadata}`}>
            <dt>{l10n.getString("profile-label-created")}</dt>
            <dd>{renderDate(props.alias.created_at)}</dd>
          </div>
        </dl>
        <AliasDeletionButton
          onDelete={props.onDelete}
          alias={props.alias}
          profile={props.profile}
        />
      </div>
    </div>
  );
};
