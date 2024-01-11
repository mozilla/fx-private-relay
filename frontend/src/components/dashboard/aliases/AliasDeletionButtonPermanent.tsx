import {
  OverlayContainer,
  FocusScope,
  useButton,
  useDialog,
  useModal,
  useOverlay,
  usePreventScroll,
  AriaOverlayProps,
} from "react-aria";
import { useOverlayTriggerState } from "react-stately";
import { ReactElement, ReactNode, useRef } from "react";
import styles from "./AliasDeletionButtonPermanent.module.scss";
import { Button } from "../../Button";
import { AliasData, getFullAddress } from "../../../hooks/api/aliases";
import { useL10n } from "../../../hooks/l10n";
import { ErrorTriangleIcon } from "../../Icons";

export type Props = {
  alias: AliasData;
  onDelete: () => void;
};

/**
 * A button to delete a given alias, which will pop up a confirmation modal before deleting.
 */
export const AliasDeletionButtonPermanent = (props: Props) => {
  const l10n = useL10n();

  const openModalButtonRef = useRef<HTMLButtonElement>(null);
  const openModalButtonProps = useButton(
    {
      onPress: () => modalState.open(),
    },
    openModalButtonRef,
  ).buttonProps;

  const modalState = useOverlayTriggerState({});
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const cancelButton = useButton(
    { onPress: () => modalState.close() },
    cancelButtonRef,
  );

  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const confirmButton = useButton(
    {
      onPress: () => {
        props.onDelete();
        modalState.close();
      },
    },
    confirmButtonRef,
  );

  const dialog = modalState.isOpen ? (
    <OverlayContainer>
      <ConfirmationDialog
        title={l10n.getString("mask-deletion-header")}
        onClose={() => modalState.close()}
        isOpen={modalState.isOpen}
        isDismissable={true}
      >
        <samp className={styles["alias-to-delete"]}>
          {getFullAddress(props.alias)}
        </samp>

        <p className={styles["permanence-warning"]}>
          {l10n.getString("mask-deletion-warning-no-recovery")}
        </p>
        <WarningBanner />
        <hr />
        <div className={styles.confirm}>
          <div className={styles.buttons}>
            <button
              {...cancelButton.buttonProps}
              ref={cancelButtonRef}
              className={styles["cancel-button"]}
            >
              {l10n.getString("profile-label-cancel")}
            </button>
            <Button
              type="submit"
              variant="destructive"
              className={styles["delete-btn"]}
              {...confirmButton.buttonProps}
            >
              {l10n.getString("profile-label-delete")}
            </Button>
          </div>
        </div>
      </ConfirmationDialog>
    </OverlayContainer>
  ) : null;

  return (
    <>
      <button
        {...openModalButtonProps}
        className={styles["deletion-button"]}
        ref={openModalButtonRef}
      >
        {l10n.getString("profile-label-delete")}
      </button>
      {dialog}
    </>
  );
};

const WarningBanner = () => {
  const l10n = useL10n();

  return (
    <div className={styles["warning-wrapper"]}>
      <div className={styles["left-content"]}>
        <ErrorTriangleIcon alt="" className={styles["prefix-error-icon"]} />
        <p>{l10n.getString("mask-deletion-warning-sign-ins")}</p>
      </div>
    </div>
  );
};

type ConfirmationDialogProps = {
  title: string | ReactElement;
  children: ReactNode;
  isOpen: boolean;
  onClose?: () => void;
};
const ConfirmationDialog = (
  props: ConfirmationDialogProps & AriaOverlayProps,
) => {
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
            <h3 {...titleProps}>{props.title}</h3>
          </div>
          {props.children}
        </div>
      </FocusScope>
    </div>
  );
};
