import { Expression, FunctionDeclaration, Statement } from "@babel/types";

export class ExecutionContextStack {
  private readonly stack: ExecutionContext[] = [];

  getRunningContext(): ExecutionContext {
    return this.stack[this.stack.length - 1];
  }

  push(context: ExecutionContext): void {
    this.stack.push(context);
  }

  pop(): void {
    this.stack.pop();
  }
}

// https://tc39.es/ecma262/#sec-execution-contexts
export class ExecutionContext {
  variableEnv: EnvironmentRecord;
  lexicalEnv: EnvironmentRecord;
  privateEnv: PrivateEnvironmentRecord;

  Function: unknown;
}

export type EnvironmentRecordType = "function" | "declarative";

// https://tc39.es/ecma262/#sec-environment-records
export class EnvironmentRecord {
  readonly type: EnvironmentRecordType;
  readonly outer: EnvironmentRecord;
  private readonly bindingMap = new Map<string, BindingState>();

  constructor(type: EnvironmentRecordType, outer: EnvironmentRecord) {
    this.type = type;
    this.outer = outer;
  }

  HasBinding(name: string): boolean {
    return this.bindingMap.has(name);
  }

  CreateMutableBinding(name: string, deletable: boolean): void {
    // Assert: binding does not exist.
    this.bindingMap.set(name, {
      mutable: true,
      deletable: deletable,
    });
  }

  CreateImmutableBinding(name: string, strict: boolean): void {
    // Assert: binding does not exist.
    this.bindingMap.set(name, {
      strict: strict,
    });
  }

  InitializeBinding(name: string, value: unknown): void {
    const binding = this.bindingMap.get(name);
    // Assert: binding exists and uninitialized.
    Object.assign<BindingState, Partial<BindingState>>(binding, {
      initialized: true,
      value,
    });
  }

  SetMutableBinding(name: string, value: unknown, strict: boolean): void {
    const binding = this.bindingMap.get(name);
    if (!binding) {
      if (strict) {
        throw new ReferenceError(`[strict] no binding for ${name}`);
      }
      this.CreateMutableBinding(name, true);
      this.InitializeBinding(name, value);
      return;
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
  }

  GetBindingValue(name: string, strict: boolean): unknown {
    const binding = this.bindingMap.get(name);
    // Assert: binding exists.
    if (!binding.initialized) {
      throw new ReferenceError(`${name} is not initialized`);
    }
    return binding.value;
  }

  DeleteBiding(name: string): boolean {
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

// https://tc39.es/ecma262/#sec-privateenvironment-records
export class PrivateEnvironmentRecord {}

export interface BindingState {
  initialized?: boolean;
  mutable?: boolean;
  deletable?: boolean;
  strict?: boolean;
  value?: unknown;
}

export interface FunctionObject {
  FormalParameters?: FunctionDeclaration["params"];
  ECMAScriptCode?: Statement[] | Expression;
  Environment?: EnvironmentRecord;
  PrivateEnvironment?: PrivateEnvironmentRecord;
}
