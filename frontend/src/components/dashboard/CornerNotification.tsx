import { useInView } from "react-intersection-observer";
import styles from "./CornerNotification.module.scss";
import { CloseIcon } from "../Icons";
import Image from "../Image";
import { ProfileData } from "../../hooks/api/profile";
import { useLocalDismissal } from "../../hooks/localDismissal";
import UpsellBannerNonUs from "../../pages/accounts/images/upsell-banner-nonus.svg";
import { useGaViewPing } from "../../hooks/gaViewPing";
import { RuntimeData } from "../../hooks/api/runtimeData";
import { isFlagActive } from "../../functions/waffle";
import { useGaEvent } from "../../hooks/gaEvent";
import { useL10n } from "../../hooks/l10n";
import { LinkButton } from "../Button";
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
  const aliases = props.aliases;
  const ctaRef = useGaViewPing({
    category: "Purchase Button",
    label: "4-mask-limit-upsell",
  });
  const gaEvent = useGaEvent();

  const title = l10n.getString(`upsell-banner-4-masks-us-heading-2`);
  const description = l10n.getString(`upsell-banner-4-masks-us-description-2`);

  if (
    isFlagActive(runtimeData, "four_mask_limit_upsell") &&
    !profile.has_premium &&
    !dismissal.isDismissed &&
    aliases.length === 4
  ) {
    return (
      <aside
        ref={wrapperRef}
        aria-label={title}
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
                alt={l10n.getString("upsell-banner-4-masks-button-close-label")}
                width={20}
                height={20}
              />
            </button>
            <Image src={UpsellBannerNonUs} alt="" />
          </div>
          <div className={styles["card-content"]}>
            <p className={styles["card-title"]}>{title}</p>
            <p className={styles["card-description"]}>{description}</p>
            <LinkButton
              className={styles["card-cta"]}
              href="/premium/?utm_medium=referral&utm_source=relay-dashboard&utm_campaign=4-masks-modal#pricing"
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
