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
          },
        ],
      },
    ],
    [
      "for of loop",
      {
        source: `
          function test(a){
            for (const x of a) {
              return x;
            }
            return 'last';
          }
        `,
        cases: [
          {
            args: [[1]],
            result: 1,
          },
        ],
      },
    ],
    [
      "for of loop: break",
      {
        source: `
          function test(a){
            for (const x of a) {
              break;
              return 'after break';
            }
            return 'last';
          }
        `,
        cases: [
          {
            args: [[1]],
            result: "last",
          },
        ],
      },
    ],
    [
      "for of loop: continue",
      {
        source: `
          function test(a){
            for (const x of a) {
              continue;
              return 'after break';
            }
            return 'last';
          }
        `,
        cases: [
          {
            args: [[1]],
            result: "last",
          },
        ],
      },
    ],
    [
      "for of loop: iterate destructure as lexical binding",
      {
        source: `
          function test(a){
            for (const [x,,[y,...z]] of a) {
              return [x,,y,z,,];
            }
          }
        `,
        cases: [
          {
            args: [[[0, 1, [2, 3, 4]]]],
            // eslint-disable-next-line no-sparse-arrays
            result: [0, , 2, [3, 4], ,],
          },
        ],
      },
    ],
    [
      "for of loop: iterate destructure as lexical binding with init",
      {
        source: `
          function test(a){
            for (const [x,,[y,...z]=[2,3,4]] of a) {
              return [x,y,z];
            }
          }
        `,
        cases: [
          {
            args: [[[0, 1]]],
            result: [0, 2, [3, 4]],
          },
        ],
      },
    ],
    [
      "for of loop: iterate destructure as var binding",
      {
        source: `
          function test(a){
            for (var [x,,[y,...z]] of a) {
              return [x,,y,z,,];
            }
          }
        `,
        cases: [
          {
            args: [[[0, 1, [2, 3, 4]]]],
            // eslint-disable-next-line no-sparse-arrays
            result: [0, , 2, [3, 4], ,],
          },
        ],
      },
    ],
    [
      "for of loop: iterate destructure as var binding with init",
      {
        source: `
          function test(a){
            for (var [x,,[y,...z]=[2,3,4]] of a) {
              return [x,y,z];
            }
          }
        `,
        cases: [
          {
            args: [[[0, 1]]],
            result: [0, 2, [3, 4]],
          },
        ],
      },
    ],
    [
      "for of loop: iterate destructure as assignment to var declarations",
      {
        source: `
          function test(a){
            var x, y, z;
            for ([x,,[y,...z]] of a) {
              return [x,,y,z,,];
            }
          }
        `,
        cases: [
          {
            args: [[[0, 1, [2, 3, 4]]]],
            // eslint-disable-next-line no-sparse-arrays
            result: [0, , 2, [3, 4], ,],
          },
        ],
      },
    ],
    [
      "for of loop: iterate destructure as assignment to var declarations with init",
      {
        source: `
          function test(a){
            var x, y, z;
            for ([x,,[y,...z]=[2,3,4]] of a) {
              return [x,y,z];
            }
          }
        `,
        cases: [
          {
            args: [[[0, 1]]],
            result: [0, 2, [3, 4]],
          },
        ],
      },
    ],
    [
      "for of loop: iterate destructure as assignment to lexical declarations",
      {
        source: `
          function test(a){
            let x, y, z;
            for ([x,,[y,...z]] of a) {
              return [x,,y,z,,];
            }
          }
        `,
        cases: [
          {
            args: [[[0, 1, [2, 3, 4]]]],
            // eslint-disable-next-line no-sparse-arrays
            result: [0, , 2, [3, 4], ,],
          },
        ],
      },
    ],
    [
      "for of loop: enumerate destructure",
      {
        source: `
          function test(a){
            for (const {b,c:d,e:{f:g}} of a) {
              return [b,d,g];
            }
          }
        `,
        cases: [
          {
            args: [[{ b: 1, c: 2, e: { f: 3 } }]],
            result: [1, 2, 3],
          },
        ],
      },
    ],
    [
      "for of loop: enumerate destructure with init",
      {
        source: `
          function test(a){
            for (const {b=1,c:d=2,e:{f:g=3}={}} of a) {
              return [b,d,g];
            }
          }
        `,
        cases: [
          {
            args: [[{}]],
            result: [1, 2, 3],
          },
        ],
      },
    ],
    [
      "for in loop",
      {
        source: `
          function test(a){
            for (const k in a) {
              return k;
            }
          }
        `,
        cases: [
          {
            args: [{ v: 1 }],
            result: "v",
          },
        ],
      },
    ],
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
  });
});
