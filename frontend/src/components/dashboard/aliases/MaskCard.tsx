import {
  createContext,
  ReactElement,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import {
  RadioGroupProps,
  RadioGroupState,
  useRadioGroupState,
  useToggleState,
} from "react-stately";
import {
  AriaRadioGroupProps,
  AriaRadioProps,
  useFocusRing,
  useRadio,
  useRadioGroup,
  useToggleButton,
} from "react-aria";
import Link from "next/link";
import Image from "next/image";
import styles from "./MaskCard.module.scss";
import CalendarIcon from "./images/calendar.svg";
import EmailIcon from "./images/email.svg";
import {
  AliasData,
  isBlockingLevelOneTrackers,
} from "../../../hooks/api/aliases";
import { UserData } from "../../../hooks/api/user";
import { ProfileData } from "../../../hooks/api/profile";
import { RuntimeData } from "../../../hooks/api/runtimeData";
import { useL10n } from "../../../hooks/l10n";
import { LabelEditor } from "./LabelEditor";
import { ArrowDownIcon, CopyIcon, LockIcon } from "../../Icons";
import { getLocale } from "../../../functions/getLocale";
import { isFlagActive } from "../../../functions/waffle";
import { renderDate } from "../../../functions/renderDate";
import { AliasDeletionButton } from "./AliasDeletionButton";
import { VisuallyHidden } from "./../../VisuallyHidden";
import HorizontalArrow from "./../images/free-onboarding-horizontal-arrow.svg";

export type Props = {
  mask: AliasData;
  user: UserData;
  profile: ProfileData;
  onUpdate: (updatedFields: Partial<AliasData>) => void;
  onDelete: () => void;
  isOpen: boolean;
  onChangeOpen: (isOpen: boolean) => void;
  showLabelEditor?: boolean;
  runtimeData?: RuntimeData;
  placeholder?: string;
  isOnboarding?: boolean;
  children?: ReactNode;
  copyAfterMaskGeneration: boolean;
};

export const MaskCard = (props: Props) => {
  const l10n = useL10n();
  const [justCopied, setJustCopied] = useState(false);
  const [promoIsSelected, setPromoIsSelectedState] = useState(false);

  const expandButtonRef = useRef<HTMLButtonElement>(null);
  const expandButtonState = useToggleState({
    isSelected: props.isOpen === true,
    onChange: props.onChangeOpen,
  });
  const expandButtonProps = useToggleButton(
    {},
    expandButtonState,
    expandButtonRef,
  ).buttonProps;
  // Used to link the expandButton to the area-to-be-expanded:
  const detailsElementId = useId();

  const copyAddressToClipboard = useCallback(() => {
    navigator.clipboard.writeText(props.mask.full_address);
    setJustCopied(true);
    setTimeout(() => {
      setJustCopied(false);
    }, 1 * 1000);
  }, [props.mask.full_address]);

  useEffect(() => {
    if (props.copyAfterMaskGeneration) {
      copyAddressToClipboard();
    }
  }, [props.copyAfterMaskGeneration, copyAddressToClipboard]);

  const statNumberFormatter = new Intl.NumberFormat(getLocale(l10n), {
    notation: "compact",
    compactDisplay: "short",
  });

  const classNames = [
    styles.card,
    props.mask.enabled ? styles["is-enabled"] : styles["is-disabled"],
    props.mask.block_list_emails
      ? styles["is-blocking-promotionals"]
      : styles["is-not-blocking-promotionals"],
    isBlockingLevelOneTrackers(props.mask, props.profile)
      ? styles["is-removing-trackers"]
      : styles["is-not-removing-trackers"],
    props.isOnboarding ? styles["is-onboarding"] : "",
  ].join(" ");

  const blockLevel =
    props.mask.enabled === false
      ? "all"
      : props.mask.block_list_emails === true
      ? "promotionals"
      : "none";

  return (
    <>
      <div className={classNames}>
        <div className={styles.bar}>
          <div className={styles.summary}>
            {props.showLabelEditor && (
              <div className={styles["label-editor-wrapper"]}>
                <LabelEditor
                  label={props.mask.description}
                  placeholder={props.placeholder}
                  onSubmit={(newLabel) =>
                    props.onUpdate({ description: newLabel })
                  }
                />
              </div>
            )}
            <div className={styles["copy-button-wrapper"]}>
              <button
                className={styles["copy-button"]}
                title={l10n.getString("profile-label-click-to-copy")}
                aria-label={l10n.getString("profile-label-click-to-copy-alt", {
                  address: props.mask.full_address,
                })}
                onClick={copyAddressToClipboard}
              >
                <samp className={styles.address}>
                  {props.mask.full_address}
                </samp>
                <span className={styles["copy-icon"]}>
                  <CopyIcon alt="" />
                </span>
              </button>
              <span
                aria-hidden={!justCopied}
                className={styles["copied-confirmation"]}
              >
                {l10n.getString("profile-label-copied")}
              </span>
            </div>
            <div className={styles["block-level-label"]}>
              {props.mask.enabled === false
                ? l10n.getString("profile-promo-email-blocking-label-none-2")
                : props.mask.block_list_emails === true
                ? l10n.getString(
                    "profile-promo-email-blocking-label-promotionals-2",
                  )
                : l10n.getString(
                    "profile-promo-email-blocking-label-forwarding-2",
                  )}
            </div>
          </div>
          <button
            {...expandButtonProps}
            ref={expandButtonRef}
            className={styles["expand-button"]}
            aria-expanded={expandButtonState.isSelected}
            aria-controls={detailsElementId}
          >
            <ArrowDownIcon
              alt={l10n.getString(
                expandButtonState.isSelected
                  ? "profile-details-collapse"
                  : "profile-details-expand",
              )}
              width={16}
              height={16}
            />
          </button>
        </div>
        <div
          id={detailsElementId}
          className={styles["details-wrapper"]}
          hidden={!expandButtonState.isSelected}
        >
          <div className={styles.details}>
            <dl className={styles.stats}>
              <div className={`${styles.stat} ${styles["blocked-stat"]}`}>
                <dt>{l10n.getString("profile-label-blocked")}</dt>
                <dd>{statNumberFormatter.format(props.mask.num_blocked)}</dd>
              </div>
              <div className={`${styles.stat} ${styles["forwarded-stat"]}`}>
                <dt>{l10n.getString("profile-label-forwarded")}</dt>
                <dd>{statNumberFormatter.format(props.mask.num_forwarded)}</dd>
              </div>
              {/* If user is not premium, hide the replies count */}
              {props.profile.has_premium && (
                <div className={`${styles.stat} ${styles["replies-stat"]}`}>
                  <dt>{l10n.getString("profile-label-replies")}</dt>
                  <dd>{statNumberFormatter.format(props.mask.num_replied)}</dd>
                </div>
              )}

              {/*
              If the back-end does not yet support providing tracker blocking stats,
              hide the blocked trackers count:
            */}
              {isFlagActive(props.runtimeData, "tracker_removal") &&
                typeof props.mask.num_level_one_trackers_blocked ===
                  "number" && (
                  <div
                    className={`${styles.stat} ${styles["trackers-removed-stat"]}`}
                  >
                    <dt>{l10n.getString("profile-label-trackers-removed")}</dt>
                    <dd>
                      {statNumberFormatter.format(
                        props.mask.num_level_one_trackers_blocked,
                      )}
                    </dd>
                  </div>
                )}
            </dl>
            <div
              className={`${styles["block-level"]} ${
                styles[`is-blocking-${blockLevel}`]
              }`}
            >
              {props.isOnboarding && props.isOpen && (
                <div className={styles["onboarding-alias-container"]}>
                  <Image src={HorizontalArrow} alt="" />
                  <div className={styles["onboarding-alias-text"]}>
                    <p>
                      {l10n.getString(
                        "profile-free-onboarding--copy-mask-what-emails-to-block",
                      )}
                    </p>
                  </div>
                </div>
              )}
              <div className={styles["block-level-setting"]}>
                <BlockLevelSegmentedControl
                  defaultValue={blockLevel}
                  onChange={(blockLevel) => {
                    if (blockLevel === "all") {
                      return props.onUpdate({ enabled: false });
                    }
                    if (blockLevel === "promotionals") {
                      return props.onUpdate({
                        enabled: true,
                        block_list_emails: true,
                      });
                    }
                    if (blockLevel === "none") {
                      return props.onUpdate({
                        enabled: true,
                        block_list_emails: false,
                      });
                    }
                  }}
                  label={l10n.getString("profile-promo-email-blocking-title")}
                >
                  <BlockLevelOption
                    value="none"
                    setPromoSelectedState={setPromoIsSelectedState}
                  >
                    {l10n.getString("profile-promo-email-blocking-option-none")}
                  </BlockLevelOption>
                  <BlockLevelOption
                    value="promotionals"
                    isDisabled={!props.profile.has_premium}
                    title={l10n.getString(
                      "profile-promo-email-blocking-description-promotionals-locked-label",
                    )}
                    isPromo={true}
                    promoSelectedState={promoIsSelected}
                    setPromoSelectedState={setPromoIsSelectedState}
                  >
                    {!props.profile.has_premium && (
                      <LockIcon
                        alt={l10n.getString(
                          "profile-promo-email-blocking-description-promotionals-locked-label",
                        )}
                      />
                    )}
                    {l10n.getString(
                      "profile-promo-email-blocking-option-promotions",
                    )}
                  </BlockLevelOption>
                  <BlockLevelOption
                    value="all"
                    setPromoSelectedState={setPromoIsSelectedState}
                  >
                    {l10n.getString("profile-promo-email-blocking-option-all")}
                  </BlockLevelOption>
                </BlockLevelSegmentedControl>
                {promoIsSelected && !props.profile.has_premium ? (
                  <div
                    className={styles["promotions-locked-description-wrapper"]}
                  >
                    <strong>
                      <LockIcon
                        alt={l10n.getString(
                          "profile-promo-email-blocking-description-promotionals-locked-label",
                        )}
                      />
                      {l10n.getString(
                        "profile-promo-email-blocking-description-promotionals-locked-label",
                      )}
                    </strong>
                    <p>
                      {l10n.getString(
                        "profile-promo-email-blocking-description-promotionals",
                      )}
                    </p>
                    <Link
                      href="/premium#pricing"
                      className={styles["upgrade-btn"]}
                    >
                      {l10n.getString("banner-pack-upgrade-cta")}
                    </Link>
                  </div>
                ) : null}
              </div>
              <div
                className={`${styles["block-level-setting-description"]}
              ${
                // Only add chevron on mobile for premium users
                promoIsSelected &&
                !props.profile.has_premium &&
                styles["without-chevron"]
              }`}
              >
                {blockLevel === "all" &&
                  l10n.getString(
                    "profile-promo-email-blocking-description-all-2",
                  )}
                {blockLevel === "promotionals" && (
                  <>
                    <p>
                      {l10n.getString(
                        "profile-promo-email-blocking-description-promotionals",
                      )}
                    </p>
                    <p>
                      <Link href="/faq#faq-promotional-email-blocking">
                        {l10n.getString(
                          "banner-label-data-notification-body-cta",
                        )}
                      </Link>
                    </p>
                  </>
                )}
                {blockLevel === "none" &&
                  l10n.getString(
                    "profile-promo-email-blocking-description-none-3",
                  )}
              </div>
            </div>
            <div className={styles.meta}>
              <dl>
                <div className={styles.metadata}>
                  <dt>{l10n.getString("profile-label-created")}</dt>
                  <dd>
                    <Image src={CalendarIcon} alt="" />
                    {renderDate(props.mask.created_at, l10n)}
                  </dd>
                </div>
                <div className={styles.metadata}>
                  <dt>{l10n.getString("profile-label-forward-emails")}</dt>
                  <dd>
                    <Image src={EmailIcon} alt="" />
                    {props.user.email}
                  </dd>
                </div>
              </dl>
              {!props.isOnboarding && (
                <div className={styles["deletion-button-wrapper"]}>
                  <AliasDeletionButton
                    onDelete={props.onDelete}
                    alias={props.mask}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {props.isOnboarding && (
        <div
          className={
            styles[
              expandButtonState.isSelected
                ? "onboarding-open"
                : "onboarding-closed"
            ]
          }
        >
          {props.children}
        </div>
      )}
    </>
  );
};

const BlockLevelContext = createContext<RadioGroupState | null>(null);

/**
 * A "segmented control" (aka a switch with more than two options) used to set
 * the block level.
 */
const BlockLevelSegmentedControl = (
  props: { children: ReactElement[] } & RadioGroupProps &
    AriaRadioGroupProps &
    Required<Pick<AriaRadioGroupProps, "label">>,
) => {
  const state = useRadioGroupState(props);
  const { radioGroupProps, labelProps } = useRadioGroup(
    { orientation: "horizontal", ...props },
    state,
  );

  // When the block level state changes externally (i.e. from the custom mask generation success modal), we need to update the block level state within the UI.
  useEffect(() => {
    if (props.defaultValue) {
      state.setSelectedValue(props.defaultValue);
    }
    // We only want the state to change when the block level default value changes from an update within a mask generation success modal.
    // The state itsself is for visually displaying the block level, and should not be added to the dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.defaultValue]);

  return (
    <div {...radioGroupProps} className={styles["block-level-control-wrapper"]}>
      <span {...labelProps} className={styles["block-level-control-label"]}>
        {props.label}
      </span>
      <div className={styles["block-level-segmented-control"]}>
        <BlockLevelContext.Provider value={state}>
          {props.children}
        </BlockLevelContext.Provider>
      </div>
    </div>
  );
};

const BlockLevelOption = (
  props: AriaRadioProps & {
    children: ReactNode;
    title?: string;
    isPromo?: boolean;
    promoSelectedState?: boolean;
    setPromoSelectedState: (promoSelectedState: boolean) => void;
  },
) => {
  const state = useContext(BlockLevelContext);
  const inputRef = useRef<HTMLInputElement>(null);
  // The `!` is safe here as long as <BlockLevelOption> is only used as a child
  // of <BlockLevelSwitch>, which sets the state in the context:
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const { inputProps, isSelected } = useRadio(props, state!, inputRef);
  const { isFocusVisible, focusProps } = useFocusRing();

  return (
    <label
      className={`${isSelected ? styles["is-selected"] : ""} ${
        isFocusVisible ? styles["is-focused"] : ""
      } ${props.isDisabled ? styles["is-disabled"] : ""} ${
        props.promoSelectedState ? styles["promo-selected"] : ""
      }`}
      title={props.title}
      onClick={() =>
        props.isPromo
          ? props.setPromoSelectedState(!props.promoSelectedState)
          : props.setPromoSelectedState(false)
      }
    >
      <VisuallyHidden>
        <input {...inputProps} {...focusProps} ref={inputRef} />
      </VisuallyHidden>
      {props.children}
    </label>
  );
};
