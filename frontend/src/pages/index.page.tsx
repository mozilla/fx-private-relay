import { NextPage } from "next";
import { useRouter } from "next/router";
import Link from "next/link";
import Image from "next/image";
import styles from "./index.module.scss";
import Testimonials from "../../public/images/hero-brands.svg";
import HowItWorks1 from "../../public/images/how-it-works-1.svg";
import HowItWorks2 from "../../public/images/how-it-works-2.svg";
import HowItWorks3 from "../../public/images/how-it-works-3.svg";
import HeroImage from "./images/relay-hero-image.svg";
import { useUsers } from "../hooks/api/user";
import { Layout } from "../components/layout/Layout";
import { useGaViewPing } from "../hooks/gaViewPing";
import { LinkButton } from "../components/Button";
import { useRuntimeData } from "../hooks/api/runtimeData";
import { isBundleAvailableInCountry } from "../functions/getPlan";
import { FaqAccordionItem } from "../components/landing/FaqAccordion";
import { Reviews } from "../components/landing/Reviews";
import { PlanMatrix } from "../components/landing/PlanMatrix";
import { BundleBanner } from "../components/landing/BundleBanner";
import { useFlaggedAnchorLinks } from "../hooks/flaggedAnchorLinks";
import { useL10n } from "../hooks/l10n";
import { HighlightedFeatures } from "../components/landing/HighlightedFeatures";
import { isFlagActive } from "../functions/waffle";

const Home: NextPage = () => {
  const l10n = useL10n();
  const router = useRouter();
  const runtimeData = useRuntimeData();
  const userData = useUsers();
  const heroCtaRef = useGaViewPing({
    category: "Sign In",
    label: "home-hero-cta",
  });

  useFlaggedAnchorLinks([runtimeData.data]);

  if (typeof userData.data?.[0] === "object" && !userData.error) {
    router.push("/accounts/profile/");
  }

  return (
    <Layout runtimeData={runtimeData.data}>
      <main>
        <section id="hero" className={styles.hero}>
          <div className={styles.lead}>
            <h2>{l10n.getString("hero-section-title")}</h2>
            <p>{l10n.getString("hero-section-body")}</p>
            <LinkButton
              ref={heroCtaRef}
              href={"#pricing"}
              className={styles.cta}
            >
              {l10n.getString("hero-section-cta")}
            </LinkButton>
            <div className={styles["testimonials-wrapper"]}>
              <p>{l10n.getString("hero-section-social-proof")}:</p>
              <Image
                src={Testimonials}
                alt="Forbes, ZDNet, Lifehacker, PCMag"
                className={styles["social-proof"]}
              />
            </div>
          </div>
          <div className={styles["hero-image"]}>
            <Image src={HeroImage} alt="" />
          </div>
        </section>
        {isBundleAvailableInCountry(runtimeData.data) && (
          <section id="vpn_promo" className={styles["bundle-banner-section"]}>
            <BundleBanner runtimeData={runtimeData.data} />
          </section>
        )}
        <section id="how_it_works" className={styles["how-it-works-wrapper"]}>
          <div className={styles["how-it-works"]}>
            <h2 className={styles.headline}>
              {l10n.getString("how-it-works-section-title")}
            </h2>
            <ol className={styles.steps}>
              <li className={styles.step}>
                <Image src={HowItWorks1} alt="" />
                <h3>
                  {l10n.getString("how-it-works-section-extension-headline")}
                </h3>
                <p>{l10n.getString("how-it-works-section-extension-body")}</p>
              </li>
              <li className={styles.step}>
                <Image src={HowItWorks2} alt="" />
                <h3>
                  {l10n.getString("how-it-works-section-forward-headline")}
                </h3>
                <p>{l10n.getString("how-it-works-section-forward-body")}</p>
              </li>
              <li className={styles.step}>
                <Image src={HowItWorks3} alt="" />
                <h3>
                  {l10n.getString("how-it-works-section-manage-headline")}
                </h3>
                <p>{l10n.getString("how-it-works-section-manage-body")}</p>
              </li>
            </ol>
          </div>
        </section>
        <div className={styles["page-break"]} />
        {/* 
          Enforcing a gray background for now to fix UI errors on
          mobile for reviews + plans section.
          Need to wait on design audit to fix white/grey background 
          discrepanies between pages. 
        */}
        <div className={`${styles["gray-bg"]} ${styles["reviews-container"]}`}>
          <Reviews />
          {/* Anchor link "pricing" exists within the PlanMatrix component */}
          <div className={styles.plans}>
            <PlanMatrix runtimeData={runtimeData.data} />
          </div>
        </div>
        <section id="highlighted-features" className={styles.features}>
          <HighlightedFeatures />
        </section>

        <section id="faq" className={styles["faq-wrapper"]}>
          <div className={styles.faq}>
            <div className={styles.lead}>
              <h2 className={styles.headline}>
                {l10n.getString("landing-faq-headline")}
              </h2>
              <p>
                <Link href="/faq" className={styles["read-more"]}>
                  {l10n.getString("landing-faq-cta")}
                </Link>
              </p>
            </div>
            <div className={styles.entries}>
              <FaqAccordionItem
                defaultExpandedIndex={0}
                entries={[
                  {
                    q: l10n.getString("faq-question-availability-question"),
                    a: isFlagActive(runtimeData.data, "eu_country_expansion")
                      ? l10n.getString("faq-question-availability-answer-v3")
                      : l10n.getString(
                          "faq-question-landing-page-availability"
                        ),
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
