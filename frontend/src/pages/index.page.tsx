import { NextPage } from "next";
import { useRouter } from "next/router";
import Link from "next/link";
import { useLocalization } from "@fluent/react";
import { event as gaEvent } from "react-ga";
import styles from "./index.module.scss";
import Testimonials from "../../../static/images/newlanding/a/hero-brands.svg";
import HowItWorks1 from "../../../static/images/how-it-works/how-it-works-1.svg";
import HowItWorks2 from "../../../static/images/how-it-works/how-it-works-2.svg";
import HowItWorks3 from "../../../static/images/how-it-works/how-it-works-3.svg";
import ShoppingIllustration from "../../../static/images/use-case-shopping.svg";
import SocialNetworksIllustration from "../../../static/images/use-case-social-networks.svg";
import OfflineIllustration from "../../../static/images/use-case-offline.svg";
import AccessContentIllustration from "../../../static/images/use-case-access-content.svg";
import GamingIllustration from "../../../static/images/use-case-gaming.svg";
import { useUsers } from "../hooks/api/user";
import { Layout } from "../components/layout/Layout";
import { useGaViewPing } from "../hooks/gaViewPing";
import { LinkButton } from "../components/Button";
import { DemoPhone } from "../components/landing/DemoPhone";
import { useRuntimeData } from "../hooks/api/runtimeData";
import { Carousel } from "../components/landing/Carousel";
import { Plans } from "../components/landing/Plans";
import { getPlan, isPremiumAvailableInCountry } from "../functions/getPlan";
import { FaqAccordion } from "../components/landing/FaqAccordion";
import { getRuntimeConfig } from "../config";

const Home: NextPage = () => {
  const { l10n } = useLocalization();
  const router = useRouter();
  const runtimeData = useRuntimeData();
  const userData = useUsers();
  const heroCtaRef = useGaViewPing({
    category: "Sign In",
    label: "home-hero-cta",
  });

  if (typeof userData.data?.[0] === "object") {
    router.push("/accounts/profile/");
  }

  const signup = () => {
    gaEvent({
      category: "Sign In",
      action: "Engage",
      label: "home-hero-cta",
    });
  };

  const plansSection = isPremiumAvailableInCountry(runtimeData.data) ? (
    <section id="pricing" className={styles["plans-wrapper"]}>
      <div className={styles.plans}>
        <div className={styles["plan-comparison"]}>
          <Plans premiumCountriesData={runtimeData.data} />
        </div>
        <div className={styles.callout}>
          <h2>
            {l10n.getString("landing-pricing-headline", {
              monthly_price: getPlan(runtimeData.data).price,
            })}
          </h2>
          <p>{l10n.getString("landing-pricing-body")}</p>
        </div>
      </div>
    </section>
  ) : null;

  return (
    <Layout>
      <main>
        <section id="hero" className={styles.hero}>
          <div className={styles.lead}>
            <h2>{l10n.getString("landing-hero-headline")}</h2>
            <p>{l10n.getString("landing-hero-body")}</p>
            <LinkButton
              ref={heroCtaRef}
              onClick={() => signup()}
              href={getRuntimeConfig().fxaLoginUrl}
            >
              {l10n.getString("nav-profile-sign-up")}
            </LinkButton>
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
        <section id="how_it_works" className={styles["how-it-works-wrapper"]}>
          <div className={styles["how-it-works"]}>
            <h2 className={styles.headline}>
              {l10n.getString("landing-how-it-works-headline")}
            </h2>
            <p className={styles.lead}>
              {l10n.getString("landing-how-it-works-body")}
            </p>
            <ol className={styles.steps}>
              <li className={styles.step}>
                <img src={HowItWorks1.src} alt="" />
                <h3>{l10n.getString("how-it-works-step-1-headline")}</h3>
                <p>
                  <a href="https://addons.mozilla.org/firefox/addon/private-relay/">
                    {l10n.getString("landing-how-it-works-step-1-body-cta")}
                  </a>
                  {l10n.getString("landing-how-it-works-step-1-body")}
                </p>
              </li>
              <li className={styles.step}>
                <img src={HowItWorks2.src} alt="" />
                <h3>{l10n.getString("how-it-works-step-2-headline")}</h3>
                <p>{l10n.getString("landing-how-it-works-step-2-body-v2")}</p>
              </li>
              <li className={styles.step}>
                <img src={HowItWorks3.src} alt="" />
                <h3>{l10n.getString("how-it-works-step-3-headline")}</h3>
                <p>{l10n.getString("landing-how-it-works-step-3-body")}</p>
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
                  content: l10n.getString("landing-use-cases-shopping-body"),
                  illustration: ShoppingIllustration,
                  id: "use-cases/shopping",
                },
                {
                  color: "orange",
                  heading: l10n.getString("landing-use-cases-social-networks"),
                  content: l10n.getString(
                    "landing-use-cases-social-networks-body"
                  ),
                  illustration: SocialNetworksIllustration,
                  id: "use-cases/social-networks",
                },
                {
                  color: "teal",
                  heading: l10n.getString("landing-use-cases-offline"),
                  content: l10n.getString("landing-use-cases-offline-body"),
                  illustration: OfflineIllustration,
                  id: "use-cases/offline",
                },
                {
                  color: "red",
                  heading: l10n.getString("landing-use-cases-access-content"),
                  content: l10n.getString(
                    "landing-use-cases-access-content-body"
                  ),
                  illustration: AccessContentIllustration,
                  id: "use-cases/access-content",
                },
                {
                  color: "pink",
                  heading: l10n.getString("landing-use-cases-gaming"),
                  content: l10n.getString("landing-use-cases-gaming-body"),
                  illustration: GamingIllustration,
                  id: "use-cases/gaming",
                },
              ]}
            />
          </div>
        </section>
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
                    q: l10n.getString("faq-question-what-is-question"),
                    a: l10n.getString("faq-question-what-is-answer"),
                  },
                  {
                    q: l10n.getString("faq-question-use-cases-question"),
                    a: (
                      <>
                        <p>
                          {l10n.getString(
                            "faq-question-use-cases-answer-part1"
                          )}
                        </p>
                        <p>
                          {l10n.getString(
                            "faq-question-use-cases-answer-part2"
                          )}
                        </p>
                      </>
                    ),
                  },
                  {
                    q: l10n.getString("faq-question-browser-support-question"),
                    a: l10n.getString("faq-question-browser-support-answer"),
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
