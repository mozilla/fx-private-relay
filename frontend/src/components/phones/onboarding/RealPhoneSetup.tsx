import { Localized, useLocalization } from "@fluent/react";
import PhoneInput from "react-phone-number-input";
import { E164Number } from "libphonenumber-js/min";
import styles from "./RealPhoneSetup.module.scss";
import "react-phone-number-input/style.css";
import PhoneVerify from "./images/phone-verify.svg";
import EnterVerifyCode from "./images/enter-verify-code.svg";
import EnterVerifyCodeError from "./images/verify-code-error.svg";
import { Button } from "../../Button";
import {
  hasPendingVerification,
  RequestPhoneRemovalFn,
  UnverifiedPhone,
  PhoneNumberSubmitVerificationFn,
} from "../../../hooks/api/realPhone";
import { RuntimeData } from "../../../hooks/api/runtimeData";
import { ChangeEventHandler, FormEventHandler, useState } from "react";
import { parseDate } from "../../../functions/parseDate";
import { formatPhone } from "../../../functions/formatPhone";
import { useInterval } from "../../../hooks/interval";

type RealPhoneSetupProps = {
  unverifiedRealPhones: Array<UnverifiedPhone>;
  onRequestVerification: (numberToVerify: string) => Promise<Response>;
  onSubmitVerification: PhoneNumberSubmitVerificationFn;
  onRequestPhoneRemoval: RequestPhoneRemovalFn;
  runtimeData: RuntimeData;
};
export const RealPhoneSetup = (props: RealPhoneSetupProps) => {
  const phonesPendingVerification = props.unverifiedRealPhones.filter(
    hasPendingVerification
  );
  const [isEnteringNumber, setIsEnteringNumber] = useState(
    phonesPendingVerification.length === 0
  );

  if (isEnteringNumber || phonesPendingVerification.length === 0) {
    return (
      <RealPhoneForm
        requestPhoneVerification={(number) => {
          setIsEnteringNumber(false);
          return props.onRequestVerification(number);
        }}
      />
    );
  }

  return (
    <RealPhoneVerification
      phonesPendingVerification={phonesPendingVerification}
      submitPhoneVerification={props.onSubmitVerification}
      requestPhoneVerification={(number) => {
        setIsEnteringNumber(false);
        return props.onRequestVerification(number);
      }}
      maxMinutesToVerify={props.runtimeData.MAX_MINUTES_TO_VERIFY_REAL_PHONE}
      onGoBack={() => setIsEnteringNumber(true)}
      requestPhoneRemoval={(id: number) => {
        setIsEnteringNumber(true);
        return props.onRequestPhoneRemoval(id);
      }}
    />
  );
};

type RealPhoneFormProps = {
  requestPhoneVerification: (phoneNumber: string) => Promise<Response>;
};

const RealPhoneForm = (props: RealPhoneFormProps) => {
  const { l10n } = useLocalization();

  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneNumberSubmitted, setPhoneNumberSubmitted] = useState("");
  const [phoneNumberError, setPhoneNumberError] = useState<boolean>(false);

  const onSubmit: FormEventHandler = async (event) => {
    event.preventDefault();

    // use this number to show user the number they submitted
    setPhoneNumberSubmitted(phoneNumber);

    // submit the request for phone verification
    const res = await props.requestPhoneVerification(phoneNumber);

    /**
     * Check if the phone number was successfully submitted for verification
     * This will let us show error message if the phone number was not submitted for
     * verification successfully and add an error class to input field
     */
    setPhoneNumberError(res.status !== 201);
  };

  const renderErrorMessage = (
    <div
      className={`${styles["error"]} ${
        phoneNumberError ? "" : styles["is-hidden"]
      }`}
    >
      {l10n.getString("phone-onboarding-step2-invalid-number", {
        phone_number: formatPhone(phoneNumberSubmitted),
      })}
    </div>
  );

  return (
    <div className={`${styles.step} ${styles["step-verify-input"]} `}>
      <div className={styles.lead}>
        <img src={PhoneVerify.src} alt="" width={200} />
        <h2>{l10n.getString("phone-onboarding-step2-headline")}</h2>
        <p>{l10n.getString("phone-onboarding-step2-body")}</p>
      </div>
      {/* Add error class of `mzp-is-error` */}
      <form onSubmit={onSubmit} className={styles.form}>
        {renderErrorMessage}

        <PhoneInput
          className={`${phoneNumberError ? styles["is-error"] : ""} ${
            styles["phone-input"]
          }`}
          placeholder={l10n.getString(
            "phone-onboarding-step2-input-placeholder"
          )}
          countries={["US", "CA"]}
          // flags are found in /public/images/countryFlags/
          flagUrl="/images/countryFlags/{xx}.svg"
          defaultCountry="US"
          type="tel"
          withCountryCallingCode={true}
          international
          autoComplete="tel"
          limitMaxLength
          value={phoneNumber}
          required={true}
          autoFocus={true}
          onChange={(number: E164Number) => setPhoneNumber(number)}
          inputMode="numeric"
        />

        <Button className={styles.button} type="submit">
          {l10n.getString("phone-onboarding-step2-button-cta")}
        </Button>
      </form>
    </div>
  );
};

// TODO: Add logic to display the correct information between: default/error/success for the following Step Three
// Init state: Enter verification
// If 5 mins expire, show errorTimeExpired message
// If code is wrong, add is-error classes and update image/title
// If code is correct, show successWhatsNext and  update image/title
type RealPhoneVerificationProps = {
  phonesPendingVerification: UnverifiedPhone[];
  submitPhoneVerification: PhoneNumberSubmitVerificationFn;
  requestPhoneRemoval: (id: number) => Promise<Response>;
  requestPhoneVerification: (numberToVerify: string) => Promise<Response>;
  maxMinutesToVerify: number;
  onGoBack: () => void;
};
const RealPhoneVerification = (props: RealPhoneVerificationProps) => {
  const { l10n } = useLocalization();
  const phoneWithMostRecentlySentVerificationCode =
    getPhoneWithMostRecentlySentVerificationCode(
      props.phonesPendingVerification
    );
  const [verificationCode, setVerificationCode] = useState("");

  const verificationSentDate = parseDate(
    phoneWithMostRecentlySentVerificationCode.verification_sent_date
  );
  const [remainingTime, setRemainingTime] = useState(
    getRemainingTime(verificationSentDate, props.maxMinutesToVerify)
  );
  /** `undefined` if verification hasn't been attempted yet */
  const [isVerifiedSuccessfully, setIsVerifiedSuccessfully] =
    useState<boolean>();

  const onChange: ChangeEventHandler<HTMLInputElement> = (event) => {
    setVerificationCode(event.currentTarget.value);
  };

  const onInvalid: FormEventHandler<HTMLInputElement> = (event) => {
    event.currentTarget.setCustomValidity(
      l10n.getString("phone-onboarding-step3-input-placeholder")
    );
  };

  const onSubmit: FormEventHandler = async (event) => {
    event.preventDefault();

    const response = await props.submitPhoneVerification(
      phoneWithMostRecentlySentVerificationCode.id,
      {
        number: phoneWithMostRecentlySentVerificationCode.number,
        verification_code: verificationCode,
      }
    );

    setIsVerifiedSuccessfully(response.ok);
  };

  useInterval(() => {
    setRemainingTime(
      getRemainingTime(verificationSentDate, props.maxMinutesToVerify)
    );
  }, 1000);

  const errorTimeExpired = (
    <div
      className={`${styles["step-input-verificiation-code-timeout"]} ${
        remainingTime > 0 ? styles["is-hidden"] : ""
      }`}
    >
      <p>{l10n.getString("phone-onboarding-step3-error-exipred")}</p>
      <Button
        className={styles.button}
        type="button"
        onClick={() => {
          props.requestPhoneVerification(
            phoneWithMostRecentlySentVerificationCode.number
          );
        }}
      >
        {l10n.getString("phone-onboarding-step3-error-cta")}
      </Button>
    </div>
  );

  const codeEntryPlaceholder = "000000";
  const remainingSeconds = Math.floor(remainingTime / 1000);
  const minuteCountdown = Math.floor(remainingSeconds / 60);
  const secondCountdown = remainingSeconds - minuteCountdown * 60;

  return (
    <div
      className={`${styles.step}  ${styles["step-input-verificiation-code"]} `}
    >
      <div
        className={`${styles.lead} ${
          isVerifiedSuccessfully === true ? styles["is-success"] : ""
        }  ${isVerifiedSuccessfully === false ? styles["is-error"] : ""}`}
      >
        <div
          className={`${styles["step-input-verificiation-code-lead-default"]}`}
        >
          {/* Default state */}
          <img src={EnterVerifyCode.src} alt="" width={300} />
          <h2>{l10n.getString("phone-onboarding-step2-headline")}</h2>
        </div>
        <div
          className={`${styles["step-input-verificiation-code-lead-error"]} `}
        >
          {/* Timeout error state */}
          <img src={EnterVerifyCodeError.src} alt="" width={170} />
          <h2 className={`${styles["is-error"]} `}>
            {l10n.getString("phone-onboarding-step3-code-fail-title")}
          </h2>
          <p>{l10n.getString("phone-onboarding-step3-code-fail-body")}</p>
        </div>
      </div>
      {/* Add error class of `mzp-is-error` */}

      {errorTimeExpired}

      <form
        onSubmit={onSubmit}
        className={`${styles.form} ${
          remainingTime < 0 ? styles["is-hidden"] : ""
        }`}
      >
        {/* TODO: Make remaining_time count backwards with "X minutes, XX seconds" */}
        <Localized
          id="phone-onboarding-step3-body"
          vars={{
            phone_number: formatPhone(
              phoneWithMostRecentlySentVerificationCode.number
            ),
            remaining_seconds: secondCountdown,
            remaining_minutes: minuteCountdown,
          }}
          elems={{
            span: <span className={`${styles["phone-number"]}`} />,
            strong: <strong />,
          }}
        >
          <p />
        </Localized>

        <input
          placeholder={codeEntryPlaceholder}
          required={true}
          maxLength={6}
          minLength={6}
          className={isVerifiedSuccessfully === false ? styles["is-error"] : ""}
          onChange={onChange}
          autoFocus={true}
          pattern="^\d{6}$"
          onInvalid={onInvalid}
          title={l10n.getString("phone-onboarding-step3-input-placeholder")}
          value={verificationCode}
        />

        <Button
          className={styles.button}
          type="submit"
          disabled={verificationCode.length === 0 || verificationCode === " "}
        >
          {l10n.getString("phone-onboarding-step3-button-cta")}
        </Button>
      </form>

      {(remainingTime < 0 || !isVerifiedSuccessfully) && (
        <Button
          onClick={() =>
            props.requestPhoneRemoval(
              phoneWithMostRecentlySentVerificationCode.id
            )
          }
          className={styles.button}
          type="button"
          variant="secondary"
        >
          {l10n.getString("phone-onboarding-step3-button-edit")}
        </Button>
      )}
    </div>
  );
};

function getRemainingTime(
  verificationSentTime: Date,
  maxMinutesToVerify: number
): number {
  const currentTime = new Date().getTime();
  const elapsedTime = currentTime - verificationSentTime.getTime();
  const remainingTime = maxMinutesToVerify * 60 * 1000 - elapsedTime;
  return remainingTime;
}

function getPhoneWithMostRecentlySentVerificationCode(
  phones: UnverifiedPhone[]
) {
  const mostRecentVerifiedPhone = [...phones].sort((a, b) => {
    const sendDateA = parseDate(a.verification_sent_date).getTime();
    const sendDateB = parseDate(b.verification_sent_date).getTime();
    return sendDateA - sendDateB;
  });

  return mostRecentVerifiedPhone[0];
}
