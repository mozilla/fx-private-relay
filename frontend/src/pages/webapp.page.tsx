import { NextPage } from "next";
import styles from "./webapp.module.scss";
import Logo from "../../public/favicon.svg";
import { getRuntimeConfig } from "../config";
import { useRelayNumber } from "../hooks/api/relayNumber";
import { Console } from "../components/webapp/Console";
import { useMessages } from "../hooks/api/messages";

const WebApp: NextPage = () => {
  const relayNumberApi = useRelayNumber();
  const messagesApi = useMessages();

  if (relayNumberApi.isLoading || messagesApi.isLoading) {
    return (
      <div className={styles["loading-screen"]}>
        <img src={Logo.src} alt="" />
      </div>
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
    <Console relayNumber={relayNumberApi.data[0]} messages={messagesApi.data} />
  );
};

export default WebApp;
