import { ReactNode } from "react";
import Head from "next/head";
import { useLocalization } from "@fluent/react";
import styles from "./Layout.module.scss";
import logoTypeLight from "../../../static/images/fx-private-relay-logotype-light.svg";
import logoTypeDark from "../../../static/images/fx-private-relay-logotype-dark.svg";
import logo from "../../../static/images/placeholder-logo.svg";
import mozillaLogo from "../../../static/images/logos/moz-logo-bw-rgb.svg";
import githubLogo from "../../../static/images/GitHub.svg";
import { useProfiles } from "../hooks/api/profile";
import { UserMenu } from "./UserMenu";

export type Props = {
  children: ReactNode;
  dark?: boolean;
};

export const Layout = (props: Props) => {
  const { l10n } = useLocalization();
  const profiles = useProfiles();

  const isDark = props.dark ?? !profiles.data?.[0].has_premium;
  const darkClass = isDark ? styles.isDark : "";
  const logoType = isDark ? logoTypeLight : logoTypeDark;

  return (
    <>
      <Head>
        <title>{l10n.getString("meta-title")}</title>
        {/* TODO: Add favicon, meta tags */}
      </Head>
      <div className={styles.wrapper}>
        <header className={`${styles.header} ${darkClass}`}>
          <div className={styles.logoWrapper}>
            <a
              href={process.env.NEXT_PUBLIC_API_ORIGIN}
              className={styles.logo}
            >
              <img
                src={logo.src}
                alt=""
                className={styles.logomark}
                width={42}
              />
              <img
                src={logoType.src}
                alt={l10n.getString("logo-alt")}
                className={styles.logotype}
                width={180}
              />
            </a>
          </div>
          <nav className={styles.nav}>
            <UserMenu />
          </nav>
        </header>
        <div className={styles.content}>{props.children}</div>
        <footer className={styles.footer}>
          <a
            href="https://www.mozilla.org"
            className={styles.mozillaLogo}
            target="_blank"
            rel="noopener noreferrer"
          >
            <img
              src={mozillaLogo.src}
              alt={l10n.getString("logo-mozilla-alt")}
              width={120}
            />
          </a>
          <ul className={styles.meta}>
            <li>
              <a
                href="https://www.mozilla.org/privacy/firefox-relay/"
                target="_blank"
                rel="noopener noreferrer"
              >
                {l10n.getString("nav-footer-privacy")}
              </a>
            </li>
            <li>
              <a
                href="https://www.mozilla.org/about/legal/terms/firefox-relay/"
                target="_blank"
                rel="noopener noreferrer"
              >
                {l10n.getString("nav-footer-relay-terms")}
              </a>
            </li>
            <li>
              <a
                href="https://www.mozilla.org/about/legal/"
                target="_blank"
                rel="noopener noreferrer"
              >
                {l10n.getString("nav-footer-legal")}
              </a>
            </li>
            <li>
              <a
                href="https://github.com/mozilla/fx-private-relay"
                rel="noopener noreferrer"
                target="_blank"
              >
                <img
                  alt={l10n.getString("logo-github-alt")}
                  src={githubLogo.src}
                  width={24}
                  height={24}
                />
              </a>
            </li>
          </ul>
        </footer>
      </div>
    </>
  );
};
