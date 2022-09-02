import { FormEventHandler, ReactElement, ReactNode, useRef } from "react";
import { useLocalization } from "@fluent/react";
import {
  OverlayContainer,
  FocusScope,
  useDialog,
  useModal,
  useOverlay,
  usePreventScroll,
} from "react-aria";
import { OverlayProps } from "@react-aria/overlays";
import styles from "./RelayNumberConfirmationModal.module.scss";
import { CloseIcon, InfoIcon } from "../../Icons";
import { Button } from "../../Button";
import { formatPhone } from "../../../functions/formatPhone";

export type Props = {
  onClose: () => void;
  confirm: () => void;
  relayNumber: string;
};

export const RelayNumberConfirmationModal = (props: Props) => {
  const { l10n } = useLocalization();

  const onSubmit: FormEventHandler = (event) => {
    event.preventDefault();
  };

  return (
    <OverlayContainer>
      <PickerDialog
        title={`test`}
        onClose={() => props.onClose()}
        isDismissable={true}
      >
        <button
          className={styles["cancel-button"]}
          onClick={() => props.onClose()}
        >
          <CloseIcon alt="Close" />
        </button>
        <form onSubmit={onSubmit}>
          <p>
            {l10n.getString("phone-onboarding-step4-body-confirm-relay-number")}
            <p>{formatPhone(props.relayNumber)}</p>
          </p>

          <Button
            className={styles["confirm-button"]}
            onClick={() => props.confirm()}
            disabled={props.relayNumber.length === 0}
          >
            {l10n.getString(
              "phone-onboarding-step4-button-confirm-relay-number"
            )}
          </Button>
        </form>
      </PickerDialog>
    </OverlayContainer>
  );
};

type PickerDialogProps = {
  title: string | ReactElement;
  children: ReactNode;
  onClose?: () => void;
};
const PickerDialog = (props: PickerDialogProps & OverlayProps) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { overlayProps, underlayProps } = useOverlay(props, wrapperRef);
  usePreventScroll();
  const { modalProps } = useModal();
  const { dialogProps } = useDialog({}, wrapperRef);

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
