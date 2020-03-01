import {
  get,
  groupBy,
  keys,
  keyBy,
  set,
  indexOf,
  isNil,
  isEqual
} from "lodash";
import moment from "moment";

export const PipeRegistry = new Map<string, Function>();

PipeRegistry.set("string", pipeString);
PipeRegistry.set("number", pipeNumber);
PipeRegistry.set("bool", pipeBoolean);
PipeRegistry.set("boolean", pipeBoolean);
PipeRegistry.set("json", pipeJson);
PipeRegistry.set("jsonStringify", pipeJsonStringify);
PipeRegistry.set("not", pipeNot);
PipeRegistry.set("map", pipeMap);
PipeRegistry.set("groupByToIndex", pipeGroupByToIndex);
PipeRegistry.set("get", pipeGet);
PipeRegistry.set("equal", pipeEqual);
PipeRegistry.set("split", pipeSplit);
PipeRegistry.set("join", pipeJoin);
PipeRegistry.set("includes", pipeIncludes);
PipeRegistry.set("datetime", pipeDatetime);
PipeRegistry.set("add", pipeAdd);
PipeRegistry.set("subtract", pipeSubtract);
PipeRegistry.set("multiply", pipeMultiply);
PipeRegistry.set("divide", pipeDivide);
PipeRegistry.set("groupBy", pipeGroupBy);
PipeRegistry.set("keyBy", pipeKeyBy);

function pipeMap(value: any[], key: string): any[] {
  return value.map(item => {
    return get(item, key);
  });
}

function pipeString(value: any): string {
  // Consider `undefined` and `null` as `""`.
  return value === undefined || value === null ? "" : String(value);
}

function pipeNumber(value: any): number {
  return Number(value);
}

function pipeBoolean(value: any): boolean {
  // Consider `"0"` as false.
  return value !== "0" && Boolean(value);
}

function pipeJson(value: any): any {
  try {
    return JSON.parse(value);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(e);
    return;
  }
}

function pipeJsonStringify(value: any): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(e);
    return;
  }
}

function pipeNot(value: boolean): boolean {
  return !value;
}

// 根据 groupField 字段给 value 分组，并且对分组过后的 keys 进行排序，把对应的 index 下标给到 targetField 并返回最终的 value。
function pipeGroupByToIndex(
  value: Record<string, any>[],
  groupField: string,
  targetField: string
): Record<string, any>[] {
  let result = value;
  if (!isNil(groupField) && !isNil(targetField)) {
    const groupByValue = groupBy(value, groupField);
    const allKeys = keys(groupByValue).sort();
    result = result.map(v => {
      const item = { ...v };
      set(item, targetField, indexOf(allKeys, get(v, groupField)));
      return item;
    });
  }
  return result;
}

function pipeGet(value: any, field: string): any {
  return get(value, field);
}

function pipeEqual(value: any, other: any): boolean {
  return isEqual(value, other);
}

function pipeSplit(value: string, separator: string): string[] {
  if (typeof value === "string") {
    return value.split(separator);
  } else {
    return [];
  }
}

function pipeJoin(value: any[], separator: string): string {
  return value.join(separator);
}

function pipeIncludes(value: any, part: any): boolean {
  return value.includes(part);
}

function pipeDatetime(value: number | string, format: string): string {
  return moment(value).format(format);
}

function pipeAdd(
  value: number | string,
  operand: number | string
): number | string {
  return (value as any) + (operand as any);
}

function pipeSubtract(value: number, operand: number): number {
  return value - operand;
}

function pipeMultiply(value: number, operand: number): number {
  return value * operand;
}

function pipeDivide(value: number, operand: number): number {
  return value / operand;
}

function pipeGroupBy(value: any[], field: string): any {
  return groupBy(value, field);
}

function pipeKeyBy(value: any[], field: string): any {
  return keyBy(value, field);
}