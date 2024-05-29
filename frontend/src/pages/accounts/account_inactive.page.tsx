import type { NextPage } from "next";

import { Layout } from "../../components/layout/Layout";
import { useL10n } from "../../hooks/l10n";
import styles from "./account_inactive.module.scss";

const AccountInactive: NextPage = () => {
  const l10n = useL10n();
  return (
    <Layout>
      <div className={styles["error"]}>
        {l10n.getString("api-error-account-is-inactive")}
      </div>
    </Layout>
  );
};

export default AccountInactive;
