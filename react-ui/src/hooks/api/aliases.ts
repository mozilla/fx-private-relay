import { SWRResponse } from "swr";
import { apiFetch, useApiV1 } from "./api";
import { ProfileData } from "./profile";

type DateTimeString = string;
type Domain_RelayFirefoxCom = 1;
type Domain_MozmailCom = 2;
export type CommonAliasData = {
  enabled: boolean;
  description: string | "";
  id: number;
  address: string;
  domain: Domain_MozmailCom | Domain_RelayFirefoxCom;
  created_at: DateTimeString;
  last_modified_at: DateTimeString;
  last_used_at: DateTimeString;
  num_forwarded: number;
  num_blocked: number;
  num_spam: number;
};

export type RandomAliasData = CommonAliasData & {
  generated_for: string | "";
  domain: Domain_RelayFirefoxCom;
};
export type CustomAliasData = CommonAliasData & {
  domain: Domain_MozmailCom;
};

export type AliasData = RandomAliasData | CustomAliasData;

export type AliasUpdateFn = (
  id: CommonAliasData["id"],
  data: Partial<CommonAliasData>
) => Promise<void>;

type UpdateFn = (alias: Partial<AliasData> & { id: number }) => Promise<void>;
type WithUpdater = {
  update: UpdateFn;
};

export const useAliases = (): {
  randomAliasData: SWRResponse<RandomAliasData[], unknown> & WithUpdater;
  customAliasData: SWRResponse<CustomAliasData[], unknown> & WithUpdater;
} & {
  // update: AliasUpdateFn;
} => {
  const randomAliases: SWRResponse<RandomAliasData[], unknown> =
    useApiV1("/relayaddresses/");
  const customAliases: SWRResponse<CustomAliasData[], unknown> =
    useApiV1("/domainaddresses/");

  const getUpdater: (type: "random" | "custom") => UpdateFn = (type) => {
    return async (aliasData) => {
      const endpoint =
        type === "random"
          ? `/relayaddresses/${aliasData.id}/`
          : `/domainaddresses/${aliasData.id}/`;

      await apiFetch(endpoint, {
        method: "PATCH",
        body: JSON.stringify(aliasData),
      });
      if (type === "random") {
        randomAliases.mutate();
      } else {
        customAliases.mutate();
      }
    };
  };

  const randomAliasData = {
    ...randomAliases,
    update: getUpdater("random"),
  };
  const customAliasData = {
    ...customAliases,
    update: getUpdater("custom"),
  };

  return {
    randomAliasData: randomAliasData,
    customAliasData: customAliasData,
  };
};

export function isRandomAlias(alias: AliasData): alias is RandomAliasData {
  return typeof (alias as RandomAliasData).generated_for === "string";
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
