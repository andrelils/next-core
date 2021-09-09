import { SimpleFunction } from "@next-core/brick-types";
import { cloneDeep } from "lodash";
import { evaluate } from "./evaluate";
import { evaluateCases, NormalizedCase } from "./evaluate.case";
import { parseEstree } from "./parse";

const equivalentFunc = (source: string): SimpleFunction =>
  new Function(`"use strict"; return (${source})`)();

describe("evaluate", () => {
  it.each<NormalizedCase>(evaluateCases)("%s", (desc, { source, cases }) => {
    const typescript = desc.startsWith("[TypeScript]");
    const funcDcl = parseEstree(source);
    const func = evaluate(funcDcl);
    for (const { args, result } of cases) {
      if (!typescript) {
        expect(equivalentFunc(source)(...cloneDeep(args))).toEqual(result);
      }
      expect(func(...cloneDeep(args))).toEqual(result);
    }
  });
});
