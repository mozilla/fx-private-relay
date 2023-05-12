import { NextPage } from "next";
import { useEffect, useState } from "react";
import Image from "next/image";
import styles from "./tracker-report.module.scss";
import LogoType from "./images/fx-private-relay-logotype-dark.svg";
import Logo from "./images/placeholder-logo.svg";
import { PageMetadata } from "../components/layout/PageMetadata";
import {
  HideIcon,
  WarningFilledIcon,
  InfoTriangleIcon,
} from "../components/Icons";
import Link from "next/link";
import { FaqAccordionItem } from "../components/landing/FaqAccordion";
import { useL10n } from "../hooks/l10n";

// Paste this in your browser console to get a report URL:
// { let url = new URL("http://localhost:3000/tracker-report"); url.hash = JSON.stringify({ sender: "email@example.com", received_at: Date.now(), trackers: { "ads.facebook.com": 1, "ads.googletagmanager.com": 2 } }); url.href }
// This generates the following URL:
// http://localhost:3000/tracker-report#{%22sender%22:%22email@example.com%22,%22received_at%22:1655288077484,%22trackers%22:{%22ads.facebook.com%22:1,%22ads.googletagmanager.com%22:2}}
// For more info, see /docs/frontend-architecture.md#work-on-the-tracker-removal-report

type ReportData = {
  sender: string;
  received_at: number;
  trackers?: Record<string, number>;
};

const TrackerReport: NextPage = () => {
  const l10n = useL10n();
  const [reportData, setReportData] = useState<ReportData | null>();

  useEffect(() => {
    function updateReportData() {
      setReportData(parseHash(window.location.hash));
    }
    updateReportData();
    window.addEventListener("hashchange", updateReportData);
    return () => {
      window.removeEventListener("hashchange", updateReportData);
    };
  }, []);

  if (typeof reportData === "undefined") {
    return (
      <div className={styles.loading}>
        {l10n.getString("trackerreport-loading")}
      </div>
    );
  }

  // check if reportData is null and check if trackers are set.
  if (reportData === null) {
    return (
      <div className={styles["load-error"]}>
        {l10n.getString("trackerreport-load-error")}
      </div>
    );
  }

  const trackers = Object.entries(reportData.trackers ?? {}).sort(
    ([_trackerA, countA], [_trackerB, countB]) => countB - countA
  );
  const trackerListing =
    trackers.length === 0 ? (
      <p>{l10n.getString("trackerreport-trackers-none")}</p>
    ) : (
      <table>
        <thead>
          <tr>
            <td aria-hidden={true}>
              {/* Empty header for the icon column, hidden from screen readers */}
            </td>
            <th>{l10n.getString("trackerreport-trackers-tracker-heading")}</th>
            <th>{l10n.getString("trackerreport-trackers-count-heading")}</th>
          </tr>
        </thead>
        <tbody>
          {trackers.map(([tracker, count]) => (
            <tr key={tracker}>
              <td aria-hidden={true} className={styles.icon}>
                <HideIcon alt="" />
              </td>
              <td className={styles["tracker-domain"]}>{tracker}</td>
              <td aria-label={count.toString()} className={styles.count}>
                {l10n.getString("trackerreport-tracker-count", {
                  count: count,
                })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );

  return (
    <>
      <PageMetadata />
      <div className={styles.wrapper}>
        <main className={styles["report-wrapper"]}>
          <div className={styles.report}>
            <b className={styles.logo}>
              <Image src={Logo} alt="" className={styles.logomark} width={42} />
              <Image
                src={LogoType}
                alt={l10n.getString("logo-alt")}
                className={styles.logotype}
                height={20}
              />
            </b>
            <h1>{l10n.getString("trackerreport-title")}</h1>
            <dl className={styles.meta}>
              <div className={styles.from}>
                <dt>{l10n.getString("trackerreport-meta-from-heading")}</dt>
                <dd>{reportData.sender}</dd>
              </div>
              <div className={styles["received_at"]}>
                <dt>
                  {l10n.getString("trackerreport-meta-receivedat-heading")}
                </dt>
                <dd>{new Date(reportData.received_at).toLocaleString()}</dd>
              </div>
              <div className={styles.count}>
                <dt>{l10n.getString("trackerreport-meta-count-heading")}</dt>
                <dd>
                  {l10n.getString("trackerreport-trackers-value", {
                    count: Object.values(reportData.trackers ?? {}).reduce(
                      (acc, count) => acc + count,
                      0
                    ),
                  })}
                </dd>
              </div>
            </dl>
            <div className={styles.trackers}>
              <h2>{l10n.getString("trackerreport-trackers-heading")}</h2>
              {trackerListing}
            </div>
            <div className={styles["confidentiality-notice"]}>
              <WarningFilledIcon alt="" />
              {l10n.getString("trackerreport-confidentiality-notice")}
            </div>
            <div className={styles.explainer}>
              <h2>
                {l10n.getString("trackerreport-removal-explainer-heading")}
              </h2>
              <p>{l10n.getString("trackerreport-removal-explainer-content")}</p>
              <hr aria-hidden="true" />
              <h2>
                {l10n.getString("trackerreport-trackers-explainer-heading")}
              </h2>
              <p>
                {l10n.getString(
                  "trackerreport-trackers-explainer-content-part1"
                )}
              </p>
              <p>
                {l10n.getString(
                  "trackerreport-trackers-explainer-content-part2"
                )}
              </p>
              <div className={styles["breakage-warning"]}>
                <InfoTriangleIcon alt="" />
                {l10n.getString("trackerreport-breakage-warning-2")}
              </div>
            </div>
          </div>
        </main>
        <section id="faq" className={styles["faq-wrapper"]}>
          <div className={styles.faq}>
            <div className={styles.lead}>
              <h2 className={styles.headline}>
                {l10n.getString("trackerreport-faq-heading")}
              </h2>
              <p>
                <Link href="/faq" className={styles["read-more"]}>
                  {l10n.getString("trackerreport-faq-cta")}
                </Link>
              </p>
            </div>
            <div className={styles.entries}>
              <FaqAccordionItem
                entries={[
                  {
                    q: l10n.getString(
                      "faq-question-disable-trackerremoval-question"
                    ),
                    a: l10n.getString(
                      "faq-question-disable-trackerremoval-answer"
                    ),
                  },
                  {
                    q: l10n.getString(
                      "faq-question-bulk-trackerremoval-question"
                    ),
                    a: l10n.getString(
                      "faq-question-bulk-trackerremoval-answer"
                    ),
                  },
                  {
                    q: l10n.getString(
                      "faq-question-trackerremoval-breakage-question"
                    ),
                    a: l10n.getString(
                      "faq-question-trackerremoval-breakage-answer-2"
                    ),
                  },
                ]}
              />
            </div>
          </div>
        </section>
      </div>
    </>
  );
};

function parseHash(hash: string): ReportData | null {
  try {
    const data: unknown = JSON.parse(decodeURIComponent(hash.substring(1)));
    if (!containsReportData(data)) {
      return null;
    }
    // Note: we're explicitly enumerating the keys we're returning because
    // `data` includes (potentially malicious) user input. This mitigates the
    // risk of e.g. prototype pollution.
    return {
      sender: data.sender,
      received_at: data.received_at,
      trackers: data.trackers,
    };
  } catch (e) {
    return null;
  }
}

// This function does runtime type checking on user input,
// so we don't know its type at compile time yet:
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function containsReportData(parsed: any): parsed is ReportData {
  return (
    typeof parsed === "object" &&
    parsed !== null &&
    typeof parsed.sender === "string" &&
    Number.isInteger(parsed.received_at) &&
    ["undefined", "object"].includes(typeof parsed.trackers) &&
    Object.entries(parsed.trackers ?? {}).every(
      ([tracker, count]: [unknown, unknown]) =>
        typeof tracker === "string" && Number.isInteger(count)
    )
  );
}

export default TrackerReport;
