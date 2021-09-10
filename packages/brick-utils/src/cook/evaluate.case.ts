export type NormalizedCase = [string, MultipleCasePairs];

type LooseCase = [string, SingleCasePair | MultipleCasePairs];

interface SingleCasePair extends CasePair {
  source: string;
}

interface MultipleCasePairs {
  source: string;
  cases: CasePair[];
}

interface CasePair {
  args: unknown[];
  result?: unknown;
}

const casesOfForOfLoops: LooseCase[] = [
  [
    "for of loop: if/else/break/continue/return",
    {
      source: `
        function test(a, p = []){
          for (const x of a) {
            p.push(0);
            if (x === 0) {
              p.push(1);
              continue;
              p.push(2);
            }
            p.push(3);
            if (x === 1)
              continue;
            p.push(4);
            if (x === 2) {
              p.push(5);
              break;
              p.push(6);
            }
            p.push(7);
            if (x === 3)
              return p;
            p.push(8);
            if (x === 4) {
              p.push(9);
              return p;
              p.push(10);
            } else if (x===5) {
              p.push(11);
            } else {
              p.push(13);
            }
            p.push(14);
          }
          p.push(15);
          return p;
          p.push(16);
        }
      `,
      cases: [
        {
          args: [[0, 1, 2, 3, 4]],
          result: [0, 1, 0, 3, 0, 3, 4, 5, 15],
        },
        {
          args: [[3, 4, 5]],
          result: [0, 3, 4, 7],
        },
        {
          args: [[4, 5]],
          result: [0, 3, 4, 7, 8, 9],
        },
        {
          args: [[5, 6]],
          result: [0, 3, 4, 7, 8, 11, 14, 0, 3, 4, 7, 8, 13, 14, 15],
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
      args: [[1]],
      result: "last",
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
      args: [[1]],
      result: "last",
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
      args: [[[0, 1, [2, 3, 4]]]],
      // eslint-disable-next-line no-sparse-arrays
      result: [0, , 2, [3, 4], ,],
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
      args: [[[0, 1]]],
      result: [0, 2, [3, 4]],
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
      args: [[[0, 1, [2, 3, 4]]]],
      // eslint-disable-next-line no-sparse-arrays
      result: [0, , 2, [3, 4], ,],
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
      args: [[[0, 1]]],
      result: [0, 2, [3, 4]],
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
      args: [[[0, 1, [2, 3, 4]]]],
      // eslint-disable-next-line no-sparse-arrays
      result: [0, , 2, [3, 4], ,],
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
      args: [[[0, 1]]],
      result: [0, 2, [3, 4]],
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
      args: [[[0, 1, [2, 3, 4]]]],
      // eslint-disable-next-line no-sparse-arrays
      result: [0, , 2, [3, 4], ,],
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
      args: [[{ b: 1, c: 2, e: { f: 3 } }]],
      result: [1, 2, 3],
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
      args: [[{}]],
      result: [1, 2, 3],
    },
  ],
];

const casesOfForInLoops: LooseCase[] = [
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

const casesOfSwitchStatements: LooseCase[] = [
  [
    "switch statements: case after default",
    {
      source: `
        function test(a) {
          let b = '';
          switch(a) {
            case 1:
              b += 'A';
              break;
            default:
              b += 'C';
            case 2:
              b += 'B';
            case 4:
              b += 'D';
              break;
            case 5:
              b += 'E';
          }
          return b;
        }
      `,
      cases: [
        {
          args: [1],
          result: "A",
        },
        {
          args: [2],
          result: "BD",
        },
        {
          args: [3],
          result: "CBD",
        },
        {
          args: [4],
          result: "D",
        },
        {
          args: [5],
          result: "E",
        },
      ],
    },
  ],
];

const casesOfWhileStatements: LooseCase[] = [
  [
    "while ...",
    {
      source: `
        function test() {
          let total = 0;
          while (total <= 2) {
            total += 1;
          }
          return total;
        }
      `,
      args: [],
      result: 3,
    },
  ],
  [
    "while ... false",
    {
      source: `
        function test() {
          let total = 0;
          while (false) {
            total += 1;
          }
          return total;
        }
      `,
      args: [],
      result: 0,
    },
  ],
  [
    "while ...: break",
    {
      source: `
        function test() {
          let total = 0;
          while (true) {
            total += 1;
            if (total >= 2) {
              break;
            }
          }
          return total;
        }
      `,
      args: [],
      result: 2,
    },
  ],
  [
    "while ...: continue",
    {
      source: `
        function test() {
          let total = 0;
          while (total < 2) {
            if (total >= 2) {
              continue;
            }
            total += 1;
          }
          return total;
        }
      `,
      args: [],
      result: 2,
    },
  ],
  [
    "do ... while",
    {
      source: `
        function test() {
          let total = 0;
          do {
            total += 1;
          } while (total <= 2);
          return total;
        }
      `,
      args: [],
      result: 3,
    },
  ],
  [
    "do ... while false",
    {
      source: `
        function test() {
          let total = 0;
          do {
            total += 1;
          } while (false);
          return total;
        }
      `,
      args: [],
      result: 1,
    },
  ],
  [
    "do ... while: break",
    {
      source: `
        function test() {
          let total = 0;
          do {
            total += 1;
            if (total >= 2) {
              break;
            }
          } while (true);
          return total;
        }
      `,
      args: [],
      result: 2,
    },
  ],
  [
    "do ... while: continue",
    {
      source: `
        function test() {
          let total = 0;
          do {
            if (total >= 2) {
              continue;
            }
            total += 1;
          } while (total < 2);
          return total;
        }
      `,
      args: [],
      result: 2,
    },
  ],
];

const casesOfTryStatements: LooseCase[] = [
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

const casesOfMigrated: LooseCase[] = [
  [
    "lexical variables in block statement",
    {
      source: `
        function test(a) {
          {
            let a;
            a = 9;
          }
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
    "lexical variables in block statement of if",
    {
      source: `
        function test(a) {
          if (true) {
            let a;
            a = 9;
          }
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
    "lexical variables in block statement of switch",
    {
      source: `
        function test(a) {
          switch (true) {
            case true:
              let a;
              a = 9;
          }
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
    "update param variables in block statement",
    {
      source: `
        function test(a) {
          {
            a = 9;
          }
          return a;
        }
      `,
      cases: [
        {
          args: [1],
          result: 9,
        },
      ],
    },
  ],
  [
    "update lexical variables in block statement",
    {
      source: `
        function test(a) {
          let b = a;
          {
            b = 9;
          }
          return b;
        }
      `,
      cases: [
        {
          args: [1],
          result: 9,
        },
      ],
    },
  ],
  [
    "switch statements: general",
    {
      source: `
        function test(a) {
          let b;
          switch(a) {
            case 1:
              b = 'A';
              break;
            case 2:
              b = 'B';
              break;
            case 9:
              b = 'X';
              return 'Z';
            default:
              b = 'C';
          }
          return b;
        }
      `,
      cases: [
        {
          args: [1],
          result: "A",
        },
        {
          args: [2],
          result: "B",
        },
        {
          args: [3],
          result: "C",
        },
        {
          args: [9],
          result: "Z",
        },
      ],
    },
  ],
  [
    "switch statements: missing a break",
    {
      source: `
        function test(a) {
          let b = '';
          switch(a) {
            case 1:
              b += 'A';
            case 2:
              b += 'B';
              break;
            default:
              b = 'C';
          }
          return b;
        }
      `,
      cases: [
        {
          args: [1],
          result: "AB",
        },
        {
          args: [2],
          result: "B",
        },
        {
          args: [3],
          result: "C",
        },
      ],
    },
  ],
  [
    "switch statements: missing a break before default",
    {
      source: `
        function test(a) {
          let b = '';
          switch(a) {
            case 1:
              b += 'A';
              break;
            case 2:
              b += 'B';
            default:
              b += 'C';
          }
          return b;
        }
      `,
      cases: [
        {
          args: [1],
          result: "A",
        },
        {
          args: [2],
          result: "BC",
        },
        {
          args: [3],
          result: "C",
        },
      ],
    },
  ],
  [
    "switch statements: case after default",
    {
      source: `
        function test(a) {
          let b = '';
          switch(a) {
            case 1:
              b += 'A';
              break;
            default:
              b += 'C';
            case 2:
              b += 'B';
            case 4:
              b += 'D';
              break;
            case 5:
              b += 'E';
          }
          return b;
        }
      `,
      cases: [
        {
          args: [1],
          result: "A",
        },
        {
          args: [2],
          result: "BD",
        },
        {
          args: [3],
          result: "CBD",
        },
        {
          args: [4],
          result: "D",
        },
        {
          args: [5],
          result: "E",
        },
      ],
    },
  ],
  [
    "switch statements: case after default, and mutate discriminant",
    {
      source: `
      function test(a) {
        a.c = [];
        switch(a.b) {
          case 1:
            a.c.push('case 1');
            break;
          default:
            a.c.push('default');
            a.b = 2;
          case 2:
            a.c.push('case 2');
            a.b = 3;
        }
        return a;
      }
      `,
      cases: [
        {
          args: [{ b: 1 }],
          result: { b: 1, c: ["case 1"] },
        },
        {
          args: [{ b: 2 }],
          result: { b: 3, c: ["case 2"] },
        },
        {
          args: [{ b: 3 }],
          result: { b: 3, c: ["default", "case 2"] },
        },
      ],
    },
  ],
  [
    "switch statements: in for …",
    {
      source: `
      function test() {
        let total = 0;
        for (const i of [1, 2, 3]) {
          switch (i) {
            case 1:
              break;
            case 2:
              continue;
            default:
              break;
          }
          total += i;
        }
        return total;
      }
      `,
      cases: [
        {
          args: [],
          result: 4,
        },
      ],
    },
  ],
  [
    "if statements",
    {
      source: `
        function test(a) {
          if (a === 1) {
            return 'A';
          } else if (a === 2) {
            return 'B';
          } else if (a === 3) {
            return;
          } else {
            return 'C';
          }
        }
      `,
      cases: [
        {
          args: [1],
          result: "A",
        },
        {
          args: [2],
          result: "B",
        },
        {
          args: [3],
          result: undefined,
        },
        {
          args: [4],
          result: "C",
        },
      ],
    },
  ],
  [
    "object destructuring",
    {
      source: `
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
      cases: [
        {
          args: [
            {
              x: 1,
              y: 2,
              z: 3,
            },
            {
              r: 4,
              s: 5,
              t: 6,
            },
            7,
            8,
          ],
          result: {
            b: 1,
            c: {
              y: 2,
              z: 3,
            },
            d: 4,
            e: {
              s: 5,
              t: 6,
            },
            f: [7, 8],
          },
        },
        {
          args: [
            {
              y: 2,
              z: 3,
            },
          ],
          result: {
            b: 9,
            c: {
              y: 2,
              z: 3,
            },
            d: undefined,
            e: {},
            f: [],
          },
        },
      ],
    },
  ],
  [
    "array destructuring",
    {
      source: `
        function test(a, [d, ...e] = []) {
          const [ b = 9, ...c ] = a;
          return [ 0, ...c, b, d, e];
        }
      `,
      cases: [
        {
          args: [
            [1, 2, 3],
            [4, 5, 6],
          ],
          result: [0, 2, 3, 1, 4, [5, 6]],
        },
        {
          args: [[undefined, 2, 3]],
          result: [0, 2, 3, 9, undefined, []],
        },
      ],
    },
  ],
  [
    "recursive",
    {
      source: `
        function test(a) {
          return a + (a > 1 ? test(a - 1) : 0);
        }
      `,
      cases: [
        {
          args: [2],
          result: 3,
        },
        {
          args: [3],
          result: 6,
        },
      ],
    },
  ],
  [
    "var variables overload param variables",
    {
      source: `
        function test(a) {
          var a = 2;
          return a;
        }
      `,
      cases: [
        {
          args: [1],
          result: 2,
        },
      ],
    },
  ],
  [
    "functions overload params variables",
    {
      source: `
        function test(a) {
          function a() {}
          return typeof a;
        }
      `,
      cases: [
        {
          args: [1],
          result: "function",
        },
      ],
    },
  ],
  [
    "var variables hoist in block statements",
    {
      source: `
        function test() {
          var b = typeof a;
          if (false) {
            var a;
          }
          return b;
        }
      `,
      cases: [
        {
          args: [],
          result: "undefined",
        },
      ],
    },
  ],
  [
    "functions after var variables initialized",
    {
      source: `
        function test(a) {
          var a = 'A';
          function a() {}
          return typeof a;
        }
      `,
      cases: [
        {
          args: [1],
          result: "string",
        },
      ],
    },
  ],
  [
    "functions after var variables uninitialized",
    {
      source: `
        function test(a) {
          var a;
          function a() {}
          return typeof a;
        }
      `,
      cases: [
        {
          args: [1],
          result: "function",
        },
      ],
    },
  ],
  [
    "functions before var variables initialized",
    {
      source: `
        function test(a) {
          function a() {}
          var a = 'A';
          return typeof a;
        }
      `,
      cases: [
        {
          args: [1],
          result: "string",
        },
      ],
    },
  ],
  [
    "functions before var variables uninitialized",
    {
      source: `
        function test(a) {
          function a() {}
          var a;
          return typeof a;
        }
      `,
      cases: [
        {
          args: [1],
          result: "function",
        },
      ],
    },
  ],
  [
    "functions before false conditional var variables initialized",
    {
      source: `
        function test(a) {
          function a() {}
          if (false) {
            var a = 'A';
          }
          return typeof a;
        }
      `,
      cases: [
        {
          args: [1],
          result: "function",
        },
      ],
    },
  ],
  [
    "functions before true conditional var variables initialized",
    {
      source: `
        function test(a) {
          function a() {}
          if (true) {
            var a = 'A';
          }
          return typeof a;
        }
      `,
      cases: [
        {
          args: [1],
          result: "string",
        },
      ],
    },
  ],
  [
    "functions before blocked var variables initialized",
    {
      source: `
        function test(a) {
          function a() {}
          {
            var a = 'A';
          }
          return typeof a;
        }
      `,
      cases: [
        {
          args: [1],
          result: "string",
        },
      ],
    },
  ],
  [
    "conditional functions after var variables uninitialized",
    {
      source: `
        function test(a) {
          var a;
          if (true) {
            function a() {}
          }
          return typeof a;
        }
      `,
      cases: [
        {
          args: [1],
          result: "number",
        },
      ],
    },
  ],
  [
    "conditional functions with param uninitialized",
    {
      source: `
        function test(a) {
          if (true) {
            function a() {}
          }
          return typeof a;
        }
      `,
      cases: [
        {
          args: [],
          result: "undefined",
        },
      ],
    },
  ],
  [
    "blocked functions after var variables uninitialized",
    {
      source: `
        function test(a) {
          var a;
          {
            function a() {}
          }
          return typeof a;
        }
      `,
      cases: [
        {
          args: [1],
          result: "number",
        },
      ],
    },
  ],
  [
    "conditional functions after var variables uninitialized with no params",
    {
      source: `
        function test() {
          var a;
          if (true) {
            function a() {}
          }
          return typeof a;
        }
      `,
      cases: [
        {
          args: [],
          result: "undefined",
        },
      ],
    },
  ],
  [
    "blocked functions after var variables uninitialized with no params",
    {
      source: `
        function test() {
          var a;
          {
            function a() {}
          }
          return typeof a;
        }
      `,
      cases: [
        {
          args: [],
          result: "undefined",
        },
      ],
    },
  ],
  [
    "blocked functions",
    {
      source: `
        function test(a) {
          {
            function a() {}
          }
          return typeof a;
        }
      `,
      cases: [
        {
          args: [1],
          result: "number",
        },
      ],
    },
  ],
  [
    "hoisted functions",
    {
      source: `
        function test() {
          const t = a();
          function a() {
            return 1;
          }
          return t;
        }
      `,
      cases: [
        {
          args: [],
          result: 1,
        },
      ],
    },
  ],
  [
    "functions hoisting in block",
    {
      source: `
        function test() {
          const t = a();
          let r;
          if (true) {
            r = a();
            function a() {
              return 2;
            }
          }
          function a() {
            return 1;
          }
          return t + r;
        }
      `,
      cases: [
        {
          args: [],
          result: 3,
        },
      ],
    },
  ],
  [
    "functions hoisting in switch statement",
    {
      source: `
        function test() {
          const t = a();
          let r;
          switch (true) {
            case true:
              r = a();
            case false:
              function a() { return 2 }
          }
          function a() {
            return 1;
          }
          return t + r;
        }
      `,
      cases: [
        {
          args: [],
          result: 3,
        },
      ],
    },
  ],
  [
    "hoisted functions in function expressions",
    {
      source: `
        function test() {
          const f = function(){
            const t = a();
            let r;
            if (true) {
              r = a();
              function a() {
                return 2;
              }
            }
            function a() {
              return 1;
            }
            return t + r;
          };
          return f();
        }
      `,
      cases: [
        {
          args: [],
          result: 3,
        },
      ],
    },
  ],
  [
    "hoisted functions in arrow functions",
    {
      source: `
        function test() {
          const f = () => {
            const t = a();
            let r;
            if (true) {
              r = a();
              function a() {
                return 2;
              }
            }
            function a() {
              return 1;
            }
            return t + r;
          };
          return f();
        }
      `,
      cases: [
        {
          args: [],
          result: 3,
        },
      ],
    },
  ],
  [
    "for const ... of",
    {
      source: `
        function test() {
          let total = 0;
          for (const i of [1, 2]) {
            total += i;
          }
          return total;
        }
      `,
      cases: [
        {
          args: [],
          result: 3,
        },
      ],
    },
  ],
  [
    "for var ... of",
    {
      source: `
        function test() {
          let total = 0;
          for (var i of [1, 2]) {
            total += i;
          }
          return total + i;
        }
      `,
      cases: [
        {
          args: [],
          result: 5,
        },
      ],
    },
  ],
  [
    "for ... of",
    {
      source: `
        function test() {
          let total = 0;
          let i;
          for (i of [1, 2]) {
            total += i;
          }
          return total + i;
        }
      `,
      cases: [
        {
          args: [],
          result: 5,
        },
      ],
    },
  ],
  [
    "for ... of: nesting scopes",
    {
      source: `
        function test() {
          let total = '';
          const i = 'a';
          for (const i of ['b', 'c']) {
            const i = 'd';
            total += i;
          }
          return total + i;
        }
      `,
      cases: [
        {
          args: [],
          result: "dda",
        },
      ],
    },
  ],
  [
    "for let ... of: break",
    {
      source: `
        function test() {
          let total = 0;
          for (let i of [1, 2]) {
            total += i;
            if (total >= 1) {
              break;
              // Should never reach here.
              total += 10;
            }
          }
          return total;
        }
      `,
      cases: [
        {
          args: [],
          result: 1,
        },
      ],
    },
  ],
  [
    "for const ... of: continue",
    {
      source: `
        function test() {
          let total = 0;
          for (const i of [1, 2, 3]) {
            if (i === 2) {
              continue;
            }
            total += i;
          }
          return total;
        }
      `,
      cases: [
        {
          args: [],
          result: 4,
        },
      ],
    },
  ],
  [
    "for let ... in",
    {
      source: `
        function test() {
          let total = '';
          for (let i in {a:1,b:2}) {
            total += i;
          }
          return total;
        }
      `,
      cases: [
        {
          args: [],
          result: "ab",
        },
      ],
    },
  ],
  [
    "for ... in",
    {
      source: `
        function test() {
          let total = '';
          var i;
          for (i in {a:1,b:2}) {
            total += i;
          }
          return total + i;
        }
      `,
      cases: [
        {
          args: [],
          result: "abb",
        },
      ],
    },
  ],
  [
    "for var ... in",
    {
      source: `
        function test() {
          let total = '';
          for (var i in {a:1,b:2}) {
            total += i;
          }
          return total + i;
        }
      `,
      cases: [
        {
          args: [],
          result: "abb",
        },
      ],
    },
  ],
  [
    "for const ... in: return",
    {
      source: `
        function test() {
          let total = '';
          for (let i in {a:1,b:2}) {
            total += i;
            if (total.length >= 1) {
              return 'oops: ' + total;
            }
          }
          return total;
        }
      `,
      cases: [
        {
          args: [],
          result: "oops: a",
        },
      ],
    },
  ],
  [
    "for const ... in: continue",
    {
      source: `
        function test() {
          let total = '';
          for (const i in {a:1,b:2,c:3}) {
            if (i === 'b') {
              continue;
            }
            total += i;
          }
          return total;
        }
      `,
      cases: [
        {
          args: [],
          result: "ac",
        },
      ],
    },
  ],
  [
    "for let ...",
    {
      source: `
        function test() {
          let total = 0;
          const list = [1, 2];
          for (let i = 0; i < list.length; i += 1) {
            total += list[i];
          }
          return total;
        }
      `,
      cases: [
        {
          args: [],
          result: 3,
        },
      ],
    },
  ],
  [
    "for var ...: break",
    {
      source: `
        function test() {
          let total = 0;
          const list = [1, 2];
          for (var i = 0; i < list.length; i += 1) {
            total += list[i];
            if (total >= 1) {
              break;
            }
          }
          return total + i;
        }
      `,
      cases: [
        {
          args: [],
          result: 1,
        },
      ],
    },
  ],
  [
    "for const ...: continue",
    {
      source: `
        function test() {
          let total = 0;
          const list = [1, 2, 3];
          for (let i = 0; i < list.length; i += 1) {
            if (i === 1) {
              continue;
            }
            total += list[i];
          }
          return total;
        }
      `,
      cases: [
        {
          args: [],
          result: 4,
        },
      ],
    },
  ],
  [
    "for ...: with no init nor test nor update",
    {
      source: `
        function test() {
          let total = 0;
          for (; ;) {
            total += 1;
            if (total >= 2) {
              break;
            }
          }
          return total;
        }
      `,
      cases: [
        {
          args: [],
          result: 2,
        },
      ],
    },
  ],
  [
    "for ...: nested",
    {
      source: `
        function test() {
          let total = 0;
          const list = [1, 2];
          const object = {a: 3, b: 4};
          for (const i of list) {
            total += i;
            for (const k in object) {
              total += object[k];
            }
          }
          return total;
        }
      `,
      cases: [
        {
          args: [],
          result: 17,
        },
      ],
    },
  ],
  [
    "for ...: nested and break inner",
    {
      source: `
        function test() {
          let total = 0;
          const list = [1, 2];
          const object = {a: 3, b: 4};
          for (const i of list) {
            total += i;
            for (const k in object) {
              total += object[k];
              break;
            }
          }
          return total;
        }
      `,
      cases: [
        {
          args: [],
          result: 9,
        },
      ],
    },
  ],
  [
    "for ...: nested and break outer",
    {
      source: `
        function test() {
          let total = 0;
          const list = [1, 2];
          const object = {a: 3, b: 4};
          for (const i of list) {
            total += i;
            for (const k in object) {
              total += object[k];
            }
            break;
          }
          return total;
        }
      `,
      cases: [
        {
          args: [],
          result: 8,
        },
      ],
    },
  ],
  [
    "for ...: nested and return inner",
    {
      source: `
        function test() {
          let total = 0;
          const list = [1, 2];
          const object = {a: 3, b: 4};
          for (const i of list) {
            total += i;
            for (const k in object) {
              total += object[k];
              return "oops: " + total;
            }
            alert('yaks');
          }
          return total;
        }
      `,
      cases: [
        {
          args: [],
          result: "oops: 4",
        },
      ],
    },
  ],
  [
    "while ...",
    {
      source: `
        function test() {
          let total = 0;
          while (total <= 2) {
            total += 1;
          }
          return total;
        }
      `,
      cases: [
        {
          args: [],
          result: 3,
        },
      ],
    },
  ],
  [
    "while ... false",
    {
      source: `
        function test() {
          let total = 0;
          while (false) {
            total += 1;
          }
          return total;
        }
      `,
      cases: [
        {
          args: [],
          result: 0,
        },
      ],
    },
  ],
  [
    "while ...: break",
    {
      source: `
        function test() {
          let total = 0;
          while (true) {
            total += 1;
            if (total >= 2) {
              break;
            }
          }
          return total;
        }
      `,
      cases: [
        {
          args: [],
          result: 2,
        },
      ],
    },
  ],
  [
    "while ...: continue",
    {
      source: `
        function test() {
          let total = 0;
          while (total < 2) {
            if (total >= 2) {
              continue;
            }
            total += 1;
          }
          return total;
        }
      `,
      cases: [
        {
          args: [],
          result: 2,
        },
      ],
    },
  ],
  [
    "do ... while",
    {
      source: `
        function test() {
          let total = 0;
          do {
            total += 1;
          } while (total <= 2);
          return total;
        }
      `,
      cases: [
        {
          args: [],
          result: 3,
        },
      ],
    },
  ],
  [
    "do ... while false",
    {
      source: `
        function test() {
          let total = 0;
          do {
            total += 1;
          } while (false);
          return total;
        }
      `,
      cases: [
        {
          args: [],
          result: 1,
        },
      ],
    },
  ],
  [
    "do ... while: break",
    {
      source: `
        function test() {
          let total = 0;
          do {
            total += 1;
            if (total >= 2) {
              break;
            }
          } while (true);
          return total;
        }
      `,
      cases: [
        {
          args: [],
          result: 2,
        },
      ],
    },
  ],
  [
    "do ... while: continue",
    {
      source: `
        function test() {
          let total = 0;
          do {
            if (total >= 2) {
              continue;
            }
            total += 1;
          } while (total < 2);
          return total;
        }
      `,
      cases: [
        {
          args: [],
          result: 2,
        },
      ],
    },
  ],
  [
    "empty statement",
    {
      source: `
        function test() {
          ;
        }
      `,
      cases: [
        {
          args: [],
          result: undefined,
        },
      ],
    },
  ],
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
      cases: [
        {
          args: [],
          result: "TypeError: a is not a function:yep",
        },
      ],
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
      cases: [
        {
          args: [],
          result: "Error: oops",
        },
      ],
    },
  ],
  [
    "assignment",
    {
      source: `
        function test() {
          let [a, b, c, d, e, f, i] = [10, 20, 30, 40, 50, 60, 70];
          const g = { h: 70 };
          let r = a;
          let s = (b += 1);
          let t = (c -= 1);
          let u = (d *= 2);
          let v = (e /= 2);
          let w = (f %= 7);
          let x = (g.h += 2);
          let y = (i **= 2);
          return [[a, b, c, d, e, f, g.h, i], [r, s, t, u, v, w, x, y]];
        }
      `,
      cases: [
        {
          args: [],
          result: [
            [10, 21, 29, 80, 25, 4, 72, 4900],
            [10, 21, 29, 80, 25, 4, 72, 4900],
          ],
        },
      ],
    },
  ],
  [
    "update",
    {
      source: `
        function test() {
          let [a, b, c, d] = [10, 20, 30, 40];
          let r = a++;
          let s = ++b;
          let t = c--;
          let u = --d;
          return [ [a, b, c, d], [r, s, t, u] ];
        }
      `,
      cases: [
        {
          args: [],
          result: [
            [11, 21, 29, 39],
            [10, 21, 30, 39],
          ],
        },
      ],
    },
  ],
  [
    "arrow function expression",
    {
      source: `
        function test(a) {
          return a.map(b => b.name);
        }
      `,
      cases: [
        {
          args: [
            [
              { name: "sayHello", description: "Hello" },
              { name: "sayExclamation", description: "Exclamation" },
            ],
          ],
          result: ["sayHello", "sayExclamation"],
        },
      ],
    },
  ],
  [
    "delete",
    {
      source: `
        function test(a) {
          const d = delete a.b;
          const e = delete a.f;
          return { ...a, d, e };
        }
      `,
      cases: [
        {
          args: [{ b: 1, c: 2 }],
          result: { c: 2, d: true, e: true },
        },
      ],
    },
  ],
  [
    "parameter expression scope read",
    {
      source: `
        function test() {
          var x = 1;
          var y = 2;
          function inner(b = x + y) {
            var y = 3;
            return b;
          }
          return inner();
        }
      `,
      cases: [
        {
          args: [],
          result: 3,
        },
      ],
    },
  ],
  [
    "parameter expression scope write",
    {
      source: `
        function test() {
          var x = 1;
          var y = 2;
          function inner(x, b = (x = y)) {
            var y = 3;
            return b;
          }
          return x + ':' + inner();
        }
      `,
      cases: [
        {
          args: [],
          result: "1:2",
        },
      ],
    },
  ],
  [
    "parameter expression scope read in function",
    {
      source: `
        function test() {
          var x = 1;
          function inner(y, b = () => x + y) {
            var y = 2;
            return b();
          }
          return inner(3);
        }
      `,
      cases: [
        {
          args: [],
          result: 4,
        },
      ],
    },
  ],
  [
    "parameter expression scope write in function",
    {
      source: `
        function test() {
          var y = 1;
          function inner(b = () => (y=2)) {
            var y;
            b();
            return y;
          }
          return inner() + ':' + y;
        }
      `,
      cases: [
        {
          args: [],
          result: `undefined:2`,
        },
      ],
    },
  ],
  [
    "iterator destructuring assignment",
    {
      source: `
        function test() {
          const x = { a: 0 };
          let y, z, size;
          const v = [1, 2, 3, 4];
          [x.b, ...[y, ...z]] = v;
          [, x.a, ...{ length: size }] = v;
          return { x, y, z, size };
        }
      `,
      cases: [
        {
          args: [],
          result: { x: { a: 2, b: 1 }, y: 2, z: [3, 4], size: 2 },
        },
      ],
    },
  ],
  [
    "[TypeScript]",
    {
      source: `
        interface A {
          b: number;
        }
        type B = A & {
          c: string;
        }
        declare function f(): void;
        function test({ b, c }: B): void {
          return { b: c as number, c: b };
        }
      `,
      cases: [
        {
          args: [{ b: 1, c: 2 }],
          result: { b: 2, c: 1 },
        },
      ],
    },
  ],
];

const casesOfExpressions: LooseCase[] = [
  ["'good'", "good"],
  ["1", 1],
  ["null", null],
  ["undefined", undefined],
  ["true", true],
  ["NaN", NaN],
  ["/bc/.test('abcd')", true],
  ["/bc/.test('dcba')", false],
  ["isNaN(NaN)", true],
  ["isNaN({})", true],
  ["isNaN(1)", false],
  ["Array.isArray([])", true],
  ["Array.isArray({})", false],
  ["Object.keys(DATA.objectA)", ["onlyInA", "bothInAB"]],
  ["String([1, 2])", "1,2"],
  ["Boolean(1)", true],
  ["Boolean(0)", false],
  ["Number(true)", 1],
  ["Number.isNaN({})", false],
  ["JSON.parse('[1]')", [1]],
  ["isFinite(5)", true],
  ["isFinite(Infinity)", false],
  ["parseFloat('5.3good')", 5.3],
  ["parseInt('5.3good')", 5],
  ["Math.max(1, 2)", 2],
  ["PIPES.string(null)", ""],
  ["location.href", "http://localhost/"],
  ["DATA.for", "good"],
  ["DATA['for']", "good"],
  ["DATA.other", undefined],
  ["{}", {}],
  [
    "{ quality: DATA.for, [DATA.true]: 'story' }",
    {
      quality: "good",
      true: "story",
    },
  ],
  ["[]", []],
  ["[1, DATA.number5]", [1, 5]],
  [
    // `ArrowFunctionExpression` mixed `CallExpression`
    "(a => a.b)({b: 'c'})",
    "c",
  ],
  [
    // `MemberExpression`
    "DATA.number5.toFixed(1)",
    "5.0",
  ],
  [
    // `OptionalMemberExpression`
    "DATA.number5?.toFixed(1)",
    "5.0",
  ],
  ["DATA.null || 'oops'", "oops"],
  ["DATA.for || 'oops'", "good"],
  ["DATA.null && 'oops'", null],
  ["DATA.for && 'oops'", "oops"],
  ["DATA.for ?? 'oops'", "good"],
  ["DATA.false ?? 'oops'", false],
  ["DATA.null ?? 'oops'", "oops"],
  ["DATA.undefined ?? 'oops'", "oops"],
  ["DATA.for?.length", 4],
  ["DATA?.fnReturnThisFor()", "good"],
  ["DATA.fnReturnThisFor?.()", "good"],
  ["String?.(null)", "null"],
  ["DATA.notExisted?.length", undefined],
  ["DATA.notExisted?.length?.oops", undefined],
  ["DATA.notExisted?.()", undefined],
  ["DATA.notExisted?.()?.()", undefined],
  ["DATA.notExisted?.()?.length", undefined],
  ["DATA.notExisted?.length?.()", undefined],
  ["DATA.notExisted?.length.oops", undefined],
  ["DATA.notExisted?.length()", undefined],
  ["DATA.notExisted?.()()", undefined],
  ["(DATA.notExisted)?.length", undefined],
  ["(DATA.notExisted?.length)?.oops", undefined],
  ["!DATA.null", true],
  ["+DATA.true", 1],
  ["-DATA.true", -1],
  ["typeof DATA.for", "string"],
  ["typeof DATA.unknown", "undefined"],
  ["typeof unknown", "undefined"],
  ["void DATA.for", undefined],
  ["DATA.number5 + 1", 6],
  ["DATA.number5 - 1", 4],
  ["DATA.number5 / 2", 2.5],
  ["DATA.number5 % 2", 1],
  ["DATA.number5 * 2", 10],
  ["DATA.number5 ** 2", 25],
  ["DATA.number5 == '5'", true],
  ["DATA.number5 == 4", false],
  ["DATA.number5 === 5", true],
  ["DATA.number5 === '5'", false],
  ["DATA.number5 != '5'", false],
  ["DATA.number5 != 4", true],
  ["DATA.number5 !== 5", false],
  ["DATA.number5 !== '5'", true],
  ["DATA.number5 > 4", true],
  ["DATA.number5 > 5", false],
  ["DATA.number5 < 6", true],
  ["DATA.number5 < 5", false],
  ["DATA.number5 >= 4", true],
  ["DATA.number5 >= 5", true],
  ["DATA.number5 >= 6", false],
  ["DATA.number5 <= 6", true],
  ["DATA.number5 <= 5", true],
  ["DATA.number5 <= 4", false],
  ["DATA.for ? 'yep': 'oops'", "yep"],
  ["DATA.null ? 'yep': 'oops'", "oops"],
  [
    // `SequenceExpression`
    "DATA.for, DATA.number5",
    5,
  ],
  [
    "`${null},${undefined},${true},${false},${{}},${[]},${[1,2]}${5},${NaN}`",
    `${null},${undefined},${true},${false},${{}},${[]},${[1, 2]}${5},${NaN}`,
  ],
  ["_.get(DATA, 'for')", "good"],
  ["moment().format()", "2020-03-25T17:37:00+08:00"],
  ["moment('not a real date').isValid()", false],
  [
    "moment('12-25-1995', 'MM-DD-YYYY').format(moment.HTML5_FMT.DATETIME_LOCAL)",
    "1995-12-25T00:00",
  ],
  ["[1,2,3].slice(1)", [2, 3]],
  ["[1, ...DATA.for, 2]", [1, "g", "o", "o", "d", 2]],
  // eslint-disable-next-line no-sparse-arrays
  ["[1, , 2]", [1, , 2]],
  ["[-1].concat(0, ...[1, 2], 3)", [-1, 0, 1, 2, 3]],
  ["[-1]?.concat(0, ...[1, 2], 3)", [-1, 0, 1, 2, 3]],
  [
    "{...DATA.objectA, ...DATA.objectB}",
    {
      onlyInA: 1,
      bothInAB: 4,
      onlyInB: 3,
    },
  ],
  ["{...null, ...undefined}", {}],
  ["[1, undefined, null].map((i = 5) => i)", [1, 5, null]],
  ["[1, undefined].map((i = DATA.number5) => i)", [1, 5]],
  [
    // `j` is not defined, but not evaluated either.
    "[1, 2].map((i = j + 1) => i)",
    [1, 2],
  ],
  [
    // `j` is not initialized, but not evaluated either.
    "[1, 2].map((i = j + 1, j) => i)",
    [1, 2],
  ],
  ["[1, 2].map(i => ((i, j = i + 1) => i + j)(i))", [3, 5]],
  [
    "[1, 2].map((...args) => args)",
    [
      [1, 0, [1, 2]],
      [2, 1, [1, 2]],
    ],
  ],
  [
    "[1, 2].map((i, ...args) => args)",
    [
      [0, [1, 2]],
      [1, [1, 2]],
    ],
  ],
  // `ArrayPattern`
  ["[[1, 2]].map(([a, b]) => a + b)", [3]],
  // `ArrayPattern` with `RestElement`
  ["[[1, 2, 3]].map(([a, ...b]) => a + b.length)", [3]],
  // Nested `ArrayPattern`
  ["[[1, [2, 3]]].map(([a, [b, c]]) => a + b + c)", [6]],
  // `ArrayPattern` with `AssignmentPattern`
  ["[[1]].map(([a, [b, c] = [2, 3]]) => a + b + c)", [6]],
  // `ArrayPattern` with Nested `AssignmentPattern`
  ["[[1]].map(([a, [b, c = 3] = [2]]) => a + b + c)", [6]],
  // `ArrayPattern` with parameter scope
  ["[[1]].map(([a, [b, c = b] = [2]]) => a + b + c)", [5]],
  // `ObjectPattern`
  ["[{a: 1, b: 2}].map(({a, b}) => a + b)", [3]],
  // `ObjectPattern` with `RestElement`
  ["[{a: 1, b: 2, c: 3}].map(({a, ...b}) => a + b.b + b.c)", [6]],
  // Nested `ObjectPattern`
  ["[{a: 1, b: { d: 2 }}].map(({a, b: { d: c }}) => a + c)", [3]],
  // `ObjectPattern` with `AssignmentPattern` and `RestElement`
  ["[undefined].map(({a, ...b}={}) => a + b)", ["undefined[object Object]"]],
  // `ObjectPattern` with a computed key
  ["[{'a.b': 1}].map(({'a.b': c}) => c)", [1]],
  // Pipeline operator.
  ["DATA.number5 |> PIPES.string", "5"],
  // Sequential pipeline operators with an arrow function.
  ["DATA.number5 |> (_ => _ + 1) |> PIPES.string", "6"],
  // Reuse arrow functions.
  ["(fn => fn(2)+fn())((a=1)=>a)", 3],
  // Nested arrow functions
  ["((a)=>(b)=>a+b)(1)(2)", 3],
  ["new Set([1, 2, 3])", new Set([1, 2, 3])],
  ["new Array(1, ...[2, 3])", [1, 2, 3]],
  [
    "String(new URLSearchParams({q: 'hello,world', age: 18}))",
    "q=hello%2Cworld&age=18",
  ],
  // Tagged template.
  ["((s,...k) => `${s.join('-')}:${k.join(',')}`)`a${1}b${2}c`", "a-b-c:1,2"],
  [
    "TAG_URL`${APP.homepage}/list?q=${DATA.q}&redirect=${DATA.redirect}`",
    "/hello/world/list?q=a%26b&redirect=/r/s%3Ft%3Du%26v%3Dw",
  ],
  ["SAFE_TAG_URL`file/${DATA.path}?q=${DATA.q}`", "file/x%2Fy.zip?q=a%26b"],
  ["btoa('hello')", "aGVsbG8="],
  ["atob('aGVsbG8=')", "hello"],
].map(([source, result]) => [
  `expression: ${source}`,
  {
    source: `
      function test() {
        return (${source});
      }
    `,
    args: [],
    result,
  },
]);

const negativeCasesOfExpression: LooseCase[] = [
  "DATA?.()",
  "DATA?.number5()",
  "DATA?.number5.notExisted.oops",
  "DATA.number5?.toFixed.oo.ps",
  "DATA.number5.toFixed?.().oops()",
  "(DATA.notExisted?.length).oops",
].map((source) => [
  `expression: ${source}`,
  {
    source: `
      function test() {
        return (${source});
      }
    `,
    args: [],
  },
]);

const negativeCasesOfStatements: LooseCase[] = [
  [
    "assign constants",
    `
      function test(){
        const a = 1;
        a = 2;
      }
    `,
  ],
  [
    "assign global functions",
    `
      function test(){
        test = 1;
      }
    `,
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
  ],
  [
    "assign `for const ... of`",
    `
      function test(){
        for (const i of [1]) {
          i = 2;
        }
      }
    `,
  ],
  [
    "assign `for const ...`",
    `
      function test(){
        for (const i=0; i<2; i+=1) {
          i = 2;
        }
      }
    `,
  ],
  [
    "try without catch",
    `
      function test() {
        let a = 1, b, c;
        try {
          b = 'yep';
          a();
          b = 'nope';
        } finally {
          c = a + ':' + b;
        }
        return c;
      }
    `,
  ],
  [
    "assign member of nil",
    `
      function test() {
        let a;
        a.b = 1;
      }
    `,
  ],
  [
    "access before initialized",
    `
      function test() {
        let a = typeof b;
        let b;
        return a;
      }
    `,
  ],
].map(([desc, source]) => [
  desc,
  {
    source,
    args: [],
  },
]);

export const positiveCases = casesOfForOfLoops
  .concat(
    casesOfForInLoops,
    casesOfSwitchStatements,
    casesOfWhileStatements,
    casesOfTryStatements,
    casesOfExpressions,
    casesOfMigrated
  )
  .map<NormalizedCase>(([desc, { source, ...rest }]) => [
    desc,
    {
      source,
      cases: (rest as MultipleCasePairs).cases || [rest as CasePair],
    },
  ]);

export const negativeCases = negativeCasesOfExpression
  .concat(negativeCasesOfStatements)
  .map<NormalizedCase>(([desc, { source, ...rest }]) => [
    desc,
    {
      source,
      cases: (rest as MultipleCasePairs).cases || [rest as CasePair],
    },
  ]);
