import {
  FormEventHandler,
  HTMLAttributes,
  forwardRef,
  RefObject,
  useRef,
  useState,
} from "react";
import {
  FocusScope,
  OverlayContainer,
  mergeProps,
  useOverlay,
  useOverlayTrigger,
  useOverlayPosition,
  useButton,
} from "react-aria";
import styles from "./CategoryFilter.module.scss";
import { Filters } from "../../../functions/filterAliases";
import { useOverlayTriggerState } from "react-stately";
import { Button } from "../../Button";
import { FilterIcon } from "../../Icons";
import { useL10n } from "../../../hooks/l10n";

export type SelectedFilters = {
  domainType?: Filters["domainType"];
  status?: Filters["status"];
};

export type Props = {
  selectedFilters: SelectedFilters;
  onChange: (selected: SelectedFilters) => void;
};

type OnCloseParams = {
  selectedFilters: SelectedFilters;
  saveFilters?: boolean;
};

/**
 * Menu to select alias filters to apply, based on properties like being random or custom, or enabled or disabled.
 */
export const CategoryFilter = (props: Props) => {
  const l10n = useL10n();
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

  const { buttonProps } = useButton(triggerProps, triggerRef);

  const onClose = (onCloseParams: OnCloseParams) => {
    const { selectedFilters, saveFilters = true } = onCloseParams;
    if (saveFilters) {
      props.onChange(selectedFilters);
    }

    menuState.close();
  };

  return (
    <>
      <button
        {...buttonProps}
        ref={triggerRef}
        title={l10n.getString("profile-filter-category-button-tooltip")}
        className={styles["filter-button"]}
      >
        <FilterIcon
          alt={l10n.getString("profile-filter-category-button-label")}
          width={20}
          height={20}
        />
      </button>
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
    </>
  );
};

type FilterMenuProps = HTMLAttributes<HTMLDivElement> & {
  selectedFilters: SelectedFilters;
  onClose: (onCloseParams: OnCloseParams) => void;
  isOpen: boolean;
};
const FilterMenu = forwardRef<HTMLDivElement, FilterMenuProps>(
  function FilterMenuWithForwardedRef(
    { selectedFilters, onClose, isOpen, ...otherProps },
    overlayRef
  ) {
    const l10n = useL10n();
    const [domainType, setDomainType] = useState<Filters["domainType"]>(
      selectedFilters.domainType
    );
    const [status, setStatus] = useState<Filters["status"]>(
      selectedFilters.status
    );
    const saveAndClose = () => {
      onClose({ selectedFilters: { domainType, status } });
    };
    const cancelAndClose = () => {
      onClose({ selectedFilters: { domainType, status }, saveFilters: false });
    };
    const resetAndClose = () => {
      onClose({
        selectedFilters: { domainType: undefined, status: undefined },
      });
    };

    const { overlayProps } = useOverlay(
      {
        onClose: cancelAndClose,
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
      resetAndClose();
    };

    const mergedOverlayProps = mergeProps(overlayProps, otherProps);

    return (
      <FocusScope contain restoreFocus autoFocus>
        <div
          {...mergedOverlayProps}
          ref={overlayRef}
          className={styles["filter-menu"]}
          style={{
            ...mergedOverlayProps.style,
            display: !isOpen ? "none" : mergedOverlayProps.style?.display,
          }}
        >
          <form
            onSubmit={onSubmit}
            onReset={onReset}
            className={styles["filter-form"]}
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
              {l10n.getString("profile-filter-category-option-custom-masks")}
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
              {l10n.getString("profile-filter-category-option-random-masks")}
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
              {l10n.getString("profile-filter-category-option-active-masks")}
            </label>
            <label>
              <input
                type="checkbox"
                checked={status === "promo-blocking"}
                onChange={(e) =>
                  setStatus(e.target.checked ? "promo-blocking" : undefined)
                }
                name="promoBlockingAliases"
                id="promoBlockingAliases"
              />
              {l10n.getString(
                "profile-filter-category-option-promo-blocking-masks"
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
              {l10n.getString("profile-filter-category-option-disabled-masks")}
            </label>
            <div className={styles.buttons}>
              <Button type="reset" variant="secondary">
                {l10n.getString("profile-label-reset")}
              </Button>
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
