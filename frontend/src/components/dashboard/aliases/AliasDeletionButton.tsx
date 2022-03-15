import { Localized, useLocalization } from "@fluent/react";
import {
  OverlayContainer,
  FocusScope,
  useButton,
  useDialog,
  useModal,
  useOverlay,
  usePreventScroll,
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
import { ProfileData } from "../../../hooks/api/profile";
import { Button } from "../../Button";
import { OverlayProps } from "@react-aria/overlays";
import {
  AliasData,
  getFullAddress,
  isRandomAlias,
} from "../../../hooks/api/aliases";

export type Props = {
  alias: AliasData;
  profile: ProfileData;
  onDelete: () => void;
};

/**
 * A button to delete a given alias, which will pop up a confirmation modal before deleting.
 */
export const AliasDeletionButton = (props: Props) => {
  const { l10n } = useLocalization();
  const [confirmCheckbox, setConfirmCheckbox] = useState(false);

  const openModalButtonRef = useRef<HTMLButtonElement>(null);
  const openModalButtonProps = useButton(
    {
      onPress: () => modalState.open(),
    },
    openModalButtonRef
  ).buttonProps;

  const modalState = useOverlayTriggerState({});
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const cancelButton = useButton(
    { onPress: () => modalState.close() },
    cancelButtonRef
  );

  const onConfirm: FormEventHandler = (event) => {
    event.preventDefault();

    props.onDelete();
    modalState.close();
  };

  const dialog = modalState.isOpen ? (
    <OverlayContainer>
      <ConfirmationDialog
        title={l10n.getString("modal-delete-headline")}
        onClose={() => modalState.close()}
        isOpen={modalState.isOpen}
        isDismissable={true}
      >
        <samp className={styles["alias-to-delete"]}>
          {getFullAddress(props.alias, props.profile)}
        </samp>
        <Localized
          id="modal-delete-warning-recovery-html"
          vars={{ email: getFullAddress(props.alias, props.profile) }}
          elems={{
            strong: <strong />,
          }}
        >
          <p className={styles["permanence-warning"]} />
        </Localized>
        <p className={styles["usage-warning"]}>
          {l10n.getString(
            isRandomAlias(props.alias)
              ? "modal-delete-warning-upgrade"
              : "modal-delete-domain-address-warning-upgrade"
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
            {l10n.getString("modal-delete-confirmation")}
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
const ConfirmationDialog = (props: ConfirmationDialogProps & OverlayProps) => {
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
