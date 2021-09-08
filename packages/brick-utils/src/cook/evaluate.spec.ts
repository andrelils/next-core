import { cloneDeep } from "lodash";
import { evaluate } from "./evaluate";
import { parseEstree } from "./parse";

describe("", () => {
  it.each<
    [string, { source: string; cases: { args: unknown[]; result: unknown }[] }]
  >([
    [
      "return first argument",
      {
        source: `
          function test(a){
            return a;
          }
        `,
        cases: [
          {
            args: [1],
            result: 1,
          }
        ]
      }
    ]
  ])("%s", (desc, { source, cases }) => {
    const typescript = desc.startsWith("[TypeScript]");
    const funcDcl = parseEstree(source);
    const func = evaluate(funcDcl);
    for (const { args, result } of cases) {
      if (!typescript) {
        const equivalentFunc = new Function(
          `"use strict"; return (${source})`
        )();
        expect(equivalentFunc(...cloneDeep(args))).toEqual(result);
      }
      expect(func(...cloneDeep(args))).toEqual(result);
    }
  })
});
