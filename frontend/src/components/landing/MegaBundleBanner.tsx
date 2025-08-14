import {
  getMegabundlePrice,
  getMegabundleSubscribeLink,
  isMegabundleAvailableInCountry,
  getMegabundleYearlyPrice,
} from "../../functions/getPlan";
import { RuntimeData } from "../../hooks/api/types";
import styles from "./MegaBundleBanner.module.scss";
import { LinkButton } from "../Button";
import { trackPlanPurchaseStart } from "../../functions/trackPurchase";
import { useGaViewPing } from "../../hooks/gaViewPing";
import { useGaEvent } from "../../hooks/gaEvent";
import { useL10n } from "../../hooks/l10n";
import VpnIcon from "./images/vpn-icon.svg";
import RelayIcon from "./images/relay-icon.svg";
import MonitorIcon from "./images/monitor-icon.svg";

export type Props = {
  runtimeData: RuntimeData;
};

export const MegabundleBanner = (props: Props) => {
  const l10n = useL10n();
  const gaEvent = useGaEvent();

  const megabundleUpgradeCta = useGaViewPing({
    category: "Megabundle banner",
    label: "megabundle-banner-upgrade-promo",
  });

  return (
    <div
      className={styles["megabundle-banner-wrapper"]}
      data-testid="megabundle-banner"
    >
      <div className={styles["first-section"]}>
        <div className={styles["shield-img-wrapper"]} />
      </div>
      {isMegabundleAvailableInCountry(props.runtimeData) && (
        <div className={styles["second-section"]}>
          <div className={styles["megabundle-banner-description"]}>
            {props.runtimeData && (
              <h2>
                {l10n.getString("megabundle-banner-header", {
                  monthly_price: getMegabundlePrice(props.runtimeData, l10n),
                })}
              </h2>
            )}
            <div className={styles["middle-section"]}>
              <div className={styles["megabundle-banner-tools"]}>
                <p className={styles["megabundle-banner-tools-headline"]}>
                  {l10n.getString("megabundle-banner-header-tools")}
                </p>
                <ul className={styles["megabundle-banner-value-props"]}>
                  <li>
                    <img
                      src={VpnIcon.src}
                      alt="vpn icon"
                      width="20"
                      height="20"
                    />
                    {l10n.getString("megabundle-banner-plan-modules-vpn")}
                  </li>
                  <li>
                    <img
                      src={MonitorIcon.src}
                      alt="monitor icon"
                      width="20"
                      height="20"
                    />
                    {l10n.getString("megabundle-banner-plan-modules-monitor")}
                  </li>
                  <li>
                    <img
                      src={RelayIcon.src}
                      alt="relay icon"
                      width="20"
                      height="20"
                    />
                    {l10n.getString("megabundle-banner-plan-modules-relay")}
                  </li>
                </ul>
              </div>
              <p className={styles["megabundle-plan-body"]}>
                {l10n.getString("megabundle-banner-plan-body")}
              </p>
            </div>
            <div className={styles["bottom-section"]}>
              <LinkButton
                ref={megabundleUpgradeCta}
                className={styles["button"]}
                href={getMegabundleSubscribeLink(props.runtimeData)}
                onClick={() =>
                  trackPlanPurchaseStart(
                    gaEvent,
                    { plan: "megabundle" },
                    { label: "megabundle-banner-upgrade-promo" },
                  )
                }
              >
                {l10n.getString("megabundle-banner-cta")}
              </LinkButton>
              <div className={styles["bottom-section-text"]}>
                <span className={styles["button-sub-text"]}>
                  {l10n.getString("megabundle-banner-billed-annually", {
                    billed: getMegabundleYearlyPrice(props.runtimeData, l10n),
                  })}
                </span>
                <span className={styles["button-sub-text"]}>
                  {l10n.getString("megabundle-banner-money-back-guarantee", {
                    days_guarantee: "30",
                  })}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
