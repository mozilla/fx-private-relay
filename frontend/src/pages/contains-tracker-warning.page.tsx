import { NextPage } from "next";
import styles from "./contains-tracker-warning.module.scss";
import { Layout } from "../components/layout/Layout";
import { useRuntimeData } from "../hooks/api/runtimeData";
import { useL10n } from "../hooks/l10n";
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
      elems: {
        u: <u />,
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
    <Layout theme="plain" runtimeData={runtimeData.data}>
      <main className={styles["contains-tracker-main"]}>
        <section className={styles["contains-tracker-container"]}>
          <div className={styles["details-section"]}>
            <h1>{l10n.getString("contains-tracker-title")}</h1>
            <p>{TrackerWarningDescription}</p>
            <div className={styles["warning-banner"]}>
              {TrackerWarningBanner}
            </div>
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
