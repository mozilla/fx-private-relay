import { useTab, useTabList, useTabPanel } from "react-aria";
import { ReactNode, useRef } from "react";
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
import { RuntimeData } from "../../hooks/api/runtimeData";
import { CheckIcon, MozillaVpnWordmark } from "../Icons";
import { getRuntimeConfig } from "../../config";
import { useGaEvent } from "../../hooks/gaEvent";
import { useGaViewPing } from "../../hooks/gaViewPing";
import { Plan, trackPlanPurchaseStart } from "../../functions/trackPurchase";
import { setCookie } from "../../functions/cookies";
import { useL10n } from "../../hooks/l10n";
import { Localized } from "../Localized";
import { LinkButton } from "../Button";
import { VisuallyHidden } from "../VisuallyHidden";
import { useIsLoggedIn } from "../../hooks/session";

type FeatureList = {
  "email-masks": number;
  "browser-extension": boolean;
  "email-tracker-removal": boolean;
  "promo-email-blocking": boolean;
  "email-subdomain": boolean;
  "email-reply": boolean;
  "phone-mask": boolean;
  vpn: boolean;
};

const freeFeatures: FeatureList = {
  "email-masks": 5,
  "browser-extension": true,
  "email-tracker-removal": true,
  "promo-email-blocking": false,
  "email-subdomain": false,
  "email-reply": false,
  "phone-mask": false,
  vpn: false,
};
const premiumFeatures: FeatureList = {
  ...freeFeatures,
  "email-masks": Number.POSITIVE_INFINITY,
  "promo-email-blocking": true,
  "email-subdomain": true,
  "email-reply": true,
};
const phoneFeatures: FeatureList = {
  ...premiumFeatures,
  "phone-mask": true,
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
  const l10n = useL10n();
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

  const desktopView = (
    <table className={styles.desktop}>
      <thead>
        <tr>
          <th scope="col">{l10n.getString("plan-matrix-heading-features")}</th>
          <th scope="col">{l10n.getString("plan-matrix-heading-plan-free")}</th>
          <th scope="col">
            {l10n.getString("plan-matrix-heading-plan-premium")}
          </th>
          <th scope="col">
            {l10n.getString("plan-matrix-heading-plan-phones")}
          </th>
          {isBundleAvailableInCountry(props.runtimeData) ? (
            <th scope="col" className={styles.recommended}>
              <b>{l10n.getString("plan-matrix-heading-plan-bundle-2")}</b>
            </th>
          ) : (
            <th scope="col">
              {l10n.getString("plan-matrix-heading-plan-bundle-2")}
            </th>
          )}
        </tr>
      </thead>
      <tbody>
        <DesktopFeature runtimeData={props.runtimeData} feature="email-masks" />
        <DesktopFeature
          runtimeData={props.runtimeData}
          feature="browser-extension"
        />
        <DesktopFeature
          runtimeData={props.runtimeData}
          feature="email-tracker-removal"
        />
        <DesktopFeature
          runtimeData={props.runtimeData}
          feature="promo-email-blocking"
        />
        <DesktopFeature
          runtimeData={props.runtimeData}
          feature="email-subdomain"
        />
        <DesktopFeature runtimeData={props.runtimeData} feature="email-reply" />
        <DesktopFeature runtimeData={props.runtimeData} feature="phone-mask" />
        <DesktopFeature runtimeData={props.runtimeData} feature="vpn" />
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
                <LinkButton
                  ref={freeButtonDesktopRef}
                  href={getRuntimeConfig().fxaLoginUrl}
                  onClick={() => countSignIn("plan-matrix-free-cta-desktop")}
                  className={styles["primary-pick-button"]}
                  disabled={isLoggedIn === "logged-in"}
                >
                  {isLoggedIn === "logged-in"
                    ? l10n.getString("plan-matrix-your-plan")
                    : l10n.getString("plan-matrix-get-relay-cta")}
                </LinkButton>
                {/*
                The <small> has space for price-related notices (e.g. "* billed
                annually"). When there is no such notice, we still want to leave
                space for it to prevent the page from jumping around; hence the
                empty <small>.
                */}
                <small>&nbsp;</small>
              </div>
            </div>
          </td>
          <td>
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
            ) : (
              <div className={`${styles.pricing} ${styles["single-price"]}`}>
                <div className={styles["pricing-overview"]}>
                  <span className={styles.price}>
                    {/* Clunky method to make sure the .pick-button is aligned
                        with the buttons for plans that do display a price */}
                    &nbsp;
                  </span>
                  <Link
                    href="/premium/waitlist"
                    className={styles["pick-button"]}
                  >
                    {l10n.getString("plan-matrix-join-waitlist")}
                  </Link>
                  {/*
                  The <small> has space for price-related notices (e.g. "* billed
                  annually"). When there is no such notice, we still want to leave
                  space for it to prevent the page from jumping around; hence the
                  empty <small>.
                  */}
                  <small>&nbsp;</small>
                </div>
              </div>
            )}
          </td>
          <td>
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
            ) : (
              <div className={`${styles.pricing} ${styles["single-price"]}`}>
                <div className={styles["pricing-overview"]}>
                  <span className={styles.price}>
                    {/* Clunky method to make sure the .pick-button is aligned
                        with the buttons for plans that do display a price */}
                    &nbsp;
                  </span>
                  <Link
                    href="/phone/waitlist"
                    className={styles["pick-button"]}
                  >
                    {l10n.getString("plan-matrix-join-waitlist")}
                  </Link>
                  <small>
                    {l10n.getString(
                      "plan-matrix-price-period-monthly-footnote-1",
                    )}
                  </small>
                </div>
              </div>
            )}
          </td>
          <td>
            {isBundleAvailableInCountry(props.runtimeData) ? (
              <div className={`${styles.pricing}`}>
                <div className={styles["pricing-toggle-wrapper"]}>
                  <p className={styles["discount-notice-wrapper"]}>
                    <Localized
                      id="plan-matrix-price-vpn-discount-promo"
                      vars={{
                        savings: "40%",
                      }}
                      elems={{
                        span: (
                          <span className={styles["discount-notice-bolded"]} />
                        ),
                      }}
                    >
                      <span className={styles["discount-notice-container"]} />
                    </Localized>
                  </p>
                </div>
                <div className={styles["pricing-overview"]}>
                  <span className={styles.price}>
                    {l10n.getString("plan-matrix-price-monthly-calculated", {
                      monthly_price: getBundlePrice(props.runtimeData, l10n),
                    })}
                  </span>
                  <a
                    ref={bundleButtonDesktopRef}
                    href={getBundleSubscribeLink(props.runtimeData)}
                    onClick={() =>
                      trackPlanPurchaseStart(
                        gaEvent,
                        { plan: "bundle" },
                        { label: "plan-matrix-bundle-cta-desktop" },
                      )
                    }
                    className={styles["pick-button"]}
                  >
                    {l10n.getString("plan-matrix-sign-up")}
                  </a>
                  <small>
                    {l10n.getString(
                      "plan-matrix-price-period-yearly-footnote-1",
                    )}
                  </small>
                </div>
              </div>
            ) : (
              <div className={`${styles.pricing} ${styles["single-price"]}`}>
                <div className={styles["pricing-overview"]}>
                  <span className={styles.price}>
                    {/* Clunky method to make sure the .pick-button is aligned
                        with the buttons for plans that do display a price */}
                    &nbsp;
                  </span>
                  <Link
                    href="/vpn-relay/waitlist"
                    className={styles["pick-button"]}
                  >
                    {l10n.getString("plan-matrix-join-waitlist")}
                  </Link>
                  <small>
                    {l10n.getString(
                      "plan-matrix-price-period-monthly-footnote-1",
                    )}
                  </small>
                </div>
              </div>
            )}
          </td>
        </tr>
      </tfoot>
    </table>
  );

  const mobileView = (
    <div className={styles.mobile}>
      <ul className={styles.plans}>
        <li className={styles.plan}>
          <h3>{l10n.getString("plan-matrix-heading-plan-free")}</h3>
          <MobileFeatureList list={freeFeatures} />
          <div className={styles.pricing}>
            <div className={styles["pricing-overview"]}>
              <span className={styles.price}>
                {l10n.getString("plan-matrix-price-free")}
              </span>
              <LinkButton
                ref={freeButtonMobileRef}
                href={getRuntimeConfig().fxaLoginUrl}
                onClick={() => countSignIn("plan-matrix-free-cta-mobile")}
                className={styles["primary-pick-button"]}
              >
                {l10n.getString("plan-matrix-get-relay-cta")}
              </LinkButton>
            </div>
          </div>
        </li>
        <li className={styles.plan}>
          <h3>{l10n.getString("plan-matrix-heading-plan-premium")}</h3>
          <MobileFeatureList list={premiumFeatures} />
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
                  label: "plan-matrix-premium-monthly-cta-mobile",
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
                subscribeLink: getPeriodicalPremiumSubscribeLink(
                  props.runtimeData,
                  "yearly",
                ),
                gaViewPing: {
                  category: "Purchase yearly Premium button",
                  label: "plan-matrix-premium-yearly-cta-mobile",
                },
                plan: {
                  plan: "premium",
                  billing_period: "yearly",
                },
              }}
            />
          ) : (
            <div className={styles.pricing}>
              <div className={styles["pricing-overview"]}>
                <span className={styles.price}>
                  {/* Clunky method to make sure that there's whitespace
                      where the prices are for other plans on the same row. */}
                  &nbsp;
                </span>
                <Link
                  href="/premium/waitlist"
                  className={styles["pick-button"]}
                >
                  {l10n.getString("plan-matrix-join-waitlist")}
                </Link>
              </div>
            </div>
          )}
        </li>
        <li className={styles.plan}>
          <h3>{l10n.getString("plan-matrix-heading-plan-phones")}</h3>
          <MobileFeatureList list={phoneFeatures} />
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
                  label: "plan-matrix-phone-monthly-cta-mobile",
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
                subscribeLink: getPhoneSubscribeLink(
                  props.runtimeData,
                  "yearly",
                ),
                gaViewPing: {
                  category: "Purchase yearly Premium+phones button",
                  label: "plan-matrix-phone-yearly-cta-mobile",
                },
                plan: {
                  plan: "phones",
                  billing_period: "yearly",
                },
              }}
            />
          ) : (
            <div className={styles.pricing}>
              <div className={styles["pricing-overview"]}>
                <span className={styles.price}>
                  {/* Clunky method to make sure that there's whitespace
                        where the prices are for other plans on the same row. */}
                  &nbsp;
                </span>
                <Link href="/phone/waitlist" className={styles["pick-button"]}>
                  {l10n.getString("plan-matrix-join-waitlist")}
                </Link>
              </div>
            </div>
          )}
        </li>
        <li
          className={`${styles.plan} ${
            isBundleAvailableInCountry(props.runtimeData)
              ? styles.recommended
              : ""
          }`}
        >
          <h3>{l10n.getString("plan-matrix-heading-plan-bundle-2")}</h3>
          <MobileFeatureList list={bundleFeatures} />
          {isBundleAvailableInCountry(props.runtimeData) ? (
            <div className={styles.pricing}>
              <div className={styles["pricing-toggle-wrapper"]}>
                <p className={styles["discount-notice-wrapper"]}>
                  <Localized
                    id="plan-matrix-price-vpn-discount-promo"
                    vars={{
                      savings: "40%",
                    }}
                    elems={{
                      span: (
                        <span className={styles["discount-notice-bolded"]} />
                      ),
                    }}
                  >
                    <span />
                  </Localized>
                </p>
              </div>
              <div className={styles["pricing-overview"]}>
                <span className={styles.price}>
                  {l10n.getString("plan-matrix-price-monthly-calculated", {
                    monthly_price: getBundlePrice(props.runtimeData, l10n),
                  })}
                </span>
                <a
                  ref={bundleButtonMobileRef}
                  href={getBundleSubscribeLink(props.runtimeData)}
                  onClick={() =>
                    trackPlanPurchaseStart(
                      gaEvent,
                      { plan: "bundle" },
                      { label: "plan-matrix-bundle-cta-mobile" },
                    )
                  }
                  className={styles["pick-button"]}
                >
                  {l10n.getString("plan-matrix-sign-up")}
                </a>
                <small>
                  {l10n.getString("plan-matrix-price-period-yearly-footnote-1")}
                </small>
              </div>
            </div>
          ) : (
            <div className={styles.pricing}>
              <div className={styles["pricing-overview"]}>
                <span className={styles.price}>
                  {/* Clunky method to make sure that there's whitespace
                        where the prices are for other plans on the same row. */}
                  &nbsp;
                </span>
                <Link
                  href="/vpn-relay/waitlist"
                  className={styles["pick-button"]}
                >
                  {l10n.getString("plan-matrix-join-waitlist")}
                </Link>
              </div>
            </div>
          )}
        </li>
      </ul>
    </div>
  );

  return (
    <div className={styles.wrapper}>
      {isBundleAvailableInCountry(props.runtimeData) && (
        <h2 className={styles["bundle-offer-heading"]}>
          {l10n.getString("plan-matrix-offer-title", {
            monthly_price: getBundlePrice(props.runtimeData, l10n),
          })}
        </h2>
      )}
      {isPeriodicalPremiumAvailableInCountry(props.runtimeData) && (
        <p className={styles["bundle-offer-content"]}>
          {l10n.getString("plan-matrix-offer-body", { savings: "40%" })}
        </p>
      )}
      <section id="pricing" className={styles["table-wrapper"]}>
        {desktopView}
        {mobileView}
      </section>
    </div>
  );
};

type DesktopFeatureProps = {
  feature: keyof FeatureList;
  runtimeData?: RuntimeData;
};
const DesktopFeature = (props: DesktopFeatureProps) => {
  return (
    <tr>
      <Localized
        id={`plan-matrix-feature-${props.feature}`}
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
      <td>
        <AvailabilityListing availability={phoneFeatures[props.feature]} />
      </td>
      <td>
        <AvailabilityListing availability={bundleFeatures[props.feature]} />
      </td>
    </tr>
  );
};

type MobileFeatureListProps = {
  list: FeatureList;
};
const MobileFeatureList = (props: MobileFeatureListProps) => {
  const l10n = useL10n();

  const lis = Object.entries(props.list)
    .filter(
      ([_feature, availability]) =>
        typeof availability !== "boolean" || availability,
    )
    .map(([feature, availability]) => {
      const variables =
        typeof availability === "number"
          ? { mask_limit: availability }
          : undefined;
      const featureDescription =
        feature === "email-masks" && availability === Number.POSITIVE_INFINITY
          ? l10n.getString("plan-matrix-feature-list-email-masks-unlimited")
          : l10n.getString(`plan-matrix-feature-mobile-${feature}`, variables);

      return (
        <li key={feature}>
          <Localized
            id={`plan-matrix-feature-mobile-${feature}`}
            elems={{
              "vpn-logo": <VpnWordmark />,
            }}
          >
            <span
              className={styles.description}
              // The aria label makes sure that listings like "Email masks"
              // with a number in span.availability get read by screen readers
              // as "5 email masks" rather than "Email masks 5".
              // However, the VPN feature has an image in there, marked up as
              // <vpn-logo> in the Fluent localisation file, so we don't want
              // that read out loud. And since the VPN feature doesn't contain
              // a number, we can skip overriding its aria-label.
              aria-label={feature !== "vpn" ? featureDescription : undefined}
            />
          </Localized>
          <span aria-hidden={true} className={styles.availability}>
            <AvailabilityListing availability={availability} />
          </span>
        </li>
      );
    });

  return <ul className={styles["feature-list"]}>{lis}</ul>;
};

type AvailabilityListingProps = {
  availability: FeatureList[keyof FeatureList];
};
const AvailabilityListing = (props: AvailabilityListingProps) => {
  const l10n = useL10n();

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
        <span className={styles.price}>
          {l10n.getString("plan-matrix-price-monthly-calculated", {
            monthly_price: props.yearlyBilled.monthly_price,
          })}
        </span>
        <a
          ref={yearlyButtonRef}
          href={props.yearlyBilled.subscribeLink}
          onClick={() =>
            trackPlanPurchaseStart(gaEvent, props.yearlyBilled.plan, {
              label: props.yearlyBilled.gaViewPing?.label,
            })
          }
          // tabIndex tells react-aria that this element is focusable
          tabIndex={0}
          className={styles["pick-button"]}
        >
          {l10n.getString("plan-matrix-sign-up")}
        </a>
        <small>
          {l10n.getString("plan-matrix-price-period-yearly-footnote-1")}
        </small>
      </Item>
      <Item
        key="monthly"
        title={l10n.getString("plan-matrix-price-period-monthly")}
      >
        <span className={styles.price}>
          {l10n.getString("plan-matrix-price-monthly-calculated", {
            monthly_price: props.monthlyBilled.monthly_price,
          })}
        </span>
        <a
          ref={monthlyButtonRef}
          href={props.monthlyBilled.subscribeLink}
          onClick={() =>
            trackPlanPurchaseStart(gaEvent, props.monthlyBilled.plan, {
              label: props.monthlyBilled.gaViewPing?.label,
            })
          }
          // tabIndex tells react-aria that this element is focusable
          tabIndex={0}
          className={styles["pick-button"]}
        >
          {l10n.getString("plan-matrix-sign-up")}
        </a>
        <small>
          {l10n.getString("plan-matrix-price-period-monthly-footnote-1")}
        </small>
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

const VpnWordmark = (props: { children?: string }) => {
  return (
    <>
      &nbsp;
      <MozillaVpnWordmark alt={props.children ?? "Mozilla VPN"} />
    </>
  );
};
