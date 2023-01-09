import { NextPage } from "next";
import { Layout } from "../components/layout/Layout";
import logo from "../components/layout/images/relay-logo.svg";
import logoType from "../components/layout/images/fx-private-relay-premium-logotype-dark.svg";
import panelArt from "./images/vpn-relay-panel-art.svg";
import vpnLogo from "./images/mozilla-vpn-logo.svg";
import styles from "./vpn-relay-welcome.module.scss";
import { useEffect } from "react";
import { authenticatedFetch } from "../hooks/api/api";
import Link from "next/link";
import { LinkButton } from "../components/Button";
import { useL10n } from "../hooks/l10n";

const VpnRelayWelcome: NextPage = () => {
  const l10n = useL10n();
  const referringSiteUrl =
    typeof document !== "undefined"
      ? document.location.host
      : "relay.firefox.com";

  useEffect(() => {
    // Tell the backend that there will probably be new subscriptions.
    // It will then ask Firefox Accounts for up-to-date subscription information,
    // and have that ready for the next request to `/profiles`.
    authenticatedFetch("/accounts/profile/refresh");
  }, []);

  return (
    <Layout theme="premium">
      <main>
        <div className={styles["content-container"]}>
          <div className={styles["content-head"]}>
            <b className={styles.headline}>
              {l10n.getString("vpn-relay-welcome-headline")}
            </b>
            <h2 className={styles.subheadline}>
              {l10n.getString("vpn-relay-welcome-subheadline")}
            </h2>
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
              <Link href={"/"} className={styles.button}>
                {l10n.getString("vpn-relay-go-relay-cta")}
              </Link>
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
                href={`https://vpn.mozilla.org/vpn/download/?utm_source=${encodeURIComponent(
                  referringSiteUrl
                )}&utm_medium=referral&utm_campaign=vpn-relay-welcome&utm_content=download-button`}
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
