/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import type { useHasRenderedClientSide as ogUseHasRenderedClientSide } from "../hasRenderedClientSide";

/**
 * Mock that always returns `true`
 *
 * This allows tests to simply call
 * `jest.mock("path/to/useHasRenderedClientSide")` to skip the loading phase
 * followed by an automatic re-render, which would result in the error:
 *
 * > Warning: A suspended resource finished loading inside a test, but
 * > the event was not wrapped in act(...).
 */
export const useHasRenderedClientSide: typeof ogUseHasRenderedClientSide = () =>
  true;
