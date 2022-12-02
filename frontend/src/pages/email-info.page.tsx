import { useLocalization } from "@fluent/react";
import { NextPage } from "next";
import { useEffect, useState } from "react";
import styles from "./email-info.module.scss";
import logoType from "./images/fx-private-relay-logotype-dark.svg";
import logo from "./images/placeholder-logo.svg";
import { PageMetadata } from "../components/layout/PageMetadata";
import {
  WarningFilledIcon,
  InfoTriangleIcon,
  CloseIcon,
  InfoIcon,
  CheckIcon,
} from "../components/Icons";
import Link from "next/link";
import { FaqAccordion } from "../components/landing/FaqAccordion";
import { AliasData, AliasUpdateFn, useAliases } from "../hooks/api/aliases";
import { useProfiles } from "../hooks/api/profile";

// Paste this in your browser console to get a report URL:
// { let url = new URL("http://localhost:3000/email-info"); url.hash = JSON.stringify({ sender: "email@example.com", received_at: Date.now(), trackers: { "ads.facebook.com": 1, "ads.googletagmanager.com": 2 }, subject: "Uw bestelling - bevestiging van ontvangst 1353260347", type: "random", maskId: 0, isPromotional: true }); url.href }
// This generates the following URL:
// http://localhost:3000/email-info#{%22sender%22:%22email@example.com%22,%22received_at%22:1669910306162,%22trackers%22:{%22ads.facebook.com%22:1,%22ads.googletagmanager.com%22:2},%22subject%22:%22Uw%20bestelling%20-%20bevestiging%20van%20ontvangst%201353260347%22,%22type%22:%22random%22,%22maskId%22:0,%22isPromotional%22:true}

type EmailMeta = {
  sender: string;
  received_at: number;
  subject: string;
  trackers: Record<string, number>;
  maskId: number;
  isPromotional: boolean;
  type: "random" | "custom";
};

const EmailInfo: NextPage = () => {
  const { l10n } = useLocalization();
  const [emailMeta, setEmailMeta] = useState<EmailMeta | null>();

  const maskData = useAliases();
  const profileData = useProfiles();

  useEffect(() => {
    function updateEmailMeta() {
      setEmailMeta(parseHash(window.location.hash));
    }
    updateEmailMeta();
    window.addEventListener("hashchange", updateEmailMeta);
    return () => {
      window.removeEventListener("hashchange", updateEmailMeta);
    };
  }, []);

  if (typeof emailMeta === "undefined") {
    return (
      <div className={styles.loading}>
        {l10n.getString("emailinfo-loading")}
      </div>
    );
  }
  if (emailMeta === null) {
    return (
      <div className={styles["load-error"]}>
        {l10n.getString("emailinfo-load-error")}
      </div>
    );
  }

  const relevantMaskList: AliasData[] | undefined =
    emailMeta.type === "custom"
      ? maskData.customAliasData.data
      : maskData.randomAliasData.data;
  const currentMask =
    relevantMaskList?.find((mask) => mask.id === emailMeta.maskId) ?? null;

  return (
    <>
      <PageMetadata />
      <div className={styles.wrapper}>
        <main className={styles["emailinfo-wrapper"]}>
          <div className={styles.metadata}>
            <b className={styles.logo}>
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
                height={20}
              />
            </b>
            <h1>{emailMeta.subject}</h1>
            <dl className={styles.meta}>
              <div className={styles.from}>
                <dt>{l10n.getString("emailinfo-meta-from-heading")}</dt>
                <dd>{emailMeta.sender}</dd>
              </div>
              <div className={styles["received_at"]}>
                <dt>{l10n.getString("emailinfo-meta-receivedat-heading")}</dt>
                <dd>{new Date(emailMeta.received_at).toLocaleString()}</dd>
              </div>
            </dl>
          </div>
          <div className={styles.checklist}>
            <ul>
              <PromotionalCheck
                emailMeta={emailMeta}
                mask={
                  currentMask
                    ? { data: currentMask, onUpdate: maskData.update }
                    : undefined
                }
              />
              <li
                className={`${styles.trackers} ${styles.info} ${styles["no-trackers"]}`}
              >
                <InfoIcon
                  alt=""
                  width={20}
                  height={20}
                  className={styles["status-icon"]}
                />
                <div className={styles.text}>
                  <b className={styles.status}>
                    {l10n.getString("emailinfo-checklist-trackers-status-none")}
                  </b>
                  <p className={styles.description}>
                    {l10n.getString(
                      "emailinfo-checklist-trackers-description-none"
                    )}
                  </p>
                </div>
              </li>
              <li
                className={`${styles.premium} ${styles.checked} ${styles["has-premum"]}`}
              >
                <CheckIcon
                  alt=""
                  width={20}
                  height={20}
                  className={styles["status-icon"]}
                />
                <div className={styles.text}>
                  <b className={styles.status}>
                    {l10n.getString(
                      "emailinfo-checklist-premium-status-premium"
                    )}
                  </b>
                  <p className={styles.description}>
                    {l10n.getString(
                      "emailinfo-checklist-premium-description-premium"
                    )}
                  </p>
                </div>
              </li>
            </ul>
          </div>
        </main>
      </div>
    </>
  );
};

const PromotionalCheck = (props: {
  emailMeta: EmailMeta;
  mask?: { data: AliasData; onUpdate: AliasUpdateFn };
}) => {
  const { l10n } = useLocalization();

  if (
    props.emailMeta.isPromotional &&
    props.mask?.data.block_level_one_trackers === false
  ) {
    return (
      <Check
        status="unchecked"
        title={l10n.getString(
          "emailinfo-checklist-promotional-status-promotional"
        )}
        description={l10n.getString(
          "emailinfo-checklist-promotional-description-promotional"
        )}
        cta={{
          text: l10n.getString(
            "emailinfo-checklist-promotional-cta-promotional",
            { address: props.mask.data.full_address }
          ),
          action: () => console.log("Doing"),
        }}
      />
    );
  }

  return (
    <Check
      status="checked"
      title={l10n.getString(
        "emailinfo-checklist-promotional-status-promotional"
      )}
      description={l10n.getString(
        "emailinfo-checklist-promotional-description-promotional"
      )}
    />
  );
};

const Check = (props: {
  status: "checked" | "info" | "unchecked";
  title: string;
  description: string;
  cta?: { text: string; action: string | (() => void) };
}) => {
  const cta =
    typeof props.cta === "undefined" ? null : typeof props.cta.action ===
      "function" ? (
      <button className={styles.cta}>{props.cta.text}</button>
    ) : (
      <a href={props.cta.action} className={styles.cta}>
        {props.cta.text}
      </a>
    );

  const Icon =
    props.status === "checked"
      ? CheckIcon
      : props.status === "info"
      ? InfoIcon
      : CloseIcon;

  return (
    <li
      className={`${styles.premium} ${styles.checked} ${styles["has-premum"]}`}
    >
      <Icon alt="" width={20} height={20} className={styles["status-icon"]} />
      <div className={styles.text}>
        <b className={styles.status}>{props.title}</b>
        <p className={styles.description}>{props.description}</p>
        {cta}
      </div>
    </li>
  );
};

function parseHash(hash: string): EmailMeta | null {
  try {
    const data: unknown = JSON.parse(decodeURIComponent(hash.substring(1)));
    if (!containsEmailMeta(data)) {
      return null;
    }
    // Note: we're explicitly enumerating the keys we're returning because
    // `data` includes (potentially malicious) user input. This mitigates the
    // risk of e.g. prototype pollution.
    return {
      sender: data.sender,
      received_at: data.received_at,
      subject: data.subject,
      trackers: data.trackers,
      isPromotional: data.isPromotional,
      maskId: data.maskId,
      type: data.type,
    };
  } catch (e) {
    return null;
  }
}

// This function does runtime type checking on user input,
// so we don't know its type at compile time yet:
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function containsEmailMeta(parsed: any): parsed is EmailMeta {
  return (
    typeof parsed === "object" &&
    parsed !== null &&
    typeof parsed.sender === "string" &&
    Number.isInteger(parsed.received_at) &&
    Number.isInteger(parsed.maskId) &&
    typeof parsed.subject === "string" &&
    typeof parsed.isPromotional === "boolean" &&
    typeof parsed.type === "string" &&
    ["random", "custom"].includes(parsed.type) &&
    typeof parsed.trackers === "object" &&
    Object.entries(parsed.trackers).every(
      ([tracker, count]: [unknown, unknown]) =>
        typeof tracker === "string" && Number.isInteger(count)
    )
  );
}

export default EmailInfo;
