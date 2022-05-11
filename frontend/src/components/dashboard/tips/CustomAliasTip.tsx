import { useLocalization } from "@fluent/react";
import styles from "./CustomAliasTip.module.scss";
import { getRuntimeConfig } from "../../../config";

export type CustomAliasTipProps = {
  subdomain?: string;
};
/**
 * The tip on using custom aliases also shows the user's domain on top,
 * so it can't use {@see GenericTip}.
 */
export const CustomAliasTip = (props: CustomAliasTipProps) => {
  const { l10n } = useLocalization();

  const subdomainElement =
    typeof props.subdomain === "string" ? (
      <samp>
        @{props.subdomain}.{getRuntimeConfig().mozmailDomain}
      </samp>
    ) : null;

  return (
    <div className={styles["custom-alias-tip"]}>
      {subdomainElement}
      <h3>{l10n.getString("tips-custom-alias-heading-2")}</h3>
      <p>{l10n.getString("tips-custom-alias-content-2")}</p>
    </div>
  );
};
