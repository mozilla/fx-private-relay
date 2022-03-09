import { setupWorker } from "msw";
import { handlers } from "./handlers";

export function initialiseWorker() {
  return setupWorker(...handlers);
}
