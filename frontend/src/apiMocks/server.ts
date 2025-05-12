import { setupServer } from "msw/node";
import { getHandlers } from "./handlers";

export function initialiseServer() {
  return setupServer(...getHandlers());
}
