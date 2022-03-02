import { ReactLocalization, useLocalization } from "@fluent/react";
import { useRef } from "react";
import {
  mergeProps,
  useFocusRing,
  useSlider,
  useSliderThumb,
  VisuallyHidden,
} from "react-aria";
import Link from "next/link";
import { SliderState, useSliderState } from "react-stately";
import { event as gaEvent } from "react-ga";
import styles from "./BlockLevelSlider.module.scss";
import UmbrellaClosed from "./images/umbrella-closed.svg";
import UmbrellaClosedMobile from "../../../../../static/images/umbrella-closed-mobile.svg";
import UmbrellaSemi from "./images/umbrella-semi.svg";
import UmbrellaSemiMobile from "../../../../../static/images/umbrella-semi-mobile.svg";
import UmbrellaOpen from "./images/umbrella-open.svg";
import UmbrellaOpenMobile from "../../../../../static/images/umbrella-open-mobile.svg";
import { AliasData } from "../../../hooks/api/aliases";
import { LockIcon } from "../../Icons";

export type BlockLevel = "none" | "promotional" | "all";
export type Props = {
  alias: AliasData;
  onChange: (blockLevel: BlockLevel) => void;
  hasPremium: boolean;
};

/**
 * The slider has only a single thumb, so we can always refer to it by its index of 0.
 */
const onlyThumbIndex = 0;

export const BlockLevelSlider = (props: Props) => {
  const { l10n } = useLocalization();
  const trackRef = useRef<HTMLDivElement>(null);
  const numberFormatter = new SliderValueFormatter(l10n);
  const sliderSettings: Parameters<typeof useSliderState>[0] = {
    minValue: 0,
    maxValue: 100,
    step: 50,
    numberFormatter: numberFormatter,
    label: l10n.getString("profile-promo-email-blocking-title"),
    onChange: (value) => {
      const blockLevel = getBlockLevelFromSliderValue(value[onlyThumbIndex]);
      gaEvent({
        category: "Dashboard Alias Settings",
        action: "Toggle Forwarding",
        label: getBlockLevelGaEventLabel(blockLevel),
      });
      // Free users can't enable Promotional email blocking:
      if (blockLevel !== "promotional" || props.hasPremium) {
        return props.onChange(blockLevel);
      }
    },
    defaultValue: [getSliderValueForAlias(props.alias)],
  };
  const sliderState = useSliderState(sliderSettings);

  const { groupProps, trackProps, labelProps, outputProps } = useSlider(
    sliderSettings,
    sliderState,
    trackRef
  );

  const lockIcon = props.hasPremium ? null : (
    <LockIcon alt="" width={14} height={16} className={styles["lock-icon"]} />
  );

  const premiumOnlyMarker = props.hasPremium ? null : (
    <>
      <br />
      <span className={styles["premium-only-marker"]}>
        {l10n.getString(
          "profile-promo-email-blocking-option-promotionals-premiumonly-marker"
        )}
      </span>
    </>
  );

  const isBlockLevelActive = (blockLevel: BlockLevel): boolean => {
    if (
      blockLevel === "none" &&
      props.alias.enabled === true &&
      props.alias.block_list_emails !== true
    ) {
      return true;
    }
    if (
      blockLevel === "promotional" &&
      props.alias.enabled === true &&
      props.alias.block_list_emails === true
    ) {
      return true;
    }
    if (blockLevel === "all" && props.alias.enabled === false) {
      return true;
    }
    return false;
  };
  const getTrackStopClassNames = (blockLevel: BlockLevel): string => {
    const isActiveClass = isBlockLevelActive(blockLevel)
      ? styles["is-active"]
      : "";
    const isSelectedClass =
      getBlockLevelFromSliderValue(
        sliderState.getThumbValue(onlyThumbIndex)
      ) === blockLevel
        ? styles["is-selected"]
        : "";
    const blockLevelClassName = styles[`track-stop-${blockLevel}`];

    return `${styles["track-stop"]} ${blockLevelClassName} ${isActiveClass} ${isSelectedClass}`;
  };

  return (
    <div
      {...groupProps}
      className={`${styles.group} ${
        props.hasPremium ? styles["is-premium"] : styles["is-free"]
      }`}
    >
      <div className={styles.control}>
        <label {...labelProps} className={styles["slider-label"]}>
          {sliderSettings.label}
        </label>
        <div {...trackProps} ref={trackRef} className={styles.track}>
          <div className={styles["track-line"]} />
          <div className={getTrackStopClassNames("none")}>
            <img src={UmbrellaClosedMobile.src} alt="" />
            <p aria-hidden="true">{getLabelForBlockLevel("none", l10n)}</p>
          </div>
          <div className={getTrackStopClassNames("promotional")}>
            <img src={UmbrellaSemiMobile.src} alt="" />
            {lockIcon}
            <p aria-hidden="true">
              {getLabelForBlockLevel("promotional", l10n)}
              {premiumOnlyMarker}
            </p>
          </div>
          <div className={getTrackStopClassNames("all")}>
            <img src={UmbrellaOpenMobile.src} alt="" />
            <p aria-hidden="true">{getLabelForBlockLevel("all", l10n)}</p>
          </div>
          <Thumb sliderState={sliderState} trackRef={trackRef} />
        </div>
      </div>
      <VisuallyHidden>
        {/* The p[aria-hidden] elements above already show the current and
        possible values for sighted users, but this element announces the
        current value for screen reader users. */}
        <output {...outputProps} className={styles["value-label"]}>
          {sliderState.getThumbValueLabel(onlyThumbIndex)}
        </output>
      </VisuallyHidden>
      <output {...outputProps} className={styles["value-description"]}>
        <BlockLevelIllustration
          level={getBlockLevelFromSliderValue(
            sliderState.getThumbValue(onlyThumbIndex)
          )}
        />
        <BlockLevelDescription
          level={getBlockLevelFromSliderValue(
            sliderState.getThumbValue(onlyThumbIndex)
          )}
          hasPremium={props.hasPremium}
        />
      </output>
    </div>
  );
};

type ThumbProps = {
  sliderState: SliderState;
  trackRef: React.RefObject<HTMLDivElement>;
};
const Thumb = (props: ThumbProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const { thumbProps, inputProps } = useSliderThumb(
    {
      index: onlyThumbIndex,
      trackRef: props.trackRef,
      inputRef: inputRef,
    },
    props.sliderState
  );

  const { focusProps, isFocusVisible } = useFocusRing();

  const focusClassName = isFocusVisible ? styles["is-focused"] : "";
  const draggingClassName = props.sliderState.isThumbDragging(onlyThumbIndex)
    ? styles["is-dragging"]
    : "";

  return (
    <div
      className={styles["thumb-container"]}
      style={{
        left: `${props.sliderState.getThumbPercent(onlyThumbIndex) * 100}%`,
      }}
    >
      <div
        {...thumbProps}
        className={`${styles.thumb} ${focusClassName} ${draggingClassName}`}
      >
        <VisuallyHidden>
          <input ref={inputRef} {...mergeProps(inputProps, focusProps)} />
        </VisuallyHidden>
      </div>
    </div>
  );
};

const BlockLevelDescription = (props: {
  level: BlockLevel;
  hasPremium: boolean;
}) => {
  const { l10n } = useLocalization();

  if (props.level === "none") {
    return (
      <span className={styles["value-description-content"]}>
        {l10n.getString("profile-promo-email-blocking-description-none-2")}
      </span>
    );
  }

  if (props.level === "promotional" && props.hasPremium) {
    return (
      <span className={styles["value-description-content"]}>
        {l10n.getString(
          "profile-promo-email-blocking-description-promotionals"
        )}
        <Link href="/faq#faq-promotional-email-blocking">
          <a>{l10n.getString("banner-label-data-notification-body-cta")}</a>
        </Link>
      </span>
    );
  }

  if (props.level === "promotional" && !props.hasPremium) {
    return (
      <span className={styles["value-description-content"]}>
        <b className={styles["locked-message"]}>
          <LockIcon alt="" className={styles["lock-icon"]} />
          {l10n.getString(
            "profile-promo-email-blocking-description-promotionals-locked-label"
          )}
        </b>
        {l10n.getString(
          "profile-promo-email-blocking-description-promotionals"
        )}
        <Link href="/premium/">
          <a>
            {l10n.getString(
              "profile-promo-email-blocking-description-promotionals-locked-cta"
            )}
          </a>
        </Link>
      </span>
    );
  }

  return (
    <span className={styles["value-description-content"]}>
      {l10n.getString("profile-promo-email-blocking-description-all-2")}
    </span>
  );
};
const BlockLevelIllustration = (props: { level: BlockLevel }) => {
  if (props.level === "none") {
    return (
      <img src={UmbrellaClosed.src} height={UmbrellaClosed.height} alt="" />
    );
  }

  if (props.level === "promotional") {
    return <img src={UmbrellaSemi.src} height={UmbrellaSemi.height} alt="" />;
  }

  return <img src={UmbrellaOpen.src} height={UmbrellaOpen.height} alt="" />;
};

function getSliderValueForAlias(alias: AliasData): number {
  if (alias.enabled === false) {
    return 100;
  }
  if (alias.block_list_emails === true) {
    return 50;
  }
  return 0;
}

function getBlockLevelFromSliderValue(value: number): BlockLevel {
  if (value === 0) {
    return "none";
  }
  if (value === 50) {
    return "promotional";
  }
  return "all";
}
function getLabelForBlockLevel(
  blockLevel: BlockLevel,
  l10n: ReactLocalization
): string {
  switch (blockLevel) {
    case "none":
      return l10n.getString("profile-promo-email-blocking-option-none");
    case "promotional":
      return l10n.getString("profile-promo-email-blocking-option-promotionals");
    case "all":
      return l10n.getString("profile-promo-email-blocking-option-all");
  }
}
class SliderValueFormatter implements Intl.NumberFormat {
  l10n: ReactLocalization;

  constructor(l10n: ReactLocalization) {
    this.l10n = l10n;
  }
  // This method is only implemented to conform with the `Intl.NumberFormat`
  // interface, but react-aria should only call the `.format` method:
  resolvedOptions(): Intl.ResolvedNumberFormatOptions {
    throw new Error("Method not implemented.");
  }
  // This method is only implemented to conform with the `Intl.NumberFormat`
  // interface, but react-aria should only call the `.format` method:
  formatToParts(_number?: number | bigint): Intl.NumberFormatPart[] {
    throw new Error("Method not implemented.");
  }
  // This method is only implemented to conform with the `Intl.NumberFormat`
  // interface, but react-aria should only call the `.format` method:
  formatRange(_startDate: number | bigint, _endDate: number | bigint): string {
    throw new Error("Method not implemented.");
  }
  // This method is only implemented to conform with the `Intl.NumberFormat`
  // interface, but react-aria should only call the `.format` method:
  formatRangeToParts(
    _startDate: number | bigint,
    _endDate: number | bigint
  ): Intl.NumberFormatPart[] {
    throw new Error("Method not implemented.");
  }

  format(value: number): string {
    return getLabelForBlockLevel(
      getBlockLevelFromSliderValue(value),
      this.l10n
    );
  }
}

function getBlockLevelGaEventLabel(blockLevel: BlockLevel): string {
  switch (blockLevel) {
    case "none":
      return "User enabled forwarding";
    case "promotional":
      return "User enabled promotional emails blocking";
    case "all":
      return "User disabled forwarding";
  }
}
