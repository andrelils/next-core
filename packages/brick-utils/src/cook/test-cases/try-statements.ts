import { LooseCase } from "./interfaces";

export const casesOfTryStatements: LooseCase[] = [
  [
    "try ... catch ... finally",
    {
      source: `
        function test() {
          let a = 1, b, c;
          try {
            b = 'yep';
            a();
            b = 'nope';
          } catch (e) {
            a = e.toString();
          } finally {
            c = a + ':' + b;
          }
          return c;
        }
      `,
      args: [],
      result: "TypeError: a is not a function:yep",
    },
  ],
  [
    "throw and catch",
    {
      source: `
        function test() {
          let a = 'yes';
          try {
            throw 'oops';
          } catch (e) {
            a = 'Error: ' + e;
          }
          return a;
        }
      `,
      args: [],
      result: "Error: oops",
    },
  ],
];
