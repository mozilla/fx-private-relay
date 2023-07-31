import {
  createContext,
  RefObject,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { LocalLabel } from "./localLabels";

export type AddonData = Partial<{
  /**
   * Whether the user has the add-on installed.
   *
   * Note that the add-on also injects a stylesheet that defines the
   * `is-visible-with-addon` and `is-hidden-with-addon` classes.
   * This can provide a better user experience, since those are available
   * right away, before JavaScript is parsed, whereas JS-detection of the
   * add-on can take a couple of milliseconds.
   */
  present: boolean;
  /**
   * Alias labels as stored in the add-on.
   *
   * We now store these labels on the server, if enabled by the user,
   * or in local storage if the add-on is installed and server storage
   * is not enabled.
   * However, previously labels were stored by the add-on itself. Those
   * are contained in this property, if available.
   */
  localLabels: LocalLabel[];
}> & {
  sendEvent: (type: string, data?: object) => void;
};

const defaultAddonData: AddonData = {
  sendEvent: () => undefined,
};

function useMutationObserver(
  elementRef: RefObject<HTMLElement>,
  options: MutationObserverInit,
  callback: MutationCallback,
) {
  const [observer, setObserver] = useState<MutationObserver>();

  useEffect(() => {
    const observer = new MutationObserver(callback);
    setObserver(observer);
  }, [callback]);

  useEffect(() => {
    if (elementRef.current === null) {
      return;
    }

    observer?.observe(elementRef.current, options);

    return () => {
      observer?.disconnect();
    };
  }, [observer, options, elementRef]);
}

/**
 * The add-on passes data to the website by setting data attributes on
 * the <firefox-private-relay-addon> element. Since attributes can only
 * be strings, the parsers in this object describe how to turn those
 * strings into actual data structures:
 */
const attributeParsers: Record<
  string,
  (_addonElement: Element) => Partial<AddonData>
> = {
  "data-addon-installed": (addonElement) => ({
    present: addonElement.getAttribute("data-addon-installed") === "true",
  }),
  "data-local-labels": (addonElement) => {
    const localLabelsString = addonElement.getAttribute("data-local-labels");
    const localLabels =
      localLabelsString !== null ? JSON.parse(localLabelsString) : undefined;
    return { localLabels: localLabels };
  },
};

/**
 * MutationObservers, as used in `useAddonElementWatcher`,
 * have callbacks for individual attributes, rather than
 * processing an entire element at a time. This is a convenience
 * function that does allow parsing of an entire element in one go
 * (i.e. to parse initial values, which aren't caught by a
 * MutationObserver).
 */
const parseAddonData = (addonElement: HTMLElement): AddonData => {
  let addonData: AddonData = {
    sendEvent: (type, data = {}) => {
      addonElement.dispatchEvent(
        new CustomEvent("website", { detail: { ...data, type: type } }),
      );
    },
  };
  Object.values(attributeParsers).forEach((parser) => {
    addonData = {
      ...addonData,
      ...parser(addonElement),
    };
  });
  return addonData;
};

/**
 * Hook to keep track of the actual attributes of the <firefox-private-relay-addon> element in the DOM.
 *
 * Note: if you need a component to know whether the add-on is installed, use
 * {@link useAddonData}.
 *
 * Our add-on looks for that element on the page and manipulates its attributes
 * (e.g. it sets `data-atton-installed="true"`). This hook keeps track of those
 * changes and returns the current data, which can then be used to 1) ensure the
 * props in the virtual DOM are aligned with the attributes in the real one, and
 * 2) pass those values to the {@link AddonDataContext} provider so that other
 * components can have access to it using {@link useAddonData}.
 *
 * @param addonElementRef React Ref to the custom element that the add-on looks at (i.e. <firefox-private-relay-addon>).
 * @returns The data that should be set as the element's props, to ensure they're aligned with its in-DOM attributes.
 */
export function useAddonElementWatcher(
  addonElementRef: RefObject<HTMLElement>,
): AddonData {
  const [addonData, setAddonData] = useState<AddonData>(
    addonElementRef.current !== null
      ? parseAddonData(addonElementRef.current)
      : defaultAddonData,
  );
  useEffect(() => {
    if (addonElementRef.current === null) {
      return;
    }
    setAddonData(parseAddonData(addonElementRef.current));
  }, [addonElementRef]);

  const mutationListener = useCallback(
    (mutationRecords: MutationRecord[]) => {
      setAddonData((prevAddonData) => {
        let newAddonData = { ...prevAddonData };
        mutationRecords.forEach((mutationRecord) => {
          Object.entries(attributeParsers).forEach(([attribute, parser]) => {
            if (
              mutationRecord.attributeName === attribute &&
              mutationRecord.target instanceof Element
            ) {
              newAddonData = {
                ...newAddonData,
                ...parser(mutationRecord.target),
              };
            }
          });
        });
        return newAddonData;
      });
    },
    [setAddonData],
  );

  useMutationObserver(addonElementRef, { attributes: true }, mutationListener);

  return addonData;
}

export const AddonDataContext = createContext<AddonData>(defaultAddonData);

/**
 * This hook can be used to communicate with the user's installed add-on, if any.
 *
 * @returns Data from the user's add-on installation, if any.
 */
export function useAddonData(): AddonData {
  const addonData = useContext(AddonDataContext);

  return addonData;
}
