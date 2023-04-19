import { NextPage } from "next";
import styles from "./contains-tracker-warning.module.scss";
import { Layout } from "../components/layout/Layout";
import { useRuntimeData } from "../hooks/api/runtimeData";
import { useL10n } from "../hooks/l10n";
import { LinkButton } from "../components/Button";
import { InfoIcon } from "../components/Icons";
import { FaqAccordionTracker } from "../components/landing/FaqAccordion";
import { Banner } from "../components/Banner";

const ContainsTracker: NextPage = () => {
  const runtimeData = useRuntimeData();
  const l10n = useL10n();

  const TrackerWarningDescription = l10n.getFragment(
    "contains-tracker-description",
    {
      vars: {
        sender: "someone@email.com",
        datetime: "05/06/2023 at 10:53pm EST",
      },
    }
  );

  const linkToView = "#";

  const TrackerWarningBanner = (
    <Banner
      type="warning"
      title={l10n.getString("contains-tracker-warning-title")}
      cta={{
        content: l10n.getString("contains-tracker-warning-view-link-cta"),
        size: "large",
        target: linkToView,
      }}
    >
      {l10n.getString("contains-tracker-warning-description")}
    </Banner>
  );

  return (
    <Layout theme="free" runtimeData={runtimeData.data}>
      <main>
        <section className={styles["contains-tracker-container"]}>
          <div className={styles["details-section"]}>
            <h1>{l10n.getString("contains-tracker-title")}</h1>
            <p>{TrackerWarningDescription}</p>

            {/* <div className={styles["contains-tracker-warning-banner"]}>
              <div>
                <dt>
                  <InfoIcon alt="" />
                  {l10n.getString("contains-tracker-warning-title")}
                </dt>
                <dd>
                  {l10n.getString("contains-tracker-warning-description")}
                </dd>
              </div>
              <LinkButton href={linkToView}>
                {l10n.getString("contains-tracker-warning-view-link-cta")}
              </LinkButton>
            </div> */}
            {TrackerWarningBanner}
          </div>
        </section>
        <section id="faq" className={styles["faq-wrapper"]}>
          <div className={styles.faq}>
            <div className={styles.lead}>
              <h2 className={styles.headline}>
                {l10n.getString("contains-tracker-faq-section-title")}
              </h2>
            </div>
            <div className={styles.entries}>
              <FaqAccordionTracker />
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
};

export default ContainsTracker;
