import { describe, it, expect } from "vitest";
import { loadLevel } from "../src/levels/loader";
import tinyurlJson from "../src/levels/definitions/tinyurl-1.json";

/* Guards the level DSL contract: "a level that can't drive a sim is a content bug",
   so loadLevel must reject malformed content at load time — especially the
   failureInjections union, which drives the disaster schedule. */

const base = {
  id: "t",
  stage: 1,
  title: "t",
  story: "",
  traffic: { profile: "steady", ratePerMin: 120, readWriteRatio: 0.9 },
  allowedComponents: ["client", "api-gateway", "sql-db"],
  winConditions: { steady: {}, scenarios: [], resilience: [] },
  concepts: [],
};
const withInjections = (injections: unknown[]) => ({ ...base, failureInjections: injections });

describe("loadLevel — shipped content", () => {
  it("parses the tinyurl-1 definition", () => {
    expect(loadLevel(tinyurlJson).id).toBe("tinyurl-1");
  });

  it("defaults failureInjections to an empty array when omitted", () => {
    expect(loadLevel(base).failureInjections).toEqual([]);
  });
});

describe("loadLevel — failureInjections validation", () => {
  it("accepts each well-formed injection kind", () => {
    const injections = [
      { kind: "spike", atSecond: 10, durationSec: 5, multiplier: 3 },
      { kind: "node-down", atSecond: 20, durationSec: 8, nodeType: "sql-db" },
      { kind: "latency-spike", atSecond: 30, durationSec: 4, addMs: 200 },
    ];
    expect(loadLevel(withInjections(injections)).failureInjections).toEqual(injections);
  });

  it("rejects an unknown injection kind", () => {
    expect(() => loadLevel(withInjections([{ kind: "meltdown", atSecond: 0, durationSec: 5 }]))).toThrow();
  });

  it("rejects a spike missing its multiplier", () => {
    expect(() => loadLevel(withInjections([{ kind: "spike", atSecond: 0, durationSec: 5 }]))).toThrow();
  });

  it("rejects a node-down with an empty nodeType", () => {
    expect(() => loadLevel(withInjections([{ kind: "node-down", atSecond: 0, durationSec: 5, nodeType: "" }]))).toThrow();
  });

  it("rejects a non-positive durationSec (window that never activates)", () => {
    expect(() => loadLevel(withInjections([{ kind: "latency-spike", atSecond: 0, durationSec: 0, addMs: 50 }]))).toThrow();
  });
});
