import { NextPage } from "next";
import { useRouter } from "next/router";
import Link from "next/link";
import { useState } from "react";
import { useLocalization } from "@fluent/react";
import { event as gaEvent } from "react-ga";
import styles from "./index.module.scss";
import Testimonials from "../../public/images/hero-brands.svg";
import HowItWorks1 from "../../public/images/how-it-works-1.svg";
import HowItWorks2 from "../../public/images/how-it-works-2.svg";
import HowItWorks3 from "../../public/images/how-it-works-3.svg";
import ShoppingIllustration from "../../public/images/use-case-shopping.svg";
import SocialNetworksIllustration from "../../public/images/use-case-social-networks.svg";
import OfflineIllustration from "../../public/images/use-case-offline.svg";
import AccessContentIllustration from "../../public/images/use-case-access-content.svg";
import GamingIllustration from "../../public/images/use-case-gaming.svg";
import ShoppingHero from "../components/landing/carousel/images/shopping-hero.svg";
import SignupsHero from "../components/landing/carousel/images/signups-hero.svg";
import OnTheGoConnect from "../components/landing/carousel/images/onthego-illustration-connect.svg";
import OnTheGoPhone from "../components/landing/carousel/images/onthego-illustration-phone.svg";
import OnTheGoReceipt from "../components/landing/carousel/images/onthego-illustration-receipts.svg";
import { useUsers } from "../hooks/api/user";
import { Layout } from "../components/layout/Layout";
import { useGaViewPing } from "../hooks/gaViewPing";
import { LinkButton } from "../components/Button";
import { DemoPhone } from "../components/landing/DemoPhone";
import { useRuntimeData } from "../hooks/api/runtimeData";
import { Carousel } from "../components/landing/carousel/Carousel";
import { CarouselContentTextOnly } from "../components/landing/carousel/ContentTextOnly";
import { CarouselContentHero } from "../components/landing/carousel/ContentHero";
import { CarouselContentCards } from "../components/landing/carousel/ContentCards";
import { Plans } from "../components/landing/Plans";
import {
  getPremiumPlan,
  getPremiumSubscribeLink,
  isBundleAvailableInCountry,
  isPhonesAvailableInCountry,
  isPremiumAvailableInCountry,
} from "../functions/getPlan";
import { FaqAccordion } from "../components/landing/FaqAccordion";
import { getRuntimeConfig } from "../config";
import { setCookie } from "../functions/cookies";
import { Reviews } from "../components/landing/Reviews";
import { getLocale } from "../functions/getLocale";
import { useInterval } from "../hooks/interval";
import { CountdownTimer } from "../components/CountdownTimer";
import { isFlagActive } from "../functions/waffle";
import { parseDate } from "../functions/parseDate";
import { PlanMatrix } from "../components/landing/PlanMatrix";
import { BundleBanner } from "../components/landing/BundleBanner";
import { PhoneBanner } from "../components/landing/PhoneBanner";

const Home: NextPage = () => {
  const { l10n } = useLocalization();
  const router = useRouter();
  const runtimeData = useRuntimeData();
  const userData = useUsers();
  const heroCtaRef = useGaViewPing({
    category: "Sign In",
    label: "home-hero-cta",
  });
  const heroCountdownCtaRef = useGaViewPing({
    category: "Purchase Button",
    label: "Landing Page: Top Banner",
  });
  const plansCountdownCtaRef = useGaViewPing({
    category: "Purchase Button",
    label: "Landing Page: Bottom Banner",
  });
  const phoneBannerCtaRef = useGaViewPing({
    category: "Sign In",
    label: "Landing Page: Phone Banner",
  });

  const [now, setNow] = useState(Date.now());
  const endDateFormatter = new Intl.DateTimeFormat(getLocale(l10n), {
    dateStyle: "long",
  });

  useInterval(() => {
    setNow(Date.now());
  }, 1000);

  const introPricingOfferEndDate = runtimeData.data
    ? parseDate(runtimeData.data?.INTRO_PRICING_END)
    : new Date(0);
  const remainingTimeInMs = introPricingOfferEndDate.getTime() - now;

  if (typeof userData.data?.[0] === "object" && !userData.error) {
    router.push("/accounts/profile/");
  }

  const signup = () => {
    gaEvent({
      category: "Sign In",
      action: "Engage",
      label: "home-hero-cta",
    });
    setCookie("user-sign-in", "true", { maxAgeInSeconds: 60 * 60 });
  };

  const plansSection =
    // Show the countdown timer to the end of our introductory pricing offer if…
    // …the offer hasn't expired yet,
    remainingTimeInMs > 0 &&
    // …the remaining time isn't far enough in the future that the user's
    // computer's clock is likely to be wrong,
    remainingTimeInMs <= 32 * 24 * 60 * 60 * 1000 &&
    // …the user is able to purchase Premium at the introductory offer price, and
    isPremiumAvailableInCountry(runtimeData.data) &&
    // …the relevant feature flag is enabled:
    isFlagActive(runtimeData.data, "intro_pricing_countdown") ? (
      <section id="pricing" className={styles["plans-wrapper"]}>
        <div className={styles.plans}>
          <div className={styles["plan-comparison"]}>
            <Plans runtimeData={runtimeData.data} />
          </div>
          <div className={styles.callout}>
            <h2>
              {l10n.getString("landing-pricing-offer-end-headline", {
                monthly_price: getPremiumPlan(runtimeData.data).price,
              })}
            </h2>
            <div
              className={styles["end-of-intro-pricing-countdown-and-warning"]}
            >
              <b>{l10n.getString("landing-pricing-offer-end-warning")}</b>
              <CountdownTimer remainingTimeInMs={remainingTimeInMs} />
            </div>
            <LinkButton
              ref={plansCountdownCtaRef}
              href={getPremiumSubscribeLink(runtimeData.data)}
              onClick={() => {
                gaEvent({
                  category: "Purchase Button",
                  action: "Engage",
                  label: "Landing Page: Bottom Banner",
                });
              }}
            >
              {l10n.getString("landing-pricing-offer-end-cta")}
            </LinkButton>
            <p>
              {l10n.getString("landing-pricing-offer-end-body", {
                end_date: endDateFormatter.format(introPricingOfferEndDate),
              })}
            </p>
          </div>
        </div>
      </section>
    ) : // Otherwise, if the countdown timer has reached 0:
    isFlagActive(runtimeData.data, "intro_pricing_countdown") ? (
      <section id="pricing" className={styles["plans-wrapper"]}>
        <div className={styles.plans}>
          <PlanMatrix runtimeData={runtimeData.data} />
        </div>
      </section>
    ) : // Otherwise, if Premium is available in the user's country,
    // allow them to purchase it:
    isPremiumAvailableInCountry(runtimeData.data) ? (
      <section id="pricing" className={styles["plans-wrapper"]}>
        <div className={styles.plans}>
          <div className={styles["plan-comparison"]}>
            <Plans runtimeData={runtimeData.data} />
          </div>
          <div className={styles.callout}>
            <h2>
              {l10n.getString("landing-pricing-headline-2", {
                monthly_price: getPremiumPlan(runtimeData.data).price,
              })}
            </h2>
            <p>{l10n.getString("landing-pricing-body-2")}</p>
          </div>
        </div>
      </section>
    ) : (
      // Or finally, if Premium is not available in the country,
      // prompt them to join the waitlist:
      <section id="pricing" className={styles["plans-wrapper"]}>
        <div className={`${styles.plans} ${styles["non-premium-country"]}`}>
          <Plans runtimeData={runtimeData.data} />
        </div>
      </section>
    );

  // Only show the countdown timer to the end of our introductory pricing offer if…
  const introPricingEndBanner =
    // …the offer hasn't expired yet,
    remainingTimeInMs > 0 &&
    // …the remaining time isn't far enough in the future that the user's
    // computer's clock is likely to be wrong,
    remainingTimeInMs <= 32 * 24 * 60 * 60 * 1000 &&
    // …the user is able to purchase Premium at the introductory offer price, and
    isPremiumAvailableInCountry(runtimeData.data) &&
    // …the relevant feature flag is enabled:
    isFlagActive(runtimeData.data, "intro_pricing_countdown") ? (
      <div className={styles["end-of-intro-pricing-hero"]}>
        <CountdownTimer remainingTimeInMs={remainingTimeInMs} />
        <div>
          <h3>{l10n.getString("landing-offer-end-hero-heading")}</h3>
          <p>
            {l10n.getString("landing-offer-end-hero-content", {
              end_date: endDateFormatter.format(introPricingOfferEndDate),
            })}
          </p>
        </div>
      </div>
    ) : null;

  const cta =
    introPricingEndBanner === null ||
    !isPremiumAvailableInCountry(runtimeData.data) ? (
      <LinkButton
        ref={heroCtaRef}
        onClick={() => signup()}
        href={getRuntimeConfig().fxaLoginUrl}
      >
        {l10n.getString("nav-profile-sign-up")}
      </LinkButton>
    ) : (
      <LinkButton
        ref={heroCountdownCtaRef}
        href={getPremiumSubscribeLink(runtimeData.data)}
        onClick={() => {
          gaEvent({
            category: "Purchase Button",
            action: "Engage",
            label: "Landing Page: Top Banner",
          });
        }}
      >
        {l10n.getString("landing-offer-end-hero-cta")}
      </LinkButton>
    );

  const phoneBannerCta = (
    <LinkButton
      href="#pricing"
      ref={phoneBannerCtaRef}
      onClick={() =>
        gaEvent({
          category: "Sign In",
          action: "Engage",
          label: "Landing Page: Phone Banner",
        })
      }
    >
      {l10n.getString("phone-banner-cta-landing")}
    </LinkButton>
  );

  return (
    <Layout runtimeData={runtimeData.data}>
      <main>
        <section id="hero" className={styles.hero}>
          <div className={styles.lead}>
            <h2>{l10n.getString("landing-hero-headline-2")}</h2>
            <p>{l10n.getString("landing-hero-body-2")}</p>
            {introPricingEndBanner}
            {cta}
            <img
              src={Testimonials.src}
              alt="Forbes, ZDNet, Lifehacker, PCMag"
              className={styles["social-proof"]}
            />
          </div>
          <div className={styles["demo-phone"]}>
            <DemoPhone
              premium={
                runtimeData.data?.PREMIUM_PLANS.premium_available_in_country ===
                true
              }
            />
          </div>
        </section>

        {isFlagActive(runtimeData.data, "bundle") &&
          isBundleAvailableInCountry(runtimeData.data) && (
            <section className={styles["bundle-banner-section"]}>
              <BundleBanner runtimeData={runtimeData.data} />
            </section>
          )}

        {isFlagActive(runtimeData.data, "phones") &&
          isPhonesAvailableInCountry(runtimeData.data) && (
            <section className={styles["phone-banner-section"]}>
              <PhoneBanner cta={phoneBannerCta} />
            </section>
          )}

        <section id="how_it_works" className={styles["how-it-works-wrapper"]}>
          <div className={styles["how-it-works"]}>
            <h2 className={styles.headline}>
              {l10n.getString("landing-how-it-works-headline")}
            </h2>
            <p className={styles.lead}>
              {l10n.getString("landing-how-it-works-body-2")}
            </p>
            <ol className={styles.steps}>
              <li className={styles.step}>
                <img src={HowItWorks1.src} alt="" />
                <h3>{l10n.getString("how-it-works-step-1-headline")}</h3>
                <p>
                  <a href="https://addons.mozilla.org/firefox/addon/private-relay/">
                    {l10n.getString("landing-how-it-works-step-1-body-cta")}
                  </a>
                  &nbsp;
                  {l10n.getString("landing-how-it-works-step-1-body-2")}
                </p>
              </li>
              <li className={styles.step}>
                <img src={HowItWorks2.src} alt="" />
                <h3>{l10n.getString("how-it-works-step-2-headline-2")}</h3>
                <p>{l10n.getString("landing-how-it-works-step-2-body-2")}</p>
              </li>
              <li className={styles.step}>
                <img src={HowItWorks3.src} alt="" />
                <h3>{l10n.getString("how-it-works-step-3-headline-2")}</h3>
                <p>{l10n.getString("landing-how-it-works-step-3-body-2")}</p>
              </li>
            </ol>
          </div>
        </section>
        <section id="use-cases" className={styles["use-cases-wrapper"]}>
          <div className={styles["use-cases"]}>
            <Carousel
              title={l10n.getString("landing-use-cases-heading")}
              tabs={[
                {
                  color: "yellow",
                  heading: l10n.getString("landing-use-cases-shopping"),
                  content: (
                    <CarouselContentHero
                      heroImage={ShoppingHero.src}
                      heading={l10n.getString(
                        "landing-use-cases-shopping-hero-heading"
                      )}
                      body={
                        <>
                          <p>
                            {l10n.getString(
                              "landing-use-cases-shopping-hero-content1"
                            )}
                          </p>
                          <p>
                            {l10n.getString(
                              "landing-use-cases-shopping-hero-content2"
                            )}
                          </p>
                        </>
                      }
                      textFirst={true}
                    />
                  ),
                  illustration: ShoppingIllustration,
                  id: "use-cases/shopping",
                },
                {
                  color: "deep-pink",
                  heading: l10n.getString("landing-use-cases-social-networks"),
                  content: (
                    <CarouselContentTextOnly
                      heading={l10n.getString(
                        "landing-use-cases-social-networks"
                      )}
                      body={l10n.getString(
                        "landing-use-cases-social-networks-body-2"
                      )}
                    />
                  ),
                  illustration: SocialNetworksIllustration,
                  id: "use-cases/social-networks",
                },
                {
                  color: "purple",
                  heading: l10n.getString("landing-use-cases-on-the-go"),
                  content: (
                    <CarouselContentCards
                      heading={l10n.getString(
                        "landing-use-cases-on-the-go-heading"
                      )}
                      lead={l10n.getString("landing-use-cases-on-the-go-lead")}
                      cards={[
                        {
                          image: OnTheGoConnect.src,
                          heading: l10n.getString(
                            "landing-use-cases-on-the-go-connect-heading"
                          ),
                          body: l10n.getString(
                            "landing-use-cases-on-the-go-connect-body"
                          ),
                        },
                        {
                          image: OnTheGoReceipt.src,
                          heading: l10n.getString(
                            "landing-use-cases-on-the-go-receipt-heading"
                          ),
                          body: l10n.getString(
                            "landing-use-cases-on-the-go-receipt-body"
                          ),
                        },
                        {
                          image: OnTheGoPhone.src,
                          heading: l10n.getString(
                            "landing-use-cases-on-the-go-phone-heading"
                          ),
                          body: l10n.getString(
                            "landing-use-cases-on-the-go-phone-body"
                          ),
                        },
                      ]}
                    />
                  ),
                  illustration: OfflineIllustration,
                  id: "use-cases/offline",
                },
                {
                  color: "pink",
                  heading: l10n.getString("landing-use-cases-signups"),
                  content: (
                    <CarouselContentHero
                      heroImage={SignupsHero.src}
                      heading={l10n.getString(
                        "landing-use-cases-signups-hero-heading"
                      )}
                      body={
                        <>
                          <p>
                            {l10n.getString(
                              "landing-use-cases-signups-hero-content1"
                            )}
                          </p>
                          <p>
                            {l10n.getString(
                              "landing-use-cases-signups-hero-content2"
                            )}
                          </p>
                        </>
                      }
                      textFirst={false}
                    />
                  ),
                  illustration: AccessContentIllustration,
                  id: "use-cases/access-content",
                },
                {
                  color: "orange",
                  heading: l10n.getString("landing-use-cases-gaming"),
                  content: (
                    <CarouselContentTextOnly
                      heading={l10n.getString("landing-use-cases-gaming")}
                      body={l10n.getString("landing-use-cases-gaming-body-2")}
                    />
                  ),
                  illustration: GamingIllustration,
                  id: "use-cases/gaming",
                },
              ]}
            />
          </div>
        </section>
        <div className={styles["page-break"]} />
        <Reviews />
        {plansSection}
        <section id="faq" className={styles["faq-wrapper"]}>
          <div className={styles.faq}>
            <div className={styles.lead}>
              <h2 className={styles.headline}>
                {l10n.getString("landing-faq-headline")}
              </h2>
              <p>
                <Link href="/faq">
                  <a className={styles["read-more"]}>
                    {l10n.getString("landing-faq-cta")}
                  </a>
                </Link>
              </p>
            </div>
            <div className={styles.entries}>
              <FaqAccordion
                entries={[
                  {
                    q: l10n.getString("faq-question-availability-question"),
                    a: l10n.getString("faq-question-availability-answer-v2"),
                  },
                  {
                    q: l10n.getString("faq-question-what-is-question-2"),
                    a: l10n.getString("faq-question-what-is-answer-2"),
                  },
                  {
                    q: l10n.getString("faq-question-use-cases-question-2"),
                    a: (
                      <>
                        <p>
                          {l10n.getString(
                            "faq-question-use-cases-answer-part1-2"
                          )}
                        </p>
                        <p>
                          {l10n.getString(
                            "faq-question-use-cases-answer-part2-2"
                          )}
                        </p>
                      </>
                    ),
                  },
                  {
                    q: l10n.getString("faq-question-browser-support-question"),
                    a: l10n.getString("faq-question-browser-support-answer-2"),
                  },
                ]}
              />
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
};

export default Home;
