/** @jest-environment node */

import React from "react";
import { renderToString } from "react-dom/server";
import { useRuntimeData } from "./runtimeData";

// Mock transport so SSR sees "no data yet".
jest.mock("./api", () => ({
  useApiV1: jest.fn(() => ({ data: undefined })),
}));

function Probe() {
  const { data } = useRuntimeData();
  // On SSR, data MUST remain undefined (no client fallback)
  return <div data-has={data ? "yes" : "no"} />;
}

describe("useRuntimeData SSR", () => {
  it("does NOT supply DEFAULT_RUNTIME_DATA on the server", () => {
    expect(renderToString(<Probe />)).toContain('data-has="no"');
  });
});
