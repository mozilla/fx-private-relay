import { useEffect, useState } from "react";

/**
 * Hook to help selectively opting out of static site generation
 *
 * Sometimes you want to adapt the appearance of a component based on specific
 * characteristics of the user's in-browser environment. However, this can
 * cause problems: we pre-render our components to static HTML before sending
 * them to the user, and then React re-renders the components on the client-
 * side, and matches the resulting HTML with the HTML that we already sent to
 * the browser. If those two don't align, that can cause hydration errors; see
 * https://nextjs.org/docs/messages/react-hydration-error?trk=public_post_comment-text
 *
 * To avoid this, you can use this hook to defer client-side adjustments until
 * *after* hydration. That way, React knows how the adjustments are different
 * from the initial render, and can apply just those changes.
 *
 * @returns Whether the component has already rendered client-side; if `true`,
 *          subsequent renders are guaranteed to be on the client-side.
 */
export function useHasRenderedClientSide() {
  const [hasRenderedClientSide, setHasRenderedClientSide] = useState(false);

  useEffect(() => {
    setHasRenderedClientSide(true);
  }, []);

  return hasRenderedClientSide;
}
