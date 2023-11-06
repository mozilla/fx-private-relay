import { initialiseWorker } from "./browser";
import { initialiseServer } from "./server";

export function initialiseApiMocks() {
  if (typeof window === "undefined") {
    const server = initialiseServer();
    server.listen();
  } else {
    const worker = initialiseWorker();
    worker.start({
      // This custom handler supresses the default warnings about not mocking expected requests:
      onUnhandledRequest: (req, print) => {
        const requestUrl = new URL(req.url);
        if (
          !requestUrl.pathname.startsWith("/_next/") &&
          !requestUrl.pathname.startsWith("/fonts/") &&
          !requestUrl.pathname.startsWith("/icons/") &&
          !req.url.startsWith("https://profile.accounts.firefox.com/v1/avatar/")
        ) {
          print.warning();
        }
      },
    });
  }
}
