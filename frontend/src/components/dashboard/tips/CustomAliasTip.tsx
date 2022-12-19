import styles from "./CustomAliasTip.module.scss";
import { getRuntimeConfig } from "../../../config";
import { getLocale } from "../../../functions/getLocale";
import { useL10n } from "../../../hooks/l10n";

export type CustomAliasTipProps = {
  subdomain?: string;
};
/**
 * The tip on using custom aliases also shows the user's domain on top,
 * so it can't use {@see GenericTip}.
 */
export const CustomAliasTip = (props: CustomAliasTipProps) => {
  const l10n = useL10n();

  const subdomainElement =
    typeof props.subdomain === "string" ? (
      <samp>
        @{props.subdomain}.{getRuntimeConfig().mozmailDomain}
      </samp>
    ) : null;

  // This animation provides the same information as the text,
  // and since it contains English content, only show it to people using the
  // English website:
  const video =
    getLocale(l10n).split("-")[0] !== "en" ? null : (
      <>
        <video
          // This animation is redundant with the regular text accompanying it,
          // so screen readers should ignore it:
          aria-hidden={true}
          autoPlay={true}
          loop={true}
          muted={true}
        >
          {/*
            Unfortunately video files cannot currently be imported, so make
            sure these files are present in /public. See
            https://github.com/vercel/next.js/issues/35248
          */}
          <source
            type="video/webm; codecs='vp9'"
            src="/animations/tips/custom-alias.webm"
          />
          <source type="video/mp4" src="/animations/tips/custom-alias.mp4" />
        </video>
      </>
    );

  return (
    <div className={styles["custom-alias-tip"]}>
      {video}
      {subdomainElement}
      <h3>{l10n.getString("tips-custom-alias-heading-2")}</h3>
      <p>{l10n.getString("tips-custom-alias-content-2")}</p>
    </div>
  );
};
