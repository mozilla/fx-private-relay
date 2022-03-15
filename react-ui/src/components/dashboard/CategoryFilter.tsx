import {
  FormEventHandler,
  HTMLAttributes,
  forwardRef,
  RefObject,
  useRef,
  useState,
  FocusEventHandler,
} from "react";
import {
  FocusScope,
  OverlayContainer,
  mergeProps,
  useOverlay,
  useOverlayTrigger,
  useOverlayPosition,
  useButton,
  useFocusWithin,
} from "react-aria";
import { useLocalization } from "@fluent/react";
import styles from "./CategoryFilter.module.scss";
import filterIcon from "../../../../static/images/icon-filter-blue.svg";
import { Filters } from "../../functions/filterAliases";
import { useOverlayTriggerState } from "@react-stately/overlays";
import { Button } from "../Button";

export type SelectedFilters = {
  domainType?: Filters["domainType"];
  status?: Filters["status"];
};

export type Props = {
  selectedFilters: SelectedFilters;
  onChange: (selected: SelectedFilters) => void;
};

export const CategoryFilter = (props: Props) => {
  const { l10n } = useLocalization();
  const menuState = useOverlayTriggerState({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const { triggerProps, overlayProps } = useOverlayTrigger(
    { type: "listbox" },
    menuState,
    triggerRef
  );

  const positionProps = useOverlayPosition({
    targetRef: triggerRef,
    overlayRef: overlayRef,
    placement: "bottom",
    offset: 16,
    isOpen: menuState.isOpen,
  }).overlayProps;

  const { buttonProps } = useButton(
    { onPress: () => menuState.open() },
    triggerRef
  );

  const onClose = (selectedFilters: SelectedFilters) => {
    menuState.close();
    props.onChange(selectedFilters);
  };

  const menu = menuState.isOpen ? (
    <OverlayContainer>
      <FilterMenu
        {...overlayProps}
        {...positionProps}
        ref={overlayRef}
        isOpen={menuState.isOpen}
        selectedFilters={props.selectedFilters}
        onClose={onClose}
      />
    </OverlayContainer>
  ) : null;

  return (
    <>
      <button
        {...buttonProps}
        {...triggerProps}
        ref={triggerRef}
        title={l10n.getString("profile-filter-category-button-tooltip")}
        className={styles.filterButton}
      >
        <img
          src={filterIcon.src}
          alt={l10n.getString("profile-filter-category-button-label")}
          width={20}
          height={20}
        />
      </button>
      {menu}
    </>
  );
};

type FilterMenuProps = HTMLAttributes<HTMLDivElement> & {
  selectedFilters: SelectedFilters;
  onClose: (selectedFilters: SelectedFilters) => void;
  isOpen: boolean;
};
const FilterMenu = forwardRef<HTMLDivElement, FilterMenuProps>(
  ({ selectedFilters, onClose, isOpen, ...otherProps }, overlayRef) => {
    const { l10n } = useLocalization();
    const [domainType, setDomainType] = useState<Filters["domainType"]>(
      selectedFilters.domainType
    );
    const [status, setStatus] = useState<Filters["status"]>(
      selectedFilters.status
    );
    const saveAndClose = () => {
      onClose({ domainType, status });
    };
    const { overlayProps } = useOverlay(
      {
        onClose: saveAndClose,
        isOpen: isOpen,
        isDismissable: true,
      },
      overlayRef as RefObject<HTMLDivElement>
    );

    const onSubmit: FormEventHandler = (event) => {
      event.preventDefault();

      saveAndClose();
    };
    const onReset: FormEventHandler = () => {
      onClose({ domainType: undefined, status: undefined });
    };

    return (
      <FocusScope contain restoreFocus autoFocus>
        <div
          {...mergeProps(overlayProps, otherProps)}
          ref={overlayRef}
          className={styles.filterMenu}
        >
          <form
            onSubmit={onSubmit}
            onReset={onReset}
            className={styles.filterForm}
          >
            <label>
              <input
                type="checkbox"
                checked={domainType === "custom"}
                onChange={(e) =>
                  setDomainType(e.target.checked ? "custom" : undefined)
                }
                name="customAliases"
                id="customAliases"
              />
              {l10n.getString(
                "profile-filter-category-option-domain-based-aliases-v2"
              )}
            </label>
            <label>
              <input
                type="checkbox"
                checked={domainType === "random"}
                onChange={(e) =>
                  setDomainType(e.target.checked ? "random" : undefined)
                }
                name="randomAliases"
                id="randomAliases"
              />
              {l10n.getString(
                "profile-filter-category-option-relay-aliases-v2"
              )}
            </label>
            <label>
              <input
                type="checkbox"
                checked={status === "forwarding"}
                onChange={(e) =>
                  setStatus(e.target.checked ? "forwarding" : undefined)
                }
                name="forwardingAliases"
                id="forwardingAliases"
              />
              {l10n.getString(
                "profile-filter-category-option-active-aliases-v2"
              )}
            </label>
            <label>
              <input
                type="checkbox"
                checked={status === "blocking"}
                onChange={(e) =>
                  setStatus(e.target.checked ? "blocking" : undefined)
                }
                name="blockingAliases"
                id="blockingAliases"
              />
              {l10n.getString(
                "profile-filter-category-option-disabled-aliases-v2"
              )}
            </label>
            <div className={styles.buttons}>
              <button type="reset">
                {l10n.getString("profile-label-reset")}
              </button>
              <Button type="submit">
                {l10n.getString("profile-label-apply")}
              </Button>
            </div>
          </form>
        </div>
      </FocusScope>
    );
  }
);
