import { SWRResponse } from "swr";
import { useApiV1 } from "./api";

export type ProfileData = {
    id: number;
    server_storage: boolean;
    subdomain: string | null;
};

export type ProfilesData = [ProfileData];

export const useProfile = () => {
    const profile: SWRResponse<ProfilesData, unknown> = useApiV1("/profiles/");
    return profile;
};
