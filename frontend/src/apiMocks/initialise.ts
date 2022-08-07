import { initialiseWorker } from "./browser";
import { initialiseServer } from "./server";

export function initialiseApiMocks() {
  if (typeof window === "undefined") {
    const server = initialiseServer();
    server.listen();
  } else {
    const worker = initialiseWorker();
    worker.start({
      // This custom handler suppresses the default warnings about not mocking expected requests:
      onUnhandledRequest: (req, print) => {
        if (
          !req.url.pathname.startsWith("/_next/") &&
          !req.url.pathname.startsWith("/fonts/") &&
          !req.url.pathname.startsWith("/icons/") &&
          !req.url.href.startsWith(
            "https://profile.accounts.firefox.com/v1/avatar/"
          )
        ) {
          print.warning();
        }
      },
    });
  }
}
