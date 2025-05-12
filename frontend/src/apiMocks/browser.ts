import { setupWorker } from "msw/browser";
import { getHandlers } from "./handlers";

export function initialiseWorker() {
  return setupWorker(...getHandlers());
}
