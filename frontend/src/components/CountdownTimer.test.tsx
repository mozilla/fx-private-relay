import fc from "fast-check";
import { getRemainingTimeParts } from "./CountdownTimer";

describe("getRemainingTimeParts", () => {
  it("knows when there's zero of everything", () => {
    expect(getRemainingTimeParts(0)).toStrictEqual({
      remainingDays: 0,
      remainingHours: 0,
      remainingMinutes: 0,
      remainingSeconds: 0,
    });
  });

  it("knows when there's zero of everything when there's less than half a second left", () => {
    expect(getRemainingTimeParts(499)).toStrictEqual({
      remainingDays: 0,
      remainingHours: 0,
      remainingMinutes: 0,
      remainingSeconds: 0,
    });
  });

  it("knows when there's zero of everything but seconds", () => {
    expect(getRemainingTimeParts(1337)).toStrictEqual({
      remainingDays: 0,
      remainingHours: 0,
      remainingMinutes: 0,
      remainingSeconds: 1,
    });
  });

  it("knows when there's zero of everything but minutes and seconds", () => {
    expect(getRemainingTimeParts(3 * 60 * 1000 + 2 * 1000 + 42)).toStrictEqual({
      remainingDays: 0,
      remainingHours: 0,
      remainingMinutes: 3,
      remainingSeconds: 2,
    });
  });

  it("knows when there are zero days left", () => {
    expect(
      getRemainingTimeParts(4 * 60 * 60 * 1000 + 3 * 60 * 1000 + 2 * 1000 + 42)
    ).toStrictEqual({
      remainingDays: 0,
      remainingHours: 4,
      remainingMinutes: 3,
      remainingSeconds: 2,
    });
  });

  it("knows when are multiple days left", () => {
    expect(
      getRemainingTimeParts(
        5 * 24 * 60 * 60 * 1000 +
          4 * 60 * 60 * 1000 +
          3 * 60 * 1000 +
          2 * 1000 +
          42
      )
    ).toStrictEqual({
      remainingDays: 5,
      remainingHours: 4,
      remainingMinutes: 3,
      remainingSeconds: 2,
    });
  });

  it("can deal with hours reaching zero with multiple days left", () => {
    expect(
      getRemainingTimeParts(
        5 * 24 * 60 * 60 * 1000 + 3 * 60 * 1000 + 2 * 1000 + 42
      )
    ).toStrictEqual({
      remainingDays: 5,
      remainingHours: 0,
      remainingMinutes: 3,
      remainingSeconds: 2,
    });
  });

  it("can deal with minutes reaching zero with multiple days left", () => {
    expect(
      getRemainingTimeParts(
        5 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000 + 2 * 1000 + 42
      )
    ).toStrictEqual({
      remainingDays: 5,
      remainingHours: 4,
      remainingMinutes: 0,
      remainingSeconds: 2,
    });
  });

  it("can deal with hours close to 24", () => {
    expect(
      getRemainingTimeParts(
        5 * 24 * 60 * 60 * 1000 +
          23 * 60 * 60 * 1000 +
          3 * 60 * 1000 +
          2 * 1000 +
          42
      )
    ).toStrictEqual({
      remainingDays: 5,
      remainingHours: 23,
      remainingMinutes: 3,
      remainingSeconds: 2,
    });
  });

  it("can deal with minutes close to 60", () => {
    expect(
      getRemainingTimeParts(
        5 * 24 * 60 * 60 * 1000 +
          4 * 60 * 60 * 1000 +
          59 * 60 * 1000 +
          2 * 1000 +
          42
      )
    ).toStrictEqual({
      remainingDays: 5,
      remainingHours: 4,
      remainingMinutes: 59,
      remainingSeconds: 2,
    });
  });

  it("can deal with seconds close to 60", () => {
    expect(
      getRemainingTimeParts(
        5 * 24 * 60 * 60 * 1000 +
          4 * 60 * 60 * 1000 +
          3 * 60 * 1000 +
          59 * 1000 +
          42
      )
    ).toStrictEqual({
      remainingDays: 5,
      remainingHours: 4,
      remainingMinutes: 3,
      remainingSeconds: 59,
    });
  });

  it("never returns a negative number of days", () => {
    const runs = 100;
    expect.assertions(runs);
    fc.assert(
      fc.property(
        fc.nat({ max: 90 * 24 * 60 * 60 * 1000 }),
        (timeInMilliseconds) => {
          const remainingTimeParts = getRemainingTimeParts(timeInMilliseconds);
          expect(remainingTimeParts.remainingDays).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: runs }
    );
  });

  it("never returns more hours than fit in a day", () => {
    const runs = 100;
    expect.assertions(runs);
    fc.assert(
      fc.property(
        fc.nat({ max: 90 * 24 * 60 * 60 * 1000 }),
        (timeInMilliseconds) => {
          const remainingTimeParts = getRemainingTimeParts(timeInMilliseconds);
          expect(remainingTimeParts.remainingHours).toBeLessThan(24);
        }
      ),
      { numRuns: runs }
    );
  });

  it("never returns a negative number of hours", () => {
    const runs = 100;
    expect.assertions(runs);
    fc.assert(
      fc.property(
        fc.nat({ max: 90 * 24 * 60 * 60 * 1000 }),
        (timeInMilliseconds) => {
          const remainingTimeParts = getRemainingTimeParts(timeInMilliseconds);
          expect(remainingTimeParts.remainingHours).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: runs }
    );
  });

  it("never returns more minutes than fit in an hour", () => {
    const runs = 100;
    expect.assertions(runs);
    fc.assert(
      fc.property(
        fc.nat({ max: 90 * 24 * 60 * 60 * 1000 }),
        (timeInMilliseconds) => {
          const remainingTimeParts = getRemainingTimeParts(timeInMilliseconds);
          expect(remainingTimeParts.remainingMinutes).toBeLessThan(60);
        }
      ),
      { numRuns: runs }
    );
  });

  it("never returns a negative number of minutes", () => {
    const runs = 100;
    expect.assertions(runs);
    fc.assert(
      fc.property(
        fc.nat({ max: 90 * 24 * 60 * 60 * 1000 }),
        (timeInMilliseconds) => {
          const remainingTimeParts = getRemainingTimeParts(timeInMilliseconds);
          expect(remainingTimeParts.remainingMinutes).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: runs }
    );
  });

  it("never returns more seconds than fit in a minute", () => {
    const runs = 100;
    expect.assertions(runs);
    fc.assert(
      fc.property(
        fc.nat({ max: 90 * 24 * 60 * 60 * 1000 }),
        (timeInMilliseconds) => {
          const remainingTimeParts = getRemainingTimeParts(timeInMilliseconds);
          expect(remainingTimeParts.remainingSeconds).toBeLessThan(60);
        }
      ),
      { numRuns: runs }
    );
  });

  it("never returns a negative number of seconds", () => {
    const runs = 100;
    expect.assertions(runs);
    fc.assert(
      fc.property(
        fc.nat({ max: 90 * 24 * 60 * 60 * 1000 }),
        (timeInMilliseconds) => {
          const remainingTimeParts = getRemainingTimeParts(timeInMilliseconds);
          expect(remainingTimeParts.remainingSeconds).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: runs }
    );
  });

  it("always properly detects the number of remaining days, hours, minutes and seconds", () => {
    const runs = 100;
    expect.assertions(runs * 4);
    fc.assert(
      fc.property(
        fc.tuple(
          fc.nat({ max: 90 }),
          fc.nat({ max: 23 }),
          fc.nat({ max: 59 }),
          fc.nat({ max: 59 }),
          fc.nat({ max: 999 })
        ),
        ([days, hours, minutes, seconds, milliseconds]) => {
          const remainingTimeParts = getRemainingTimeParts(
            days * 24 * 60 * 60 * 1000 +
              hours * 60 * 60 * 1000 +
              minutes * 60 * 1000 +
              seconds * 1000 +
              milliseconds
          );
          expect(remainingTimeParts.remainingDays).toBe(days);
          expect(remainingTimeParts.remainingHours).toBe(hours);
          expect(remainingTimeParts.remainingMinutes).toBe(minutes);
          expect(remainingTimeParts.remainingSeconds).toBe(seconds);
        }
      ),
      { numRuns: runs }
    );
  });
});
