import { LooseCase } from "../interfaces";

export const casesOfForInLoops: LooseCase[] = [
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
      args: [{ v: 1 }],
      result: "v",
    },
  ],
];
