import { NextPage } from "next";
import { useLocalization } from "@fluent/react";
import { Layout } from "../components/layout/Layout";
import { useRuntimeData } from "../hooks/api/runtimeData";
import logo from "../components/layout/images/relay-logo.svg";
import logoType from "../components/layout/images/fx-private-relay-premium-logotype-dark.svg";
import panelArt from "./images/vpn-relay-panel-art.svg";
import vpnLogo from "./images/mozilla-vpn-logo.svg";
import styles from "./vpn-relay-welcome.module.scss";
import { LinkButton } from "../components/Button";
import { useProfiles } from "../hooks/api/profile";
import { useRouter } from "next/router";
import { isFlagActive } from "../functions/waffle";
import { useEffect } from "react";
import { authenticatedFetch } from "../hooks/api/api";

const VpnRelayWelcome: NextPage = () => {
  const { l10n } = useLocalization();
  const profile = useProfiles();
  const router = useRouter();
  const runtimeData = useRuntimeData();

  useEffect(() => {
    // Tell the backend that there will probably be new subscriptions.
    // It will then ask Firefox Accounts for up-to-date subscription information,
    // and have that ready for the next request to `/profiles`.
    authenticatedFetch("/accounts/profile/refresh");
  }, []);

  // redirect user if they haven't purchased vpn-relay
  if (profile && profile.data && !profile.data[0].has_vpn) {
    router.push("/");
  }

  return runtimeData && isFlagActive(runtimeData.data, "bundle") ? (
    <Layout>
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
                href={"https://www.mozilla.org/en-US/products/vpn/download/"}
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
                href={"https://relay.firefox.com/"}
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
  ) : null;
};

export default VpnRelayWelcome;
