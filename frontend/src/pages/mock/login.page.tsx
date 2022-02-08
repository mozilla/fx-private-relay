import { NextPage } from "next";
import { useRouter } from "next/router";
import { FormEventHandler, useEffect, useState } from "react";
import styles from "./mockSession.module.scss";
import { getRuntimeConfig } from "../../config";
import { apiFetch } from "../../hooks/api/api";
import { UsersData } from "../../hooks/api/user";

type UsedToken = {
  token: string;
  user: string;
  lastUsed: number;
};

const MockLogin: NextPage = () => {
  const router = useRouter();
  const [usedTokens, setUsedTokens] = useState<UsedToken[]>([]);
  const [token, setToken] = useState("");

  useEffect(() => {
    const usedTokensString = localStorage.getItem("usedTokens") ?? "[]";
    setUsedTokens(JSON.parse(usedTokensString).sort(byUseDate));
  }, []);

  const onLogin: FormEventHandler = (event) => {
    event.preventDefault();

    login(token);
  };

  const login = async (token: string) => {
    localStorage.setItem("authToken", token);
    await new Promise((resolve) => setTimeout(resolve));
    const userDataResponse = await apiFetch("/users");
    const userData: UsersData = await userDataResponse.json();
    const newUsedTokens = usedTokens.concat([
      {
        token: token,
        user: userData[0].email,
        lastUsed: Date.now(),
      },
    ]);
    localStorage.setItem("usedTokens", JSON.stringify(newUsedTokens));
    setUsedTokens(newUsedTokens);

    router.push("/");
  };

  const chooseToken = (token: string) => {
    setToken(token);
    login(token);
  };

  const existingTokenElements = usedTokens
    .filter(isFirstInstance)
    .map((usedToken) => {
      return (
        <li key={usedToken.token + usedToken.lastUsed}>
          <button onClick={() => chooseToken(usedToken.token)}>
            {usedToken.token} ({usedToken.user})
          </button>
        </li>
      );
    });

  return (
    <div className={styles.mockSession}>
      <p className={styles.lead}>
        Visit{" "}
        <a
          href={
            getRuntimeConfig().backendOrigin + "/admin/authtoken/tokenproxy/"
          }
        >
          the Django admin panel
        </a>{" "}
        to obtain the token for the user you wish to log in as, or{" "}
        <a
          href={
            getRuntimeConfig().backendOrigin +
            "/accounts/fxa/login/?process=login"
          }
        >
          create a new account
        </a>{" "}
        first.
      </p>
      <form onSubmit={onLogin}>
        <label htmlFor="token">Token:</label>
        <input
          type="text"
          name="token"
          id="token"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          autoFocus
        />
        <button type="submit">Login</button>
      </form>
      <h1>Previously used tokens:</h1>
      <ul>{existingTokenElements}</ul>
    </div>
  );
};

function byUseDate(a: UsedToken, b: UsedToken) {
  return b.lastUsed - a.lastUsed;
}

function isFirstInstance(
  value: UsedToken,
  index: number,
  fullArray: UsedToken[]
): boolean {
  return fullArray.findIndex((token) => token.token === value.token) === index;
}

export default MockLogin;
