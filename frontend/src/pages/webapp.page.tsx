import { NextPage } from "next";
import styles from "./webapp.module.scss";
import Logo from "../../public/favicon.svg";
import { getRuntimeConfig } from "../config";
import { useRelayNumber } from "../hooks/api/relayNumber";
import { Console } from "../components/webapp/Console";
import { useMessages } from "../hooks/api/messages";
import Head from "next/head";

const WebApp: NextPage = () => {
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
    document.location.assign(getRuntimeConfig().fxaLoginUrl);
    return null;
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
