import { NextPage } from "next";
import styles from "./webapp.module.scss";
import Logo from "../../public/favicon.svg";
import { getRuntimeConfig } from "../config";
import { useRelayNumber } from "../hooks/api/relayNumber";
import { Console } from "../components/webapp/Console";

const WebApp: NextPage = () => {
  const relayNumberApi = useRelayNumber();

  if (relayNumberApi.isLoading) {
    return (
      <div className={styles["loading-screen"]}>
        <img src={Logo.src} alt="" />
      </div>
    );
  }

  if (relayNumberApi.error || !Array.isArray(relayNumberApi.data)) {
    document.location.assign(getRuntimeConfig().fxaLoginUrl);
    return null;
  }

  return <Console relayNumber={relayNumberApi.data[0]} />;
};

export default WebApp;
