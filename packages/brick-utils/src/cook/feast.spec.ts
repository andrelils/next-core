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

  it.each<[string, string, unknown[], unknown]>([
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
  ])("%s", (desc, source, args, result) => {
    const func = feast(prefeast(source), getGlobalVariables()) as (...args: unknown[]) => unknown;
    expect(func(...args)).toEqual(result);
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
