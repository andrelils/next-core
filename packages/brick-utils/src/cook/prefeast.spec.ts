import { prefeast } from "./prefeast";

const consoleWarn = jest
  .spyOn(console, "warn")
  .mockImplementation(() => void 0);

describe("prefeast", () => {
  it.skip("should parse", () => {
    const result = prefeast(
      `
        function test(a) {
          for (const h of m) {
            let k = h;
          }
        }
      `
    );
    console.log(result.function.body);
  });

  it.each<[string, string[]]>([
    [
      `
        function test(a = test) {
          let b,
            { p: c = z } = y,
            d = (w = (x = 3));
          u = v;
          s.e.f = t;
          function f(g) { return r };
          const result = test(a+b+c+d+q+p);
          [ b = n ] = o;
          for (const [h,l] of m) {
            let k = h;
          }
          return result + l + k;
        }
      `,
      [
        "z",
        "y",
        "x",
        "w",
        "v",
        "u",
        "t",
        "s",
        "r",
        "q",
        "p",
        "o",
        "n",
        "m",
        "l",
        "k",
      ],
    ],
  ])("prefeast(%j).attemptToVisitGlobals should be %j", (input, cooked) => {
    expect(Array.from(prefeast(input).attemptToVisitGlobals.values())).toEqual(
      cooked
    );
  });

  it("should warn unsupported type", () => {
    expect(
      Array.from(prefeast("this.bad").attemptToVisitGlobals.values())
    ).toEqual([]);
    expect(consoleWarn).toBeCalledTimes(1);
    expect(consoleWarn).toBeCalledWith(
      "Unsupported node type `ThisExpression`: `this`"
    );
  });
});
