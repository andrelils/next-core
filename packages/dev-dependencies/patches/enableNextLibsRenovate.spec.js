jest.mock("../utils");

const enableNextLibsRenovate = require("./enableNextLibsRenovate");
const { writeJsonFile, readJson } = require("../utils");

describe("enableNextLibsRenovate", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should ignore if already updated", () => {
    readJson.mockReturnValueOnce({
      packageRules: [
        {
          matchDepTypes: ["devDependencies"],
          matchUpdateTypes: ["minor", "patch"],
          automerge: true,
        },
        {
          groupName: "next-libs packages",
          matchPackagePatterns: ["^@next-libs/"],
          automerge: false,
        },
      ],
    });
    enableNextLibsRenovate();
    expect(writeJsonFile).not.toBeCalled();
  });

  it("should enable next-libs", () => {
    readJson.mockReturnValueOnce({
      packageRules: [
        {
          matchDepTypes: ["devDependencies"],
          automerge: true,
        },
        {
          matchPackagePatterns: [
            "^@next-bricks/",
            "^@next-sdk/",
            "^@bricks/",
            "^@libs/",
            "^@micro-apps/",
            "^@sdk/",
            "^@templates/",
            "^@next-libs/",
            "^@next-micro-apps/",
            "^@next-legacy-templates/",
          ],
          matchPackageNames: ["react"],
          enabled: false,
        },
        {
          matchUpdateTypes: ["major"],
          enabled: false,
        },
      ],
    });
    enableNextLibsRenovate();
    expect(writeJsonFile).toBeCalledWith(
      expect.stringContaining("renovate.json"),
      {
        packageRules: [
          {
            matchDepTypes: ["devDependencies"],
            automerge: true,
          },
          {
            matchPackagePatterns: [
              "^@next-bricks/",
              "^@next-sdk/",
              "^@bricks/",
              "^@libs/",
              "^@micro-apps/",
              "^@sdk/",
              "^@templates/",
              "^@next-micro-apps/",
              "^@next-legacy-templates/",
            ],
            matchPackageNames: ["react"],
            enabled: false,
          },
          {
            matchUpdateTypes: ["major"],
            enabled: false,
          },
          {
            groupName: "next-libs packages",
            matchPackagePatterns: ["^@next-libs/"],
            automerge: false,
          },
        ],
      }
    );
  });
});
