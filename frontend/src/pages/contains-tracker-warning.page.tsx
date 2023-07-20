import { NextPage } from "next";
import styles from "./contains-tracker-warning.module.scss";
import { Layout } from "../components/layout/Layout";
import { useRuntimeData } from "../hooks/api/runtimeData";
import { useL10n } from "../hooks/l10n";
import { FaqAccordionItem } from "../components/landing/FaqAccordion";
import { useEffect, useState } from "react";
import { RoundedInfoTriangleIcon } from "../components/Icons";
import { OutboundLink } from "react-ga";

type TrackerWarningData = {
  sender: string;
  received_at: number;
  original_link: string;
};

const ContainsTracker: NextPage = () => {
  const runtimeData = useRuntimeData();
  const l10n = useL10n();
  const [trackerData, setTrackerData] = useState<TrackerWarningData | null>();

  useEffect(() => {
    function updateTrackerData() {
      setTrackerData(parseHash(window.location.hash));
    }
    updateTrackerData();
    window.addEventListener("hashchange", updateTrackerData);
    return () => {
      window.removeEventListener("hashchange", updateTrackerData);
    };
  }, []);

  const TrackerWarningDescription =
    trackerData &&
    l10n.getFragment("contains-tracker-description", {
      vars: {
        sender: trackerData.sender,
        datetime: new Date(trackerData.received_at).toLocaleString("en-US", {
          month: "2-digit",
          day: "2-digit",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
          timeZoneName: "short",
        }),
      },
      elems: {
        u: <u />,
      },
    });

  const TrackerWarningBanner = trackerData && (
    <>
      <div className={styles["warning-banner-container"]}>
        <RoundedInfoTriangleIcon width={28} height={28} alt="" />
        <div className={styles["warning-banner-title-section"]}>
          <h2 className={styles["warning-banner-title"]}>
            {l10n.getString("contains-tracker-warning-title")}
          </h2>
          <p className={styles["warning-banner-description"]}>
            {l10n.getString("contains-tracker-warning-description")}
          </p>
        </div>
      </div>
      <div className={styles["warning-banner-button"]}>
        <div className={styles["cta-button"]}>
          <OutboundLink
            to={trackerData.original_link}
            eventLabel={l10n.getString(
              "contains-tracker-warning-view-link-cta",
            )}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span>
              {l10n.getString("contains-tracker-warning-view-link-cta")}
            </span>
          </OutboundLink>
        </div>
      </div>
    </>
  );

  return (
    <Layout theme="plain" runtimeData={runtimeData.data}>
      <main className={styles["contains-tracker-main"]}>
        <section className={styles["contains-tracker-container"]}>
          <div className={styles["details-section"]}>
            <h1>{l10n.getString("contains-tracker-title")}</h1>
            <p>{TrackerWarningDescription}</p>
            <div className={styles["warning-banner-wrapper"]}>
              {TrackerWarningBanner}
            </div>
          </div>
        </section>
        <section id="faq" className={styles["faq-wrapper"]}>
          <div className={styles.faq}>
            <div className={styles.lead}>
              <h2 className={styles.headline}>
                {l10n.getString("contains-tracker-faq-section-title")}
              </h2>
            </div>
            <div className={styles.entries}>
              <FaqAccordionItem
                autoFocus={true}
                entries={[
                  {
                    q: l10n.getString("faq-question-define-tracker-question"),
                    a: (
                      <p>
                        {l10n.getString(
                          "faq-question-define-tracker-answer-partone",
                        )}
                        <br />
                        <br />
                        {l10n.getString(
                          "faq-question-define-tracker-answer-parttwo",
                        )}
                      </p>
                    ),
                  },
                  {
                    q: l10n.getString(
                      "faq-question-disable-trackerremoval-question",
                    ),
                    a: l10n.getString(
                      "faq-question-disable-trackerremoval-answer",
                    ),
                  },
                  {
                    q: l10n.getString(
                      "faq-question-bulk-trackerremoval-question",
                    ),
                    a: l10n.getString(
                      "faq-question-bulk-trackerremoval-answer",
                    ),
                  },
                  {
                    q: l10n.getString(
                      "faq-question-trackerremoval-breakage-question",
                    ),
                    a: l10n.getString(
                      "faq-question-trackerremoval-breakage-answer-2",
                    ),
                  },
                ]}
              />
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
};

function parseHash(hash: string): TrackerWarningData | null {
  try {
    const data: unknown = JSON.parse(decodeURIComponent(hash.substring(1)));
    if (!containsReportData(data)) {
      return null;
    }
    return {
      sender: data.sender,
      received_at: data.received_at,
      original_link: data.original_link,
    };
  } catch (e) {
    return null;
  }
}

// This function does runtime type checking on user input,
// so we don't know its type at compile time yet:
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function containsReportData(parsed: any): parsed is TrackerWarningData {
  return (
    typeof parsed === "object" &&
    parsed !== null &&
    typeof parsed.sender === "string" &&
    Number.isInteger(parsed.received_at) &&
    typeof parsed.original_link === "string"
  );
}

export default ContainsTracker;
