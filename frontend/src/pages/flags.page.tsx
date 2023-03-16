import { FormEventHandler, useState } from "react";
import { NextPage } from "next";
import { SWRResponse } from "swr";
import styles from "./flags.module.scss";
import { Layout } from "../components/layout/Layout";
import { Button } from "../components/Button";
import { getRuntimeConfig } from "../config";
import { useRuntimeData } from "../hooks/api/runtimeData";
import { isFlagActive } from "../functions/waffle";
import { apiFetch, useApiV1 } from "../hooks/api/api";
import { BlockIcon, CheckIcon } from "../components/Icons";
import { toast } from "react-toastify";

const Flags: NextPage = () => {
  const runtimeData = useRuntimeData();
  const flagData = useFlagData();
  const [actionInput, setActionInput] = useState("");
  const [flagInput, setFlagInput] = useState("");

  if (!runtimeData.data) {
    return null;
  }

  if (!isFlagActive(runtimeData.data, "manage_flags") || flagData.error) {
    document.location.assign(getRuntimeConfig().fxaLoginUrl);
    return null;
  }

  const flags =
    flagData.data?.filter((flag) => flag.name !== "manage_flags") ?? [];

  async function createOrUpdate(flagName: string, enable: boolean) {
    const existingFlag = flagData.data?.find((flag) => flag.name === flagName);

    if (existingFlag) {
      return apiFetch(`/flags/${existingFlag.id}/`, {
        method: "PATCH",
        body: JSON.stringify({
          everyone: enable,
        }),
      });
    }

    return await apiFetch("/flags/", {
      method: "POST",
      body: JSON.stringify({
        name: flagName,
        everyone: enable,
      }),
    });
  }

  const onSubmit: FormEventHandler = async (event) => {
    event.preventDefault();

    if (!["enable", "disable"].includes(actionInput)) {
      return;
    }

    const enable = actionInput === "enable";
    const existingFlag = flags.find((flag) => flag.name === flagInput);

    if (existingFlag?.everyone === null) {
      toast(
        <>
          The flag <output>{flagInput}</output> already has a non-global value,
          and therefore cannot be {enable ? "enabled" : "disabled"} for
          everyone.
        </>,
        { type: "error" }
      );
      return;
    }

    const response = await createOrUpdate(flagInput, enable);
    flagData.mutate();
    if (response.ok) {
      toast(
        <>
          Flag <output>{flagInput}</output> {enable ? "enabled" : "disabled"}{" "}
          successfully
        </>,
        { type: "success" }
      );
      // Don't make it too easy to update multiple flags in a row
      // (to avoid making mistakes):
      setActionInput("");
      setFlagInput("");
    } else {
      toast(
        <>
          Something went wrong {enable ? "enabling" : "disabling"} flag{" "}
          <output>{flagInput}</output>
        </>,
        { type: "error" }
      );
    }
    return;
  };

  return (
    <Layout runtimeData={runtimeData.data}>
      <main className={styles.wrapper}>
        <table className={styles["flag-list"]}>
          <thead>
            <tr>
              <th>Active?</th>
              <th>Flag</th>
            </tr>
          </thead>
          <tbody>
            {flags.map((flag) => (
              <tr
                key={flag.name}
                className={
                  flag.everyone === null
                    ? styles["is-non-global"]
                    : flag.everyone
                    ? styles["is-active"]
                    : styles["is-inactive"]
                }
              >
                <td>
                  {flag.everyone ? (
                    <CheckIcon alt="Active" />
                  ) : (
                    <BlockIcon alt="Inactive" />
                  )}
                </td>
                <td>{flag.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <form onSubmit={onSubmit} className={styles["flag-form"]}>
          <p>
            To avoid accidentally enabling/disabling the wrong flags, you have
            to type out explicitly what action to take.
          </p>
          <div className={styles.field}>
            <label htmlFor="action">Which flag do you want to modify?</label>
            <input
              type="text"
              id="action"
              autoComplete="off"
              pattern="(?!manage_flags)(.*)"
              required={true}
              placeholder={`e.g. \`${flags[0]?.name}\``}
              value={flagInput}
              onChange={(e) => setFlagInput(e.target.value)}
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="action">
              Do you want to <output>enable</output> or <output>disable</output>{" "}
              it?
            </label>
            <input
              type="text"
              id="action"
              autoComplete="off"
              pattern="enable|disable"
              required={true}
              placeholder="`enable` or `disable`"
              value={actionInput}
              onChange={(e) => setActionInput(e.target.value)}
            />
          </div>
          <Button type="submit">Set flag status</Button>
        </form>
      </main>
    </Layout>
  );
};

type Flag = { id: number; name: string; everyone: boolean; note: string };
function useFlagData() {
  const flagData: SWRResponse<Flag[], unknown> = useApiV1("/flags/");
  return flagData;
}

export default Flags;
