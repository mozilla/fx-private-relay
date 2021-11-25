import { useLocalization } from "@fluent/react";
import styles from "./Alias.module.scss";
import copyIcon from "../../../../static/images/copy-to-clipboard.svg";
import { AliasData, getFullAddress } from "../../hooks/api/aliases";
import { ProfileData } from "../../hooks/api/profile";
import { useRef, useState } from "react";
import { useToggleState } from "@react-stately/toggle";
import { useToggleButton } from "@react-aria/button";

export type Props = {
  alias: AliasData;
  profile: ProfileData;
  onUpdate: (updatedFields: Partial<AliasData>) => void;
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

  const address = getFullAddress(props.alias, props.profile);

  const copyAddressToClipboard = () => {
    navigator.clipboard.writeText(address);
    setJustCopied(true);
    setTimeout(() => {
      setJustCopied(false);
    }, 1 * 1000);
  };

  return (
    <div
      className={`${styles.aliasCard} ${
        toggleButtonState.isSelected ? styles.isEnabled : styles.isDisabled
      }`}
    >
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
        <span className={styles.copyControls}>
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
      </div>
      <div className={styles.aliasStats}>
        {props.alias.num_blocked}
        {props.alias.num_forwarded}
      </div>
    </div>
  );
};
