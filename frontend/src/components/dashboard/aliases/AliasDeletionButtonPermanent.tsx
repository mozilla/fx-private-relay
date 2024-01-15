import {
  OverlayContainer,
  useButton,
  useDialog,
  AriaOverlayProps,
  useModalOverlay,
  useOverlayTrigger,
  AriaModalOverlayProps,
  Overlay,
  AriaButtonOptions,
} from "react-aria";
import {
  OverlayTriggerProps,
  OverlayTriggerState,
  useOverlayTriggerState,
} from "react-stately";
import { ReactElement, ReactNode, cloneElement, useRef } from "react";
import styles from "./AliasDeletionButtonPermanent.module.scss";
import { Button } from "../../Button";
import { AliasData, getFullAddress } from "../../../hooks/api/aliases";
import { useL10n } from "../../../hooks/l10n";
import { ErrorTriangleIcon } from "../../Icons";

export type Props = {
  alias: AliasData;
  onDelete: () => void;
};

const CancelButton = (
  props: AriaButtonOptions<"button"> & { children: ReactNode },
) => {
  const ref = useRef(null);
  const { buttonProps } = useButton(props, ref);

  return (
    <button {...buttonProps} ref={ref} className={styles["cancel-button"]}>
      {props.children}
    </button>
  );
};

/**
 * A button to delete a given alias, which will pop up a confirmation modal before deleting.
 */
export const AliasDeletionButtonPermanent = (props: Props) => {
  const l10n = useL10n();

  const modalState = useOverlayTriggerState({});

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

  return (
    <ConfirmationModalTrigger>
      {(closeModal: OverlayTriggerState["close"]) => {
        return (
          <ConfirmationDialog
            title={l10n.getString("mask-deletion-header")}
            onClose={() => modalState.close()}
            isOpen={modalState.isOpen}
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
                <CancelButton type="button" onPress={() => closeModal()}>
                  {l10n.getString("profile-label-cancel")}
                </CancelButton>
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
        );
      }}
    </ConfirmationModalTrigger>
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

const ConfirmationModalTrigger = (
  props: OverlayTriggerProps & {
    children: (closeCallback: OverlayTriggerState["close"]) => ReactElement;
  },
) => {
  const l10n = useL10n();
  const state = useOverlayTriggerState(props);
  const { triggerProps, overlayProps } = useOverlayTrigger(
    { type: "dialog" },
    state,
  );
  const triggerRef = useRef(null);
  const triggerButton = useButton(triggerProps, triggerRef);

  return (
    <>
      <button
        {...triggerButton.buttonProps}
        ref={triggerRef}
        className={styles["deletion-button"]}
      >
        {l10n.getString("profile-label-delete")}
      </button>
      {state.isOpen && (
        <ConfirmationModal state={state} isDismissable={true}>
          {cloneElement(props.children(state.close), overlayProps)}
        </ConfirmationModal>
      )}
    </>
  );
};

const ConfirmationModal = ({
  state,
  children,
  ...props
}: AriaModalOverlayProps & {
  state: OverlayTriggerState;
  children: ReactNode;
}) => {
  const ref = useRef(null);
  const { modalProps, underlayProps } = useModalOverlay(props, state, ref);

  return (
    <Overlay>
      <div className={styles.underlay} {...underlayProps}>
        <div {...modalProps} className={styles["dialog-wrapper"]} ref={ref}>
          {children}
        </div>
      </div>
    </Overlay>
  );
};

type ConfirmationDialogProps = {
  title: string | ReactElement;
  children: ReactNode;
  isOpen: boolean;
  onClose?: () => void;
};
const ConfirmationDialog = (props: ConfirmationDialogProps) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { dialogProps, titleProps } = useDialog({}, wrapperRef);

  return (
    <div {...dialogProps} ref={wrapperRef}>
      <div className={styles.hero}>
        <h3 {...titleProps}>{props.title}</h3>
      </div>
      {props.children}
    </div>
  );
};
