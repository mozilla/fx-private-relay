import { NextPage } from "next";
import { useLocalization } from "@fluent/react";
import { event as gaEvent } from "react-ga";
import styles from "./faq.module.scss";
import { Layout } from "../components/layout/Layout";
import { useGaViewPing } from "../hooks/gaViewPing";
import { LinkButton } from "../components/Button";
import { useRuntimeData } from "../hooks/api/runtimeData";
import { getPhoneSubscribeLink } from "../functions/getPlan";

const Phone: NextPage = () => {
  const { l10n } = useLocalization();
  const runtimeData = useRuntimeData();

  const purchase = () => {
    gaEvent({
      category: "Purchase Button",
      action: "Engage",
      label: "phone-cta",
    });
  };

  return (
    <Layout theme="free" runtimeData={runtimeData.data}>
      <main>
        <div className={styles["faq-page"]}>
          <div className={styles["faqs-wrapper"]}>
            <h1 className={styles.headline}>
              {l10n.getString("phone-headline")}
            </h1>
            <div className={styles.faqs}>
              {/* TODO: show disabled UI if phones are not available */}
              <LinkButton
                ref={useGaViewPing({
                  category: "Purchase Button",
                  label: "premium-promo-cta",
                })}
                href={getPhoneSubscribeLink(runtimeData.data)}
                onClick={() => purchase()}
              >
                {l10n.getString("premium-promo-hero-cta")}
              </LinkButton>
            </div>
          </div>
        </div>
      </main>
    </Layout>
  );
};

export default Phone;
