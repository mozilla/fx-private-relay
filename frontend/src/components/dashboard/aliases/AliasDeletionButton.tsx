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
import {
  FormEventHandler,
  ReactElement,
  ReactNode,
  useRef,
  useState,
} from "react";
import styles from "./AliasDeletionButton.module.scss";
import { Button } from "../../Button";
import {
  AliasData,
  getFullAddress,
  isRandomAlias,
} from "../../../hooks/api/aliases";
import { useL10n } from "../../../hooks/l10n";
import { Localized } from "../../Localized";

export type Props = {
  alias: AliasData;
  onDelete: () => void;
};

/**
 * A button to delete a given alias, which will pop up a confirmation modal before deleting.
 */
export const AliasDeletionButton = (props: Props) => {
  const l10n = useL10n();
  const [confirmCheckbox, setConfirmCheckbox] = useState(false);

  const openModalButtonRef = useRef<HTMLButtonElement>(null);
  const openModalButtonProps = useButton(
    {
      onPress: () => modalState.open(),
    },
    openModalButtonRef,
  ).buttonProps;

  const modalState = useOverlayTriggerState({
    onOpenChange: () => setConfirmCheckbox(false),
  });
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const cancelButton = useButton(
    { onPress: () => modalState.close() },
    cancelButtonRef,
  );

  const onConfirm: FormEventHandler = (event) => {
    event.preventDefault();

    props.onDelete();
    modalState.close();
  };

  const dialog = modalState.isOpen ? (
    <OverlayContainer>
      <ConfirmationDialog
        title={l10n.getString("modal-delete-headline-2")}
        onClose={() => modalState.close()}
        isOpen={modalState.isOpen}
        isDismissable={true}
      >
        <samp className={styles["alias-to-delete"]}>
          {getFullAddress(props.alias)}
        </samp>
        <Localized
          id="modal-delete-warning-recovery-2-html"
          vars={{ email: getFullAddress(props.alias) }}
          elems={{
            strong: <strong />,
          }}
        >
          <p className={styles["permanence-warning"]} />
        </Localized>
        <p className={styles["usage-warning"]}>
          {l10n.getString(
            isRandomAlias(props.alias)
              ? "modal-delete-warning-upgrade-2"
              : "modal-delete-domain-address-warning-upgrade-2",
          )}
        </p>
        <form onSubmit={onConfirm} className={styles.confirm}>
          <label>
            <input
              type="checkbox"
              name="confirmDeletion"
              id="confirmDeletion"
              onChange={(e) => setConfirmCheckbox(e.target.checked)}
              required={true}
            />
            {l10n.getString("modal-delete-confirmation-2")}
          </label>
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
              disabled={!confirmCheckbox}
            >
              {l10n.getString("profile-label-delete")}
            </Button>
          </div>
        </form>
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
