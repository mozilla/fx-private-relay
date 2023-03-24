import { ReactElement, useRef } from "react";
import {
  OverlayContainer,
  FocusScope,
  useDialog,
  useModal,
  useOverlay,
  usePreventScroll,
  AriaOverlayProps,
  useButton,
} from "react-aria";
import styles from "./InfoModal.module.scss";
import { CloseIcon } from "./Icons";

export type Props = {
  onClose: () => void;
  isOpen: boolean;
  modalTitle: string | ReactElement;
  modalBodyText: string | ReactElement;
};

/**
 * Informational modal
 */

export const InfoModal = (props: Props) => {
  return (
    <OverlayContainer>
      <PickerDialog
        isOpen={props.isOpen}
        headline={props.modalTitle}
        body={props.modalBodyText}
        onClose={() => props.onClose()}
        isDismissable={true}
        exitBtn={true}
      ></PickerDialog>
    </OverlayContainer>
  );
};

type PickerDialogProps = {
  headline: string | ReactElement;
  body: string | ReactElement;
  isOpen: boolean;
  onClose: () => void;
  exitBtn: boolean;
};
const PickerDialog = (props: PickerDialogProps & AriaOverlayProps) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { overlayProps, underlayProps } = useOverlay(props, wrapperRef);
  usePreventScroll();
  const { modalProps } = useModal();
  const { dialogProps } = useDialog({}, wrapperRef);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const cancelButton = useButton(
    { onPress: () => props.onClose() },
    cancelButtonRef
  );

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
          {props.exitBtn ? (
            <button
              {...cancelButton.buttonProps}
              ref={cancelButtonRef}
              className={styles["dismiss-button"]}
            >
              <CloseIcon alt="" />
            </button>
          ) : null}
          <div className={styles["dialog-container"]}>
            <div className={styles.hero}>
              <h3 className={styles.headline}>{props.headline}</h3>
            </div>
            <div className={styles["modal-body"]}>{props.body}</div>
          </div>
        </div>
      </FocusScope>
    </div>
  );
};
