import { event as gaEvent } from "react-ga";
import { useLocalization } from "@fluent/react";
import styles from "./PurchasePhonesPlan.module.scss";
import WomanPhone from "./images/woman-phone.svg";
import { LinkButton } from "../../Button";
import { useGaViewPing } from "../../../hooks/gaViewPing";
import {
  getPhonesPrice,
  getPhoneSubscribeLink,
  isPhonesAvailableInCountry,
} from "../../../functions/getPlan";
import { useRuntimeData } from "../../../hooks/api/runtimeData";
import { trackPlanPurchaseStart } from "../../../functions/trackPurchase";

export const PurchasePhonesPlan = () => {
  const { l10n } = useLocalization();
  const runtimeData = useRuntimeData();
  const purchaseButtonRef = useGaViewPing({
    category: "Purchase Button",
    label: "phone-onboarding-purchase-cta",
  });

  if (!isPhonesAvailableInCountry(runtimeData.data)) {
    return null;
  }

  const purchase = () => {
    gaEvent({
      category: "Purchase Premium+phones button",
      action: "Engage",
      label: "phone-cta",
    });
    trackPlanPurchaseStart({ plan: "phones", billing_period: "monthly" });
  };

  return (
    <main className={styles.wrapper}>
      <div className={styles.lead}>
        <img src={WomanPhone.src} alt="" width={200} />
        <h2>{l10n.getString("phone-onboarding-step1-headline")}</h2>
        <p>{l10n.getString("phone-onboarding-step1-body")}</p>
      </div>
      <div className={styles.description}>
        <ul>
          <li>{l10n.getString("phone-onboarding-step1-list-item-1")}</li>
          <li>{l10n.getString("phone-onboarding-step1-list-item-2")}</li>
          <li>{l10n.getString("phone-onboarding-step1-list-item-3")}</li>
        </ul>
        <div className={styles.action}>
          <h3>
            {l10n.getString("phone-onboarding-step1-button-label")}
            <span>
              {l10n.getString("phone-onboarding-step1-button-price", {
                monthly_price: getPhonesPrice(runtimeData.data, "monthly"),
              })}
            </span>
          </h3>
          <LinkButton
            ref={purchaseButtonRef}
            href={getPhoneSubscribeLink(runtimeData.data, "monthly")}
            onClick={() => purchase()}
          >
            {l10n.getString("phone-onboarding-step1-button-cta")}
          </LinkButton>
        </div>
      </div>
    </main>
  );
};
