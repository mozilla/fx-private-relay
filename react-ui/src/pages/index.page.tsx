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
import { useGaPing } from "../hooks/gaPing";
import { Button } from "../components/Button";
import { DemoPhone } from "../components/landing/DemoPhone";
import { usePremiumCountries } from "../hooks/api/premiumCountries";
import { Carousel } from "../components/landing/Carousel";
import { Plans } from "../components/landing/Plans";
import { getPlan, isPremiumAvailableInCountry } from "../functions/getPlan";
import { FaqAccordion } from "../components/landing/FaqAccordion";

const Home: NextPage = () => {
  const { l10n } = useLocalization();
  const router = useRouter();
  const premiumCountriesData = usePremiumCountries();
  const userData = useUsers();
  const heroCtaRef = useGaPing({
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

  const plansSection = isPremiumAvailableInCountry(
    premiumCountriesData.data
  ) ? (
    <section className={styles.plansWrapper}>
      <div className={styles.plans}>
        <div className={styles.planComparison}>
          <Plans premiumCountriesData={premiumCountriesData.data} />
        </div>
        <div className={styles.callout}>
          <h2>
            {l10n.getString("landing-pricing-headline", {
              monthly_price: getPlan(premiumCountriesData.data).price,
            })}
          </h2>
          <p>{l10n.getString("landing-pricing-body")}</p>
        </div>
      </div>
    </section>
  ) : null;

  return (
    <Layout>
      <section className={styles.hero}>
        <div className={styles.lead}>
          <h2>{l10n.getString("landing-hero-headline")}</h2>
          <p>{l10n.getString("landing-hero-body")}</p>
          <Button ref={heroCtaRef} onClick={() => signup()}>
            {l10n.getString("nav-profile-sign-up")}
          </Button>
          <img
            src={Testimonials.src}
            alt="Forbes, ZDNet, Lifehacker, PCMag"
            className={styles.socialProof}
          />
        </div>
        <div className={styles.demoPhone}>
          <DemoPhone
            premium={
              premiumCountriesData.data?.premium_available_in_country === true
            }
          />
        </div>
      </section>
      <section className={styles.howItWorksWrapper}>
        <div className={styles.howItWorks}>
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
      <section className={styles.useCasesWrapper}>
        <div className={styles.useCases}>
          <Carousel
            title={l10n.getString("landing-use-cases-heading")}
            tabs={[
              {
                color: "yellow",
                heading: l10n.getString("landing-use-cases-shopping"),
                content: l10n.getString("landing-use-cases-shopping-body"),
                illustration: ShoppingIllustration,
              },
              {
                color: "orange",
                heading: l10n.getString("landing-use-cases-social-networks"),
                content: l10n.getString(
                  "landing-use-cases-social-networks-body"
                ),
                illustration: SocialNetworksIllustration,
              },
              {
                color: "teal",
                heading: l10n.getString("landing-use-cases-offline"),
                content: l10n.getString("landing-use-cases-offline-body"),
                illustration: OfflineIllustration,
              },
              {
                color: "red",
                heading: l10n.getString("landing-use-cases-access-content"),
                content: l10n.getString(
                  "landing-use-cases-access-content-body"
                ),
                illustration: AccessContentIllustration,
              },
              {
                color: "pink",
                heading: l10n.getString("landing-use-cases-gaming"),
                content: l10n.getString("landing-use-cases-gaming-body"),
                illustration: GamingIllustration,
              },
            ]}
          />
        </div>
      </section>
      {plansSection}
      <section className={styles.faqWrapper}>
        <div className={styles.faq}>
          <div className={styles.lead}>
            <h2 className={styles.headline}>
              {l10n.getString("landing-faq-headline")}
            </h2>
            <p>
              <Link href="/faq">
                <a className={styles.readMore}>
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
                  a: l10n.getString("faq-question-availability-answer"),
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
                        {l10n.getString("faq-question-use-cases-answer-part1")}
                      </p>
                      <p>
                        {l10n.getString("faq-question-use-cases-answer-part2")}
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
    </Layout>
  );
};

export default Home;
