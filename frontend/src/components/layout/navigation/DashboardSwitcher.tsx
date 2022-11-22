import { useLocalization } from "@fluent/react";
import Link from "next/link";
import { useRouter } from "next/router";
import styles from "./DashboardSwitcher.module.scss";
import { MaskIcon, PhoneIcon } from "../../Icons";

/** Component that allows the user to switch between the Email and Phone masks dashboards. */
export const DashboardSwitcher = () => {
  const router = useRouter();
  const { l10n } = useLocalization();

  return (
    /* Email and Phone Duo Header on Mobile */
    <nav
      className={`${styles["nav-mask-phone"]} ${styles["hidden-desktop"]}`}
      aria-label={l10n.getString("nav-duo-description")}
    >
      {/* Email Mask Btn */}
      <Link href="/accounts/profile">
        <a
          className={`${styles["nav-mask-email-icon"]} ${
            router.pathname === "/accounts/profile" ? styles["is-active"] : null
          }`}
          title={l10n.getString("nav-duo-email-mask-alt")}
        >
          <MaskIcon
            width={25}
            height={25}
            alt={l10n.getString("nav-duo-email-mask-alt")}
          />
        </a>
      </Link>
      {/* Phone Mask Btn */}
      <Link href="/phone">
        <a
          className={`${styles["nav-mask-phone-icon"]} ${
            router.pathname === "/phone" ? styles["is-active"] : null
          }`}
          title={l10n.getString("nav-duo-phone-mask-alt")}
        >
          <span className={styles["phone-icon-new-wrapper"]}>
            <PhoneIcon
              width={30}
              height={30}
              alt={l10n.getString("nav-duo-phone-mask-alt")}
              viewBox="0 0 20 25"
            />
            <p>{l10n.getString("phone-dashboard-header-new")}</p>
          </span>
        </a>
      </Link>
    </nav>
  );
};
