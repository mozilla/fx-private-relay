import { useLocalization } from "@fluent/react";
import { event as gaEvent } from "react-ga";
import styles from "./UpgradeButton.module.scss";
import { useGaViewPing } from "../../../hooks/gaViewPing";
import Link from "next/link";

export const UpgradeButton = (): JSX.Element => {
  const { l10n } = useLocalization();
  const upgradeButtonRef = useGaViewPing({
    category: "Upgrade",
    label: "profile-upgrade",
  });

  return (
    <Link href="/premium">
      <a
        ref={upgradeButtonRef}
        onClick={() =>
          gaEvent({
            category: "Upgrade",
            action: "Engage",
            label: "profile-upgrade",
          })
        }
        className={`btn ${styles["upgrade-button"]}`}
      >
        {l10n.getString("menu-upgrade-button")}
      </a>
    </Link>
  );
};
