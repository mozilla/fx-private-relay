import { NextPage } from "next";
import styles from "./webapp.module.scss";
import Logo from "../../public/favicon.svg";
import { getRuntimeConfig } from "../config";
import { useRelayNumber } from "../hooks/api/relayNumber";
import { Console } from "../components/webapp/Console";
import { useMessages } from "../hooks/api/messages";
import Head from "next/head";
import { useL10n } from "../hooks/l10n";
import { LinkButton } from "../components/Button";

const WebApp: NextPage = () => {
  const l10n = useL10n();
  const relayNumberApi = useRelayNumber();
  const messagesApi = useMessages();

  if (relayNumberApi.isLoading || messagesApi.isLoading) {
    return (
      <>
        <ManifestLink />
        <div className={styles["loading-screen"]}>
          <img src={Logo.src} alt="" />
        </div>
      </>
    );
  }

  if (
    relayNumberApi.error ||
    !Array.isArray(relayNumberApi.data) ||
    !messagesApi.data
  ) {
    return (
      <>
        <ManifestLink />
        <div className={styles["login-prompt"]}>
          <p>{l10n.getString("webapp-signin-lead")}</p>
          <LinkButton
            href={
              getRuntimeConfig().fxaLoginUrl +
              "&redirect_uri=http://127.0.0.1:8000/webapp/"
            }
          >
            {l10n.getString("webapp-signin-button")}
          </LinkButton>
        </div>
      </>
    );
  }

  return (
    <>
      <ManifestLink />
      <Console
        relayNumber={relayNumberApi.data[0]}
        messages={messagesApi.data}
      />
    </>
  );
};

const ManifestLink = () => (
  <>
    <Head>
      <link rel="manifest" href="/pwa.webmanifest"></link>
    </Head>
  </>
);

export default WebApp;
