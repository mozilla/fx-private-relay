/**
 * Returns true or false based on whether doNotTack is enabled. It also takes into account the
 * anomalies, such as !bugzilla 887703, which effect versions of Fx 31 and lower. It also handles
 * IE versions on Windows 7, 8 and 8.1, where the DNT implementation does not honor the spec.
 * @see https://bugzilla.mozilla.org/show_bug.cgi?id=1217896 for more details
 * @params {string} [dnt] - An optional mock doNotTrack string to ease unit testing.
 * @params {string} [userAgent] - An optional mock userAgent string to ease unit testing.
 * @returns {boolean} true if enabled else false
 */

function _dntEnabled(dnt, userAgent) {

  // for old version of IE we need to use the msDoNotTrack property of navigator
  // on newer versions, and newer platforms, this is doNotTrack but, on the window object
  // Safari also exposes the property on the window object.
  var dntStatus = dnt || navigator.doNotTrack || window.doNotTrack || navigator.msDoNotTrack;
  var ua = userAgent || navigator.userAgent;

  // List of Windows versions known to not implement DNT according to the standard.
  var anomalousWinVersions = ["Windows NT 6.1", "Windows NT 6.2", "Windows NT 6.3"];

  var fxMatch = ua.match(/Firefox\/(\d+)/);
  var ieRegEx = /MSIE|Trident/i;
  var isIE = ieRegEx.test(ua);
  // Matches from Windows up to the first occurance of ; un-greedily
  // http://www.regexr.com/3c2el
  var platform = ua.match(/Windows.+?(?=;)/g);

  // With old versions of IE, DNT did not exist so we simply return false;
  if (isIE && typeof Array.prototype.indexOf !== "function") {
      return false;
  } else if (fxMatch && parseInt(fxMatch[1], 10) < 32) {
      // Can"t say for sure if it is 1 or 0, due to Fx bug 887703
      dntStatus = "Unspecified";
  } else if (isIE && platform && anomalousWinVersions.indexOf(platform.toString()) !== -1) {
      // default is on, which does not honor the specification
      dntStatus = "Unspecified";
  } else {
      // sets dntStatus to Disabled or Enabled based on the value returned by the browser.
      // If dntStatus is undefined, it will be set to Unspecified
      dntStatus = { "0": "Disabled", "1": "Enabled" }[dntStatus] || "Unspecified";
  }

  return dntStatus === "Enabled" ? true : false;
}

function handleIntersectingElem(entries, analyticsObserver) {
	entries.forEach(entry => {
		if (entry.target.classList.contains("hidden")) {
			analyticsObserver.unobserve(entry.target);
			return;
		}
		if (entry.intersectionRatio === 1) {
      const elemDataset = entry.target.dataset;
      ga("send", "event", elemDataset.eventCategory, "View",  elemDataset.eventLabel);
      analyticsObserver.unobserve(entry.target);
		}
	});
}

function sendGaPing(eventCategory, eventAction, eventLabel) {
  if (typeof(ga) !== "undefined") {
    return ga("send", "event", eventCategory, eventAction, eventLabel);
  }
  return;
}


(()=> {
// Check for DoNotTrack header before running GA script
  if (_dntEnabled()) {
    return;
  }

  (function(i,s,o,g,r,a,m){i["GoogleAnalyticsObject"]=r;i[r]=i[r]||function(){
  (i[r].q=i[r].q||[]).push(arguments);},i[r].l=1*new Date();a=s.createElement(o),
  m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m);
  })(window,document,"script","https://www.google-analytics.com/analytics.js","ga");

  ga("create", "UA-77033033-33");
  ga("set", "anonymizeIp", true);
  ga("set", "transport", "beacon");
  ga("send", "pageview");

  const gaEventTriggers = document.querySelectorAll("[data-ga='send-ga-funnel-pings']");

  const intersectionObserverAvailable =  (
    "IntersectionObserver" in window &&
    "IntersectionObserverEntry" in window &&
    "intersectionRatio" in window.IntersectionObserverEntry.prototype
  );

  if  (!intersectionObserverAvailable) {
    return;
  }

  const analyticsObserver = new IntersectionObserver(handleIntersectingElem, {
    threshold: 1,
  });

  gaEventTriggers.forEach(eventTriggeringElem => {
    analyticsObserver.observe(eventTriggeringElem);
    eventTriggeringElem.addEventListener("click", () => {
      const eventData = eventTriggeringElem.dataset;
      ga("send", "event", eventData.eventCategory, "Engage",  eventData.eventLabel);
    });
  });
})();
