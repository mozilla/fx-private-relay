import { ReactElement, ReactNode, useRef } from "react";
import {
  OverlayContainer,
  FocusScope,
  useDialog,
  useModal,
  useOverlay,
  usePreventScroll,
  AriaOverlayProps,
} from "react-aria";
import styles from "./InfoModal.module.scss";
import { useL10n } from "../hooks/l10n";

export type Props = {
  onClose: () => void;
};

/**
 * Modal in which the user can confirm that they really want to permanently claim a given subdomain.
 */
export const InfoModal = (props: Props) => {
  return (
    <OverlayContainer>
      <SuccessModal {...props} />
    </OverlayContainer>
  );
};

const SuccessModal = (props: Props) => {
  const l10n = useL10n();

  return (
    <div className={styles["picked-confirmation"]}>
      <PickerDialog
        title="title"
        headline="headline"
        onClose={() => props.onClose()}
        isDismissable={true}
      >
        <div className={styles["picked-confirmation-body"]}>
          something goes here
        </div>
      </PickerDialog>
    </div>
  );
};

type PickerDialogProps = {
  title: string | ReactElement;
  headline: string;
  children: ReactNode;
  onClose?: () => void;
};
const PickerDialog = (props: PickerDialogProps & AriaOverlayProps) => {
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
          <div className={styles.hero}>
            <span className={styles.headline}>{props.headline}</span>
            <h3 {...titleProps}>{props.title}</h3>
          </div>
          {props.children}
        </div>
      </FocusScope>
    </div>
  );
};
