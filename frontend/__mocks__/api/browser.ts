import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";

export function initialiseWorker() {
  return setupWorker(...handlers);
}
