import { useLocalization } from "@fluent/react";
import {
  FocusEventHandler,
  FormEventHandler,
  useEffect,
  useRef,
  useState,
} from "react";
import styles from "./LabelEditor.module.scss";

export type Props = {
  label: string;
  onSubmit: (newLabel: string) => void;
};

/**
 * Input field that allows the user to update the label of an alias.
 */
export const LabelEditor = (props: Props) => {
  const { l10n } = useLocalization();
  const [inputValue, setInputValue] = useState(props.label);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // `justSetLabel` gets updated whenever props.label changes.
  //   `justSaved` is true if that is the case, and this isn't the first render.
  const [labelJustUpdated, setLabelJustUpdated] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  const justSaved = labelJustUpdated && hasSaved;

  useEffect(() => {
    setLabelJustUpdated(true);
    const updateTimeout = setTimeout(() => setLabelJustUpdated(false), 1000);
    return () => clearTimeout(updateTimeout);
  }, [props.label]);

  const onSubmit: FormEventHandler = (event) => {
    event.preventDefault();

    const isValid = formRef.current?.reportValidity();
    if (isValid && inputValue.trim() !== props.label) {
      setHasSaved(true);
      props.onSubmit(inputValue.trim());
      inputRef.current?.blur();
    }
  };
  const onBlur: FocusEventHandler<HTMLInputElement> = (_event) => {
    formRef.current?.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true })
    );
  };

  return (
    <form onSubmit={onSubmit} ref={formRef} className={styles["label-form"]}>
      <input
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onBlur={onBlur}
        aria-label={l10n.getString("profile-label-edit-2")}
        ref={inputRef}
        className={styles["label-input"]}
        placeholder={l10n.getString("profile-label-placeholder")}
        type="text"
        maxLength={50}
        // Require at least one non-whitespace character:
        pattern=".*\S.*"
      />
      <span
        className={`${styles["confirmation-message"]} ${
          justSaved ? styles["is-shown"] : styles["is-hidden"]
        }`}
        aria-hidden={!justSaved}
      >
        {l10n.getString("profile-label-saved")}
      </span>
    </form>
  );
};
