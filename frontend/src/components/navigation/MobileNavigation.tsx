import Link from "next/link";
import { useRouter } from "next/router";
import { useLocalization } from "@fluent/react";
import styles from "./MobileNavigation.module.scss";
import { useIsLoggedIn } from "../../hooks/session";
import { SignUpButton } from "./SignUpButton";
import { SignInButton } from "./SignInButton";
import { useProfiles } from "../../hooks/api/profile";
import { UpgradeButton } from "./UpgradeButton";
import { WhatsNewMenu } from "../layout/whatsnew/WhatsNewMenu";
import { FaqIcon, HomeIcon, MenuIcon } from "../Icons";
import { UserMenu } from "./UserMenu";
import { AppPicker } from "./AppPicker";
import { MenuToggle } from "./MenuToggle";

/** Switch between the different pages of the Relay website. */
export const MobileNavigation = ({ ...props }) => {
  const { l10n } = useLocalization();
  const router = useRouter();
  const isLoggedIn = useIsLoggedIn();
  const profiles = useProfiles();
  const homePath = isLoggedIn ? "/accounts/profile" : "/";
  const hasPremium: boolean = profiles.data?.[0].has_premium || false;
  const { theme } = props;

  return (
    <nav
      aria-label={l10n.getString("nav-menu")}
      className={styles["mobile-menu"]}
    >
      <Link href={homePath}>
        <a className={`${styles.link}`}>
          {HomeIcon({ alt: "home icon" })}
          {l10n.getString("nav-home")}
        </a>
      </Link>
      <Link href="/faq">
        <a className={`${styles.link}`}>
          {FaqIcon({ alt: "home icon" })}
          {l10n.getString("nav-faq")}
        </a>
      </Link>
    </nav>
  );
};
