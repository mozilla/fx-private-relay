import { useLocalization } from "@fluent/react";
import Link from "next/link";
import styles from "./Tips.module.scss";
import { CloseIcon } from "../icons/close";
import { InfoIcon } from "../icons/info";
import { ProfileData } from "../../hooks/api/profile";
import { useLocalDismissal } from "../../hooks/localDismissal";
import { getRuntimeConfig } from "../../config";
import { CustomAliasData } from "../../hooks/api/aliases";

export type Props = {
  profile: ProfileData;
  customAliases: CustomAliasData[];
};

export const Tips = (props: Props) => {
  const { l10n } = useLocalization();
  const dismissal = useLocalDismissal(`tips_${props.profile.id}`);

  if (getRuntimeConfig().featureFlags.generateCustomAliasTip !== true) {
    return null;
  }

  if (dismissal.isDismissed) {
    return null;
  }

  if (
    typeof props.profile.subdomain !== "string" ||
    props.customAliases.length > 0
  ) {
    // TODO: When we have more than a single tip,
    // only do this check for the subdomain tip.
    return null;
  }

  return (
    <aside className={styles.wrapper}>
      <div className={styles.card}>
        <header className={styles.header}>
          <span className={styles.icon}>
            <InfoIcon alt="" width={20} height={20} />
          </span>
          <h2>{l10n.getString("tips-header-title")}</h2>
          <button
            onClick={() => dismissal.dismiss()}
            className={styles.closeButton}
          >
            <CloseIcon
              alt={l10n.getString("tips-header-button-close-label")}
              width={20}
              height={20}
            />
          </button>
        </header>
        <div className={styles.tip}>
          <CustomAliasTip subdomain={props.profile.subdomain} />
        </div>
        <footer className={styles.footer}>
          <ul>
            <li>
              <Link href="/faq">
                <a title={l10n.getString("tips-footer-link-faq-tooltip")}>
                  {l10n.getString("tips-footer-link-faq-label")}
                </a>
              </Link>
            </li>
            <li>
              <a
                href={`https://support.mozilla.org/products/relay/?utm_source=${
                  getRuntimeConfig().frontendOrigin
                }`}
                target="_blank"
                rel="noopener noreferrer"
                title={l10n.getString("tips-footer-link-support-tooltip")}
              >
                {l10n.getString("tips-footer-link-support-label")}
              </a>
            </li>
          </ul>
        </footer>
      </div>
    </aside>
  );
};

type CustomAliasTipProps = {
  subdomain: string;
};
const CustomAliasTip = (props: CustomAliasTipProps) => {
  const { l10n } = useLocalization();

  return (
    <div className={styles.customAliasTip}>
      <samp>
        @{props.subdomain}.{getRuntimeConfig().mozmailDomain}
      </samp>
      <h3>{l10n.getString("tips-custom-alias-heading")}</h3>
      <p>{l10n.getString("tips-custom-alias-content")}</p>
    </div>
  );
};
