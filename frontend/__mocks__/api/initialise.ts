export async function initialiseApiMocks() {
  if (typeof window === "undefined") {
    const { initialiseServer } = await import("./server");
    const server = initialiseServer();
    await server.listen();
  } else {
    const { initialiseWorker } = await import("./browser");
    const worker = initialiseWorker();
    await worker.start({
      // This custom handler suppresses the default warnings about not mocking expected requests:
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
