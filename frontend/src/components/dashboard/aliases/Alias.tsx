import { useRef, useState, ReactNode } from "react";
import { Localized, useLocalization } from "@fluent/react";
import { useToggleState, useTooltipTriggerState } from "react-stately";
import {
  mergeProps,
  useToggleButton,
  useTooltip,
  useTooltipTrigger,
} from "react-aria";
import styles from "./Alias.module.scss";
import { ArrowDownIcon, CopyIcon, HideIcon } from "../../Icons";
import IllustrationHoliday from "../../../../public/illustrations/holiday.svg";
import IllustrationLibrary from "../../../../public/illustrations/library.svg";
import {
  AliasData,
  getFullAddress,
  isBlockingLevelOneTrackers,
} from "../../../hooks/api/aliases";
import { LabelEditor } from "./LabelEditor";
import { UserData } from "../../../hooks/api/user";
import { ProfileData } from "../../../hooks/api/profile";
import { renderDate } from "../../../functions/renderDate";
import { AliasDeletionButton } from "./AliasDeletionButton";
import { getRuntimeConfig } from "../../../config";
import { getLocale } from "../../../functions/getLocale";
import { BlockLevel, BlockLevelSlider } from "./BlockLevelSlider";
import { RuntimeData } from "../../../hooks/api/runtimeData";
import { isFlagActive } from "../../../functions/waffle";
import { isPeriodicalPremiumAvailableInCountry } from "../../../functions/getPlan";

export type Props = {
  alias: AliasData;
  user: UserData;
  profile: ProfileData;
  onUpdate: (updatedFields: Partial<AliasData>) => void;
  onDelete: () => void;
  isOpen: boolean;
  onChangeOpen: (isOpen: boolean) => void;
  showLabelEditor?: boolean;
  runtimeData?: RuntimeData;
};

/**
 * A card to manage (toggle it on/off, view details, ...) a single alias.
 */
export const Alias = (props: Props) => {
  const { l10n } = useLocalization();
  const [justCopied, setJustCopied] = useState(false);

  const expandButtonRef = useRef<HTMLButtonElement>(null);
  const expandButtonState = useToggleState({
    isSelected: props.isOpen === true,
    onChange: props.onChangeOpen,
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
    <div className={styles["label-editor-wrapper"]}>
      <LabelEditor
        label={props.alias.description}
        onSubmit={(newLabel) => props.onUpdate({ description: newLabel })}
      />
    </div>
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

  const setBlockLevel = (blockLevel: BlockLevel) => {
    if (blockLevel === "none") {
      // The back-end rejects requests trying to set this property for free users:
      const blockPromotionals = props.profile.has_premium ? false : undefined;
      return props.onUpdate({
        enabled: true,
        block_list_emails: blockPromotionals,
      });
    }
    if (blockLevel === "promotional") {
      return props.onUpdate({ enabled: true, block_list_emails: true });
    }
    if (blockLevel === "all") {
      // The back-end rejects requests trying to set this property for free users:
      const blockPromotionals = props.profile.has_premium ? true : undefined;
      return props.onUpdate({
        enabled: false,
        block_list_emails: blockPromotionals,
      });
    }
  };

  const classNames = [
    styles["alias-card"],
    props.alias.enabled ? styles["is-enabled"] : styles["is-disabled"],
    expandButtonState.isSelected
      ? styles["is-expanded"]
      : styles["is-collapsed"],
    props.alias.block_list_emails
      ? styles["is-blocking-promotionals"]
      : styles["is-not-blocking-promotionals"],
    isBlockingLevelOneTrackers(props.alias, props.profile)
      ? styles["is-removing-trackers"]
      : styles["is-not-removing-trackers"],
  ].join(" ");

  return (
    <div
      className={classNames}
      style={{
        backgroundImage: backgroundImage
          ? `url(${backgroundImage}), none`
          : undefined,
      }}
    >
      <div className={styles["main-data"]}>
        <div className={styles.controls}>
          <TrackerRemovalIndicator
            alias={props.alias}
            profile={props.profile}
          />
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
                <span className={styles["copy-icon"]}>
                  <CopyIcon alt="" />
                </span>
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
        {/* This <Stats> will be hidden on small screens: */}
        <Stats
          alias={props.alias}
          profile={props.profile}
          runtimeData={props.runtimeData}
        />
        <div className={styles["expand-toggle"]}>
          <button {...expandButtonProps} ref={expandButtonRef}>
            <ArrowDownIcon
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
        {/* This <Stats> will be hidden on large screens: */}
        <Stats
          alias={props.alias}
          profile={props.profile}
          runtimeData={props.runtimeData}
        />
        <div className={styles.row}>
          <BlockLevelSlider
            alias={props.alias}
            onChange={setBlockLevel}
            hasPremium={props.profile.has_premium}
            premiumAvailableInCountry={isPeriodicalPremiumAvailableInCountry(
              props.runtimeData
            )}
          />
        </div>
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

type StatsProps = {
  alias: AliasData;
  profile: ProfileData;
  runtimeData?: RuntimeData;
};
const Stats = (props: StatsProps) => {
  const { l10n } = useLocalization();
  const numberFormatter = new Intl.NumberFormat(getLocale(l10n), {
    notation: "compact",
    compactDisplay: "short",
  });

  return (
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

      {/* If user is not premium, hide the replies count */}
      {props.profile.has_premium && (
        <RepliesTooltip>
          <span className={styles.number}>
            {numberFormatter.format(props.alias.num_replied)}
          </span>
          <span className={styles.label}>
            {l10n.getString("profile-label-replies")}
          </span>
        </RepliesTooltip>
      )}

      {/*
        If the back-end does not yet support providing tracker blocking stats,
        hide the blocked trackers count:
       */}
      {isFlagActive(props.runtimeData, "tracker_removal") &&
        typeof props.alias.num_level_one_trackers_blocked === "number" && (
          <TrackersRemovedTooltip>
            <span className={styles.number}>
              {numberFormatter.format(
                props.alias.num_level_one_trackers_blocked
              )}
            </span>
            <span className={styles.label}>
              {l10n.getString("profile-label-trackers-removed")}
            </span>
          </TrackersRemovedTooltip>
        )}
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
    <div className={styles["stat-wrapper"]}>
      <span
        ref={triggerRef}
        {...tooltipTrigger.triggerProps}
        className={`${styles.stat} ${styles["forwarded-stat"]}`}
      >
        {props.children}
      </span>
      {triggerState.isOpen && (
        <div
          {...mergeProps(tooltipTrigger.tooltipProps, tooltipProps)}
          className={styles.tooltip}
        >
          <p>
            <span>{l10n.getString("profile-forwarded-copy-2")}</span>
          </p>
          <p>
            <strong>{l10n.getString("profile-forwarded-note")}</strong>&nbsp;
            <span>
              {l10n.getString("profile-forwarded-note-copy", {
                size: getRuntimeConfig().emailSizeLimitNumber,
                unit: getRuntimeConfig().emailSizeLimitUnit,
              })}
            </span>
          </p>
        </div>
      )}
    </div>
  );
};

const BlockedTooltip = (props: TooltipProps) => {
  const { l10n } = useLocalization();
  const triggerState = useTooltipTriggerState({ delay: 0 });
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipTrigger = useTooltipTrigger({}, triggerState, triggerRef);

  const { tooltipProps } = useTooltip({}, triggerState);
  return (
    <div className={styles["stat-wrapper"]}>
      <span
        ref={triggerRef}
        {...tooltipTrigger.triggerProps}
        className={`${styles.stat} ${styles["blocked-stat"]}`}
      >
        {props.children}
      </span>
      {triggerState.isOpen && (
        <div
          {...mergeProps(tooltipTrigger.tooltipProps, tooltipProps)}
          className={styles.tooltip}
        >
          {l10n.getString("profile-blocked-copy-2")}
        </div>
      )}
    </div>
  );
};

const TrackersRemovedTooltip = (props: TooltipProps) => {
  const { l10n } = useLocalization();
  const triggerState = useTooltipTriggerState({ delay: 0 });
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipTrigger = useTooltipTrigger({}, triggerState, triggerRef);

  const { tooltipProps } = useTooltip({}, triggerState);
  return (
    <div className={styles["stat-wrapper"]}>
      <span
        ref={triggerRef}
        {...tooltipTrigger.triggerProps}
        className={`${styles.stat} ${styles["trackers-removed-stat"]}`}
      >
        {props.children}
      </span>
      {triggerState.isOpen && (
        <div
          {...mergeProps(tooltipTrigger.tooltipProps, tooltipProps)}
          className={styles.tooltip}
        >
          <p>{l10n.getString("profile-trackers-removed-tooltip-part1")}</p>
          <Localized
            id="profile-trackers-removed-tooltip-part2-2"
            elems={{
              b: <b />,
            }}
          >
            <p />
          </Localized>
        </div>
      )}
    </div>
  );
};

const RepliesTooltip = (props: TooltipProps) => {
  const { l10n } = useLocalization();
  const triggerState = useTooltipTriggerState({ delay: 0 });
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipTrigger = useTooltipTrigger({}, triggerState, triggerRef);

  const { tooltipProps } = useTooltip({}, triggerState);

  return (
    <div className={styles["stat-wrapper"]}>
      <span
        ref={triggerRef}
        {...tooltipTrigger.triggerProps}
        className={`${styles.stat} ${styles["replies-stat"]}`}
      >
        {props.children}
      </span>
      {triggerState.isOpen && (
        <div
          {...mergeProps(tooltipTrigger.tooltipProps, tooltipProps)}
          className={styles.tooltip}
        >
          {l10n.getString("profile-replies-tooltip")}
        </div>
      )}
    </div>
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

type TrackerRemovalIndicatorProps = {
  alias: AliasData;
  profile: ProfileData;
};
const TrackerRemovalIndicator = (props: TrackerRemovalIndicatorProps) => {
  const { l10n } = useLocalization();
  const tooltipState = useTooltipTriggerState({ delay: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { triggerProps, tooltipProps: triggerTooltipProps } = useTooltipTrigger(
    {},
    tooltipState,
    triggerRef
  );
  const { tooltipProps } = useTooltip(triggerTooltipProps, tooltipState);

  if (!isBlockingLevelOneTrackers(props.alias, props.profile)) {
    return null;
  }

  return (
    <span className={styles["tracker-removal-indicator-wrapper"]}>
      <button
        ref={triggerRef}
        {...triggerProps}
        aria-label={l10n.getString("profile-indicator-tracker-removal-alt")}
      >
        <HideIcon alt="" />
      </button>
      {tooltipState.isOpen && (
        <span
          className={styles["tracker-removal-indicator-tooltip"]}
          {...mergeProps(triggerTooltipProps, tooltipProps)}
        >
          {l10n.getString("profile-indicator-tracker-removal-tooltip")}
        </span>
      )}
    </span>
  );
};
