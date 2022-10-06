import { NextPage } from "next";
import { ReactNode } from "react";
import { Localized, useLocalization } from "@fluent/react";
import styles from "./faq.module.scss";
import { Layout } from "../components/layout/Layout";
import { getRuntimeConfig } from "../config";
import { useRuntimeData } from "../hooks/api/runtimeData";
import { isFlagActive } from "../functions/waffle";
import { isPhonesAvailableInCountry } from "../functions/getPlan";

const Faq: NextPage = () => {
  const { l10n } = useLocalization();
  const runtimeData = useRuntimeData();

  const phoneMaskingFaqs =
    isPhonesAvailableInCountry(runtimeData.data) &&
    isFlagActive(runtimeData.data, "phones") ? (
      <>
        <QAndA
          id={"phone-masking-faq-question-what-is"}
          question={l10n.getString("phone-masking-faq-question-what-is")}
        >
          <p>{l10n.getString("phone-masking-faq-answer-what-is")}</p>
        </QAndA>
        <QAndA
          id={"phone-masking-faq-question-where-is"}
          question={l10n.getString("phone-masking-faq-question-where-is")}
        >
          <p>{l10n.getString("phone-masking-faq-answer-where-is")}</p>
        </QAndA>
        <QAndA
          id={"phone-masking-faq-question-how-many"}
          question={l10n.getString("phone-masking-faq-question-how-many")}
        >
          <p>{l10n.getString("phone-masking-faq-answer-how-many")}</p>
        </QAndA>
        <QAndA
          id={"phone-masking-faq-question-change-phone-mask"}
          question={l10n.getString(
            "phone-masking-faq-question-change-phone-mask"
          )}
        >
          <p>{l10n.getString("phone-masking-faq-answer-change-phone-mask")}</p>
        </QAndA>
        <QAndA
          id={"phone-masking-faq-question-can-reply"}
          question={l10n.getString("phone-masking-faq-question-can-reply")}
        >
          <p>{l10n.getString("phone-masking-faq-answer-can-reply")}</p>
        </QAndA>
        <QAndA
          id={"phone-masking-faq-question-forwarded-texts"}
          question={l10n.getString(
            "phone-masking-faq-question-forwarded-texts"
          )}
        >
          <p>{l10n.getString("phone-masking-faq-answer-forwarded-texts")}</p>
        </QAndA>
        <QAndA
          id={"phone-masking-faq-question-pictures"}
          question={l10n.getString("phone-masking-faq-question-pictures")}
        >
          <p>{l10n.getString("phone-masking-faq-answer-pictures")}</p>
        </QAndA>
        <QAndA
          id={"phone-masking-faq-question-historical"}
          question={l10n.getString("phone-masking-faq-question-historical")}
        >
          <p>{l10n.getString("phone-masking-faq-answer-historical")}</p>
        </QAndA>
        <QAndA
          id={"phone-masking-faq-question-can-i-send"}
          question={l10n.getString("phone-masking-faq-question-can-i-send")}
        >
          <p>{l10n.getString("phone-masking-faq-answer-can-i-send")}</p>
        </QAndA>
        <QAndA
          id={"phone-masking-faq-question-limit"}
          question={l10n.getString("phone-masking-faq-question-limit")}
        >
          <p>{l10n.getString("phone-masking-faq-answer-limit")}</p>
        </QAndA>
        <QAndA
          id={"phone-masking-faq-question-call-length"}
          question={l10n.getString("phone-masking-faq-question-call-length")}
        >
          <p>{l10n.getString("phone-masking-faq-answer-call-length")}</p>
        </QAndA>
        <QAndA
          id={"phone-masking-faq-question-can-i-call"}
          question={l10n.getString("phone-masking-faq-question-can-i-call")}
        >
          <p>{l10n.getString("phone-masking-faq-answer-can-i-call")}</p>
        </QAndA>
        <QAndA
          id={"phone-masking-faq-question-can-i-see"}
          question={l10n.getString("phone-masking-faq-question-can-i-see")}
        >
          <p>{l10n.getString("phone-masking-faq-answer-can-i-see")}</p>
        </QAndA>
        <QAndA
          id={"phone-masking-faq-question-can-i-block"}
          question={l10n.getString("phone-masking-faq-question-can-i-block")}
        >
          <p>{l10n.getString("phone-masking-faq-answer-can-i-block")}</p>
        </QAndA>
        <QAndA
          id={"phone-masking-faq-question-spam"}
          question={l10n.getString("phone-masking-faq-question-spam")}
        >
          <p>{l10n.getString("phone-masking-faq-answer-spam")}</p>
        </QAndA>
        <QAndA
          id={"phone-masking-faq-question-disable-logging"}
          question={l10n.getString(
            "phone-masking-faq-question-disable-logging"
          )}
        >
          <p>{l10n.getString("phone-masking-faq-answer-disable-logging")}</p>
        </QAndA>
        <QAndA
          id={"phone-masking-faq-question-can-i-share"}
          question={l10n.getString("phone-masking-faq-question-can-i-share")}
        >
          <p>{l10n.getString("phone-masking-faq-answer-can-i-share")}</p>
        </QAndA>
        <QAndA
          id={"phone-masking-faq-question-how-i-save-card"}
          question={l10n.getString(
            "phone-masking-faq-question-how-i-save-card"
          )}
        >
          <p>{l10n.getString("phone-masking-faq-answer-how-i-save-card")}</p>
        </QAndA>
        <QAndA
          id={"phone-masking-faq-question-install-app"}
          question={l10n.getString("phone-masking-faq-question-install-app")}
        >
          <p>{l10n.getString("phone-masking-faq-answer-install-app")}</p>
        </QAndA>
        <QAndA
          id="phone-masking-faq-question-data"
          question={l10n.getString("phone-masking-faq-question-data")}
        >
          <Localized
            id="phone-masking-faq-answer-data"
            vars={{
              url: "https://www.mozilla.org/privacy/firefox-relay/",
              attrs: "",
            }}
            elems={{
              a: (
                <a
                  href="https://www.mozilla.org/privacy/firefox-relay/"
                  target="_blank"
                  rel="noopener noreferrer"
                />
              ),
            }}
          >
            <p />
          </Localized>
        </QAndA>
      </>
    ) : null;

  const trackerBlockingFaqs = isFlagActive(
    runtimeData.data,
    "tracker_removal"
  ) ? (
    <>
      <QAndA
        id="faq-disable-trackerremoval"
        question={l10n.getString(
          "faq-question-disable-trackerremoval-question"
        )}
      >
        <p>{l10n.getString("faq-question-disable-trackerremoval-answer")}</p>
      </QAndA>
      <QAndA
        id="faq-bulk-trackerremoval"
        question={l10n.getString("faq-question-bulk-trackerremoval-question")}
      >
        <p>{l10n.getString("faq-question-bulk-trackerremoval-answer")}</p>
      </QAndA>
      <QAndA
        id="faq-trackerremoval-breakage"
        question={l10n.getString(
          "faq-question-trackerremoval-breakage-question"
        )}
      >
        <p>{l10n.getString("faq-question-trackerremoval-breakage-answer-2")}</p>
      </QAndA>
    </>
  ) : null;

  return (
    <Layout theme="free" runtimeData={runtimeData.data}>
      <main>
        <div className={styles["faq-page"]}>
          <div className={styles["faqs-wrapper"]}>
            <h1 className={styles.headline}>
              {l10n.getString("faq-headline")}
            </h1>
            <div className={styles.faqs}>
              <QAndA
                id="faq-what-is"
                question={l10n.getString("faq-question-what-is-question-2")}
              >
                <p>{l10n.getString("faq-question-what-is-answer-2")}</p>
              </QAndA>
              <QAndA
                id="faq-missing-emails"
                question={l10n.getString(
                  "faq-question-missing-emails-question-2"
                )}
              >
                <p>
                  {l10n.getString("faq-question-missing-emails-answer-a-2")}
                </p>
                <ul>
                  <li>
                    {l10n.getString(
                      "faq-question-missing-emails-answer-reason-spam"
                    )}
                  </li>
                  <li>
                    {l10n.getString(
                      "faq-question-missing-emails-answer-reason-blocked-2"
                    )}
                  </li>
                  <li>
                    {l10n.getString(
                      "faq-question-missing-emails-answer-reason-size",
                      {
                        size: getRuntimeConfig().emailSizeLimitNumber,
                        unit: getRuntimeConfig().emailSizeLimitUnit,
                      }
                    )}
                  </li>
                  <li>
                    {l10n.getString(
                      "faq-question-missing-emails-answer-reason-not-accepted-2"
                    )}
                  </li>
                  <li>
                    {l10n.getString(
                      "faq-question-missing-emails-answer-reason-turned-off-2"
                    )}
                  </li>
                  <li>
                    {l10n.getString(
                      "faq-question-missing-emails-answer-reason-delay"
                    )}
                  </li>
                </ul>
                <Localized
                  id="faq-question-missing-emails-answer-support-site-html"
                  vars={{
                    url: "https://support.mozilla.org/products/relay/",
                    attrs: "",
                  }}
                  elems={{
                    a: (
                      <a
                        href="https://support.mozilla.org/products/relay/"
                        target="_blank"
                        rel="noopener noreferrer"
                      />
                    ),
                  }}
                >
                  <p />
                </Localized>
              </QAndA>
              <QAndA
                id="faq-use-cases"
                question={l10n.getString("faq-question-use-cases-question-2")}
              >
                <p>{l10n.getString("faq-question-use-cases-answer-part1-2")}</p>
                <p>{l10n.getString("faq-question-use-cases-answer-part2-2")}</p>
              </QAndA>
              <QAndA
                id="faq-rejections"
                question={l10n.getString("faq-question-2-question-2")}
              >
                <p>{l10n.getString("faq-question-2-answer-v4")}</p>
              </QAndA>
              <QAndA
                id="faq-spam"
                question={l10n.getString("faq-question-1-question")}
              >
                <p>{l10n.getString("faq-question-1-answer-a-2")}</p>
                <Localized
                  id="faq-question-1-answer-b-2-html"
                  vars={{
                    url: "https://addons.mozilla.org/firefox/addon/private-relay/",
                    attrs: "",
                  }}
                  elems={{
                    a: (
                      <a
                        href="https://addons.mozilla.org/firefox/addon/private-relay/"
                        target="_blank"
                        rel="noopener noreferrer"
                      />
                    ),
                  }}
                >
                  <p />
                </Localized>
              </QAndA>
              <QAndA
                id="faq-availability"
                question={l10n.getString("faq-question-availability-question")}
              >
                <p>{l10n.getString("faq-question-availability-answer-v2")}</p>
              </QAndA>
              <QAndA
                id="faq-replies"
                question={l10n.getString("faq-question-4-question-2")}
              >
                <p>{l10n.getString("faq-question-4-answer-v4")}</p>
              </QAndA>
              <QAndA
                id="faq-subdomain-question"
                question={l10n.getString(
                  "faq-question-subdomain-characters-question"
                )}
              >
                <p>
                  {l10n.getString(
                    "faq-question-subdomain-characters-answer-v2"
                  )}
                </p>
              </QAndA>
              <QAndA
                id="faq-browser-support"
                question={l10n.getString(
                  "faq-question-browser-support-question"
                )}
              >
                <p>{l10n.getString("faq-question-browser-support-answer-2")}</p>
              </QAndA>
              <QAndA
                id="faq-longevity"
                question={l10n.getString("faq-question-longevity-question")}
              >
                <p>{l10n.getString("faq-question-longevity-answer-2")}</p>
              </QAndA>
              <QAndA
                id="faq-mozmail"
                question={l10n.getString("faq-question-mozmail-question-2")}
              >
                <p>{l10n.getString("faq-question-mozmail-answer-2")}</p>
              </QAndA>
              <QAndA
                id="faq-attachments"
                question={l10n.getString("faq-question-attachments-question")}
              >
                <p>
                  {l10n.getString("faq-question-attachments-answer-v2", {
                    size: getRuntimeConfig().emailSizeLimitNumber,
                    unit: getRuntimeConfig().emailSizeLimitUnit,
                  })}
                </p>
              </QAndA>
              <QAndA
                id="faq-unsubscribe-domain"
                question={l10n.getString(
                  "faq-question-unsubscribe-domain-question-2"
                )}
              >
                <p>
                  {l10n.getString("faq-question-unsubscribe-domain-answer-2")}
                </p>
              </QAndA>
              <QAndA
                id="faq-data-collection"
                question={l10n.getString("faq-question-8-question")}
              >
                <Localized
                  id="faq-question-8-answer-2-html"
                  vars={{
                    url: "https://www.mozilla.org/privacy/firefox-relay/",
                    attrs: "",
                  }}
                  elems={{
                    a: (
                      <a
                        href="https://www.mozilla.org/privacy/firefox-relay/"
                        target="_blank"
                        rel="noopener noreferrer"
                      />
                    ),
                  }}
                >
                  <p />
                </Localized>
              </QAndA>
              <QAndA
                id="faq-email-storage"
                question={l10n.getString("faq-question-email-storage-question")}
              >
                <Localized
                  id="faq-question-email-storage-answer"
                  vars={{
                    url: "https://www.mozilla.org/privacy/firefox-relay/",
                    attrs: "",
                  }}
                  elems={{
                    a: (
                      <a
                        href="https://www.mozilla.org/privacy/firefox-relay/"
                        target="_blank"
                        rel="noopener noreferrer"
                      />
                    ),
                  }}
                >
                  <p />
                </Localized>
              </QAndA>
              <QAndA
                id="faq-acceptable-use"
                question={l10n.getString(
                  "faq-question-acceptable-use-question"
                )}
              >
                <Localized
                  id="faq-question-acceptable-use-answer-a-html"
                  vars={{
                    url: "https://www.mozilla.org/about/legal/acceptable-use/",
                    attrs: "",
                  }}
                  elems={{
                    a: (
                      <a
                        href="https://www.mozilla.org/about/legal/acceptable-use/"
                        target="_blank"
                        rel="noopener noreferrer"
                      />
                    ),
                  }}
                >
                  <p />
                </Localized>
                <ul>
                  <li>
                    {l10n.getString(
                      "faq-question-acceptable-use-answer-measure-account"
                    )}
                  </li>
                  <li>
                    {l10n.getString(
                      "faq-question-acceptable-use-answer-measure-unlimited-payment-2"
                    )}
                  </li>
                  <li>
                    {l10n.getString(
                      "faq-question-acceptable-use-answer-measure-rate-limit-2"
                    )}
                  </li>
                </ul>
                <Localized
                  id="faq-question-acceptable-use-answer-b-html"
                  vars={{
                    url: "https://www.mozilla.org/about/legal/terms/firefox-relay/",
                    attrs: "",
                  }}
                  elems={{
                    a: (
                      <a
                        href="https://www.mozilla.org/about/legal/terms/firefox-relay/"
                        target="_blank"
                        rel="noopener noreferrer"
                      />
                    ),
                  }}
                >
                  <p />
                </Localized>
              </QAndA>
              <QAndA
                id="faq-promotional-email-blocking"
                question={l10n.getString(
                  "faq-question-promotional-email-blocking-question"
                )}
              >
                <p>
                  {l10n.getString(
                    "faq-question-promotional-email-blocking-answer"
                  )}
                </p>
              </QAndA>
              <QAndA
                id="faq-detect-promotional"
                question={l10n.getString(
                  "faq-question-detect-promotional-question"
                )}
              >
                <p>
                  {l10n.getString("faq-question-detect-promotional-answer")}
                </p>
              </QAndA>
              {trackerBlockingFaqs}
              {phoneMaskingFaqs}
            </div>
          </div>
        </div>
      </main>
    </Layout>
  );
};

const QAndA = (props: {
  id: string;
  question: string;
  children: ReactNode;
}) => {
  return (
    <section id={props.id} className={styles.faq}>
      <h2 className={styles.question}>{props.question}</h2>
      <div className={styles.answer}>{props.children}</div>
    </section>
  );
};

export default Faq;
