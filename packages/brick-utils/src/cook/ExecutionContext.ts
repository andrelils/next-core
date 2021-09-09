import { Expression, FunctionDeclaration, Statement } from "@babel/types";

// https://tc39.es/ecma262/#sec-execution-contexts
export class ExecutionContext {
  VariableEnvironment: EnvironmentRecord;
  LexicalEnvironment: EnvironmentRecord;
  Function: FunctionObject;
}

export type EnvironmentRecordType = "function" | "declarative";

// https://tc39.es/ecma262/#sec-environment-records
export class EnvironmentRecord {
  readonly OuterEnv: EnvironmentRecord;
  private readonly bindingMap = new Map<string, BindingState>();

  constructor(outer: EnvironmentRecord) {
    this.OuterEnv = outer;
  }

  HasBinding(name: string): boolean {
    return this.bindingMap.has(name);
  }

  CreateMutableBinding(name: string, deletable: boolean): CompletionRecord {
    // Assert: binding does not exist.
    this.bindingMap.set(name, {
      mutable: true,
      deletable: deletable,
    });
    return NormalCompletion(undefined);
  }

  CreateImmutableBinding(name: string, strict: boolean): CompletionRecord {
    // Assert: binding does not exist.
    this.bindingMap.set(name, {
      strict: strict,
    });
    return NormalCompletion(undefined);
  }

  InitializeBinding(name: string, value: unknown): CompletionRecord {
    const binding = this.bindingMap.get(name);
    // Assert: binding exists and uninitialized.
    Object.assign<BindingState, Partial<BindingState>>(binding, {
      initialized: true,
      value,
    });
    return NormalCompletion(undefined);
  }

  SetMutableBinding(
    name: string,
    value: unknown,
    strict: boolean
  ): CompletionRecord {
    const binding = this.bindingMap.get(name);
    if (!binding) {
      if (strict) {
        throw new ReferenceError(`[strict] no binding for ${name}`);
      }
      this.CreateMutableBinding(name, true);
      this.InitializeBinding(name, value);
      return NormalCompletion(undefined);
    }
    if (binding.strict) {
      strict = true;
    }
    if (!binding.initialized) {
      throw new ReferenceError(`${name} is not initialized`);
    } else if (binding.mutable) {
      binding.value = value;
    } else if (strict) {
      throw new TypeError(`Attempt to change an immutable binding`);
    }
    return NormalCompletion(undefined);
  }

  GetBindingValue(name: string, strict: boolean): unknown {
    const binding = this.bindingMap.get(name);
    if (strict && !binding) {
      throw new ReferenceError();
    }
    // Assert: binding exists.
    if (!binding.initialized) {
      throw new ReferenceError(`${name} is not initialized`);
    }
    return binding.value;
  }

  DeleteBinding(name: string): boolean {
    const binding = this.bindingMap.get(name);
    // Assert: binding exists.
    if (!binding.deletable) {
      return false;
    }
    this.bindingMap.delete(name);
    return true;
  }

  IsUninitializedBinding(name: string): boolean {
    const binding = this.bindingMap.get(name);
    return !!binding && !binding.initialized;
  }
}

export class DeclarativeEnvironment extends EnvironmentRecord {}

export class FunctionEnvironment extends EnvironmentRecord {}

export interface BindingState {
  initialized?: boolean;
  mutable?: boolean;
  deletable?: boolean;
  strict?: boolean;
  value?: unknown;
}

export const FormalParameters = Symbol.for("FormalParameters");
export const ECMAScriptCode = Symbol.for("ECMAScriptCode");
export const Environment = Symbol.for("Environment");

export interface FunctionObject {
  (...args: unknown[]): unknown;
  [FormalParameters]: FunctionDeclaration["params"];
  [ECMAScriptCode]: Statement[] | Expression;
  [Environment]: EnvironmentRecord;
}

export class ReferenceRecord {
  readonly Base?: unknown | EnvironmentRecord | "unresolvable";
  readonly ReferenceName?: PropertyKey;
  readonly Strict?: boolean;

  constructor(
    base: unknown | EnvironmentRecord | "unresolvable",
    referenceName: PropertyKey,
    strict: boolean
  ) {
    this.Base = base;
    this.ReferenceName = referenceName;
    this.Strict = strict;
  }
}

export type CompletionRecordType =
  | "normal"
  | "break"
  | "continue"
  | "return"
  | "throw";

export class CompletionRecord {
  readonly Type: CompletionRecordType;
  readonly Value: unknown;

  constructor(type: CompletionRecordType, value: unknown) {
    this.Type = type;
    this.Value = value;
  }
}

export const Empty = Symbol("empty completion");

export function NormalCompletion(value: unknown): CompletionRecord {
  if (value instanceof CompletionRecord) {
    throw new TypeError(
      "We cannot set a CompletionRecord as the Value of another CompletionRecord"
    );
  }
  return new CompletionRecord("normal", value);
}
