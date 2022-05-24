import { useLocalization } from "@fluent/react";
import styles from "./UpgradeButton.module.scss";
import { useGaViewPing } from "../../../hooks/gaViewPing";
import Link from "next/link";
import { trackPurchaseStart } from "../../../functions/trackPurchase";

export const UpgradeButton = (): JSX.Element => {
  const { l10n } = useLocalization();
  const upgradeButtonRef = useGaViewPing({
    category: "Upgrade",
    label: "navbar-upgrade-bottom",
  });

  return (
    <Link href="/premium">
      <a
        ref={upgradeButtonRef}
        onClick={() => trackPurchaseStart({ label: "navbar-upgrade-bottom" })}
        className={styles["upgrade-button"]}
      >
        {l10n.getString("menu-upgrade-button")}
      </a>
    </Link>
  );
};
