import Link from "next/link";
import { useRouter } from "next/router";
import { useLocalization } from "@fluent/react";
import styles from "./Navigation.module.scss";
import { useProfiles } from "../../hooks/api/profile";

// TODO: Turn into a drop-down menu on small screens:
export const Navigation = () => {
  const { l10n } = useLocalization();
  const router = useRouter();
  const profileData = useProfiles();

  const isLoggedIn =
    typeof profileData.data !== "undefined" &&
    typeof profileData.error === "undefined";
  const homePath = isLoggedIn ? "/accounts/profile" : "/";

  return (
    <nav className={styles.siteNav}>
      <Link href={homePath}>
        <a
          className={`${styles.link} ${styles.homeLink} ${
            router.pathname === homePath ? styles.isActive : null
          }`}
        >
          {l10n.getString("nav-home")}
        </a>
      </Link>
      <Link href="/faq">
        <a
          className={`${styles.link} ${
            router.pathname === "/faq" ? styles.isActive : null
          }`}
        >
          {l10n.getString("nav-faq")}
        </a>
      </Link>
    </nav>
  );
};
