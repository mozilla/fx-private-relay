import { useRef, ReactNode, useState, useCallback, RefObject } from "react";
import Link from "next/link";
import { useTabList, useTabPanel, useTab } from "react-aria";
import { useTabListState, TabListState, Item } from "react-stately";
import { useInView } from "react-intersection-observer";
import { event as gaEvent } from "react-ga";
import styles from "./CornerNotification.module.scss";
import { ArrowDownIcon, CloseIcon } from "../Icons";
import { ProfileData } from "../../hooks/api/profile";
import { DismissalData, useLocalDismissal } from "../../hooks/localDismissal";
import Image from "next/image";
import UpsellBannerNonUs from "../../pages/accounts/images/upsell-banner-nonus.svg";
import UpsellBannerUs from "../../pages/accounts/images/upsell-banner-us.svg";
import { getRuntimeConfig } from "../../config";
import { useGaViewPing } from "../../hooks/gaViewPing";
import { RuntimeData } from "../../hooks/api/runtimeData";
import { isFlagActive } from "../../functions/waffle";
import { useL10n } from "../../hooks/l10n";
import { Button, LinkButton } from "../Button";
import { isPhonesAvailableInCountry } from "../../functions/getPlan";
import { AliasData } from "../../hooks/api/aliases";

export type Props = {
  profile: ProfileData;
  runtimeData: RuntimeData;
  aliases: AliasData[];
};

export const CornerNotification = (props: Props) => {
  const l10n = useL10n();
  const [wrapperRef, wrapperIsInView] = useInView({ threshold: 1 });
  const runtimeData = props.runtimeData;
  const profile = props.profile;
  const dismissal = useLocalDismissal(
    `corner_notification_masks_upsell_${props.profile.id}`,
  );
  const isPhonesAvailable = isPhonesAvailableInCountry(runtimeData);
  const aliases = props.aliases;
  const ctaRef = useGaViewPing({
    category: "Purchase Button",
    label: "4-mask-limit-upsell",
  });

  const title = l10n.getString(
    `upsell-banner-4-masks-${isPhonesAvailable ? "us" : "non-us"}-heading`,
  );
  const description = l10n.getString(
    `upsell-banner-4-masks-${isPhonesAvailable ? "us" : "non-us"}-description`,
  );
  const illustration = isPhonesAvailable ? UpsellBannerUs : UpsellBannerNonUs;

  if (!profile.has_premium && !dismissal.isDismissed && aliases.length === 4) {
    return (
      <aside
        ref={wrapperRef}
        aria-label={l10n.getString("tips-header-title")}
        className={`${styles.wrapper} ${
          wrapperIsInView ? styles["is-in-view"] : styles["is-out-of-view"]
        }`}
      >
        <div className={styles.card}>
          <div className={styles["card-header"]}>
            <button
              className={styles["close-button"]}
              onClick={() => dismissal.dismiss()}
            >
              <CloseIcon
                alt={l10n.getString("tips-header-button-close-label")}
                width={20}
                height={20}
              />
            </button>
            <Image
              className={styles["still-alternative"]}
              src={illustration}
              alt=""
            />
          </div>
          <div className={styles["card-content"]}>
            <p className={styles["card-title"]}>{title}</p>
            <p className={styles["card-description"]}>{description}</p>
            <LinkButton
              className={styles["card-cta"]}
              href="/premium#pricing"
              ref={ctaRef}
              onClick={() => {
                gaEvent({
                  category: "Purchase Button",
                  action: "Engage",
                  label: "4-mask-limit-upsell",
                });
              }}
            >
              {l10n.getString("upsell-banner-4-masks-us-cta")}
            </LinkButton>
          </div>
        </div>
      </aside>
    );
  }
};
