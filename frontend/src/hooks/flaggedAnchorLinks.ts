import { DependencyList, useEffect } from "react";

/**
 * Fix anchor links to elements behind a feature flag
 *
 * Some elements are not shown on page load, because they should not be visible
 * to everyone — typically, we'll have to first inspect the reponse to the
 * `/runtime_data/` API endpoint to determine whether that is the case.
 *
 * That means that, if the page loads with an anchor link pointing to that
 * element (e.g. `#vpn_promo`), the browser by default won't scroll towards that
 * element, because it does not exist yet.
 *
 * This hook will wait until the data passed to it as dependencies comes in and,
 * when it does, initiate a scroll towards the target element.
 *
 * @param dependencies When this element changes, try scrolling again
 * @param allowedTargetElementIds Only scroll if elements with one of these IDs are the target
 */
export function useFlaggedAnchorLinks(
  dependencies: DependencyList,
  allowedTargetElementIds?: string[]
) {
  useEffect(() => {
    if (document.location.hash.length <= 1) {
      return;
    }
    if (
      Array.isArray(allowedTargetElementIds) &&
      !allowedTargetElementIds.includes(document.location.hash.substring(1))
    ) {
      return;
    }
    const targetElement = document.getElementById(
      document.location.hash.substring(1)
    );
    targetElement?.scrollIntoView();
    // The hooks linter can't statically analyse a dynamic dependency list,
    // but since none of the dependencies actually get used inside the hook
    // anyway (they're just there to trigger the scroll), that's fine:
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);
}
