import {
  ChangeEventHandler,
  FormEventHandler,
  MouseEventHandler,
  useEffect,
  useState,
} from "react";
import { useLocalization } from "@fluent/react";
import styles from "./RelayNumberPicker.module.scss";
import FlagUS from "./images/flag-usa.svg";
import EnteryVerifyCodeSuccess from "./images/verify-code-success.svg";
import { Button } from "../../Button";
import {
  useRelayNumber,
  getRelayNumberSuggestions,
} from "../../../hooks/api/relayNumber";

type RelayNumberPickerProps = {
  onComplete: () => void;
};
export const RelayNumberPicker = (props: RelayNumberPickerProps) => {
  const [hasStarted, setHasStarted] = useState(false);
  const relayNumberData = useRelayNumber();

  if (!hasStarted) {
    return <RelayNumberIntro onStart={() => setHasStarted(true)} />;
  }

  if (!relayNumberData.data || relayNumberData.data.length === 0) {
    return (
      <RelayNumberSelection
        registerRelayNumber={(number) =>
          relayNumberData.registerRelayNumber(number)
        }
      />
    );
  }

  return <RelayNumberConfirmation onComplete={props.onComplete} />;
};
type RelayNumberIntroProps = {
  onStart: () => void;
};
const RelayNumberIntro = (props: RelayNumberIntroProps) => {
  const { l10n } = useLocalization();

  return (
    <div
      className={`${styles.step}  ${styles["step-input-verificiation-code"]} `}
    >
      <div className={`${styles.lead}  ${styles["is-success"]} `}>
        <div
          className={`${styles["step-input-verificiation-code-lead-success"]} `}
        >
          {/* Success state */}
          <img src={EnteryVerifyCodeSuccess.src} alt="" width={170} />
          <h2 className={`${styles["is-success"]} `}>
            {l10n.getString("phone-onboarding-step3-code-success-title")}
          </h2>
          <p>{l10n.getString("phone-onboarding-step3-code-success-body")}</p>
        </div>
      </div>
      {/* Add error class of `mzp-is-error` */}

      {/* TODO: Add logic to display success message */}

      <div className={`${styles["step-input-verificiation-code-success"]} `}>
        <h3>
          {l10n.getString("phone-onboarding-step3-code-success-subhead-title")}
        </h3>
        <p>
          {l10n.getString("phone-onboarding-step3-code-success-subhead-body")}
        </p>
        <Button onClick={() => props.onStart()} className={styles.button}>
          {l10n.getString("phone-onboarding-step3-code-success-cta")}
        </Button>
      </div>
    </div>
  );
};
type RelayNumberSelectionProps = {
  registerRelayNumber: (phoneNumber: string) => Promise<Response>;
};
const RelayNumberSelection = (props: RelayNumberSelectionProps) => {
  const { l10n } = useLocalization();

  // TODO: Defaulting to true to stop FoUC however we need to catch any error in await getRelayNumberSuggestions();
  const [isLoading, setIsLoading] = useState(true);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [relayNumberSuggestions, setRelayNumberSuggestions] = useState<
    string[]
  >([]);
  const [sliceStart, setSliceStart] = useState(0);
  const [sliceEnd, setSliceEnd] = useState(3);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      const resp = await getRelayNumberSuggestions();
      setIsLoading(false);
      const respObject = await resp.json();
      const suggestedNumbers: string[] = [];

      // TODO: DRY If statements below
      if (respObject.other_areas_options) {
        for (const otherAreaOption of respObject.other_areas_options) {
          suggestedNumbers.push(otherAreaOption.phone_number);
        }
      }

      if (respObject.same_area_options) {
        for (const sameAreaOption of respObject.same_area_options) {
          suggestedNumbers.push(sameAreaOption.phone_number);
        }
      }

      if (respObject.same_prefix_options) {
        for (const samePrefixOption of respObject.same_prefix_options) {
          suggestedNumbers.push(samePrefixOption.phone_number);
        }
      }

      setRelayNumberSuggestions(suggestedNumbers);
    })();
  }, []);

  const onChange: ChangeEventHandler<HTMLInputElement> = (event) => {
    setPhoneNumber(event.target.value);
  };

  const onSubmit: FormEventHandler = (event) => {
    event.preventDefault();
    props.registerRelayNumber(phoneNumber);
  };

  const loadingState = isLoading ? (
    <div className={`${styles["step-select-phone-number-mask-loading"]} `}>
      <div className={styles.loading} />
      <p>{l10n.getString("phone-onboarding-step3-loading")}</p>
    </div>
  ) : null;

  const moreRelayNumberOptions: MouseEventHandler<HTMLButtonElement> = () => {
    setSliceStart(sliceStart + 3);
    setSliceEnd(sliceEnd + 3);
  };

  const suggestedNumberRadioInputs = relayNumberSuggestions
    .slice(sliceStart, sliceEnd)
    .map((suggestion, i) => {
      function formatPhone(phoneNumber: string) {
        // Bug: Any country code with two characters will break
        // Return in +1 (111) 111-1111 format
        return `${phoneNumber.substring(0, 2)} (${phoneNumber.substring(
          2,
          5
        )}) ${phoneNumber.substring(5, 8)}-${phoneNumber.substring(8, 12)}`;
      }

      return (
        <div key={suggestion}>
          <input
            onChange={onChange}
            type="radio"
            name="phoneNumberMask"
            id={`number${i}`}
            value={suggestion}
            autoFocus={i === 0}
          />
          <label htmlFor={`number${i}`}>{formatPhone(suggestion)}</label>
        </div>
      );
    });

  const form = isLoading ? null : (
    <div className={`${styles["step-select-phone-number-mask"]} `}>
      <div className={styles.lead}>
        <img src={FlagUS.src} alt="" width={45} />
        <span>{l10n.getString("phone-onboarding-step4-country-us")}</span>
      </div>

      <form onSubmit={onSubmit} className={styles.form}>
        <input
          className={styles.search}
          placeholder={l10n.getString("phone-onboarding-step4-insput-search")}
          type="search"
        />

        <p className={styles.paragraph}>
          {l10n.getString("phone-onboarding-step4-body")}
        </p>

        <div className={`${styles["step-select-relay-numbers-radio-group"]} `}>
          {suggestedNumberRadioInputs}
        </div>

        <Button
          onClick={moreRelayNumberOptions}
          className={styles.button}
          type="button"
          variant="secondary"
        >
          {l10n.getString("phone-onboarding-step4-button-more-options")}
        </Button>

        {/* TODO: Add error class to input field */}
        <Button className={styles.button} type="submit">
          {l10n.getString("phone-onboarding-step2-button-cta")}
        </Button>
      </form>
    </div>
  );

  return (
    <div className={`${styles.step}`}>
      {/* TODO: Add logic to show this instead of step-select-phone-number-mask when loading */}
      {loadingState}
      {form}
    </div>
  );
};
type RelayNumberConfirmationProps = {
  onComplete: () => void;
};
const RelayNumberConfirmation = (props: RelayNumberConfirmationProps) => {
  const { l10n } = useLocalization();

  return (
    <div
      className={`${styles.step}  ${styles["step-input-verificiation-code"]} `}
    >
      <div className={`${styles.lead}  ${styles["is-success"]} `}>
        <div
          className={`${styles["step-input-verificiation-code-lead-success"]} `}
        >
          {/* Success state */}
          <img src={EnteryVerifyCodeSuccess.src} alt="" width={170} />
          <h2 className={`${styles["is-success"]} `}>
            {l10n.getString("phone-onboarding-step4-code-success-title")}
          </h2>
          <p>{l10n.getString("phone-onboarding-step4-code-success-body")}</p>
        </div>
      </div>
      {/* Add error class of `mzp-is-error` */}

      {/* TODO: Add logic to display success message */}

      <div className={`${styles["step-input-verificiation-code-success"]} `}>
        <h3>
          {l10n.getString("phone-onboarding-step4-code-success-subhead-title")}
        </h3>
        <p>
          {l10n.getString(
            "phone-onboarding-step4-code-success-subhead-body-p1"
          )}
        </p>
        <p>
          {l10n.getString(
            "phone-onboarding-step4-code-success-subhead-body-p2"
          )}
        </p>
        <Button onClick={() => props.onComplete()} className={styles.button}>
          {l10n.getString("phone-onboarding-step4-code-success-cta")}
        </Button>
      </div>
    </div>
  );
};
