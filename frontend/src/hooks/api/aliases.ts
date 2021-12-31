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
  last_used_at: DateTimeString | null;
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

export type RandomAliasCreateFn = () => Promise<void>;
export type CustomAliasCreateFn = (address: string) => Promise<void>;
export type AliasUpdateFn = (alias: Partial<AliasData> & { id: number }) => Promise<void>;
export type AliasDeleteFn = (id: number) => Promise<void>;
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

export function useAliases(): {
  randomAliasData: SWRResponse<RandomAliasData[], unknown> & WithRandomAliasCreater & WithUpdater & WithDeleter;
  customAliasData: SWRResponse<CustomAliasData[], unknown> & WithCustomAliasCreater & WithUpdater & WithDeleter;
} {
  const randomAliases: SWRResponse<RandomAliasData[], unknown> =
    useApiV1("/relayaddresses/");
  const customAliases: SWRResponse<CustomAliasData[], unknown> =
    useApiV1("/domainaddresses/");

  const randomAliasCreater: RandomAliasCreateFn = async () => {
    await apiFetch("/relayaddresses/", {
      method: "POST",
      body: JSON.stringify({ enabled: true }),
    });
    randomAliases.mutate();
  }
  const customAliasCreater: CustomAliasCreateFn = async (address) => {
    await apiFetch("/domainaddresses/", {
      method: "POST",
      body: JSON.stringify({ enabled: true, address: address }),
    });
    customAliases.mutate();
  }

  const getUpdater: (type: "random" | "custom") => AliasUpdateFn = (type) => {
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

  const getDeleter: (type: "random" | "custom") => AliasDeleteFn = (type) => {
    return async (aliasId) => {
      const endpoint =
        type === "random"
          ? `/relayaddresses/${aliasId}/`
          : `/domainaddresses/${aliasId}/`;

      await apiFetch(endpoint, {
        method: "DELETE",
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
    create: randomAliasCreater,
    update: getUpdater("random"),
    delete: getDeleter("random"),
  };
  const customAliasData = {
    ...customAliases,
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
