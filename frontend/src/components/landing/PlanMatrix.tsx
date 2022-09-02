import { Localized, useLocalization } from "@fluent/react";
import { useTab, useTabList, useTabPanel, VisuallyHidden } from "react-aria";
import { Key, ReactNode, useRef } from "react";
import Link from "next/link";
import {
  Item,
  TabListProps,
  TabListState,
  useTabListState,
} from "react-stately";
import styles from "./PlanMatrix.module.scss";
import {
  getBundlePrice,
  getBundleSubscribeLink,
  getPeriodicalPremiumPrice,
  getPeriodicalPremiumSubscribeLink,
  getPhonesPrice,
  getPhoneSubscribeLink,
  isBundleAvailableInCountry,
  isPeriodicalPremiumAvailableInCountry,
  isPhonesAvailableInCountry,
} from "../../functions/getPlan";
import { isFlagActive } from "../../functions/waffle";
import { RuntimeData } from "../../hooks/api/runtimeData";
import { CheckIcon, MozillaVpnWordmark } from "../Icons";
import { getRuntimeConfig } from "../../config";

type FeatureList = {
  email_masks: number;
  browser_extension: boolean;
  email_tracker_removal: boolean;
  promo_email_blocking: boolean;
  email_subdomain: boolean;
  email_reply: boolean;
  phone_mask: boolean;
  vpn: boolean;
};

const freeFeatures: FeatureList = {
  email_masks: 5,
  browser_extension: true,
  email_tracker_removal: true,
  promo_email_blocking: false,
  email_subdomain: false,
  email_reply: false,
  phone_mask: false,
  vpn: false,
};
const premiumFeatures: FeatureList = {
  ...freeFeatures,
  email_masks: Number.POSITIVE_INFINITY,
  promo_email_blocking: true,
  email_subdomain: true,
  email_reply: true,
};
const phoneFeatures: FeatureList = {
  ...premiumFeatures,
  phone_mask: true,
};
const bundleFeatures: FeatureList = {
  ...phoneFeatures,
  vpn: true,
};

export type Props = {
  runtimeData?: RuntimeData;
};

/**
 * Matrix to compare and choose between the different plans available to the user.
 */
export const PlanMatrix = (props: Props) => {
  const { l10n } = useLocalization();

  const desktopView = (
    <table className={styles.desktop}>
      <thead>
        <tr>
          <th scope="col">{l10n.getString("plan-matrix-heading-features")}</th>
          <th scope="col">{l10n.getString("plan-matrix-heading-plan-free")}</th>
          <th scope="col">
            {l10n.getString("plan-matrix-heading-plan-premium")}
          </th>
          {isFlagActive(props.runtimeData, "phones") &&
            isPhonesAvailableInCountry(props.runtimeData) && (
              <th scope="col">
                {l10n.getString("plan-matrix-heading-plan-phones")}
              </th>
            )}
          {isFlagActive(props.runtimeData, "bundle") &&
            isBundleAvailableInCountry(props.runtimeData) && (
              <th scope="col" className={styles.recommended}>
                <b>{l10n.getString("plan-matrix-heading-plan-bundle")}</b>
              </th>
            )}
        </tr>
      </thead>
      <tbody>
        <DesktopFeature runtimeData={props.runtimeData} feature="email_masks" />
        <DesktopFeature
          runtimeData={props.runtimeData}
          feature="browser_extension"
        />
        <DesktopFeature
          runtimeData={props.runtimeData}
          feature="email_tracker_removal"
        />
        <DesktopFeature
          runtimeData={props.runtimeData}
          feature="promo_email_blocking"
        />
        <DesktopFeature
          runtimeData={props.runtimeData}
          feature="email_subdomain"
        />
        <DesktopFeature runtimeData={props.runtimeData} feature="email_reply" />
        {isFlagActive(props.runtimeData, "phones") &&
          isPhonesAvailableInCountry(props.runtimeData) && (
            <DesktopFeature
              runtimeData={props.runtimeData}
              feature="phone_mask"
            />
          )}
        {isFlagActive(props.runtimeData, "bundle") &&
          isBundleAvailableInCountry(props.runtimeData) && (
            <DesktopFeature runtimeData={props.runtimeData} feature="vpn" />
          )}
      </tbody>
      <tfoot>
        <tr>
          <th scope="row">
            <VisuallyHidden>
              {l10n.getString("plan-matrix-heading-price")}
            </VisuallyHidden>
          </th>
          <td>
            <div className={`${styles.pricing} ${styles["single-price"]}`}>
              <div className={styles["pricing-overview"]}>
                <span className={styles.price}>
                  {l10n.getString("plan-matrix-price-free")}
                </span>
                <a
                  href={getRuntimeConfig().fxaLoginUrl}
                  className={styles["pick-button"]}
                >
                  {l10n.getString("plan-matrix-pick")}
                </a>
              </div>
            </div>
          </td>
          <td>
            {isPeriodicalPremiumAvailableInCountry(props.runtimeData) ? (
              <PricingToggle
                monthlyBilled={{
                  monthly_price: getPeriodicalPremiumPrice(
                    props.runtimeData,
                    "monthly"
                  ),
                  subscribeLink: getPeriodicalPremiumSubscribeLink(
                    props.runtimeData,
                    "monthly"
                  ),
                }}
                yearlyBilled={{
                  monthly_price: getPeriodicalPremiumPrice(
                    props.runtimeData,
                    "yearly"
                  ),
                  subscribeLink: getPeriodicalPremiumSubscribeLink(
                    props.runtimeData,
                    "yearly"
                  ),
                }}
              />
            ) : (
              <div className={`${styles.pricing} ${styles["single-price"]}`}>
                <div className={styles["pricing-overview"]}>
                  <span className={styles.price}>
                    {/* Clunky method to make sure the .pick-button is aligned
                        with the buttons for plans that do display a price */}
                    &nbsp;
                  </span>
                  <Link href="/premium/waitlist">
                    <a className={styles["pick-button"]}>
                      {l10n.getString("plan-matrix-join-waitlist")}
                    </a>
                  </Link>
                </div>
              </div>
            )}
          </td>
          {isFlagActive(props.runtimeData, "phones") &&
            isPhonesAvailableInCountry(props.runtimeData) && (
              <td>
                <PricingToggle
                  monthlyBilled={{
                    monthly_price: getPhonesPrice(props.runtimeData, "monthly"),
                    subscribeLink: getPhoneSubscribeLink(
                      props.runtimeData,
                      "monthly"
                    ),
                  }}
                  yearlyBilled={{
                    monthly_price: getPhonesPrice(props.runtimeData, "yearly"),
                    subscribeLink: getPhoneSubscribeLink(
                      props.runtimeData,
                      "yearly"
                    ),
                  }}
                />
              </td>
            )}
          {isFlagActive(props.runtimeData, "bundle") &&
            isBundleAvailableInCountry(props.runtimeData) && (
              <td>
                <div className={`${styles.pricing}`}>
                  <div className={styles["pricing-toggle-wrapper"]}>
                    <p className={styles["discount-notice"]}>
                      {l10n.getString("plan-matrix-price-vpn-discount", {
                        percentage: "??",
                      })}
                    </p>
                  </div>
                  <div className={styles["pricing-overview"]}>
                    <span className={styles.price}>
                      {l10n.getString("plan-matrix-price-monthly", {
                        monthly_price: getBundlePrice(props.runtimeData),
                      })}
                    </span>
                    <a
                      href={getBundleSubscribeLink(props.runtimeData)}
                      className={styles["pick-button"]}
                    >
                      {l10n.getString("plan-matrix-pick")}
                    </a>
                    <small>
                      * {l10n.getString("plan-matrix-price-period-yearly-note")}
                    </small>
                  </div>
                </div>
              </td>
            )}
        </tr>
      </tfoot>
    </table>
  );

  return desktopView;
};

type DesktopFeatureProps = {
  feature: keyof FeatureList;
  runtimeData?: RuntimeData;
};
const DesktopFeature = (props: DesktopFeatureProps) => {
  return (
    <tr>
      <Localized
        id={`plan-matrix-heading-feature-${props.feature}`}
        elems={{
          "vpn-logo": <VpnWordmark />,
        }}
      >
        <th scope="row" />
      </Localized>
      <td>
        <AvailabilityListing availability={freeFeatures[props.feature]} />
      </td>
      <td>
        <AvailabilityListing availability={premiumFeatures[props.feature]} />
      </td>
      {isFlagActive(props.runtimeData, "phones") &&
        isPhonesAvailableInCountry(props.runtimeData) && (
          <td>
            <AvailabilityListing availability={phoneFeatures[props.feature]} />
          </td>
        )}
      {isFlagActive(props.runtimeData, "bundle") &&
        isBundleAvailableInCountry(props.runtimeData) && (
          <td>
            <AvailabilityListing availability={bundleFeatures[props.feature]} />
          </td>
        )}
    </tr>
  );
};

type AvailabilityListingProps = {
  availability: FeatureList[keyof FeatureList];
};
const AvailabilityListing = (props: AvailabilityListingProps) => {
  const { l10n } = useLocalization();

  if (typeof props.availability === "number") {
    if (props.availability === Number.POSITIVE_INFINITY) {
      return <>{l10n.getString("plan-matrix-feature-count-unlimited")}</>;
    }
    return <>{props.availability}</>;
  }

  if (typeof props.availability === "boolean") {
    return props.availability ? (
      <CheckIcon alt={l10n.getString("plan-matrix-feature-included")} />
    ) : (
      <VisuallyHidden>
        {l10n.getString("plan-matrix-feature-not-included")}
      </VisuallyHidden>
    );
  }

  return null as never;
};

type PricingToggleProps = {
  yearlyBilled: {
    monthly_price: string;
    subscribeLink: string;
  };
  monthlyBilled: {
    monthly_price: string;
    subscribeLink: string;
  };
};
const PricingToggle = (props: PricingToggleProps) => {
  const { l10n } = useLocalization();

  return (
    <PricingTabs>
      <Item
        key="yearly"
        title={l10n.getString("plan-matrix-price-period-yearly")}
      >
        <span className={styles.price}>
          {l10n.getString("plan-matrix-price-monthly", {
            monthly_price: props.yearlyBilled.monthly_price,
          })}
          *
        </span>
        <a
          href={props.yearlyBilled.subscribeLink}
          // tabIndex tells react-aria that this element is focusable
          tabIndex={0}
          className={styles["pick-button"]}
        >
          {l10n.getString("plan-matrix-pick")}
        </a>
        <small>
          * {l10n.getString("plan-matrix-price-period-yearly-note")}
        </small>
      </Item>
      <Item
        key="monthly"
        title={l10n.getString("plan-matrix-price-period-monthly")}
      >
        <span className={styles.price}>
          {l10n.getString("plan-matrix-price-monthly", {
            monthly_price: props.monthlyBilled.monthly_price,
          })}
        </span>
        <a
          href={props.monthlyBilled.subscribeLink}
          // tabIndex tells react-aria that this element is focusable
          tabIndex={0}
          className={styles["pick-button"]}
        >
          {l10n.getString("plan-matrix-pick")}
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

const VpnWordmark = (props: { children?: string }) => {
  return (
    <>
      &nbsp;
      <MozillaVpnWordmark alt={props.children ?? "Mozilla VPN"} />
    </>
  );
};
