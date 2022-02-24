import { AliasData, getFullAddress, isRandomAlias } from "../hooks/api/aliases";

export type Filters = {
  string: string;
  domainType?: "random" | "custom";
  status?: "forwarding" | "promo-blocking" | "blocking";
};

/**
 * Given a set of filters, only returns the aliases that match.
 *
 * @see CategoryFilter
 */
export const filterAliases = (
  aliases: AliasData[],
  filters: Filters
): AliasData[] => {
  const stringFilter = filters.string.toLowerCase();
  const matchesStringFilter = (alias: AliasData) => {
    return (
      getFullAddress(alias).toLowerCase().includes(stringFilter) ||
      alias.description.toLowerCase().includes(stringFilter)
    );
  };
  const matchesDomainTypeFilter = (alias: AliasData) => {
    return (
      (filters.domainType !== "random" || isRandomAlias(alias)) &&
      (filters.domainType !== "custom" || !isRandomAlias(alias))
    );
  };
  const matchesStatusFilter = (alias: AliasData) => {
    return (
      (filters.status !== "forwarding" ||
        (alias.enabled && alias.block_list_emails === false)) &&
      (filters.status !== "promo-blocking" ||
        (alias.block_list_emails === true && alias.enabled)) &&
      (filters.status !== "blocking" || alias.enabled === false)
    );
  };

  return aliases.filter((alias) => {
    return (
      matchesStringFilter(alias) &&
      matchesDomainTypeFilter(alias) &&
      matchesStatusFilter(alias)
    );
  });
};
