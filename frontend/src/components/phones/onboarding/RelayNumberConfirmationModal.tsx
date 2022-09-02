import {
  ChangeEventHandler,
  FocusEventHandler,
  FormEventHandler,
  ReactElement,
  ReactNode,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { ReactLocalization, useLocalization } from "@fluent/react";
import {
  OverlayContainer,
  FocusScope,
  useDialog,
  useModal,
  useOverlay,
  usePreventScroll,
  useButton,
} from "react-aria";
import { OverlayProps } from "@react-aria/overlays";
import styles from "./RelayNumberConfirmationModal.module.scss";
import { CloseIcon, InfoIcon } from "../../Icons";
import { Button } from "../../Button";

export type Props = {
  isOpen: boolean;
  onClose: () => void;
  relayNumber: string;
  onPick?: (address: string, settings: { blockPromotionals: boolean }) => void;
  subdomain?: string;
};

/**
 * Modal in which the user can create a new custom alias,
 * while also being educated on why they don't need to do that.
 */
export const RelayNumberConfirmationModal = (props: Props) => {
  const { l10n } = useLocalization();
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const cancelButton = useButton(
    { onPress: () => props.onClose() },
    cancelButtonRef
  );

  const onSubmit: FormEventHandler = (event) => {
    event.preventDefault();
  };

  return (
    <OverlayContainer>
      <PickerDialog
        title={`test`}
        onClose={() => props.onClose()}
        isOpen={props.isOpen}
        isDismissable={true}
      >
        <button className={styles["cancel-button"]}>
          <CloseIcon alt="Close" />
        </button>
        <form onSubmit={onSubmit}>
          <p>
            {l10n.getString("phone-onboarding-step4-body-confirm-relay-number")}
          </p>

          <Button
            {...cancelButton.buttonProps}
            ref={cancelButtonRef}
            className={styles["confirm-button"]}
            onClick={() => props.onClose()}
          >
            {l10n.getString(
              "phone-onboarding-step4-button-confirm-relay-number"
            )}
            <span>{props.relayNumber}</span>
          </Button>
        </form>
      </PickerDialog>
    </OverlayContainer>
  );
};

type PickerDialogProps = {
  title: string | ReactElement;
  children: ReactNode;
  isOpen: boolean;
  onClose?: () => void;
};
const PickerDialog = (props: PickerDialogProps & OverlayProps) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { overlayProps, underlayProps } = useOverlay(props, wrapperRef);
  usePreventScroll();
  const { modalProps } = useModal();
  const { dialogProps, titleProps } = useDialog({}, wrapperRef);

  return (
    <div className={styles.underlay} {...underlayProps}>
      <FocusScope contain restoreFocus autoFocus>
        <div
          className={styles["dialog-wrapper"]}
          {...overlayProps}
          {...dialogProps}
          {...modalProps}
          ref={wrapperRef}
        >
          {props.children}
        </div>
      </FocusScope>
    </div>
  );
};

export function getAddressValidationMessage(
  address: string,
  l10n: ReactLocalization
): null | string {
  if (address.length === 0) {
    return null;
  }
  if (address.includes(" ")) {
    return l10n.getString(
      "modal-custom-alias-picker-form-prefix-spaces-warning"
    );
  }
  // Regular expression:
  //
  //   ^[a-z0-9]  Starts with a lowercase letter or number;
  //
  //   (...)?     followed by zero or one of:
  //
  //              [a-z0-9-.]{0,61} zero up to 61 lowercase letters, numbers, hyphens, or periods, and
  //              [a-z0-9]         a lowercase letter or number (but not a hyphen),
  //
  //   $          and nothing following that.
  //
  // All that combines to 1-63 lowercase characters, numbers, or hyphens,
  // but not starting or ending with a hyphen, aligned with the backend's
  // validation (`valid_address_pattern` in emails/models.py).
  if (!/^[a-z0-9]([a-z0-9-.]{0,61}[a-z0-9])?$/.test(address)) {
    return l10n.getString(
      "modal-custom-alias-picker-form-prefix-invalid-warning-2"
    );
  }
  return null;
}
