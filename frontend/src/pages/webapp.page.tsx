import { useCallback, useEffect, Component, Suspense, lazy } from "react";
import { NextPage } from "next";
import styles from "./webapp.module.scss";
import Logo from "../../public/favicon.svg";
import { useRelayNumber } from "../hooks/api/relayNumber";
import { Console } from "../components/webapp/Console";
import { useMessages } from "../hooks/api/messages";
import Head from "next/head";
import { useL10n } from "../hooks/l10n";

const Scan = lazy(async () => {
  const m = await import("../components/webapp/Scan");
  return {
    default: m.Scan,
  };
});

const WebApp: NextPage = () => {
  const l10n = useL10n();
  const relayNumberApi = useRelayNumber();
  const messagesApi = useMessages();

  const setAuthToken = useCallback(
    async (authToken: string) => {
      const existingAuthToken = await localStorage.getItem("authToken");
      if (existingAuthToken === authToken) {
        return;
      }
      // TODO: Check if the token is valid?
      localStorage.setItem("authToken", authToken);
      relayNumberApi.mutate();
      messagesApi.mutate();
    },
    [messagesApi, relayNumberApi]
  );

  useEffect(() => {
    if (
      typeof URLSearchParams !== "undefined" &&
      typeof document !== "undefined" &&
      !relayNumberApi.isLoading &&
      !messagesApi.isLoading &&
      (typeof relayNumberApi.error !== "undefined" ||
        typeof messagesApi.error !== "undefined")
    ) {
      // When deploying the frontend with a mocked back-end,
      // this query parameter will allow us to automatically "sign in" with one
      // of the mock users. This is useful to be able to give testers a link
      // in which to see a particular feature:
      const searchParams = new URLSearchParams(document.location.search);
      const authToken = searchParams.get("apiToken");
      if (typeof authToken === "string" && authToken.length > 0) {
        setAuthToken(authToken);
      }
    }
  }, [
    messagesApi.error,
    messagesApi.isLoading,
    relayNumberApi.error,
    relayNumberApi.isLoading,
    setAuthToken,
  ]);

  if (relayNumberApi.isLoading || messagesApi.isLoading) {
    return <LoadingScreen />;
  }

  if (
    relayNumberApi.error ||
    !Array.isArray(relayNumberApi.data) ||
    !messagesApi.data
  ) {
    return (
      <Suspense fallback={<LoadingScreen />}>
        <ManifestLink />
        <div className={styles["login-prompt"]}>
          <p>{l10n.getString("webapp-signin-lead")}</p>
          <Scan
            onScan={(authToken) => {
              setAuthToken(authToken);
            }}
          />
        </div>
      </Suspense>
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

const LoadingScreen = () => {
  return (
    <>
      <ManifestLink />
      <div className={styles["loading-screen"]}>
        <img src={Logo.src} alt="" />
      </div>
    </>
  );
};

export default WebApp;
