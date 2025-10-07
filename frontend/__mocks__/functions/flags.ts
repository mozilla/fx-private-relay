import type { RuntimeData } from "frontend/src/hooks/api/types";

type FlagMap = Record<string, boolean>;
const store: FlagMap = {};

export function setFlags(next: FlagMap) {
  resetFlags();
  Object.assign(store, next);
}

export function setFlag(name: string, value: boolean) {
  store[name] = value;
}

export function resetFlags() {
  for (const k of Object.keys(store)) delete store[k];
}

export async function withFlag(
  name: string,
  value: boolean,
  fn: () => void | Promise<void>,
) {
  const prev = store.hasOwnProperty(name) ? store[name] : undefined;
  store[name] = value;
  try {
    await fn();
  } finally {
    if (prev === undefined) {
      delete store[name];
    } else {
      store[name] = prev;
    }
  }
}

export async function withFlags(
  flags: FlagMap,
  fn: () => void | Promise<void>,
) {
  const prev: Record<string, boolean | undefined> = {};
  for (const [k, v] of Object.entries(flags)) {
    prev[k] = store.hasOwnProperty(k) ? store[k] : undefined;
    store[k] = v;
  }
  try {
    await fn();
  } finally {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete store[k];
      else store[k] = v;
    }
  }
}

export const mockIsFlagActive = jest.fn(
  (_runtimeData: RuntimeData | undefined, name: string) => {
    return !!store[name];
  },
);
