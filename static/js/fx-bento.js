"use strict";

function getFxAppLinkInfo(localizedBentoStrings, referringSiteURL) {
  return [
    [localizedBentoStrings.fxMonitor, "https://monitor.firefox.com/", "fx-monitor"],
    [localizedBentoStrings.fxPocket, "https://app.adjust.com/hr2n0yz?engagement_type=fallback_click&fallback=https%3A%2F%2Fgetpocket.com%2Ffirefox_learnmore%3Fsrc%3Dff_bento&fallback_lp=https%3A%2F%2Fapps.apple.com%2Fapp%2Fpocket-save-read-grow%2Fid309601447", "pocket"],
    [localizedBentoStrings.fxDesktop, `https://www.mozilla.org/firefox/new/?utm_source=${referringSiteURL}&utm_medium=referral&utm_campaign=bento&utm_content=desktop`, "fx-desktop"],
    [localizedBentoStrings.fxMobile, `http://mozilla.org/firefox/mobile?utm_source=${referringSiteURL}&utm_medium=referral&utm_campaign=bento&utm_content=desktop`, "fx-mobile"],
  ];
}

function createAndAppendEl(wrapper, tagName, className = null) {
  const newEl = document.createElement(tagName);
  if (className) {
    newEl.setAttribute("class", className);
  }
  wrapper.appendChild(newEl);
  return newEl;
}

async function getlocalizedBentoStrings() {

  const renderedStrings = document.querySelector(".bento-strings");

  if (!renderedStrings) {
    return {
      "bentoButtonTitle":"Firefox apps and services",
      "fxMakesTech":"Firefox is tech that fights for your online privacy.",
      "madeByMozilla":"Made by Mozilla",
      "fxDesktop":"Firefox Browser for Desktop",
      "fxLockwise":"Firefox Lockwise",
      "fxMobile":"Firefox Browser for Mobile",
      "fxMonitor":"Firefox Monitor",
      "fxPocket":"Pocket",
      "bentoButtonCloseLabel":"Close menu",
    };
  }

  // Pull the localized strings from the custom fluent object in the header 
  const localizedBentoStrings = {};

  const stringKeyArray = [
    "bentoButtonTitle",
    "fxMakesTech",
    "madeByMozilla",
    "fxDesktop",
    "fxLockwise",
    "fxMobile",
    "fxMonitor",
    "fxPocket",
    "bentoButtonCloseLabel",
  ]

  for (const key of stringKeyArray) {   
    localizedBentoStrings[key] = renderedStrings.dataset[key];
  }

  return localizedBentoStrings;

}

class FirefoxApps extends HTMLElement {
  constructor() {
    super();
  }

  async connectedCallback() {
    this._currentSite = document.body.dataset.bentoAppId;
    this._localizedBentoStrings = await getlocalizedBentoStrings();

    this._active = false; // Becomes true when the bento is opened.

    this._frag = document.createDocumentFragment(); // Wrapping fragment for bento button and bento content.

    this._bentoButton = createAndAppendEl(this._frag, "button", "fx-bento-button toggle-bento"); // Button toggles dropdown.
    this.addTitleAndAriaLabel(this._bentoButton, this._localizedBentoStrings.bentoButtonTitle);

    this._bentoWrapper = document.createElement("div");
    this._bentoWrapper.classList = "fx-bento-content-wrapper";
    this._bentoHideOverflow = createAndAppendEl(this._bentoWrapper, "div", "fx-bento-hide-overflow");
    this._bentoContent = createAndAppendEl(this._bentoHideOverflow, "div", "fx-bento-content");

    this._mobileCloseBentoButton = createAndAppendEl(this._bentoContent, "button", "fx-bento-mobile-close toggle-bento");
    this.addTitleAndAriaLabel(this._mobileCloseBentoButton, this._localizedBentoStrings.bentoButtonCloseLabel);

    [this._bentoButton, this._mobileCloseBentoButton].forEach(btn => {
      btn.addEventListener("click", this);
    });

    this._logoHeadlineWrapper = createAndAppendEl(this._bentoContent, "div", "fx-bento-headline-logo-wrapper");
    this._firefoxLogo = createAndAppendEl( this._logoHeadlineWrapper, "div", "fx-bento-logo");
    this._messageTop = createAndAppendEl( this._logoHeadlineWrapper, "span", "fx-bento-headline");
    this._messageTop.textContent = this._localizedBentoStrings.fxMakesTech;

    this._appList = this.makeAppList();

    this._messageBottomLink = createAndAppendEl(this._bentoContent, "a", "fx-bento-bottom-link fx-bento-link");
    this._messageBottomLink.textContent = this._localizedBentoStrings.madeByMozilla;
    this._messageBottomLink.href = "https://www.mozilla.org/";

    this._bentoContent.querySelectorAll("a").forEach( (anchorEl, idx) => {
      anchorEl.dataset.bentoLinkOrder = idx;
      anchorEl.addEventListener("click", this);
      anchorEl.tabIndex = "-1";
    });

    this._frag.appendChild(this._bentoWrapper);
    this.appendChild(this._frag);
    this.addEventListener("close-bento-menu", this);

    this.handleKeyDownEvents = () => {
      const moveFocusWithArrows = (whichDirection) => {
        const activeEl = document.activeElement;
        const bentoLinks = this._bentoContent.querySelectorAll("a");
        if (!activeEl.dataset.bentoLinkOrder) { // check if link in Bento has focus
          bentoLinks[0].focus(); // focus first link in bento
          return;
        }
        const activeLinkNum = parseInt(activeEl.dataset.bentoLinkOrder);
        const newActiveLink = parseInt(activeLinkNum + whichDirection);
        if (bentoLinks[newActiveLink]) {
          bentoLinks[newActiveLink].focus();
        }
        return;
      };
      switch(event.keyCode) {
        case 27: // escape
          // this._active = !this._active;
          this._closeBento();
          return;
        case 40 : // down arrow || up arrow
          moveFocusWithArrows(1);
          break;
        case 38: // arrow up
          moveFocusWithArrows(-1);
          break;
      }
      return;
    };

    this._closeBento = () => {
      this._active = false;
      this.handleBentoFocusTrap();
      window.removeEventListener("resize", this.handleBentoHeight);
      window.removeEventListener("click", this);
      document.removeEventListener("keydown", this);
      this.metricsSendEvent("bento-closed", this._currentSite);
      this.classList.remove("fx-bento-open");
      this._bentoWrapper.classList.add("fx-bento-fade-out");
      setTimeout(() => {
        this._bentoWrapper.classList.remove("fx-bento-fade-out");
        this._bentoButton.blur();
        this.classList = [];
      }, 500);
      return;
    };
  }

  addTitleAndAriaLabel(el, localizedCopy) {
    ["title", "aria-label"].forEach(attrName => {
      el.setAttribute(attrName, localizedCopy);
    });
  }

  metricsSendEvent(eventAction, eventLabel) {
    if (typeof(ga) !== "undefined") {
      return ga("send", "event", "bento", eventAction, eventLabel);
    }
  }

  handleEvent(event) {
    const keydownEvent = (event.type === "keydown");
    const eventTarget = event.target;
    if (
      // ignore mouse clicks inside the bento
      (!keydownEvent && ["fx-bento-content active", "fx-bento-headline", "fx-bento-logo", "fx-bento-headline-logo-wrapper"].includes(eventTarget.className)) ||
      // ignore and don't prevent default behavior on key clicks other than Escape, Down Arrow, and Up Arrow
      (keydownEvent && ![27, 40, 38].includes(event.keyCode))
      ) {
      return;
    }

    const hasParent = (el, selector) => {
      while (el.parentElement) {
        el = el.parentElement;
        if (el.tagName === selector)
          return el;
      }
      return null;
    };
    // close Bento on mouse clicks outside the Bento menu
    if (hasParent(event.target, "FIREFOX-APPS") === null) {
      return this._closeBento();
    }

    event.preventDefault();
    event.stopPropagation();

    if (keydownEvent) {
      return this.handleKeyDownEvents(event);
    }
    this._active = !this._active;
    const eventTargetClassList = event.target.classList;
    const MozLinkClick = (eventTargetClassList.contains("fx-bento-bottom-link"));

    if (eventTargetClassList.contains("fx-bento-app-link") || MozLinkClick) {
      const url = new URL(eventTarget.href);  // add any additional UTM params - or whatever
      url.searchParams.append("utm_source", this._currentSite);
      url.searchParams.append("utm_medium", "referral");
      url.searchParams.append("utm_campaign", "bento");
      if (MozLinkClick) {
        this.metricsSendEvent("bento-app-link-click", "Mozilla");
        window.open(url, "_blank", "noopener");
        return this._closeBento();
      }
      const appToOpenId = eventTarget.dataset.bentoAppLinkId;
      this.metricsSendEvent("bento-app-link-click", appToOpenId);
      if (eventTargetClassList.contains("fx-bento-current-site")) { // open index page in existing window
        window.location = url;
        return this._closeBento();
      }
      window.open(url, "_blank", "noopener");
      return this._closeBento();
    }

    if (
        !this._active && event.target.classList.contains("fx-bento-button") ||
        !this._active && event.target.classList.contains("fx-bento-mobile-close")
    ) {
      return this._closeBento();
    }

    this._active = true;

    const sendEventOnBentoOpen = new Event("bento-was-opened");
    document.dispatchEvent(sendEventOnBentoOpen);

    this.metricsSendEvent("bento-opened", this._currentSite);
    this.handleBentoHeight();
    document.addEventListener("keydown", this);
    window.addEventListener("resize", this.handleBentoHeight);
    window.addEventListener("click", this);

    this.classList = ["active fx-bento-open"];
    this._bentoButton.focus();
    return this.handleBentoFocusTrap();
  }

  handleBentoHeight() { // resize bento max-height if necessary
    const bento = document.querySelector(".fx-bento-content");
    const winHeight = window.innerHeight;
    const newBentoHeight = winHeight - bento.offsetTop - 100;
    const setMaxHeight = (winHeight < 500 && window.innerWidth > 500);
    if (setMaxHeight) {
      bento.style.maxHeight = `${newBentoHeight}px`;
    } else {
      bento.style.maxHeight = "1000px";
    }
    bento.classList.toggle("fx-bento-enable-scrolling", setMaxHeight);
   }

  handleBentoFocusTrap() {
    const nonBentoPageElements = document.querySelectorAll(
      "a:not(.fx-bento-app-link):not(.fx-bento-bottom-link), button:not(.toggle-bento ), input, select, option, [tabindex]"
      );
    const bentoLinks = this._bentoContent.querySelectorAll(".fx-bento-app-link, .fx-bento-bottom-link");
    if (this._active) {
      nonBentoPageElements.forEach(el => {
        if (el.tabIndex > -1) {
          el.dataset.oldTabIndex = el.tabIndex;
        }
        el.tabIndex = -1;
      });
      bentoLinks.forEach(el => {
        el.tabIndex = 0;
      });
      return;
    }
    nonBentoPageElements.forEach(el => {
      if (el.dataset.oldTabIndex) {
        el.tabIndex = el.dataset.oldTabIndex;
        delete el.dataset.oldTabIndex;
        return;
      }
      el.tabIndex = 0;
    });
    bentoLinks.forEach(el => {
      el.tabIndex = -1;
    });
  }

  makeAppList() {
    const appLinks = getFxAppLinkInfo(this._localizedBentoStrings, this._currentSite);
    appLinks.forEach(app => {
      const newLink = document.createElement("a");
      const newLinkSpan = createAndAppendEl(newLink, "span", `fx-bento-app-link-span ${app[2]}`);
      newLink.setAttribute("class", `fx-bento-app-link fx-bento-link ${app[2]}`);
      newLinkSpan["textContent"] = app[0];
      ["href", "data-bento-app-link-id"].forEach((attributeName, index) => {
        newLink.setAttribute(attributeName, app[index + 1]);
      });
      if (newLink.dataset.bentoAppLinkId === this._currentSite) {
        newLink.classList.add("fx-bento-current-site");
      }
      this._bentoContent.appendChild(newLink);
    });
  }
}

if (typeof(customElements) !== "undefined") {
  customElements.define("firefox-apps", FirefoxApps);
} else { // Hide on unsupportive browsers
  document.addEventListener("DOMContentLoaded", () => {
    document.body.classList.add("hide-bento");
  });
}
