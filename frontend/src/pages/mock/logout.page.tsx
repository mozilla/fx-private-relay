import { NextPage } from "next";
import { useRouter } from "next/router";
import { MouseEventHandler } from "react";
import { getRuntimeConfig } from "../../config";
import { authenticatedFetch } from "../../hooks/api/api";
import { useProfiles } from "../../hooks/api/profile";
import { useUsers } from "../../hooks/api/user";
import styles from "./mockSession.module.scss";

const MockLogout: NextPage = () => {
  const router = useRouter();
  const profiles = useProfiles();
  const users = useUsers();

  const onLogout: MouseEventHandler = async (event) => {
    event.preventDefault();

    localStorage.removeItem("authToken");
    // Note: logging out with a GET won't (and shouldn't) work in production,
    // but for ease of development we set ACCOUNT_LOGOUT_ON_GET to True
    // when running locally.
    await authenticatedFetch("/accounts/logout/", {
      method: "GET",
      redirect: "manual",
    });
    // Revalidate account data to reflect logged out status:
    await profiles.mutate();
    await users.mutate();

    router.push("/");
  };

  return (
    <div className={styles["mock-session"]}>
      <p className={styles.lead}>
        This page mocks logging out to be able to run a separate development
        server for the front-end. To use a production-like login/logout
        procedure, create a production build of the front-end using{" "}
        <code>npm run watch</code>. This will then be served by the back-end at
        &nbsp;<samp>{getRuntimeConfig().backendOrigin}</samp>.
      </p>
      <button onClick={onLogout}>Logout</button>
    </div>
  );
};

export default MockLogout;
