import {
  ArrowFunctionExpression,
  BlockStatement,
  Expression,
  FunctionDeclaration,
  FunctionExpression,
  Statement,
  SwitchCase,
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

export interface AnalysisOptions {
  expressionOnly?: boolean;
}

export function analysis(
  root: EstreeNode,
  { expressionOnly }: AnalysisOptions = {}
): string[] {
  const attemptToVisitGlobals = new Set<string>();

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
      // Expressions:
      switch (node.type) {
        case "Identifier":
          if (!ResolveBinding(node.name)) {
            attemptToVisitGlobals.add(node.name);
          }
          return;
        case "ArrayExpression":
        case "ArrayPattern":
          Evaluate(node.elements);
          return;
        case "ArrowFunctionExpression": {
          const closure = InstantiateArrowFunctionExpression(node);
          CallFunction(closure);
          return;
        }
        case "AssignmentPattern":
        case "BinaryExpression":
        case "LogicalExpression":
          Evaluate(node.left);
          Evaluate(node.right);
          return;
        case "CallExpression":
        case "NewExpression":
          Evaluate(node.callee);
          Evaluate(node.arguments);
          return;
        case "ChainExpression":
          Evaluate(node.expression);
          return;
        case "ConditionalExpression":
          Evaluate(node.test);
          Evaluate(node.consequent);
          Evaluate(node.alternate);
          return;
        case "MemberExpression":
          Evaluate(node.object);
          if (node.computed) {
            Evaluate(node.property);
          }
          return;
        case "ObjectExpression":
        case "ObjectPattern":
          Evaluate(node.properties);
          return;
        case "Property":
          if (node.computed) {
            Evaluate(node.key);
          }
          Evaluate(node.value);
          return;
        case "RestElement":
        case "SpreadElement":
        case "UnaryExpression":
          Evaluate(node.argument);
          return;
        case "SequenceExpression":
        case "TemplateLiteral":
          Evaluate(node.expressions);
          return;
        case "TaggedTemplateExpression":
          Evaluate(node.tag);
          Evaluate(node.quasi);
          return;
        case "Literal":
          return;
      }
      if (!expressionOnly) {
        // Statements and assignments:
        switch (node.type) {
          case "AssignmentExpression":
            Evaluate(node.right);
            Evaluate(node.left);
            return;
          case "BlockStatement": {
            if (!node.body.length) {
              return;
            }
            /*
              1. Let oldEnv be the running execution context's LexicalEnvironment.
              2. Let blockEnv be NewDeclarativeEnvironment(oldEnv).
              3. Perform BlockDeclarationInstantiation(StatementList, blockEnv).
              4. Set the running execution context's LexicalEnvironment to blockEnv.
              5. Let blockValue be the result of evaluating StatementList.
              6. Set the running execution context's LexicalEnvironment to oldEnv.
              7. Return blockValue.
             */
            const runningContext = executionContextStack.getRunningContext();
            const oldEnv = runningContext.lexicalEnv;
            const blockEnv = new EnvironmentRecord("declarative", oldEnv);
            BlockDeclarationInstantiation(node.body, blockEnv);
            runningContext.lexicalEnv = blockEnv;
            Evaluate(node.body);
            runningContext.lexicalEnv = oldEnv;
            return;
          }
          case "BreakStatement":
          case "ContinueStatement":
          case "EmptyStatement":
            return;
          case "CatchClause": {
            const runningContext = executionContextStack.getRunningContext();
            const oldEnv = runningContext.lexicalEnv;
            const catchEnv = new EnvironmentRecord("declarative", oldEnv);
            for (const argName of collectBoundNames(node.param)) {
              catchEnv.CreateMutableBinding(argName, false);
            }
            runningContext.lexicalEnv = catchEnv;
            Evaluate(node.param);
            Evaluate(node.body);
            runningContext.lexicalEnv = oldEnv;
            return;
          }
          case "DoWhileStatement":
            Evaluate(node.body);
            Evaluate(node.test);
            return;
          case "ExpressionStatement":
          case "TSAsExpression":
            Evaluate(node.expression);
            return;
          case "ForInStatement":
          case "ForOfStatement": {
            // ForIn/OfHeadEvaluation
            const lexicalBinding =
              node.left.type === "VariableDeclaration" &&
              node.left.kind !== "var";
            const runningContext = executionContextStack.getRunningContext();
            const oldEnv = runningContext.lexicalEnv;
            if (lexicalBinding) {
              const uninitializedBoundNames = collectBoundNames(node.left);
              const newEnv = new EnvironmentRecord("declarative", oldEnv);
              for (const name of uninitializedBoundNames) {
                newEnv.CreateMutableBinding(name, false);
              }
              runningContext.lexicalEnv = newEnv;
            }
            Evaluate(node.right);
            runningContext.lexicalEnv = oldEnv;

            // ForIn/OfBodyEvaluation
            // const oldEnv = runningContext.lexicalEnv;
            if (lexicalBinding) {
              const iterationEnv = new EnvironmentRecord("declarative", oldEnv);
              ForDeclarationBindingInstantiation(
                node.left as VariableDeclaration,
                iterationEnv
              );
              runningContext.lexicalEnv = iterationEnv;
            }
            Evaluate(node.left);
            Evaluate(node.body);
            runningContext.lexicalEnv = oldEnv;
            return;
          }
          case "ForStatement": {
            if (node.init.type === "VariableDeclaration") {
              if (node.init.kind === "var") {
                /*
                  1. Let varDcl be the result of evaluating VariableDeclarationList.
                  2. ReturnIfAbrupt(varDcl).
                  3. Return ? ForBodyEvaluation(the first Expression, the second Expression,
                     Statement, « », labelSet).
                 */
                Evaluate(node.init);
                Evaluate(node.test);
                Evaluate(node.body);
                Evaluate(node.update);
              } else {
                /*
                  1. Let oldEnv be the running execution context's LexicalEnvironment.
                  2. Let loopEnv be NewDeclarativeEnvironment(oldEnv).
                  3. Let isConst be IsConstantDeclaration of LexicalDeclaration.
                  4. Let boundNames be the BoundNames of LexicalDeclaration.
                  5. For each element dn of boundNames, do
                    a. If isConst is true, then
                      i. Perform ! loopEnv.CreateImmutableBinding(dn, true).
                    b. Else,
                      i. Perform ! loopEnv.CreateMutableBinding(dn, false).
                  6. Set the running execution context's LexicalEnvironment to loopEnv.
                  7. Let forDcl be the result of evaluating LexicalDeclaration.
                  8. If forDcl is an abrupt completion, then
                    a. Set the running execution context's LexicalEnvironment to oldEnv.
                    b. Return Completion(forDcl).
                  9. If isConst is false, let perIterationLets be boundNames; otherwise let perIterationLets be « ».
                  10. Let bodyResult be ForBodyEvaluation(the first Expression, the second Expression, Statement, perIterationLets, labelSet).
                  11. Set the running execution context's LexicalEnvironment to oldEnv.
                  12. Return Completion(bodyResult).
                 */
                const runningContext =
                  executionContextStack.getRunningContext();
                const oldEnv = runningContext.lexicalEnv;
                const loopEnv = new EnvironmentRecord("declarative", oldEnv);
                const isConst = node.init.kind === "const";
                const boundNames = collectBoundNames(node.init);
                for (const dn of boundNames) {
                  if (isConst) {
                    loopEnv.CreateImmutableBinding(dn, true);
                  } else {
                    loopEnv.CreateMutableBinding(dn, false);
                  }
                }
                runningContext.lexicalEnv = loopEnv;
                Evaluate(node.init);
                Evaluate(node.test);
                Evaluate(node.body);
                Evaluate(node.update);
                runningContext.lexicalEnv = oldEnv;
              }
            }
            return;
          }
          case "FunctionDeclaration": {
            const [fn] = collectBoundNames(node);
            const env = executionContextStack.getRunningContext().lexicalEnv;
            const fo = InstantiateFunctionObject(node, env, null);
            env.CreateImmutableBinding(fn, true);
            env.InitializeBinding(fn, fo);
            CallFunction(fo);
            return;
          }
          case "FunctionExpression": {
            const closure = InstantiateOrdinaryFunctionExpression(node);
            CallFunction(closure);
            return;
          }
          case "IfStatement":
            Evaluate(node.test);
            Evaluate(node.consequent);
            Evaluate(node.alternate);
            return;
          case "ReturnStatement":
          case "ThrowStatement":
          case "UpdateExpression":
            Evaluate(node.argument);
            return;
          case "SwitchCase":
            Evaluate(node.test);
            Evaluate(node.consequent);
            return;
          case "SwitchStatement": {
            Evaluate(node.discriminant);
            const runningContext = executionContextStack.getRunningContext();
            const oldEnv = runningContext.lexicalEnv;
            const blockEnv = new EnvironmentRecord("declarative", oldEnv);
            BlockDeclarationInstantiation(node.cases, blockEnv);
            runningContext.lexicalEnv = blockEnv;
            Evaluate(node.cases);
            runningContext.lexicalEnv = oldEnv;
            return;
          }
          case "TryStatement":
            Evaluate(node.block);
            Evaluate(node.handler);
            Evaluate(node.finalizer);
            return;
          case "VariableDeclaration":
            Evaluate(node.declarations);
            return;
          case "VariableDeclarator":
            Evaluate(node.id);
            Evaluate(node.init);
            return;
          case "WhileStatement":
            Evaluate(node.test);
            Evaluate(node.body);
            return;
        }
      }
      // eslint-disable-next-line no-console
      console.log(`Unsupported node type \`${node.type}\``);
    }
  }

  function ForDeclarationBindingInstantiation(
    forDeclaration: VariableDeclaration,
    env: EnvironmentRecord
  ): void {
    const isConst = forDeclaration.kind === "const";
    for (const name of collectBoundNames(forDeclaration.declarations)) {
      if (isConst) {
        env.CreateImmutableBinding(name, true);
      } else {
        env.CreateMutableBinding(name, false);
      }
    }
  }

  function CallFunction(closure: FunctionObject): void {
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

  function BlockDeclarationInstantiation(
    code: Statement[] | SwitchCase[],
    env: EnvironmentRecord
  ): void {
    /*
      The abstract operation BlockDeclarationInstantiation takes arguments code (a Parse Node) and env
      (a declarative Environment Record). code is the Parse Node corresponding to the body of the block.
      env is the Environment Record in which bindings are to be created.

      NOTE
      When a Block or CaseBlock is evaluated a new declarative Environment Record is created and bindings
      for each block scoped variable, constant, function, or class declared in the block are instantiated
      in the Environment Record.

      It performs the following steps when called:

      1. Let declarations be the LexicallyScopedDeclarations of code.
      2. Let privateEnv be the running execution context's PrivateEnvironment.
      3. For each element d of declarations, do
        a. For each element dn of the BoundNames of d, do
          i. If IsConstantDeclaration of d is true, then
            1. Perform ! env.CreateImmutableBinding(dn, true).
          ii. Else,
            1. Perform ! env.CreateMutableBinding(dn, false). NOTE: This step is replaced in section B.3.2.6.
        b. If d is a FunctionDeclaration, a GeneratorDeclaration, an AsyncFunctionDeclaration, or an
           AsyncGeneratorDeclaration, then
          i. Let fn be the sole element of the BoundNames of d.
          ii. Let fo be InstantiateFunctionObject of d with arguments env and privateEnv.
          iii. Perform env.InitializeBinding(fn, fo). NOTE: This step is replaced in section B.3.2.6.
     */
    const declarations = collectScopedDeclarations(code, {
      var: false,
      topLevel: false,
    });
    const { privateEnv } = executionContextStack.getRunningContext();
    for (const d of declarations) {
      const IsConstantDeclaration =
        d.type === "VariableDeclaration" && d.kind === "const";
      for (const dn of collectBoundNames(d)) {
        if (IsConstantDeclaration) {
          env.CreateImmutableBinding(dn, true);
        } else if (!env.HasBinding(dn)) {
          env.CreateMutableBinding(dn, false);
        }
      }
      if (d.type === "FunctionDeclaration") {
        const [fn] = collectBoundNames(d);
        const fo = InstantiateFunctionObject(d, env, privateEnv);
        if (env.IsUninitializedBinding(fn)) {
          env.InitializeBinding(fn, fo);
        } else {
          env.SetMutableBinding(fn, fo, false);
        }
      }
    }
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
    body: Statement[] | Expression,
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
    /*
      24. Let iteratorRecord be CreateListIteratorRecord(argumentsList).
      25. Perform ? IteratorBindingInitialization for formals with iteratorRecord and env as arguments.
     */
    Evaluate(formals);

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
      varEnv = new EnvironmentRecord("declarative", env);
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
      const fo = InstantiateFunctionObject(f, lexEnv, privateEnv);
      varEnv.SetMutableBinding(fn, fo, false);
    }
  }

  function InstantiateFunctionObject(
    func: FunctionDeclaration,
    scope: EnvironmentRecord,
    privateScope: PrivateEnvironmentRecord
  ): FunctionObject {
    const F = OrdinaryFunctionCreate(
      func.params,
      func.body,
      scope,
      privateScope
    );
    return F;
  }

  function InstantiateOrdinaryFunctionExpression(
    functionExpression: FunctionExpression
  ): FunctionObject {
    const { lexicalEnv: scope, privateEnv: privateScope } =
      executionContextStack.getRunningContext();
    if (functionExpression.id) {
      const name = functionExpression.id.name;
      const funcEnv = new EnvironmentRecord("declarative", scope);
      funcEnv.CreateImmutableBinding(name, false);
      const closure = OrdinaryFunctionCreate(
        functionExpression.params,
        functionExpression.body,
        funcEnv,
        privateScope
      );
      funcEnv.InitializeBinding(name, closure);
      return closure;
    } else {
      const closure = OrdinaryFunctionCreate(
        functionExpression.params,
        functionExpression.body,
        scope,
        privateScope
      );
      return closure;
    }
  }

  function InstantiateArrowFunctionExpression(
    arrowFunction: ArrowFunctionExpression
  ): FunctionObject {
    const { lexicalEnv: scope, privateEnv: privateScope } =
      executionContextStack.getRunningContext();
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
    F.ECMAScriptCode = body.type === "BlockStatement" ? body.body : body;
    F.Environment = scope;
    F.PrivateEnvironment = privateScope;
    return F;
  }

  Evaluate(root);

  return Array.from(attemptToVisitGlobals);
}
