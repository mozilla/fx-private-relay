import { Fragment, useEffect, useReducer } from "react";
import { OverlayTriggerState } from "react-stately";

/**
 * Work around a bug that prevents overlay menus from opening
 *
 * This hook is a workaround for this weird bug:
 * https://github.com/adobe/react-spectrum/issues/3517
 *
 * Since the bug presumably exists somewhere in the interplay between Next.js
 * and React Aria, it is hard for either project to fix. And of course, our glue
 * code might be at fault as well.
 *
 * The bug is that `useOverlayPosition` usually looks at the position of the
 * overlay trigger, and then updates the style properties that it returns with
 * the values needed to position the overlay. However, that update does not
 * happen by itself. Hence, this hook returns an invisible element that you can
 * include in your view, and that will trigger a re-render whenever the menu
 * opens or closes.
 *
 * @param state The OverlayTriggerState controlling your overlay (i.e. whose `isOpen` property you pass to `useOverlayPosition`)
 * @returns An invisible element to include next to your overlay trigger
 */
export const useOverlayBugWorkaround = (state: OverlayTriggerState) => {
  const [renderCount, triggerRerender] = useReducer(
    (renders) => renders + 1,
    0,
  );

  useEffect(() => {
    // Not doing anything, just triggering a re-render if the menu opens to
    // work around
    // https://github.com/adobe/react-spectrum/issues/3517
    setTimeout(() => triggerRerender());
  }, [state.isOpen]);

  // An invisible element that gets re-rendered every time the menu opens
  const elementToRender = (
    <Fragment key={`overlayBugWorkaroundRender${renderCount}`} />
  );
  return elementToRender;
};
