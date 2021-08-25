import { feast } from "./feast";
import { prefeast } from "./prefeast";

describe("feast", () => {
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
