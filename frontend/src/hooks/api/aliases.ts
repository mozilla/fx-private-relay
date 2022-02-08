import { SWRResponse } from "swr";
import { apiFetch, useApiV1 } from "./api";
import { ProfileData } from "./profile";

type DateTimeString = string;
type Domain_RelayFirefoxCom = 1;
type Domain_MozmailCom = 2;
export type CommonAliasData = {
  type: "random" | "custom";
  enabled: boolean;
  description: string | "";
  id: number;
  address: string;
  domain: Domain_MozmailCom | Domain_RelayFirefoxCom;
  created_at: DateTimeString;
  last_modified_at: DateTimeString;
  last_used_at: DateTimeString | null;
  num_forwarded: number;
  num_blocked: number;
  num_spam: number;
};

export type RandomAliasData = CommonAliasData & {
  type: "random";
  generated_for: string | "";
  domain: Domain_RelayFirefoxCom;
};
export type CustomAliasData = CommonAliasData & {
  type: "custom";
  domain: Domain_MozmailCom;
};

export type AliasData = RandomAliasData | CustomAliasData;

export type RandomAliasCreateFn = () => Promise<Response>;
export type CustomAliasCreateFn = (address: string) => Promise<Response>;
export type AliasUpdateFn = (
  alias: Partial<AliasData> & { id: number }
) => Promise<Response>;
export type AliasDeleteFn = (id: number) => Promise<Response>;
type WithRandomAliasCreater = {
  create: RandomAliasCreateFn;
};
type WithCustomAliasCreater = {
  create: CustomAliasCreateFn;
};
type WithUpdater = {
  update: AliasUpdateFn;
};
type WithDeleter = {
  delete: AliasDeleteFn;
};

/**
 * Fetch aliases (both random and custom) from our API using [SWR](https://swr.vercel.app).
 */
export function useAliases(): {
  randomAliasData: SWRResponse<RandomAliasData[], unknown> &
    WithRandomAliasCreater &
    WithUpdater &
    WithDeleter;
  customAliasData: SWRResponse<CustomAliasData[], unknown> &
    WithCustomAliasCreater &
    WithUpdater &
    WithDeleter;
} {
  const randomAliases: SWRResponse<RandomAliasData[], unknown> =
    useApiV1("/relayaddresses/");
  const customAliases: SWRResponse<CustomAliasData[], unknown> =
    useApiV1("/domainaddresses/");

  const randomAliasCreater: RandomAliasCreateFn = async () => {
    const response = await apiFetch("/relayaddresses/", {
      method: "POST",
      body: JSON.stringify({ enabled: true }),
    });
    randomAliases.mutate();
    return response;
  };
  const customAliasCreater: CustomAliasCreateFn = async (address) => {
    const response = await apiFetch("/domainaddresses/", {
      method: "POST",
      body: JSON.stringify({ enabled: true, address: address }),
    });
    customAliases.mutate();
    return response;
  };

  const getUpdater: (type: "random" | "custom") => AliasUpdateFn = (type) => {
    return async (aliasData) => {
      const endpoint =
        type === "random"
          ? `/relayaddresses/${aliasData.id}/`
          : `/domainaddresses/${aliasData.id}/`;

      const response = await apiFetch(endpoint, {
        method: "PATCH",
        body: JSON.stringify(aliasData),
      });
      if (type === "random") {
        randomAliases.mutate();
      } else {
        customAliases.mutate();
      }
      return response;
    };
  };

  const getDeleter: (type: "random" | "custom") => AliasDeleteFn = (type) => {
    return async (aliasId) => {
      const endpoint =
        type === "random"
          ? `/relayaddresses/${aliasId}/`
          : `/domainaddresses/${aliasId}/`;

      const response = await apiFetch(endpoint, {
        method: "DELETE",
      });
      if (type === "random") {
        randomAliases.mutate();
      } else {
        customAliases.mutate();
      }
      return response;
    };
  };

  const randomAliasData = {
    ...randomAliases,
    data: randomAliases.data?.map((alias) => markAsRandomAlias(alias)),
    create: randomAliasCreater,
    update: getUpdater("random"),
    delete: getDeleter("random"),
  };
  const customAliasData = {
    ...customAliases,
    data: customAliases.data?.map((alias) => markAsCustomAlias(alias)),
    create: customAliasCreater,
    update: getUpdater("custom"),
    delete: getDeleter("custom"),
  };

  return {
    randomAliasData: randomAliasData,
    customAliasData: customAliasData,
  };
}

export function isRandomAlias(alias: AliasData): alias is RandomAliasData {
  return alias.type === "random";
}

export function getAllAliases(
  randomAliases: RandomAliasData[],
  customAliases: CustomAliasData[]
): AliasData[] {
  return (randomAliases as AliasData[]).concat(customAliases);
}

export function getFullAddress(alias: AliasData, profile: ProfileData) {
  if (!isRandomAlias(alias) && typeof profile.subdomain === "string") {
    return `${alias.address}@${profile.subdomain}.mozmail.com`;
  }
  if (alias.domain === (1 as Domain_RelayFirefoxCom)) {
    // 1 = @relay.firefox.com
    return `${alias.address}@relay.firefox.com`;
  }
  // 2 = @mozmail.com
  return `${alias.address}@mozmail.com`;
}

/**
 * Make an alias trackable as a random alias
 *
 * There is nothing in the properties of an alias that will always distinguish
 * random aliases from custom aliases. The only certain indication we have of
 * an alias's type, is whether we fetched it from the Random or Custom Alias
 * endpoint. Thus, we immediately tack on a `type` property after fetching
 * (using this function) so that we can pass it on to the rest of the app and
 * still determine the type of the alias.
 *
 * @param randomAliasData A random alias fetched from the API
 * @returns The same alias, but with a `type` property set to `"random"`
 */
function markAsRandomAlias(randomAliasData: RandomAliasData): RandomAliasData {
  return {
    ...randomAliasData,
    type: "random",
  };
}

/**
 * Make an alias trackable as a custom alias
 *
 * There is nothing in the properties of an alias that will always distinguish
 * random aliases from custom aliases. The only certain indication we have of
 * an alias's type, is whether we fetched it from the Random or Custom Alias
 * endpoint. Thus, we immediately tack on a `type` property after fetching
 * (using this function) so that we can pass it on to the rest of the app and
 * still determine the type of the alias.
 *
 * @param randomAliasData A custom alias fetched from the API
 * @returns The same alias, but with a `type` property set to `"custom"`
 */
function markAsCustomAlias(customAliasData: CustomAliasData): CustomAliasData {
  return {
    ...customAliasData,
    type: "custom",
  };
}
