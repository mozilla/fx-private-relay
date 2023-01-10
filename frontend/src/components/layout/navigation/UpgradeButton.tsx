import styles from "./UpgradeButton.module.scss";
import { useGaViewPing } from "../../../hooks/gaViewPing";
import Link from "next/link";
import { useL10n } from "../../../hooks/l10n";

export const UpgradeButton = (): JSX.Element => {
  const l10n = useL10n();
  const upgradeButtonRef = useGaViewPing({
    category: "Purchase Button",
    label: "navbar-upgrade-button",
  });

  return (
    <Link
      href="/premium#pricing"
      ref={upgradeButtonRef}
      id={styles["upgrade-button"]}
    >
      {l10n.getString("menu-upgrade-button")}
    </Link>
  );
};
