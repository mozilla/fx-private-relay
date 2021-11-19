import Link from "next/link";
import { useRouter } from "next/router";
import { useLocalization } from "@fluent/react";
import styles from "./Navigation.module.scss";

// TODO: Turn into a drop-down menu on small screens:
export const Navigation = () => {
  const { l10n } = useLocalization();
  const router = useRouter();

  return (
    <nav>
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
