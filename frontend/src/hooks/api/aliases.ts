import { SWRResponse } from "swr";
import { apiFetch, useApiV1 } from "./api";

type DateTimeString = string;
type Domain_RelayFirefoxCom = 1;
type Domain_MozmailCom = 2;
export type CommonAliasData = {
  mask_type: "random" | "custom";
  enabled: boolean;
  block_list_emails: boolean;
  description: string | "";
  id: number;
  address: string;
  full_address: string;
  domain: Domain_MozmailCom | Domain_RelayFirefoxCom;
  created_at: DateTimeString;
  last_modified_at: DateTimeString;
  last_used_at: DateTimeString | null;
  num_forwarded: number;
  num_blocked: number;
  num_spam: number;
  used_on: string | "" | null;
};

export type RandomAliasData = CommonAliasData & {
  mask_type: "random";
  generated_for: string | "";
  domain: Domain_RelayFirefoxCom;
};
export type CustomAliasData = CommonAliasData & {
  mask_type: "custom";
  domain: Domain_MozmailCom;
};

export type AliasData = RandomAliasData | CustomAliasData;

export type AliasCreateFn = (
  options:
    | { mask_type: "random" }
    | { mask_type: "custom"; address: string; blockPromotionals: boolean }
) => Promise<Response>;
export type AliasUpdateFn = (
  alias: Pick<CommonAliasData, "id" | "mask_type">,
  updatedFields: Partial<AliasData>
) => Promise<Response>;
export type AliasDeleteFn = (alias: AliasData) => Promise<Response>;

/**
 * Fetch aliases (both random and custom) from our API using [SWR](https://swr.vercel.app).
 */
export function useAliases(): {
  randomAliasData: SWRResponse<RandomAliasData[], unknown>;
  customAliasData: SWRResponse<CustomAliasData[], unknown>;
  create: AliasCreateFn;
  update: AliasUpdateFn;
  delete: AliasDeleteFn;
} {
  const randomAliases: SWRResponse<RandomAliasData[], unknown> =
    useApiV1("/relayaddresses/");
  const customAliases: SWRResponse<CustomAliasData[], unknown> =
    useApiV1("/domainaddresses/");

  const randomAliasData = {
    ...randomAliases,
    data: randomAliases.data,
  };
  const customAliasData = {
    ...customAliases,
    data: customAliases.data,
  };

  const createAlias: AliasCreateFn = async (options) => {
    if (options.mask_type === "custom") {
      const body: Partial<CustomAliasData> = {
        enabled: true,
        address: options.address,
        block_list_emails: options.blockPromotionals,
      };
      const response = await apiFetch("/domainaddresses/", {
        method: "POST",
        body: JSON.stringify(body),
      });
      customAliases.mutate();
      return response;
    }

    const body: Partial<RandomAliasData> = { enabled: true };
    const response = await apiFetch("/relayaddresses/", {
      method: "POST",
      body: JSON.stringify(body),
    });
    randomAliases.mutate();
    return response;
  };

  const updateAlias: AliasUpdateFn = async (alias, updatedFields) => {
    const endpoint =
      alias.mask_type === "random"
        ? `/relayaddresses/${alias.id}/`
        : `/domainaddresses/${alias.id}/`;

    const response = await apiFetch(endpoint, {
      method: "PATCH",
      body: JSON.stringify(updatedFields),
    });
    if (alias.mask_type === "random") {
      randomAliases.mutate();
    } else {
      customAliases.mutate();
    }
    return response;
  };

  const deleteAlias: AliasDeleteFn = async (aliasData) => {
    const endpoint =
      aliasData.mask_type === "random"
        ? `/relayaddresses/${aliasData.id}/`
        : `/domainaddresses/${aliasData.id}/`;

    const response = await apiFetch(endpoint, {
      method: "DELETE",
    });
    if (aliasData.mask_type === "random") {
      randomAliases.mutate();
    } else {
      customAliases.mutate();
    }
    return response;
  };

  return {
    randomAliasData: randomAliasData,
    customAliasData: customAliasData,
    create: createAlias,
    update: updateAlias,
    delete: deleteAlias,
  };
}

export function isRandomAlias(alias: AliasData): alias is RandomAliasData {
  return alias.mask_type === "random";
}

export function getAllAliases(
  randomAliases: RandomAliasData[],
  customAliases: CustomAliasData[]
): AliasData[] {
  return (randomAliases as AliasData[]).concat(customAliases);
}

export function getFullAddress(alias: AliasData) {
  return alias.full_address;
}
