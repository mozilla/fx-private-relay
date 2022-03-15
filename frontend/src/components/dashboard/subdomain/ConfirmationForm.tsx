import { useLocalization, Localized } from "@fluent/react";
import styles from "./ConfirmationForm.module.scss";
import { Button } from "../../Button";
import { FormEventHandler, useRef, useState } from "react";
import { useButton } from "react-aria";

export type Props = {
  subdomain: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export const SubdomainConfirmationForm = (props: Props) => {
  const { l10n } = useLocalization();
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
      <p className={styles.permanenceWarning}>
        {l10n.getString("modal-domain-register-warning-reminder")}
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
            id="modal-domain-register-confirmation-checkbox-v2"
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
            className={styles.cancelButton}
          >
            {l10n.getString("profile-label-cancel")}
          </button>
          <Button type="submit" disabled={!confirmCheckbox}>
            {l10n.getString("modal-domain-register-button")}
          </Button>
        </div>
      </form>
    </>
  );
};
