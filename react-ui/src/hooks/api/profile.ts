import { SWRResponse } from "swr";
import { useApiV1 } from "./api";

export type ProfileData = {
    id: number;
    server_storage: boolean;
    has_premium: boolean;
    subdomain: string | null;
};

export type ProfilesData = [ProfileData];

export const useProfiles = () => {
    const profiles: SWRResponse<ProfilesData, unknown> = useApiV1("/profiles/");
    return profiles;
};
