export type E164Number = `+${number}`;

export function isE164Number(number: string): number is E164Number {
  const numberPart = number.substring(1);

  return (
    numberPart.length <= 15 &&
    numberPart.length > 0 &&
    // Ensure there are no non-number characters in the given string:
    `+${Number.parseInt(numberPart, 10).toString()}` === number
  );
}
