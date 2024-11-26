import { AriaOverlayProps, useMenu as useAriaMenu } from "react-aria";
import { AriaMenuItemProps, AriaMenuOptions, MenuAria } from "@react-aria/menu";
import { MenuTriggerState, TreeProps, TreeState } from "react-stately";
import { RefObject } from "@react-types/shared";
import { HTMLAttributes } from "react";

// MenuTriggerState focusStrategy from react-stately 3.34.0 is typed as
// FocusStrategy | null
// In react-aria 3.36.0, autoFocus is typed as
// boolean | FocusStrategy | undefined
// So, adjust a null value into undefined for use in react-aria
// Presumably, react-aria will reconcile its typings with react-stately
// at some point, at which point this commit can be reverted again.
export type MenuPopupProps<T> = TreeProps<T> & {
  onAction: AriaMenuItemProps["onAction"];
  domProps: HTMLAttributes<HTMLElement>;
  onClose?: AriaOverlayProps["onClose"];
  autoFocus?: MenuTriggerState["focusStrategy"] | null;
};

export function useMenu<T>(
  props: MenuPopupProps<T>,
  state: TreeState<T>,
  ref: RefObject<HTMLElement | null>,
): MenuAria {
  const adjustedProps: AriaMenuOptions<T> = {
    ...props,
    autoFocus: props.autoFocus ?? undefined,
  };
  return useAriaMenu(adjustedProps, state, ref);
}
