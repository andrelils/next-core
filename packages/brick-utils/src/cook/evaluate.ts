import {
  ArrowFunctionExpression,
  BlockStatement,
  Expression,
  FunctionDeclaration,
  VariableDeclaration,
} from "@babel/types";
import {
  EnvironmentRecord,
  ExecutionContext,
  ExecutionContextStack,
  FunctionObject,
  PrivateEnvironmentRecord,
} from "./ExecutionContext";
import { EstreeNode } from "./interfaces";
import {
  collectBoundNames,
  collectScopedDeclarations,
  containsExpression,
  getDeclaredNames,
} from "./traverse";

export function evaluate(root: EstreeNode): void {
  const executionContextStack = new ExecutionContextStack();
  const globalEnv = new EnvironmentRecord("declarative", null);
  const scriptContext = new ExecutionContext();
  scriptContext.variableEnv = globalEnv;
  scriptContext.lexicalEnv = globalEnv;
  scriptContext.privateEnv = null;
  executionContextStack.push(scriptContext);

  function Evaluate(node: EstreeNode | EstreeNode[]): void {
    if (Array.isArray(node)) {
      for (const n of node) {
        Evaluate(n);
      }
    } else if (node) {
      // `node` maybe `null` in some cases.
      switch (node.type) {
        case "Identifier":
          ResolveBinding(node.name);
          break;
        case "ArrowFunctionExpression": {
          const closure = InstantiateArrowFunctionExpression(node);
          // > start: closure.Call()
          const callerContext = executionContextStack.getRunningContext();
          const calleeContext = PrepareOrdinaryCall(closure);
          // !miss: if (closure.IsClassConstructor) ...
          // !miss: OrdinaryCallBindThis(closure, calleeContext, thisArgument)
          const result = OrdinaryCallEvaluateBody(closure, []);
          // 7. Remove calleeContext from the execution context stack and restore callerContext as the running execution context.
          executionContextStack.pop();
          // !miss:
          // 8. If result.[[Type]] is return, return NormalCompletion(result.[[Value]]).
          // 9. ReturnIfAbrupt(result).
          // 10. Return NormalCompletion(undefined).
          // < end: closure.Call()
          break;
        }
      }
    }
  }

  function ResolveBinding(name: string, env?: EnvironmentRecord): unknown {
    /*
      The abstract operation ResolveBinding takes argument name (a String) and optional argument env (an Environment Record
      or undefined). It is used to determine the binding of name. env can be used to explicitly provide the Environment Record
      that is to be searched for the binding. It performs the following steps when called:

      1. If env is not present or if env is undefined, then
      a. Set env to the running execution context's LexicalEnvironment.
      2. Assert: env is an Environment Record.
      3. If the code matching the syntactic production that is being evaluated is contained in strict mode code, let strict
         be true; else let strict be false.
      4. Return ? GetIdentifierReference(env, name, strict).
     */
    if (!env) {
      env = executionContextStack.getRunningContext().lexicalEnv;
    }
    return GetIdentifierReference(env, name);
  }

  function GetIdentifierReference(
    env: EnvironmentRecord,
    name: string
  ): unknown {
    /*
      The abstract operation GetIdentifierReference takes arguments env (an Environment Record or null), name (a String),
      and strict (a Boolean). It performs the following steps when called:

      1. If env is the value null, then
      a. Return the Reference Record
         { [[Base]]: unresolvable, [[ReferencedName]]: name, [[Strict]]: strict, [[ThisValue]]: empty }.
      2. Let exists be ? env.HasBinding(name).
      3. If exists is true, then
      a. Return the Reference Record { [[Base]]: env, [[ReferencedName]]: name, [[Strict]]: strict, [[ThisValue]]: empty }.
      4. Else,
      a. Let outer be env.[[OuterEnv]].
      b. Return ? GetIdentifierReference(outer, name, strict).
     */
    if (!env) {
      return false;
    }
    return env.HasBinding(name) || GetIdentifierReference(env.outer, name);
  }

  function PrepareOrdinaryCall(F: FunctionObject): ExecutionContext {
    // const callerContext = executionContextStack.getRunningContext();
    const calleeContext = new ExecutionContext();
    calleeContext.Function = F;
    const localEnv = new EnvironmentRecord("function", F.Environment);
    calleeContext.variableEnv = localEnv;
    calleeContext.lexicalEnv = localEnv;
    calleeContext.privateEnv = F.PrivateEnvironment;
    // callerContext.suspend();
    executionContextStack.push(calleeContext);
    return calleeContext;
  }

  function OrdinaryCallEvaluateBody(
    F: FunctionObject,
    args: unknown[]
  ): unknown {
    return EvaluateFunctionBody(F.ECMAScriptCode, F, args);
  }

  function EvaluateFunctionBody(
    body: BlockStatement | Expression,
    F: FunctionObject,
    args: unknown[]
  ): unknown {
    FunctionDeclarationInstantiation(F, args);
    return Evaluate(body);
  }

  function FunctionDeclarationInstantiation(
    func: FunctionObject,
    args: unknown[]
  ): void {
    const calleeContext = executionContextStack.getRunningContext();
    const code = func.ECMAScriptCode as BlockStatement | Expression;
    const formals = func.FormalParameters as FunctionDeclaration["params"];
    const parameterNames = collectBoundNames(formals);
    const hasParameterExpressions = containsExpression(formals);
    const varDeclarations = collectScopedDeclarations(code, {
      var: true,
      topLevel: true,
    });
    const varNames = getDeclaredNames(varDeclarations);

    // `functionNames` ∈ `varNames`
    // `functionsToInitialize` ≈ `functionNames`
    const functionNames: string[] = [];
    const functionsToInitialize: FunctionDeclaration[] = [];
    for (let i = varDeclarations.length - 1; i >= 0; i--) {
      const d = varDeclarations[i];
      if (d.type === "FunctionDeclaration") {
        const [fn] = collectBoundNames(d);
        if (!functionNames.includes(fn)) {
          functionNames.unshift(fn);
          functionsToInitialize.unshift(d);
        }
      }
    }

    const env = calleeContext.lexicalEnv;
    for (const paramName of parameterNames) {
      // In strict mode, it's guaranteed no duplicate params exist.
      env.CreateMutableBinding(paramName, false);
    }

    // Binding parameters initialization.
    // Return-If-Abrupt

    let varEnv: EnvironmentRecord;
    let instantiatedVarNames: string[];
    if (!hasParameterExpressions) {
      // NOTE: Only a single Environment Record is needed for the parameters
      // and top-level vars.
      instantiatedVarNames = Array.from(parameterNames);
      for (const n of varNames) {
        if (!instantiatedVarNames.includes(n)) {
          instantiatedVarNames.push(n);
          env.CreateMutableBinding(n, false);
          env.InitializeBinding(n, undefined);
        }
      }
      varEnv = env;
    } else {
      // NOTE: A separate Environment Record is needed to ensure that closures
      // created by expressions in the formal parameter list do not have
      // visibility of declarations in the function body.
      varEnv = env.spawn();
      calleeContext.variableEnv = varEnv;
      instantiatedVarNames = [];
      for (const n of varNames) {
        if (!instantiatedVarNames.includes(n)) {
          instantiatedVarNames.push(n);
          varEnv.CreateMutableBinding(n, false);
          let initialValue: unknown;
          if (!parameterNames.has(n) || functionNames.includes(n)) {
            //
          } else {
            initialValue = env.GetBindingValue(n, false);
          }
          varEnv.InitializeBinding(n, initialValue);
          // NOTE: A var with the same name as a formal parameter initially has
          // the same value as the corresponding initialized parameter.
        }
      }
    }
    const lexEnv = varEnv;
    calleeContext.lexicalEnv = lexEnv;

    const lexDeclarations = collectScopedDeclarations(code, {
      var: false,
      topLevel: true,
    });
    for (const d of lexDeclarations) {
      for (const dn of collectBoundNames(d)) {
        // Only lexical VariableDeclaration here in top-level.
        if ((d as VariableDeclaration).kind === "const") {
          lexEnv.CreateImmutableBinding(dn, true);
        } else {
          lexEnv.CreateMutableBinding(dn, false);
        }
      }
    }

    const { privateEnv } = calleeContext;
    for (const f of functionsToInitialize) {
      const [fn] = collectBoundNames(f);
      let fo; //= InstantiateFunctionObject(f, lexEnv, privateEnv);
      varEnv.SetMutableBinding(fn, fo, false);
    }
  }

  function InstantiateArrowFunctionExpression(
    arrowFunction: ArrowFunctionExpression
  ): FunctionObject {
    const runningContext = executionContextStack.getRunningContext();
    const scope = runningContext.lexicalEnv;
    const privateScope = runningContext.privateEnv;
    const closure = OrdinaryFunctionCreate(
      arrowFunction.params,
      arrowFunction.body,
      scope,
      privateScope
    );
    return closure;
  }

  function OrdinaryFunctionCreate(
    parameterList: FunctionDeclaration["params"],
    body: BlockStatement | Expression,
    scope: EnvironmentRecord,
    privateScope: PrivateEnvironmentRecord
  ): FunctionObject {
    const F: FunctionObject = {};
    // F.Call = (argumentsList: unknown[]): unknown => void 0;
    F.FormalParameters = parameterList;
    F.ECMAScriptCode = body;
    F.Environment = scope;
    F.PrivateEnvironment = privateScope;
    return F;
  }

  Evaluate(root);
}
