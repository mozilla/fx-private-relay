import { useRef, useState, ReactNode } from "react";
import { useLocalization } from "@fluent/react";
import { useToggleState, useTooltipTriggerState } from "react-stately";
import {
  mergeProps,
  useToggleButton,
  useTooltip,
  useTooltipTrigger,
} from "react-aria";
import styles from "./Alias.module.scss";
import copyIcon from "../../../../../static/images/copy-to-clipboard.svg";
import arrowDownIcon from "../../../../../static/images/arrowhead.svg";
import IllustrationHoliday from "../../../../public/illustrations/holiday.svg";
import IllustrationLibrary from "../../../../public/illustrations/library.svg";
import { AliasData, getFullAddress } from "../../../hooks/api/aliases";
import { LabelEditor } from "./LabelEditor";
import { UserData } from "../../../hooks/api/user";
import { ProfileData } from "../../../hooks/api/profile";
import { renderDate } from "../../../functions/renderDate";
import { AliasDeletionButton } from "./AliasDeletionButton";
import { getRuntimeConfig } from "../../../config";
import { getLocale } from "../../../functions/getLocale";
import { BlockLevel, BlockLevelSlider } from "./BlockLevelSlider";

export type Props = {
  alias: AliasData;
  user: UserData;
  profile: ProfileData;
  onUpdate: (updatedFields: Partial<AliasData>) => void;
  onDelete: () => void;
  defaultOpen?: boolean;
  showLabelEditor?: boolean;
};

/**
 * A card to manage (toggle it on/off, view details, ...) a single alias.
 */
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
  const expandButtonState = useToggleState({
    defaultSelected: props.defaultOpen === true,
  });
  const expandButtonProps = useToggleButton(
    {},
    expandButtonState,
    expandButtonRef
  ).buttonProps;

  const address = getFullAddress(props.alias);

  const copyAddressToClipboard = () => {
    navigator.clipboard.writeText(address);
    setJustCopied(true);
    setTimeout(() => {
      setJustCopied(false);
    }, 1 * 1000);
  };

  const labelEditor = props.showLabelEditor ? (
    <LabelEditor
      label={props.alias.description}
      onSubmit={(newLabel) => props.onUpdate({ description: newLabel })}
    />
  ) : null;

  let backgroundImage = undefined;
  if (
    [
      "Holiday",
      "Holidays",
      "Vakantie",
      "Urlaub",
      "Ferien",
      "Vacances",
    ].includes(props.alias.description)
  ) {
    backgroundImage = IllustrationHoliday.src;
  }
  if (
    [
      "Library",
      "Bibliotheek",
      "Bibliotek",
      "Bibliothek",
      "Biblioteek",
      "Bibliothèque",
    ].includes(props.alias.description)
  ) {
    backgroundImage = IllustrationLibrary.src;
  }

  const numberFormatter = new Intl.NumberFormat(getLocale(l10n), {
    notation: "compact",
    compactDisplay: "short",
  });

  // We have the <BlockLevelSlider> for Premium users, so don't show the toggle
  // for them:
  const toggleButton = props.profile.has_premium ? (
    // An empty span can take the cell in the grid layout that otherwise
    // would have been taken by the <button>:
    <span />
  ) : (
    <button
      {...buttonProps}
      ref={toggleButtonRef}
      className={styles["toggle-button"]}
      aria-label={l10n.getString(
        toggleButtonState.isSelected
          ? "profile-label-disable-forwarding-button"
          : "profile-label-enable-forwarding-button"
      )}
    ></button>
  );

  const setBlockLevel = (blockLevel: BlockLevel) => {
    if (blockLevel === "none") {
      return props.onUpdate({ enabled: true, block_list_emails: false });
    }
    if (blockLevel === "promotional") {
      return props.onUpdate({ enabled: true, block_list_emails: true });
    }
    if (blockLevel === "all") {
      return props.onUpdate({ enabled: false, block_list_emails: true });
    }
  };

  const blockLevelSlider = props.profile.has_premium ? (
    <div className={styles.row}>
      <BlockLevelSlider alias={props.alias} onChange={setBlockLevel} />
    </div>
  ) : null;

  return (
    <div
      className={`${styles["alias-card"]} ${
        props.alias.enabled ? styles["is-enabled"] : styles["is-disabled"]
      } ${
        expandButtonState.isSelected
          ? styles["is-expanded"]
          : styles["is-collapsed"]
      }`}
      style={{
        backgroundImage: backgroundImage
          ? `url(${backgroundImage}), none`
          : undefined,
      }}
    >
      <div className={styles["main-data"]}>
        <div className={styles.controls}>
          {toggleButton}
          {labelEditor}
          <span className={styles["copy-controls"]}>
            <span className={styles["copy-button-wrapper"]}>
              <button
                className={styles["copy-button"]}
                title={l10n.getString("profile-label-click-to-copy")}
                aria-label={l10n.getString("profile-label-click-to-copy-alt", {
                  address: address,
                })}
                onClick={copyAddressToClipboard}
              >
                <samp className={styles.address}>{address}</samp>
                <img
                  src={copyIcon.src}
                  alt=""
                  className={styles["copy-icon"]}
                />
              </button>
              <span
                aria-hidden={!justCopied}
                className={`${styles["copied-confirmation"]} ${
                  justCopied ? styles["is-shown"] : ""
                }`}
              >
                {l10n.getString("profile-label-copied")}
              </span>
            </span>
          </span>
        </div>
        <div className={styles["block-level-label-wrapper"]}>
          <BlockLevelLabel alias={props.alias} />
        </div>
        <div className={styles["alias-stats"]}>
          <BlockedTooltip>
            <span className={styles.number}>
              {numberFormatter.format(props.alias.num_blocked)}
            </span>
            <span className={styles.label}>
              {l10n.getString("profile-label-blocked")}
            </span>
          </BlockedTooltip>
          <ForwardedTooltip>
            <span className={styles.number}>
              {numberFormatter.format(props.alias.num_forwarded)}
            </span>
            <span className={styles.label}>
              {l10n.getString("profile-label-forwarded")}
            </span>
          </ForwardedTooltip>
        </div>
        <div className={styles["expand-toggle"]}>
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
      <div className={styles["secondary-data"]}>
        {blockLevelSlider}
        <div className={styles.row}>
          <dl>
            <div className={`${styles["forward-target"]} ${styles.metadata}`}>
              <dt>{l10n.getString("profile-label-forward-emails")}</dt>
              <dd>{props.user.email}</dd>
            </div>
            <div className={`${styles["date-created"]} ${styles.metadata}`}>
              <dt>{l10n.getString("profile-label-created")}</dt>
              <dd>{renderDate(props.alias.created_at, l10n)}</dd>
            </div>
          </dl>
          <AliasDeletionButton onDelete={props.onDelete} alias={props.alias} />
        </div>
      </div>
    </div>
  );
};

type TooltipProps = {
  children: ReactNode;
};
const ForwardedTooltip = (props: TooltipProps) => {
  const { l10n } = useLocalization();
  const triggerState = useTooltipTriggerState({ delay: 0 });
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipTrigger = useTooltipTrigger({}, triggerState, triggerRef);

  const { tooltipProps } = useTooltip({}, triggerState);

  return (
    <span className={styles["stat-wrapper"]}>
      <span
        ref={triggerRef}
        {...tooltipTrigger.triggerProps}
        className={`${styles.stat} ${styles["forwarded-stat"]}`}
      >
        {props.children}
      </span>
      {triggerState.isOpen && (
        <span
          {...mergeProps(tooltipTrigger.tooltipProps, tooltipProps)}
          className={styles.tooltip}
        >
          <span>{l10n.getString("profile-forwarded-copy")}</span>
          <br />
          <strong>{l10n.getString("profile-forwarded-note")}</strong>&nbsp;
          <span>
            {l10n.getString("profile-forwarded-note-copy", {
              size: getRuntimeConfig().emailSizeLimitNumber,
              unit: getRuntimeConfig().emailSizeLimitUnit,
            })}
          </span>
        </span>
      )}
    </span>
  );
};
const BlockedTooltip = (props: TooltipProps) => {
  const { l10n } = useLocalization();
  const triggerState = useTooltipTriggerState({ delay: 0 });
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipTrigger = useTooltipTrigger({}, triggerState, triggerRef);

  const { tooltipProps } = useTooltip({}, triggerState);

  return (
    <span className={styles["stat-wrapper"]}>
      <span
        ref={triggerRef}
        {...tooltipTrigger.triggerProps}
        className={`${styles.stat} ${styles["blocked-stat"]}`}
      >
        {props.children}
      </span>
      {triggerState.isOpen && (
        <span
          {...mergeProps(tooltipTrigger.tooltipProps, tooltipProps)}
          className={styles.tooltip}
        >
          {l10n.getString("profile-blocked-copy")}
        </span>
      )}
    </span>
  );
};

type BlockLevelLabelProps = {
  alias: AliasData;
};
const BlockLevelLabel = (props: BlockLevelLabelProps) => {
  const { l10n } = useLocalization();
  if (props.alias.enabled === false) {
    return (
      <b
        className={`${styles["block-level-label"]} ${styles["block-level-all-label"]}`}
      >
        {l10n.getString("profile-promo-email-blocking-label-none")}
      </b>
    );
  }

  if (props.alias.block_list_emails === true) {
    return (
      <b
        className={`${styles["block-level-label"]} ${styles["block-level-promotional-label"]}`}
      >
        {l10n.getString("profile-promo-email-blocking-label-promotionals")}
      </b>
    );
  }

  return null;
};
