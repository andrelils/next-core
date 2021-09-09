import { BinaryExpression, LogicalExpression, PatternLike } from "@babel/types";
import { SimpleFunction } from "@next-core/brick-types";
import { right } from "inquirer/lib/utils/readline";
import {
  CompletionRecord,
  Empty,
  EnvironmentRecord,
  NormalCompletion,
  ReferenceRecord,
} from "./ExecutionContext";
import { isIterable } from "./utils";

export function IsPropertyReference(V: ReferenceRecord): boolean {
  return V.Base !== "unresolvable" && !(V.Base instanceof EnvironmentRecord);
}

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
    return base.GetBindingValue(V.ReferenceName as string, V.Strict);
  } else {
    // NOTE
    // The object that may be created in step 4.a is not accessible outside of the above abstract operation
    // and the ordinary object [[Get]] internal method. An implementation might choose to avoid the actual
    // creation of the object.
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
  const O = ToObject(V);
  return O[P];
}

export function PutValue(V: ReferenceRecord, W: unknown): CompletionRecord {
  if (!(V instanceof ReferenceRecord)) {
    throw new ReferenceError();
  }
  if (V.Base === "unresolvable") {
    throw new ReferenceError();
  }
  if (V.Base instanceof EnvironmentRecord) {
    return V.Base.SetMutableBinding(V.ReferenceName as string, W, V.Strict);
  }
  // IsPropertyReference
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
  const base = V.Base as EnvironmentRecord;
  return base.InitializeBinding(V.ReferenceName as string, W);
}

export function RequireObjectCoercible(arg: unknown): void {
  if (arg === null || arg === undefined) {
    throw new TypeError();
  }
}

export function ApplyStringOrNumericBinaryOperator(
  leftValue: number,
  operator: (BinaryExpression | LogicalExpression)["operator"] | "|>",
  rightValue: number
): unknown {
  switch (operator) {
    case "+":
      return leftValue + rightValue;
    case "-":
      return leftValue + rightValue;
    case "/":
      return leftValue / rightValue;
    case "%":
      return leftValue % rightValue;
    case "*":
      return leftValue * rightValue;
    case "**":
      return leftValue ** rightValue;
    case "==":
      return leftValue == rightValue;
    case "===":
      return leftValue === rightValue;
    case "!=":
      return leftValue != rightValue;
    case "!==":
      return leftValue !== rightValue;
    case ">":
      return leftValue > rightValue;
    case "<":
      return leftValue < rightValue;
    case ">=":
      return leftValue >= rightValue;
    case "<=":
      return leftValue <= rightValue;
    case "|>":
      if ((typeof rightValue as unknown) !== "function") {
        throw new TypeError();
      }
      return (rightValue as unknown as SimpleFunction)(leftValue);
  }
  throw new SyntaxError(`Unsupported binary operator \`${operator}\``);
}

export function ApplyStringOrNumericAssignment(
  leftValue: string | number,
  operator: string,
  rightValue: string | number
): unknown {
  switch (operator) {
    case "+=":
    case "-=":
    case "*=":
    case "/=":
    case "%=":
    case "**=":
      return ApplyStringOrNumericBinaryOperator(
        leftValue as number,
        operator.substr(0, operator.length - 1) as BinaryExpression["operator"],
        rightValue as number
      );
  }

  throw new SyntaxError(`Unsupported assignment operator \`${operator}\``);
}
