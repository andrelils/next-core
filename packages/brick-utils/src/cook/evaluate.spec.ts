import { install, InstalledClock } from "lolex";
import { SimpleFunction } from "@next-core/brick-types";
import { cloneDeep } from "lodash";
import { analysis } from "./analysis";
import { evaluate } from "./evaluate";
import { positiveCases, NormalizedCase, negativeCases } from "./evaluate.case";
import { parseEstree } from "./parse";
import { fulfilGlobalVariables } from "./supply";

jest.spyOn(console, "warn").mockImplementation(() => void 0);

const getExtraGlobalVariables = (): Record<string, unknown> => ({
  DATA: {
    for: "good",
    null: null,
    undefined: undefined,
    true: true,
    false: false,
    number5: 5,
    objectA: {
      onlyInA: 1,
      bothInAB: 2,
    },
    objectB: {
      onlyInB: 3,
      bothInAB: 4,
    },
    q: "a&b",
    redirect: "/r/s?t=u&v=w",
    path: "x/y.zip",
    fnReturnThisFor() {
      return (this as any).for;
    },
  },
  APP: {
    homepage: "/hello/world",
  },
});

const equivalentFunc = (
  source: string,
  attemptToVisitGlobals: Set<string>
): SimpleFunction => {
  const globalVariables = fulfilGlobalVariables(
    attemptToVisitGlobals,
    getExtraGlobalVariables()
  );
  return new Function(
    ...globalVariables.keys(),
    `"use strict"; return (${source})`
  )(...globalVariables.values());
};

describe("evaluate", () => {
  let clock: InstalledClock;
  beforeEach(() => {
    clock = install({ now: +new Date("2020-03-25 17:37:00") });
  });
  afterEach(() => {
    clock.uninstall();
  });

  it
    // .only
    .each<NormalizedCase>(
      positiveCases
      // .filter(item => item[0] ===
      //   // "array destructuring"
      //   // "iterator destructuring assignment"
      //   // "expression: TAG_URL`${APP.homepage}/list?q=${DATA.q}&redirect=${DATA.redirect}`"
      //   "expression: new Array(1, ...[2, 3])"
      // )
    )("%s", (desc, { source, cases }) => {
    const typescript = desc.startsWith("[TypeScript]");
    const funcDcl = parseEstree(source, { typescript });
    const attemptToVisitGlobals = analysis(funcDcl);
    const func = evaluate(
      funcDcl,
      source,
      attemptToVisitGlobals,
      getExtraGlobalVariables()
    );
    for (const { args, result } of cases) {
      if (!typescript && !/\|>/.test(source)) {
        expect(
          equivalentFunc(source, attemptToVisitGlobals)(...cloneDeep(args))
        ).toEqual(result);
      }
      expect(func(...cloneDeep(args))).toEqual(result);
    }
  });

  it.each<NormalizedCase>(negativeCases)(
    "Should throw: %s",
    (desc, { source, cases }) => {
      const typescript = desc.startsWith("[TypeScript]");
      const funcDcl = parseEstree(source, { typescript });
      const attemptToVisitGlobals = analysis(funcDcl);
      const func = evaluate(
        funcDcl,
        source,
        attemptToVisitGlobals,
        getExtraGlobalVariables()
      );
      for (const { args } of cases) {
        if (!typescript && !/\|>/.test(source)) {
          expect(() =>
            equivalentFunc(source, attemptToVisitGlobals)(...cloneDeep(args))
          ).toThrowError();
        }
        expect(() => func(...cloneDeep(args))).toThrowErrorMatchingSnapshot();
      }
    }
  );
});
