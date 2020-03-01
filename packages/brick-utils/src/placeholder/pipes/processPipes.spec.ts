import { processPipes } from "./processPipes";
import { PipeCall } from "../interfaces";

describe("processPipes", () => {
  beforeAll(() => {
    jest.spyOn(console, "error").mockImplementation(() => null);
    jest.spyOn(console, "warn").mockImplementation(() => null);
  });

  const circularValue: any = {};
  circularValue.self = circularValue;
  const cases: [any, string, any][] = [
    [1, "", 1],
    [1, "|string", "1"],
    [undefined, "|string", ""],
    [null, "|string", ""],
    ["1", "|number", 1],
    [1, "|bool", true],
    [0, "|bool", false],
    ["0", "|bool", false],
    ['{"a":1}', "|json", { a: 1 }],
    ["{", "|json", undefined],
    [{ a: 1 }, "|jsonStringify", '{\n  "a": 1\n}'],
    [circularValue, "|jsonStringify", undefined],
    [1, "|unknown", undefined],
    [1, "|bool|not", false],
    [0, "|bool|not", true]
  ];
  it.each(cases)(
    "process %j with pipes %j should return %j",
    (value, rawPipes, result) => {
      expect(
        processPipes(
          value,
          // Compile the pipes first, in a hacking way.
          rawPipes
            ? rawPipes
                .substr(1)
                .split("|")
                .map<PipeCall>(id => ({
                  type: "PipeCall",
                  identifier: id,
                  parameters: []
                }))
            : []
        )
      ).toEqual(result);
    }
  );
  it.each([
    [[{ key: 123 }], "key", [123]],
    [[{ key: { name: "xxx" } }, {}], "key.name", ["xxx", undefined]]
  ])("map should work", (value, param, res) => {
    expect(
      processPipes(value, [
        { type: "PipeCall", identifier: "map", parameters: [param] }
      ])
    ).toEqual(res);
  });

  it.each([
    [
      [
        { a: "3", b: "1" },
        { a: "1", b: "2" },
        { a: "1", b: "3" }
      ],
      "a",
      "groupIndex",
      [
        { a: "3", b: "1", groupIndex: 1 },
        { a: "1", b: "2", groupIndex: 0 },
        { a: "1", b: "3", groupIndex: 0 }
      ]
    ],
    [
      [{ a: "3" }, { a: "1" }],
      undefined,
      "groupIndex",
      [{ a: "3" }, { a: "1" }]
    ],
    [[{ a: "3" }, { a: "1" }], "a", undefined, [{ a: "3" }, { a: "1" }]]
  ])("groupByToIndex should work", (value, groupField, targetField, res) => {
    expect(
      processPipes(value, [
        {
          type: "PipeCall",
          identifier: "groupByToIndex",
          parameters: [groupField, targetField]
        }
      ])
    ).toEqual(res);
  });

  const casesWithSingleParameter: [any, string, any][] = [
    [{ name: "foo" }, "|get:name", "foo"],
    ["bar", "|equal:bar", true],
    ["hello, world", "|split:, ", ["hello", "world"]],
    [null, "|split:, ", []],
    [[1, 2, 3], "|join:;", "1;2;3"],
    [[1, 2, 3], "|includes:0", false],
    [["foo", "bar"], "|includes:foo", true],
    [1582877669000, "|datetime:YYYY-MM-DD", "2020-02-28"],
    ["2020/02/28 17:14", "|datetime:YYYY-MM-DD", "2020-02-28"],
    [24, "|add:0", "240"],
    [24, "|subtract:1", 23],
    [24, "|multiply:1.5", 36],
    [24, "|divide:0", Infinity],
    [24, "|divide:3", 8],
    [
      ["one", "two", "three"],
      "|groupBy:length",
      { 3: ["one", "two"], 5: ["three"] }
    ],
    [
      [{ objectId: "HOST" }, { objectId: "APP" }],
      "|keyBy:objectId",
      { HOST: { objectId: "HOST" }, APP: { objectId: "APP" } }
    ]
  ];
  it.each(casesWithSingleParameter)(
    "process %j with pipes %j should return %j",
    (value, rawPipes, result) => {
      // Compile the pipes first, in a hacking way.
      const [identifier, parameter] = rawPipes.substr(1).split(":", 2);
      const parameters: (number | string)[] = [parameter];
      const pipeCalls: PipeCall[] = [
        {
          type: "PipeCall",
          identifier,
          parameters
        }
      ];
      expect(processPipes(value, pipeCalls)).toEqual(result);
    }
  );
});