import styles from "./ConfirmationForm.module.scss";
import { Button } from "../../Button";
import { FormEventHandler, useRef, useState } from "react";
import { useButton } from "react-aria";
import { useL10n } from "../../../hooks/l10n";
import { Localized } from "../../Localized";

export type Props = {
  subdomain: string;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Form to ask the user whether they're sure about their chosen domain, because it's permanent.
 *
 * Primarily used in {@link ConfirmationModal}.
 */
export const SubdomainConfirmationForm = (props: Props) => {
  const l10n = useL10n();
  const [confirmCheckbox, setConfirmCheckbox] = useState(false);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const cancelButton = useButton(
    { onPress: () => props.onCancel() },
    cancelButtonRef
  );

  const onSubmit: FormEventHandler = (event) => {
    event.preventDefault();

    props.onConfirm();
  };

  return (
    <>
      <p className={styles["permanence-warning"]}>
        {l10n.getString("modal-domain-register-warning-reminder-2")}
      </p>
      <form onSubmit={onSubmit} className={styles.confirm}>
        <label>
          <input
            type="checkbox"
            name="confirmSubdomain"
            id="confirmSubdomain"
            checked={confirmCheckbox}
            onChange={(e) => setConfirmCheckbox(e.target.checked)}
            required={true}
          />
          <Localized
            id="modal-domain-register-confirmation-checkbox-2"
            vars={{
              subdomain: props.subdomain,
            }}
            elems={{
              subdomain: <span className={styles.subdomain} />,
            }}
          >
            <span />
          </Localized>
        </label>
        <div className={styles.buttons}>
          <button
            {...cancelButton.buttonProps}
            ref={cancelButtonRef}
            className={styles["cancel-button"]}
          >
            {l10n.getString("profile-label-cancel")}
          </button>
          <Button type="submit" disabled={!confirmCheckbox}>
            {l10n.getString("modal-domain-register-button-2")}
          </Button>
        </div>
      </form>
    </>
  );
};
