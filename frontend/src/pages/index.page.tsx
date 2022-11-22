import { NextPage } from "next";
import { useRouter } from "next/router";
import Link from "next/link";
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
import {
  isBundleAvailableInCountry,
  isPeriodicalPremiumAvailableInCountry,
  isPhonesAvailableInCountry,
} from "../functions/getPlan";
import { FaqAccordion } from "../components/landing/FaqAccordion";
import { getRuntimeConfig } from "../config";
import { setCookie } from "../functions/cookies";
import { Reviews } from "../components/landing/Reviews";
import { isFlagActive } from "../functions/waffle";
import { PlanMatrix } from "../components/landing/PlanMatrix";
import { BundleBanner } from "../components/landing/BundleBanner";
import { PhoneBanner } from "../components/landing/PhoneBanner";
import { useFlaggedAnchorLinks } from "../hooks/flaggedAnchorLinks";

const Home: NextPage = () => {
  const { l10n } = useLocalization();
  const router = useRouter();
  const runtimeData = useRuntimeData();
  const userData = useUsers();
  const heroCtaRef = useGaViewPing({
    category: "Sign In",
    label: "home-hero-cta",
  });
  const phoneBannerCtaRef = useGaViewPing({
    category: "Sign In",
    label: "Landing Page: Phone Banner",
  });

  useFlaggedAnchorLinks([runtimeData.data]);

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
              premium={isPeriodicalPremiumAvailableInCountry(runtimeData.data)}
            />
          </div>
        </section>

        {isFlagActive(runtimeData.data, "bundle") &&
          isBundleAvailableInCountry(runtimeData.data) && (
            <section id="vpn_promo" className={styles["bundle-banner-section"]}>
              <BundleBanner runtimeData={runtimeData.data} />
            </section>
          )}

        {isFlagActive(runtimeData.data, "phones") &&
          isPhonesAvailableInCountry(runtimeData.data) && (
            <section
              id="phone_promo"
              className={styles["phone-banner-section"]}
            >
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
        <section id="pricing" className={styles["plans-wrapper"]}>
          <div className={styles.plans}>
            <PlanMatrix runtimeData={runtimeData.data} />
          </div>
        </section>
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
