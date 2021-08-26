import { feast } from "./feast";
import { prefeast } from "./prefeast";

describe("feast", () => {
  const getGlobalVariables = (): Record<string, any> => ({
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
    },
    APP: {
      homepage: "/hello/world",
    },
  });

  it.each<[desc: string, source: string, args: unknown[], result: unknown]>([
    [
      "lexical variables in block statement",
      `
        function test(a) {
          {
            let a;
            a = 9;
          }
          return a;
        }
      `,
      [1],
      1,
    ],
    [
      "lexical variables in block statement of if",
      `
        function test(a) {
          if (true) {
            let a;
            a = 9;
          }
          return a;
        }
      `,
      [1],
      1,
    ],
    [
      "lexical variables in block statement of switch",
      `
        function test(a) {
          switch (true) {
            case true:
              let a;
              a = 9;
          }
          return a;
        }
      `,
      [1],
      1,
    ],
    [
      "update param variables in block statement",
      `
        function test(a) {
          {
            a = 9;
          }
          return a;
        }
      `,
      [1],
      9,
    ],
    [
      "update lexical variables in block statement",
      `
        function test(a) {
          let b = a;
          {
            b = 9;
          }
          return b;
        }
      `,
      [1],
      9,
    ],
  ])("%s", (desc, source, args, result) => {
    const func = feast(prefeast(source), getGlobalVariables()) as (...args: unknown[]) => unknown;
    const equivalentFunc = new Function(`"use strict"; return ${source.trim()}`)();
    expect(equivalentFunc(...args)).toEqual(result);
    expect(func(...args)).toEqual(result);
  });

  it.each<[desc: string, source: string, pairs: [args: unknown[], result: unknown][]]>([
    [
      "switch statements: general",
      `
        function test(a) {
          let b;
          switch(a) {
            case 1:
              b = "A";
              break;
            case 2:
              b = "B";
              break;
            case 9:
              b = "X";
              return "Z";
            default:
              b = "C";
          }
          return b;
        }
      `,
      [
        [
          [1],
          "A",
        ],
        [
          [2],
          "B",
        ],
        [
          [3],
          "C",
        ],
        [
          [9],
          "Z",
        ],
      ]
    ],
    [
      "switch statements: missing a break",
      `
        function test(a) {
          let b = "";
          switch(a) {
            case 1:
              b += "A";
            case 2:
              b += "B";
              break;
            default:
              b = "C";
          }
          return b;
        }
      `,
      [
        [
          [1],
          "AB",
        ],
        [
          [2],
          "B",
        ],
        [
          [3],
          "C",
        ],
      ]
    ],
    [
      "switch statements: missing a break before default",
      `
        function test(a) {
          let b = "";
          switch(a) {
            case 1:
              b += "A";
              break;
            case 2:
              b += "B";
            default:
              b += "C";
          }
          return b;
        }
      `,
      [
        [
          [1],
          "A",
        ],
        [
          [2],
          "BC",
        ],
        [
          [3],
          "C",
        ],
      ]
    ],
    [
      "if statements",
      `
        function test(a) {
          if (a === 1) {
            return "A";
          } else if (a === 2) {
            return "B";
          } else {
            return "C";
          }
        }
      `,
      [
        [
          [1],
          "A",
        ],
        [
          [2],
          "B",
        ],
        [
          [3],
          "C",
        ],
      ]
    ],
    [
      "object destructuring",
      `
        function test(a, { r: d, ...e } = {}, ...f) {
          const { x: b = 9, ...c } = a;
          return {
            b,
            c,
            d,
            e,
            f
          };
        }
      `,
      [
        [
          [{ x: 1, y: 2, z: 3 }, { r: 4, s: 5, t: 6}, 7, 8],
          {
            b: 1,
            c: { y: 2, z: 3 },
            d: 4,
            e: { s: 5, t: 6 },
            f: [7, 8],
          },
        ],
        [
          [{ y: 2, z: 3 }],
          {
            b: 9,
            c: { y: 2, z: 3 },
            d: undefined,
            e: {},
            f: [],
          },
        ],
      ]
    ],
    [
      "array destructuring",
      `
        function test(a, [d, ...e] = []) {
          const [ b = 9, ...c ] = a;
          return [ 0, ...c, b, d, e];
        }
      `,
      [
        [
          [[1, 2, 3], [4, 5, 6]],
          [0, 2, 3, 1, 4, [5, 6]],
        ],
        [
          [[undefined, 2, 3]],
          [0, 2, 3, 9, undefined, []],
        ],
      ]
    ],
    [
      "recursive",
      `
        function test(a) {
          return a + (a > 1 ? test(a - 1) : 0);
        }
      `,
      [
        [
          [2],
          3
        ],
        [
          [3],
          6
        ]
      ]
    ],
    [
      "var variables overload param variables",
      `
        function test(a) {
          var a = 2;
          return a;
        }
      `,
      [
        [
          [1],
          2
        ],
      ]
    ],
    [
      "functions overload params variables",
      `
        function test(a) {
          function a() {}
          return typeof a;
        }
      `,
      [
        [
          [1],
          "function"
        ],
      ]
    ],
    [
      "functions hoist in block statements",
      `
        function test() {
          if (false) {
            function a() {}
          }
          return typeof a;
        }
      `,
      [
        [
          [],
          "undefined"
        ],
      ]
    ],
    [
      "var variables hoist in block statements",
      `
        function test() {
          var b = typeof a;
          if (false) {
            var a;
          }
          return b;
        }
      `,
      [
        [
          [],
          "undefined"
        ],
      ]
    ],
    [
      "functions after var variables initialized",
      `
        function test(a) {
          var a = "A";
          function a() {}
          return typeof a;
        }
      `,
      [
        [
          [1],
          "string"
        ],
      ]
    ],
    [
      "functions after var variables uninitialized",
      `
        function test(a) {
          var a;
          function a() {}
          return typeof a;
        }
      `,
      [
        [
          [1],
          "function"
        ],
      ]
    ],
    [
      "functions before var variables initialized",
      `
        function test(a) {
          function a() {}
          var a = "A";
          return typeof a;
        }
      `,
      [
        [
          [1],
          "string"
        ],
      ]
    ],
    [
      "functions before var variables uninitialized",
      `
        function test(a) {
          function a() {}
          var a;
          return typeof a;
        }
      `,
      [
        [
          [1],
          "function"
        ],
      ]
    ],
  ])("%s", (desc, source, pairs) => {
    const func = feast(prefeast(source), getGlobalVariables()) as (...args: unknown[]) => unknown;
    for (const [args, result] of pairs) {
      const equivalentFunc = new Function(`"use strict"; return ${source.trim()}`)();
      expect(equivalentFunc(...args)).toEqual(result);
      expect(func(...args)).toEqual(result);
    }
  });

  it.each<[desc: string, source: string, inputs: unknown[][]]>([
    [
      "assign constants",
      `
        function test(){
          const a = 1;
          a = 2;
        }
      `,
      [[]],
    ],
    [
      "assign global functions",
      `
        function test(){
          test = 1;
        }
      `,
      [[]],
    ],
    [
      "assign function expressions",
      `
        function test(){
          (function f(){
            f = 1;
          })();
        }
      `,
      [[]],
    ],
  ])("%s should throw", (desc, source, inputs) => {
    const func = feast(prefeast(source), getGlobalVariables()) as (...args: unknown[]) => unknown;
    for (const args of inputs) {
      const equivalentFunc = new Function(`"use strict"; return ${source.trim()}`)();
      expect(() => equivalentFunc(...args)).toThrowError();
      expect(() => func(...args)).toThrowErrorMatchingSnapshot();
    }
  });

  it("should work", () => {
    const myTestFunc = feast(
      prefeast([
        'function myTestFunc(greeting = typeof myTestFunc, exclamation, heyCount) {',
        '  console.log("start");',
        '  let z = "_";',
        '  [z="y"] = heyCount.array;',
        '  console.log(z);',
        // '  let z = "y";',
        '  heyCount[z] = 2;',
        '  let { y: x = 0 } = heyCount;',
        '  x += 1;',
        '  switch(x) {',
        '    case 2:',
        '      console.log("Hey, ");',
        '    case 1:',
        '      console.log("Hey, ");',
        '      return "terminated";',
        '    case 3: {',
        '      console.log("Hey*3, ");',
        '      break;',
        '    }',
        '    default:',
        '      console.log("Hey*N, ");',
        '  }',
        '  if (exclamation) {',
        '    return `${greeting} ${DATA.name}!`;',
        '  } else {',
        '    return `${greeting} ${DATA.name}`;',
        '  }',
        '  console.log("never should be reached");',
        '}'
      ].join("\n")),
      {
        DATA: {
          name: "world",
        },
        console: {
          log: console.log,
        }
      }
    ) as (...args: unknown[]) => unknown;
    console.log(myTestFunc(null, false, {z: 100, array: []}));
  });
});
