/**
 * Common test helper functions to reduce duplication across test files
 */

/**
 * Mock the useFirstSeen hook to return a date X days ago
 * @param daysAgo - Number of days ago (e.g., 7 for 7 days ago)
 */
export function mockFirstSeenDaysAgo(daysAgo: number): void {
  const useFirstSeen =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (jest.requireMock("../src/hooks/firstSeen.ts") as any).useFirstSeen;
  useFirstSeen.mockReturnValue(
    new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000),
  );
}

/**
 * Mock the useFirstSeen hook to return a specific date
 * @param date - The date to return
 */
export function mockFirstSeen(date: Date | null): void {
  const useFirstSeen =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (jest.requireMock("../src/hooks/firstSeen.ts") as any).useFirstSeen;
  useFirstSeen.mockReturnValue(date);
}

/**
 * Mock the useFirstSeen hook to return a date X days ago (one-time mock)
 * @param daysAgo - Number of days ago
 */
export function mockFirstSeenDaysAgoOnce(daysAgo: number): void {
  const useFirstSeen =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (jest.requireMock("../src/hooks/firstSeen.ts") as any).useFirstSeen;
  useFirstSeen.mockReturnValueOnce(
    new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000),
  );
}

/**
 * Mock cookie dismissal for a specific survey/feature
 * @param cookieKey - The cookie key to check (e.g., "free-7days", "premium-oneyear")
 */
export function mockCookieDismissal(cookieKey: string): void {
  const getCookie: jest.Mock =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (jest.requireMock("../src/functions/cookies.ts") as any).getCookie;
  getCookie.mockImplementation((key: string) =>
    key.includes(cookieKey) ? Date.now() : undefined,
  );
}

/**
 * Mock useLocalDismissal hook
 * @param isDismissed - Whether the component is dismissed
 * @param dismissFn - Optional custom dismiss function
 */
export function mockLocalDismissal(
  isDismissed: boolean,
  dismissFn?: jest.Mock,
): void {
  const useLocalDismissal =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (jest.requireMock("../src/hooks/localDismissal.ts") as any)
      .useLocalDismissal;
  useLocalDismissal.mockReturnValue({
    isDismissed,
    dismiss: dismissFn || jest.fn(),
  });
}

/**
 * Mock the useIsLoggedIn hook
 * @param status - Login status ("logged-in", "logged-out", or "unknown")
 */
export function mockLoginStatus(
  status: "logged-in" | "logged-out" | "unknown",
): void {
  const useIsLoggedIn =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (jest.requireMock("../src/hooks/session.ts") as any).useIsLoggedIn;
  useIsLoggedIn.mockReturnValue(status);
}

/**
 * Get the mocked dismiss function from useLocalDismissal
 */
export function getMockedDismissFn(): jest.Mock {
  const useLocalDismissal =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (jest.requireMock("../src/hooks/localDismissal.ts") as any)
      .useLocalDismissal;
  return useLocalDismissal.mock.results[
    useLocalDismissal.mock.results.length - 1
  ].value.dismiss;
}
