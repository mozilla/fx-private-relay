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
import { formatPhone } from "../../../functions/formatPhone";

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
type RelayNumberOption = {
  friendly_name: string;
  iso_country: string;
  locality: string;
  phone_number: string;
  postal_code: string;
  region: string;
};

const RelayNumberSelection = (props: RelayNumberSelectionProps) => {
  const { l10n } = useLocalization();

  // TODO: Defaulting to true to stop FoUC however we need to catch any error in await getRelayNumberSuggestions();
  const [isLoading, setIsLoading] = useState(true);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [relayNumberSuggestions, setRelayNumberSuggestions] = useState<
    string[]
  >([]);
  const [relayNumberIndex, setRelayNumberIndex] = useState(0);

  useEffect(() => {
    _getRelayNumberSuggestions();
  }, []);

  // GET request to get relay number suggestions
  const _getRelayNumberSuggestions = () => {
    setIsLoading(true);
    getRelayNumberSuggestions()
      .then((response) => response.json())
      .then((data) => {
        const { other_areas_options, same_area_options, same_prefix_options } =
          data;
        const suggestedNumbers: RelayNumberOption[] = [
          ...same_area_options,
          ...same_prefix_options,
          ...other_areas_options,
        ];

        setRelayNumberSuggestions(
          suggestedNumbers.map(
            (suggestion: RelayNumberOption) => suggestion.phone_number
          )
        );

        setIsLoading(false);
      })
      .catch((error) => {
        // Do nothing, just keep the default values
      });
  };

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

  const getRelayNumberOptions: MouseEventHandler<HTMLButtonElement> = () => {
    const newRelayNumberIndex = relayNumberIndex + 3;

    if (newRelayNumberIndex >= relayNumberSuggestions.length) {
      _getRelayNumberSuggestions();
      setRelayNumberIndex(0);
    } else {
      setRelayNumberIndex(newRelayNumberIndex);
    }
  };

  const suggestedNumberRadioInputs = relayNumberSuggestions
    .slice(relayNumberIndex, relayNumberIndex + 3)
    .map((suggestion, i) => {
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
          onClick={getRelayNumberOptions}
          className={styles.button}
          type="button"
          variant="secondary"
        >
          {l10n.getString("phone-onboarding-step4-button-more-options")}
        </Button>

        {/* TODO: Add error class to input field */}
        <Button className={styles.button} type="submit">
          {l10n.getString(
            "phone-onboarding-step4-button-register-phone-number"
          )}
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
