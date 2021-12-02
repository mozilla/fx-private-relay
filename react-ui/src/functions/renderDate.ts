const formatter = new Intl.DateTimeFormat([], { dateStyle: "medium" });

export const renderDate = (iso8601DateString: string): string => {
  // `Date.parse` can be inconsistent,
  // but should be fairly reliable in parsing ISO 8601 strings
  // (though if Temporal ever gets accepted by TC39, we should switch to that):
  const date = Date.parse(iso8601DateString);
  return formatter.format(date);
};
