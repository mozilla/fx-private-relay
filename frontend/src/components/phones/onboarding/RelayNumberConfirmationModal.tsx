import { ReactNode, useRef } from "react";
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
import { CloseIcon } from "../../Icons";
import { Button } from "../../Button";
import { formatPhone } from "../../../functions/formatPhone";

export type Props = {
  onClose: () => void;
  confirm: () => void;
  isOpen: boolean;
  relayNumber: string;
};

export const RelayNumberConfirmationModal = (props: Props) => {
  const { l10n } = useLocalization();

  return (
    <OverlayContainer>
      <ConfirmationDialog
        onClose={() => props.onClose()}
        isOpen={props.isOpen}
        isDismissable={true}
      >
        <button
          className={styles["cancel-button"]}
          onClick={() => props.onClose()}
        >
          <CloseIcon alt="Close" />
        </button>
        <div className={styles["dialog-content"]}>
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
        </div>
      </ConfirmationDialog>
    </OverlayContainer>
  );
};

type ConfirmationDialogProps = {
  children: ReactNode;
  isOpen: boolean;
  onClose?: () => void;
};
const ConfirmationDialog = (props: ConfirmationDialogProps & OverlayProps) => {
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
