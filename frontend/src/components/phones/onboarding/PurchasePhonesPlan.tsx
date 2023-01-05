import styles from "./PurchasePhonesPlan.module.scss";
import WomanPhone from "./images/woman-phone.svg";
import { LinkButton } from "../../Button";
import { useGaViewPing } from "../../../hooks/gaViewPing";
import {
  getPhonesPrice,
  getPhoneSubscribeLink,
  RuntimeDataWithPhonesAvailable,
} from "../../../functions/getPlan";
import { trackPlanPurchaseStart } from "../../../functions/trackPurchase";
import {
  Item,
  TabListProps,
  TabListState,
  useTabListState,
} from "react-stately";
import { Key, ReactNode, useRef } from "react";
import { useTab, useTabList, useTabPanel } from "react-aria";
import { useL10n } from "../../../hooks/l10n";

export type Props = {
  runtimeData: RuntimeDataWithPhonesAvailable;
};

export const PurchasePhonesPlan = (props: Props) => {
  const l10n = useL10n();

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
          <li>{l10n.getString("phone-onboarding-step1-list-item-4")}</li>
        </ul>
        <div className={styles.action}>
          <h3>{l10n.getString("phone-onboarding-step1-button-label")}</h3>
          <PricingToggle runtimeData={props.runtimeData} />
        </div>
      </div>
    </main>
  );
};

type PricingToggleProps = {
  runtimeData: RuntimeDataWithPhonesAvailable;
};
const PricingToggle = (props: PricingToggleProps) => {
  const l10n = useL10n();
  const yearlyButtonRef = useGaViewPing({
    category: "Purchase yearly Premium+phones button",
    label: "phone-onboarding-purchase-yearly-cta",
  });
  const monthlyButtonRef = useGaViewPing({
    category: "Purchase monthly Premium+phones button",
    label: "phone-onboarding-purchase-monthly-cta",
  });

  return (
    <PricingTabs>
      <Item
        key="yearly"
        title={l10n.getString("phone-onboarding-step1-period-toggle-yearly")}
      >
        <span className={styles.price}>
          {l10n.getString("phone-onboarding-step1-button-price", {
            monthly_price: getPhonesPrice(props.runtimeData, "yearly", l10n),
          })}
          <span>
            {` `}
            {l10n.getString("phone-onboarding-step1-button-price-note")}
          </span>
        </span>
        <LinkButton
          ref={yearlyButtonRef}
          href={getPhoneSubscribeLink(props.runtimeData, "yearly")}
          onClick={() =>
            trackPlanPurchaseStart(
              { plan: "phones", billing_period: "yearly" },
              {
                label: "phone-onboarding-purchase-yearly-cta",
              }
            )
          }
          // tabIndex tells react-aria that this element is focusable
          tabIndex={0}
          className={styles["pick-button"]}
        >
          {l10n.getString("phone-onboarding-step1-button-cta")}
        </LinkButton>
      </Item>
      <Item
        key="monthly"
        title={l10n.getString("phone-onboarding-step1-period-toggle-monthly")}
      >
        <span className={styles.price}>
          {l10n.getString("phone-onboarding-step1-button-price", {
            monthly_price: getPhonesPrice(props.runtimeData, "monthly", l10n),
          })}
        </span>
        <LinkButton
          ref={monthlyButtonRef}
          href={getPhoneSubscribeLink(props.runtimeData, "monthly")}
          onClick={() =>
            trackPlanPurchaseStart(
              { plan: "phones", billing_period: "monthly" },
              {
                label: "phone-onboarding-purchase-monthly-cta",
              }
            )
          }
          // tabIndex tells react-aria that this element is focusable
          tabIndex={0}
          className={styles["pick-button"]}
        >
          {l10n.getString("phone-onboarding-step1-button-cta")}
        </LinkButton>
      </Item>
    </PricingTabs>
  );
};

const PricingTabs = (props: TabListProps<object>) => {
  const tabListState = useTabListState(props);
  const tabListRef = useRef(null);
  const { tabListProps } = useTabList(props, tabListState, tabListRef);
  const tabPanelRef = useRef(null);
  const { tabPanelProps } = useTabPanel({}, tabListState, tabPanelRef);

  return (
    <div className={styles.pricing}>
      <div className={styles["pricing-toggle-wrapper"]}>
        <div
          {...tabListProps}
          ref={tabListRef}
          className={styles["pricing-toggle"]}
        >
          {Array.from(tabListState.collection).map((item) => (
            <PricingTab key={item.key} item={item} state={tabListState} />
          ))}
        </div>
      </div>
      <div
        {...tabPanelProps}
        ref={tabPanelRef}
        className={styles["pricing-overview"]}
      >
        {tabListState.selectedItem?.props.children}
      </div>
    </div>
  );
};

const PricingTab = (props: {
  state: TabListState<object>;
  item: { key: Key; rendered: ReactNode };
}) => {
  const tabRef = useRef(null);
  const { tabProps } = useTab({ key: props.item.key }, props.state, tabRef);
  return (
    <div
      {...tabProps}
      ref={tabRef}
      className={
        props.state.selectedKey === props.item.key ? styles["is-selected"] : ""
      }
    >
      {props.item.rendered}
    </div>
  );
};
