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
});
