import { useTab, useTabList, useTabPanel } from "react-aria";
import { ReactNode, useRef } from "react";
import Link from "next/link";
import {
  Item,
  TabListProps,
  TabListState,
  useTabListState,
} from "react-stately";
import styles from "./PlanGrid.module.scss";
import {
  getPeriodicalPremiumPrice,
  getPeriodicalPremiumYearlyPrice,
  getPeriodicalPremiumSubscribeLink,
  getPhonesPrice,
  getPhonesYearlyPrice,
  getPhoneSubscribeLink,
  isPeriodicalPremiumAvailableInCountry,
  isPhonesAvailableInCountry,
  getMegabundlePrice,
  getMegabundleYearlyPrice,
} from "../../functions/getPlan";
import { RuntimeData } from "../../hooks/api/runtimeData";
import {
  CheckIcon2,
  VpnIcon,
  PlusIcon2,
  MonitorIcon,
  RelayIcon,
} from "../Icons";
import { getRuntimeConfig } from "../../config";
import { useGaEvent } from "../../hooks/gaEvent";
import { useGaViewPing } from "../../hooks/gaViewPing";
import { Plan, trackPlanPurchaseStart } from "../../functions/trackPurchase";
import { setCookie } from "../../functions/cookies";
import { useL10n } from "../../hooks/l10n";
import { LinkButton } from "../Button";
import { useIsLoggedIn } from "../../hooks/session";

export type Props = {
  runtimeData?: RuntimeData;
};

/**
 * Grid cards to compare and choose between the different plans available to the user.
 */
export const PlanGrid = (props: Props) => {
  const l10n = useL10n();

  // are we using google analytics in this grid?
  const freeButtonDesktopRef = useGaViewPing({
    category: "Sign In",
    label: "plan-matrix-free-cta-desktop",
  });
  const bundleButtonDesktopRef = useGaViewPing({
    category: "Purchase Bundle button",
    label: "plan-matrix-bundle-cta-desktop",
  });
  const freeButtonMobileRef = useGaViewPing({
    category: "Sign In",
    label: "plan-matrix-free-cta-mobile",
  });
  const bundleButtonMobileRef = useGaViewPing({
    category: "Purchase Bundle button",
    label: "plan-matrix-bundle-cta-mobile",
  });
  const gaEvent = useGaEvent();

  const countSignIn = (label: string) => {
    gaEvent({
      category: "Sign In",
      action: "Engage",
      label: label,
    });
    setCookie("user-sign-in", "true", { maxAgeInSeconds: 60 * 60 });
  };

  const isLoggedIn = useIsLoggedIn();

  // need to use runtime data numbers here
  // const bundleDiscountPercentage = Math.floor(
  //   (1 - bundlePriceBilling.monthly / bundlePriceBilling.individual) * 100,
  // );

  const bundleDiscountPercentage = 45;

  return (
    <div className={styles.content}>
      <div className={styles.header}>
        <h2>
          <b>{l10n.getString("plan-grid-title")}</b>
        </h2>
        <p>{l10n.getString("plan-grid-body")}</p>
      </div>
      <section id="pricing-grid" className={styles.pricingPlans}>
        <dl
          key={"megabundle"}
          className={styles.pricingCard}
          aria-label={l10n.getString("plan-grid-megabundle-title")}
        >
          <dt>
            <b>{l10n.getString("plan-grid-megabundle-title")}</b>
            <span className={styles.pricingCardLabel}>
              {l10n.getFragment("plan-grid-megabundle-label", {
                vars: {
                  discountPercentage: bundleDiscountPercentage,
                },
              })}
            </span>
            <p>{l10n.getString("plan-grid-megabundle-subtitle")}</p>
          </dt>
          <dd key={`megabundle-feature-1`}>
            <a key="bundle-vpn" className={styles.bundleItemLink} href={""}>
              <div className={styles.bundleTitle}>
                <VpnIcon alt="" />
                <b>{l10n.getString("plan-grid-megabundle-vpn-title")}</b>
              </div>
              {l10n.getString("plan-grid-megabundle-vpn-description")}
            </a>
          </dd>
          <dd key={"megabundle-feature-2"}>
            <Link
              key="megabundle-monitor"
              className={styles.bundleItemLink}
              href="/"
            >
              <div className={styles.bundleTitle}>
                <MonitorIcon alt="" />
                <b>{l10n.getString("plan-grid-megabundle-monitor-title")}</b>
              </div>
              {l10n.getString("plan-grid-megabundle-monitor-description")}
            </Link>
          </dd>
          <dd key={"megabundle-feature-3"}>
            <Link
              key="megabundle-relay"
              className={styles.bundleItemLink}
              href="/"
            >
              <div className={styles.bundleTitle}>
                <RelayIcon alt="" />
                <b>{l10n.getString("plan-grid-megabundle-relay-title")}</b>
              </div>
              {l10n.getString("plan-grid-megabundle-relay-description")}
            </Link>
          </dd>
          <dd className={styles.pricingCardCta}>
            <p id="pricingPlanBundle">
              <span className={styles.pricingCardSavings}>
                {l10n.getString("plan-grid-megabundle-yearly", {
                  yearly_price: getMegabundleYearlyPrice(
                    props.runtimeData,
                    l10n,
                  ),
                })}
              </span>
              <strong>
                <s>{"$14.99"}</s>
                {l10n.getString("plan-grid-megabundle-monthly", {
                  price: getMegabundlePrice(props.runtimeData, l10n),
                })}
              </strong>
            </p>
            <LinkButton
              ref={() => {}}
              href={""}
              onClick={() => {}}
              className={styles["megabundle-pick-button"]}
            >
              {l10n.getString("plan-grid-card-btn")}
            </LinkButton>
          </dd>
        </dl>

        <dl
          key={"phone"}
          className={styles.pricingCard}
          aria-label={l10n.getString("plan-grid-phone-title")}
        >
          <dt>
            <b>{l10n.getString("plan-grid-premium-title")}</b>
            <p>{l10n.getString("plan-grid-phone-subtitle")}</p>
          </dt>
          <dd key={"phone-feature-plus"}>
            <span className={styles.plusNote}>
              <PlusIcon2 alt={l10n.getString("plan-grid-card-phone-plus")} />
              <b>{l10n.getString("plan-grid-card-phone-plus")}</b>
            </span>
          </dd>
          <dd key={`phone-feature-1`}>
            <CheckIcon2 alt={""} />
            <span>
              {l10n.getFragment("plan-grid-card-phone-item-one", {
                elems: { b: <b /> },
              })}
            </span>
          </dd>
          <dd className={styles.pricingCardCta}>
            {isPhonesAvailableInCountry(props.runtimeData) ? (
              <PricingToggle
                monthlyBilled={{
                  monthly_price: getPhonesPrice(
                    props.runtimeData,
                    "monthly",
                    l10n,
                  ),
                  subscribeLink: getPhoneSubscribeLink(
                    props.runtimeData,
                    "monthly",
                  ),
                  gaViewPing: {
                    category: "Purchase monthly Premium+phones button",
                    label: "plan-matrix-phone-monthly-cta-desktop",
                  },
                  plan: {
                    plan: "phones",
                    billing_period: "monthly",
                  },
                }}
                yearlyBilled={{
                  monthly_price: getPhonesPrice(
                    props.runtimeData,
                    "yearly",
                    l10n,
                  ),
                  yearly_price: getPhonesYearlyPrice(
                    props.runtimeData,
                    "yearly",
                    l10n,
                  ),
                  subscribeLink: getPhoneSubscribeLink(
                    props.runtimeData,
                    "yearly",
                  ),
                  gaViewPing: {
                    category: "Purchase yearly Premium+phones button",
                    label: "plan-matrix-phone-yearly-cta-desktop",
                  },
                  plan: {
                    plan: "phones",
                    billing_period: "yearly",
                  },
                }}
              />
            ) : null}
          </dd>
        </dl>

        <dl
          key={"premium"}
          className={styles.pricingCard}
          aria-label={l10n.getString("plan-grid-premium-title")}
        >
          <dt>
            <b>{l10n.getString("plan-grid-premium-title")}</b>
            <p>{l10n.getString("plan-grid-premium-subtitle")}</p>
          </dt>
          <dd key={"premium-feature-plus"}>
            <span className={styles.plusNote}>
              <PlusIcon2 alt={l10n.getString("plan-grid-card-premium-plus")} />
              <b>{l10n.getString("plan-grid-card-premium-plus")}</b>
            </span>
          </dd>
          <dd key={`premium-feature-1`}>
            <CheckIcon2 alt={""} />
            <span>
              {l10n.getFragment("plan-grid-card-premium-item-one", {
                elems: { b: <b /> },
              })}
            </span>
          </dd>
          <dd key={`premium-feature-2`}>
            <CheckIcon2 alt={""} />
            <span>
              {l10n.getFragment("plan-grid-card-premium-item-two", {
                elems: { b: <b /> },
              })}
            </span>
          </dd>
          <dd key={`premium-feature-3`}>
            <CheckIcon2 alt={""} />
            <span>
              {l10n.getFragment("plan-grid-card-premium-item-three", {
                elems: { b: <b /> },
              })}
            </span>
          </dd>
          <dd key={`premium-feature-4`}>
            <CheckIcon2 alt={""} />
            <span>
              {l10n.getFragment("plan-grid-card-premium-item-four", {
                elems: { b: <b /> },
              })}
            </span>
          </dd>
          <dd className={styles.pricingCardCta}>
            {isPeriodicalPremiumAvailableInCountry(props.runtimeData) ? (
              <PricingToggle
                monthlyBilled={{
                  monthly_price: getPeriodicalPremiumPrice(
                    props.runtimeData,
                    "monthly",
                    l10n,
                  ),
                  subscribeLink: getPeriodicalPremiumSubscribeLink(
                    props.runtimeData,
                    "monthly",
                  ),
                  gaViewPing: {
                    category: "Purchase monthly Premium button",
                    label: "plan-matrix-premium-monthly-cta-desktop",
                  },
                  plan: {
                    plan: "premium",
                    billing_period: "monthly",
                  },
                }}
                yearlyBilled={{
                  monthly_price: getPeriodicalPremiumPrice(
                    props.runtimeData,
                    "yearly",
                    l10n,
                  ),
                  yearly_price: getPeriodicalPremiumYearlyPrice(
                    props.runtimeData,
                    "yearly",
                    l10n,
                  ),
                  subscribeLink: getPeriodicalPremiumSubscribeLink(
                    props.runtimeData,
                    "yearly",
                  ),
                  gaViewPing: {
                    category: "Purchase yearly Premium button",
                    label: "plan-matrix-premium-yearly-cta-desktop",
                  },
                  plan: {
                    plan: "premium",
                    billing_period: "yearly",
                  },
                }}
              />
            ) : null}
          </dd>
        </dl>

        <dl
          key={"free"}
          className={styles.pricingCard}
          aria-label={l10n.getString("plan-grid-free-title")}
        >
          <dt>
            <b>{l10n.getString("plan-grid-free-title")}</b>
            <p>{l10n.getString("plan-matrix-heading-plan-free")}</p>
          </dt>
          <dd key={`free-feature-1`}>
            <CheckIcon2 alt={""} />
            <span>
              {l10n.getFragment("plan-grid-card-free-item-one", {
                vars: {
                  mask_limit: 5,
                },
                elems: { b: <b /> },
              })}
            </span>
          </dd>
          <dd key={`free-feature-2`}>
            <CheckIcon2 alt={""} />
            <span>
              {l10n.getFragment("plan-grid-card-free-item-two", {
                elems: { b: <b /> },
              })}
            </span>
          </dd>
          <dd key={`free-feature-2`}>
            <CheckIcon2 alt={""} />
            <span>
              {l10n.getFragment("plan-grid-card-free-item-three", {
                elems: { b: <b /> },
              })}
            </span>
          </dd>
          <dd className={styles.pricingCardCta}>
            <p>
              <strong>{l10n.getString("plan-matrix-price-free")}</strong>
            </p>
            <LinkButton
              ref={freeButtonDesktopRef}
              href={getRuntimeConfig().fxaLoginUrl}
              onClick={() => countSignIn("plan-matrix-free-cta-desktop")}
              className={styles["pick-button"]}
              disabled={isLoggedIn === "logged-in"}
            >
              {isLoggedIn === "logged-in"
                ? l10n.getString("plan-matrix-your-plan")
                : l10n.getString("plan-grid-card-btn")}
            </LinkButton>
          </dd>
        </dl>
      </section>
    </div>
  );
};

type PricingToggleProps = {
  yearlyBilled: {
    monthly_price: string;
    yearly_price: string;
    subscribeLink: string;
    gaViewPing: Parameters<typeof useGaViewPing>[0];
    plan: Plan;
  };
  monthlyBilled: {
    monthly_price: string;
    subscribeLink: string;
    gaViewPing: Parameters<typeof useGaViewPing>[0];
    plan: Plan;
  };
};
const PricingToggle = (props: PricingToggleProps) => {
  const l10n = useL10n();
  const gaEvent = useGaEvent();
  const yearlyButtonRef = useGaViewPing(props.yearlyBilled.gaViewPing);
  const monthlyButtonRef = useGaViewPing(props.monthlyBilled.gaViewPing);

  return (
    <PricingTabs defaultSelectedKey="yearly">
      <Item
        key="yearly"
        title={l10n.getString("plan-matrix-price-period-yearly")}
      >
        <div className={styles["price-text"]}>
          <small>
            {l10n.getString("plan-matrix-price-yearly-calculated", {
              yearly_price: props.yearlyBilled.yearly_price,
            })}
          </small>
          <span className={styles.price}>
            {l10n.getString("plan-matrix-price-monthly-calculated", {
              monthly_price: props.yearlyBilled.monthly_price,
            })}
          </span>
        </div>
        <a
          ref={yearlyButtonRef}
          href={props.yearlyBilled.subscribeLink}
          onClick={() =>
            trackPlanPurchaseStart(gaEvent, props.yearlyBilled.plan, {
              label: props.yearlyBilled.gaViewPing?.label,
            })
          }
          tabIndex={0}
          className={styles["pick-button"]}
        >
          {l10n.getString("plan-grid-card-btn")}
        </a>
      </Item>
      <Item
        key="monthly"
        title={l10n.getString("plan-matrix-price-period-monthly")}
      >
        <div className={styles["price-text"]}>
          <small>{l10n.getString("plan-grid-billed-monthly")}</small>
          <span className={styles.price}>
            {l10n.getString("plan-matrix-price-monthly-calculated", {
              monthly_price: props.monthlyBilled.monthly_price,
            })}
          </span>
        </div>
        <a
          ref={monthlyButtonRef}
          href={props.monthlyBilled.subscribeLink}
          onClick={() =>
            trackPlanPurchaseStart(gaEvent, props.monthlyBilled.plan, {
              label: props.monthlyBilled.gaViewPing?.label,
            })
          }
          tabIndex={0}
          className={styles["pick-button"]}
        >
          {l10n.getString("plan-grid-card-btn")}
        </a>
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
  item: { key: Parameters<typeof useTab>[0]["key"]; rendered: ReactNode };
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
