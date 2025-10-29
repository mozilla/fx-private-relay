import { setupServer } from "msw/node";
import { handlers } from "./handlers";

export function initialiseServer() {
  return setupServer(...handlers);
}
