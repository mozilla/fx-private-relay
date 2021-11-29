import Link from "next/link";
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
import { toast } from "react-toastify";
import styles from "./SubdomainPicker.module.scss";
import illustration from "../../../../static/images/dashboard-onboarding/man-laptop-email.svg";
import checkIcon from "../../../../static/images/icon-green-check.svg";
import { ProfileData } from "../../hooks/api/profile";
import { Button } from "../Button";
import { authenticatedFetch } from "../../hooks/api/api";
import { OverlayProps } from "@react-aria/overlays";

export type Props = {
  profile: ProfileData;
  onCreate: (subdomain: string) => void;
};

export const SubdomainPicker = (props: Props) => {
  const { l10n } = useLocalization();
  const [subdomainInput, setSubdomainInput] = useState("");
  const [confirmCheckbox, setConfirmCheckbox] = useState(false);

  const modalState = useOverlayTriggerState({});
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const cancelButton = useButton(
    { onPress: () => modalState.close() },
    cancelButtonRef
  );

  if (
    !props.profile.has_premium ||
    typeof props.profile.subdomain === "string"
  ) {
    return null;
  }

  const onSubmit: FormEventHandler = async (event) => {
    event.preventDefault();

    const isAvailable = await getAvailability(subdomainInput);
    if (!isAvailable) {
      toast(
        l10n.getString("error-subdomain-not-available", {
          unavailable_subdomain: subdomainInput,
        }),
        { type: "error" }
      );
      return;
    }

    modalState.open();
  };

  const onConfirm: FormEventHandler = (event) => {
    event.preventDefault();

    props.onCreate(subdomainInput);
    modalState.close();
  };

  const dialog = modalState.isOpen ? (
    <OverlayContainer>
      <PickerDialog
        title={
          <Localized
            id="modal-domain-register-available-v2"
            vars={{
              subdomain: subdomainInput,
              domain: process.env.NEXT_PUBLIC_MOZMAIL_DOMAIN!,
            }}
            elems={{
              subdomain: <span className={styles.subdomain} />,
              domain: <span className={styles.domain} />,
            }}
          >
            <span className={styles.modalTitle} />
          </Localized>
        }
        onClose={() => modalState.close()}
        isOpen={modalState.isOpen}
        isDismissable={true}
      >
        <p className={styles.permanenceWarning}>
          {l10n.getString("modal-domain-register-warning-reminder")}
        </p>
        <form onSubmit={onConfirm} className={styles.confirm}>
          <label>
            <input
              type="checkbox"
              name="confirmSubdomain"
              id="confirmSubdomain"
              onChange={(e) => setConfirmCheckbox(e.target.checked)}
              required={true}
            />
            <Localized
              id="modal-domain-register-confirmation-checkbox-v2"
              vars={{
                subdomain: subdomainInput,
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
      </PickerDialog>
    </OverlayContainer>
  ) : null;

  return (
    <div className={styles.card} id="mpp-choose-subdomain">
      <div className={styles.description}>
        <span aria-hidden={true} className={styles.actionStep}>
          {l10n.getString("banner-label-action")}
        </span>
        <h2>{l10n.getString("banner-register-subdomain-headline-aliases")}</h2>
        <samp className={styles.example} aria-hidden={true}>
          ***@
          <span className={styles.subdomainPart}>
            {l10n.getString("banner-register-subdomain-example-address")}
          </span>
          .{process.env.NEXT_PUBLIC_MOZMAIL_DOMAIN}
        </samp>
        <p className={styles.lead}>
          {l10n.getString("banner-register-subdomain-copy", {
            mozmail: process.env.NEXT_PUBLIC_MOZMAIL_DOMAIN!,
          })}
        </p>
        <Link href="/faq">
          <a>{l10n.getString("banner-label-data-notification-body-cta")}</a>
        </Link>
      </div>
      <div className={styles.search}>
        <form onSubmit={onSubmit}>
          <input
            type="search"
            checked={confirmCheckbox}
            value={subdomainInput}
            onChange={(e) => setSubdomainInput(e.target.value)}
            placeholder={l10n.getString(
              "banner-choose-subdomain-input-placeholder"
            )}
            name="subdomain"
            id="subdomain"
            minLength={1}
            maxLength={63}
          />
          <Button type="submit">
            {l10n.getString("banner-register-subdomain-button-search")}
          </Button>
        </form>
        <img
          src={illustration.src}
          width={200}
          className={styles.illustration}
          alt=""
        />
      </div>
      {dialog}
    </div>
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
  const { l10n } = useLocalization();

  return (
    <div className={styles.underlay} {...underlayProps}>
      <FocusScope contain restoreFocus autoFocus>
        <div
          className={styles.dialogWrapper}
          {...overlayProps}
          {...dialogProps}
          {...modalProps}
          ref={wrapperRef}
        >
          <div className={styles.hero}>
            <span className={styles.headline}>
              <img src={checkIcon.src} alt="" />
              {l10n.getString("modal-domain-register-good-news")}
            </span>
            <h3 {...titleProps}>{props.title}</h3>
          </div>
          {props.children}
        </div>
      </FocusScope>
    </div>
  );
};

async function getAvailability(subdomain: string) {
  const checkResponse = await authenticatedFetch(
    `/accounts/profile/subdomain?subdomain=${subdomain}`
  );
  if (!checkResponse.ok) {
    return false;
  }
  const checkData: { available: true } = await checkResponse.json();
  return checkData.available;
}
