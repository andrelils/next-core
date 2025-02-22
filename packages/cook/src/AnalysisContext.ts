import { Expression, FunctionDeclaration, Statement } from "@babel/types";

// https://tc39.es/ecma262/#sec-execution-contexts
export class AnalysisContext {
  VariableEnvironment: AnalysisEnvironment;
  LexicalEnvironment: AnalysisEnvironment;
}

// https://tc39.es/ecma262/#sec-environment-records
export class AnalysisEnvironment {
  readonly OuterEnv: AnalysisEnvironment;
  private readonly bindingSet = new Set<string>();

  constructor(outer: AnalysisEnvironment) {
    this.OuterEnv = outer;
  }

  HasBinding(name: string): boolean {
    return this.bindingSet.has(name);
  }

  CreateBinding(name: string): void {
    this.bindingSet.add(name);
  }
}

export interface AnalysisFunctionObject {
  FormalParameters: FunctionDeclaration["params"];
  ECMAScriptCode: Statement[] | Expression;
  Environment: AnalysisEnvironment;
}
