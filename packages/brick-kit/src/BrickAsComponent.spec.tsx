import React from "react";
import { mount } from "enzyme";
import * as utils from "@easyops/brick-utils";
import { BrickAsComponent } from "./BrickAsComponent";
import * as runtime from "./runtime";

const bindListeners = jest.spyOn(utils, "bindListeners");
const spyOnResolve = jest.fn((_brickConf: any, brick: any) => {
  brick.properties.title = "resolved";
});
jest.spyOn(runtime, "getRuntime").mockReturnValue({
  _internalApiGetResolver: () => ({
    resolve: spyOnResolve
  })
} as any);

describe("BrickAsComponent", () => {
  it("should work", async () => {
    const wrapper = mount(
      <BrickAsComponent
        useBrick={{
          brick: "div",
          transform: "title",
          transformFrom: "tips",
          events: {
            "button.click": {
              action: "console.log",
              args: ["@{tips}"]
            }
          }
        }}
        data={{
          tips: "good"
        }}
      />
    );

    await (global as any).flushPromises();
    const div = wrapper.find("div").getDOMNode() as HTMLDivElement;
    expect(div.title).toBe("good");
    expect(bindListeners.mock.calls[0][1]).toEqual({
      "button.click": {
        action: "console.log",
        args: ["good"]
      }
    });
  });

  it("should resolve", async () => {
    const wrapper = mount(
      <BrickAsComponent
        useBrick={{
          brick: "div",
          properties: {
            id: "hello",
            style: {
              color: "red"
            }
          },
          transform: "title",
          transformFrom: "tips",
          lifeCycle: {
            useResolves: [
              {
                ref: "my-provider"
              }
            ]
          }
        }}
        data={{
          tips: "good"
        }}
      />
    );
    await (global as any).flushPromises();
    expect(spyOnResolve.mock.calls[0][0]).toEqual({
      brick: "div",
      lifeCycle: {
        useResolves: [
          {
            ref: "my-provider"
          }
        ]
      }
    });
    expect(spyOnResolve.mock.calls[0][1]).toMatchObject({
      type: "div",
      properties: {
        id: "hello",
        style: {
          color: "red"
        }
      }
    });
    const div = wrapper.find("div").getDOMNode() as HTMLDivElement;
    expect(div.id).toBe("hello");
    expect(div.title).toBe("resolved");
    expect(div.style.color).toBe("red");
  });
});