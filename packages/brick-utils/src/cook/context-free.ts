import { BinaryExpression, LogicalExpression, PatternLike } from "@babel/types";
import { SimpleFunction } from "@next-core/brick-types";
import {
  CompletionRecord,
  Empty,
  EnvironmentRecord,
  NormalCompletion,
  ReferenceRecord,
} from "./ExecutionContext";
import { isIterable } from "./utils";

export function DestructuringAssignmentTargetIsObjectOrArray(
  element: PatternLike
): boolean {
  const assignmentTarget =
    element.type === "RestElement"
      ? element.argument
      : element.type === "AssignmentPattern"
      ? element.left
      : element;
  return (
    assignmentTarget.type === "ArrayPattern" ||
    assignmentTarget.type === "ObjectPattern"
  );
}

export function LoopContinues(completion: CompletionRecord): boolean {
  return completion.Type === "normal" || completion.Type == "continue";
}

export function UpdateEmpty(
  completion: CompletionRecord,
  value: unknown
): CompletionRecord {
  if (completion.Value !== Empty) {
    return completion;
  }
  return new CompletionRecord(completion.Type, value);
}

// https://tc39.es/ecma262/#sec-getvalue
export function GetValue(V: unknown): unknown {
  // ReturnIfAbrupt(V)
  if (V instanceof CompletionRecord) {
    if (V.Type === "normal") {
      V = V.Value;
    } else {
      return V;
    }
  }
  if (!(V instanceof ReferenceRecord)) {
    return V;
  }
  if (V.Base === "unresolvable") {
    throw new ReferenceError();
  }
  if (V.Base instanceof EnvironmentRecord) {
    const base = V.Base as EnvironmentRecord;
    // ReturnIfAbrupt
    const result = base.GetBindingValue(V.ReferenceName, V.Strict);
    if (result instanceof CompletionRecord) {
      if (result.Type === "normal") {
        return result.Value;
      } else {
        return result;
      }
    }
    return result;
  } else {
    // NOTE
    // The object that may be created in step 4.a is not accessible outside of the above abstract operation
    // and the ordinary object [[Get]] internal method. An implementation might choose to avoid the actual
    // creation of the object.
    // ReturnIfAbrupt
    const baseObj = ToObject(V.Base);
    return baseObj[V.ReferenceName];
  }
}

// https://tc39.es/ecma262/#sec-toobject
export function ToObject(arg: unknown): Record<PropertyKey, unknown> {
  if (arg === null || arg === undefined) {
    throw new TypeError();
  }
  return arg as Record<PropertyKey, unknown>;
}

export function ToPropertyKey(arg: unknown): string | symbol {
  if (typeof arg === "symbol") {
    return arg;
  }
  return String(arg);
}

export function GetV(V: unknown, P: PropertyKey): unknown {
  // ReturnIfAbrupt
  const O = ToObject(V);
  // ReturnIfAbrupt
  return O[P];
}

export function PutValue(V: ReferenceRecord, W: unknown): CompletionRecord {
  // ReturnIfAbrupt(V).
  // ReturnIfAbrupt(W).
  if (!(V instanceof ReferenceRecord)) {
    throw new ReferenceError();
  }
  if (V.Base === "unresolvable") {
    throw new ReferenceError();
  }
  if (V.Base instanceof EnvironmentRecord) {
    return V.Base.SetMutableBinding(V.ReferenceName, W, V.Strict);
  }
  // IsPropertyReference
  // ReturnIfAbrupt
  const baseObj = ToObject(V.Base);
  baseObj[V.ReferenceName] = W;
  return NormalCompletion(undefined);
}

export function CreateListIteratorRecord(
  args: Iterable<unknown>
): Iterator<unknown> {
  if (!isIterable(args)) {
    throw new TypeError(`${typeof args} is not iterable`);
  }
  return args[Symbol.iterator]();
}

export function InitializeReferencedBinding(
  V: ReferenceRecord,
  W: unknown
): CompletionRecord {
  // ReturnIfAbrupt(V).
  // ReturnIfAbrupt(W).
  const base = V.Base as EnvironmentRecord;
  return base.InitializeBinding(V.ReferenceName, W);
}

export function RequireObjectCoercible(arg: unknown): void {
  if (arg === null || arg === undefined) {
    throw new TypeError();
  }
}

export function EvaluateBinaryExpression(
  operator: (BinaryExpression | LogicalExpression)["operator"] | "|>",
  leftValue: number,
  rightValue: number
): unknown {
  switch (operator) {
    case "+":
      return NormalCompletion(leftValue + rightValue);
    case "-":
      return NormalCompletion(leftValue + rightValue);
    case "/":
      return NormalCompletion(leftValue / rightValue);
    case "%":
      return NormalCompletion(leftValue % rightValue);
    case "*":
      return NormalCompletion(leftValue * rightValue);
    case "**":
      return NormalCompletion(leftValue ** rightValue);
    case "==":
      return NormalCompletion(leftValue == rightValue);
    case "===":
      return NormalCompletion(leftValue === rightValue);
    case "!=":
      return NormalCompletion(leftValue != rightValue);
    case "!==":
      return NormalCompletion(leftValue !== rightValue);
    case ">":
      return NormalCompletion(leftValue > rightValue);
    case "<":
      return NormalCompletion(leftValue < rightValue);
    case ">=":
      return NormalCompletion(leftValue >= rightValue);
    case "<=":
      return NormalCompletion(leftValue <= rightValue);
    case "|>":
      if ((typeof rightValue as unknown) !== "function") {
        throw new TypeError();
      }
      return NormalCompletion(
        (rightValue as unknown as SimpleFunction)(leftValue)
      );
  }
}

// const { shouldReturn, abruptRecord, value } = ReturnIfAbrupt(arg);
// if (shouldReturn) {
//   return abruptRecord;
// }
// arg = value;
function ReturnIfAbrupt(arg: unknown):
  | {
      shouldReturn: true;
      abruptRecord: CompletionRecord;
      value?: undefined;
    }
  | {
      shouldReturn?: false;
      abruptRecord?: undefined;
      value: unknown;
    } {
  if (arg instanceof CompletionRecord) {
    if (arg.Type === "normal") {
      return { value: arg.Value };
    }
    return { shouldReturn: true, abruptRecord: arg };
  }
  return { value: arg };
}
