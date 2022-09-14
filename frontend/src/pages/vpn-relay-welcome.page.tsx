import { NextPage } from "next";
import { useState } from "react";
import { useLocalization } from "@fluent/react";
import { Layout } from "../components/layout/Layout";
import { useRuntimeData } from "../hooks/api/runtimeData";
import logo from "../components/layout/images/relay-logo.svg";
import logoType from "../components/layout/images/fx-private-relay-premium-logotype-dark.svg";
import panelArt from "./images/vpn-relay-panel-art.svg";
import vpnLogo from "./images/mozilla-vpn-logo.svg";
import styles from "./vpn-relay-welcome.module.scss";
import { LinkButton } from "../components/Button";

const VpnRelayWelcome: NextPage = () => {
  const { l10n } = useLocalization();
  const runtimeData = useRuntimeData();

  return (
    <Layout runtimeData={runtimeData.data}>
      <main>
        <div className={styles["content-container"]}>
          <div className={styles["content-head"]}>
            <p className={styles.headline}>
              {l10n.getString("vpn-relay-welcome-headline")}
            </p>
            <p className={styles.subheadline}>
              {l10n.getString("vpn-relay-welcome-subheadline")}
            </p>
          </div>

          <div className={styles["content-body"]}>
            <div className={styles.panel}>
              <div className={styles.logo}>
                <img
                  src={logo.src}
                  alt=""
                  className={styles.logomark}
                  width={42}
                />
                <img
                  src={logoType.src}
                  alt={l10n.getString("logo-premium-alt")}
                  className={styles.logotype}
                />
              </div>

              <p>{l10n.getString("vpn-relay-go-relay-body")}</p>
              <LinkButton
                href={"#"}
                target="_blank"
                className={styles["get-addon-button"]}
              >
                {l10n.getString("vpn-relay-go-relay-cta")}
              </LinkButton>
            </div>
            <img src={panelArt.src} alt="" className={styles["panel-art"]} />
            <div className={styles.panel}>
              <div className={styles.logo}>
                <img
                  src={vpnLogo.src}
                  alt={l10n.getString("logo-premium-alt")}
                  className={styles["vpn-logo"]}
                  height={20}
                />
              </div>

              <p>{l10n.getString("vpn-relay-go-vpn-body")}</p>
              <LinkButton
                href={"#"}
                target="_blank"
                className={styles["get-addon-button"]}
              >
                {l10n.getString("vpn-relay-go-vpn-cta")}
              </LinkButton>
            </div>
          </div>
        </div>
      </main>
    </Layout>
  );
};

export default VpnRelayWelcome;
