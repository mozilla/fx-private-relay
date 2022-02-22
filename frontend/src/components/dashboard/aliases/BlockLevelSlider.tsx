import { ReactLocalization, useLocalization } from "@fluent/react";
import { useRef } from "react";
import {
  mergeProps,
  useFocusRing,
  useSlider,
  useSliderThumb,
  VisuallyHidden,
} from "react-aria";
import { SliderState, useSliderState } from "react-stately";
import { event as gaEvent } from "react-ga";
import styles from "./BlockLevelSlider.module.scss";
import UmbrellaClosed from "../../../../../static/images/umbrella-closed.svg";
import UmbrellaClosedMobile from "../../../../../static/images/umbrella-closed-mobile.svg";
import UmbrellaSemi from "../../../../../static/images/umbrella-semi.svg";
import UmbrellaSemiMobile from "../../../../../static/images/umbrella-semi-mobile.svg";
import UmbrellaOpen from "../../../../../static/images/umbrella-open.svg";
import UmbrellaOpenMobile from "../../../../../static/images/umbrella-open-mobile.svg";
import { AliasData } from "../../../hooks/api/aliases";
import Link from "next/link";

export type BlockLevel = "none" | "promotional" | "all";
export type Props = {
  alias: AliasData;
  onChange: (blockLevel: BlockLevel) => void;
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
      const label =
        blockLevel === "all"
          ? "User disabled forwarding"
          : blockLevel === "promotional"
          ? "User enabled promotional emails blocking"
          : "User enabled forwarding";
      gaEvent({
        category: "Dashboard Alias Settings",
        action: "Toggle Forwarding",
        label: label,
      });
      return props.onChange(blockLevel);
    },
    defaultValue: [getSliderValueForAlias(props.alias)],
  };
  const sliderState = useSliderState(sliderSettings);

  const { groupProps, trackProps, labelProps, outputProps } = useSlider(
    sliderSettings,
    sliderState,
    trackRef
  );

  return (
    <div {...groupProps} className={styles.group}>
      <div className={styles.control}>
        <label {...labelProps} className={styles["slider-label"]}>
          {sliderSettings.label}
        </label>
        <div {...trackProps} ref={trackRef} className={styles.track}>
          <div className={styles["track-line"]} />
          <div
            className={`${styles["track-stop"]} ${styles["track-stop-none"]} ${
              getBlockLevelFromSliderValue(
                sliderState.getThumbValue(onlyThumbIndex)
              ) === "none"
                ? styles["is-active"]
                : ""
            }`}
          >
            <img src={UmbrellaClosedMobile.src} alt="" />
            <p aria-hidden="true">{getLabelForBlockLevel("none", l10n)}</p>
          </div>
          <div
            className={`${styles["track-stop"]} ${
              styles["track-stop-promotional"]
            } ${
              getBlockLevelFromSliderValue(
                sliderState.getThumbValue(onlyThumbIndex)
              ) === "promotional"
                ? styles["is-active"]
                : ""
            }`}
          >
            <img src={UmbrellaSemiMobile.src} alt="" />
            <p aria-hidden="true">
              {getLabelForBlockLevel("promotional", l10n)}
            </p>
          </div>
          <div
            className={`${styles["track-stop"]} ${styles["track-stop-all"]} ${
              getBlockLevelFromSliderValue(
                sliderState.getThumbValue(onlyThumbIndex)
              ) === "all"
                ? styles["is-active"]
                : ""
            }`}
          >
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
        <span>
          <BlockLevelDescription
            level={getBlockLevelFromSliderValue(
              sliderState.getThumbValue(onlyThumbIndex)
            )}
          />
        </span>
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

  return (
    <div
      className={styles["thumb-container"]}
      style={{
        left: `${props.sliderState.getThumbPercent(onlyThumbIndex) * 100}%`,
      }}
    >
      <div
        {...thumbProps}
        className={`${styles.thumb} ${
          isFocusVisible ? styles["is-focused"] : ""
        } ${
          props.sliderState.isThumbDragging(onlyThumbIndex)
            ? styles["is-dragging"]
            : ""
        }`}
      >
        <VisuallyHidden>
          <input ref={inputRef} {...mergeProps(inputProps, focusProps)} />
        </VisuallyHidden>
      </div>
    </div>
  );
};

const BlockLevelDescription = (props: { level: BlockLevel }) => {
  const { l10n } = useLocalization();

  if (props.level === "none") {
    return (
      <>{l10n.getString("profile-promo-email-blocking-description-none")}</>
    );
  }

  if (props.level === "promotional") {
    return (
      <>
        {l10n.getString(
          "profile-promo-email-blocking-description-promotionals"
        )}
        <br />
        <Link href="/faq#faq-promotional-email-blocking">
          <a>{l10n.getString("banner-label-data-notification-body-cta")}</a>
        </Link>
      </>
    );
  }

  return <>{l10n.getString("profile-promo-email-blocking-description-all")}</>;
};
const BlockLevelIllustration = (props: { level: BlockLevel }) => {
  if (props.level === "none") {
    return <img src={UmbrellaClosed.src} alt="" />;
  }

  if (props.level === "promotional") {
    return <img src={UmbrellaSemi.src} alt="" />;
  }

  return <img src={UmbrellaOpen.src} alt="" />;
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
class SliderValueFormatter extends Intl.NumberFormat {
  l10n: ReactLocalization;

  constructor(l10n: ReactLocalization) {
    super();
    this.l10n = l10n;
  }

  format(value: number): string {
    return getLabelForBlockLevel(
      getBlockLevelFromSliderValue(value),
      this.l10n
    );
  }
}
