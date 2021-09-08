import {
  ArrayPattern,
  ArrowFunctionExpression,
  BlockStatement,
  Expression,
  ForInStatement,
  ForOfStatement,
  ForStatement,
  FunctionDeclaration,
  FunctionExpression,
  Identifier,
  LVal,
  ObjectPattern,
  PatternLike,
  RestElement,
  Statement,
  SwitchCase,
  VariableDeclaration,
} from "@babel/types";
import { CreateListIteratorRecord, GetV, GetValue, InitializeReferencedBinding, LoopContinues, RequireObjectCoercible, ToObject, UpdateEmpty } from "./context-free";
import {
  CompletionRecord,
  DeclarativeEnvironment,
  ECMAScriptCode,
  Empty,
  Environment,
  EnvironmentRecord,
  ExecutionContext,
  FormalParameters,
  FunctionEnvironment,
  FunctionObject,
  NormalCompletion,
  ReferenceRecord,
} from "./ExecutionContext";
import { EstreeNode, EstreeObjectPattern, EstreeProperty } from "./interfaces";
import {
  collectBoundNames,
  collectScopedDeclarations,
  containsExpression,
  getDeclaredNames,
} from "./traverse";

export function evaluate(
  root: FunctionDeclaration | ArrowFunctionExpression
): FunctionObject {
  const expressionOnly = root.type === "ArrowFunctionExpression";
  const rootEnv = new DeclarativeEnvironment(null);
  const rootContext = new ExecutionContext();
  rootContext.VariableEnvironment = rootEnv;
  rootContext.LexicalEnvironment = rootEnv;
  const executionContextStack = [rootContext];

  function getRunningContext(): ExecutionContext {
    return executionContextStack[executionContextStack.length - 1];
  }

  function Evaluate(node: EstreeNode): CompletionRecord {
    // Expressions:
    switch (node.type) {
      case "Identifier": {
        const ref = ResolveBinding(node.name);
        return NormalCompletion(ref);
      }
      case "ArrayExpression":
      case "ArrayPattern":
        return Evaluate(node.elements);
      case "ArrowFunctionExpression": {
        const closure = InstantiateArrowFunctionExpression(node);
        return NormalCompletion(closure);
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
        return NormalCompletion(node.value);
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
          const oldEnv = getRunningContext().LexicalEnvironment;
          const blockEnv = new DeclarativeEnvironment(oldEnv);
          BlockDeclarationInstantiation(node.body, blockEnv);
          getRunningContext().LexicalEnvironment = blockEnv;
          const blockValue = Evaluate(node.body);
          getRunningContext().LexicalEnvironment = oldEnv;
          return blockValue;
        }
        case "BreakStatement":
        case "ContinueStatement":
        case "EmptyStatement":
          return;
        case "CatchClause": {
          const oldEnv = getRunningContext().LexicalEnvironment;
          const catchEnv = new DeclarativeEnvironment(oldEnv);
          for (const argName of collectBoundNames(node.param)) {
            catchEnv.CreateMutableBinding(argName, false);
          }
          getRunningContext().LexicalEnvironment = catchEnv;
          Evaluate(node.param);
          Evaluate(node.body);
          getRunningContext().LexicalEnvironment = oldEnv;
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
        case "ForOfStatement":
          return ForInOfLoopEvaluation(node);
        case "ForStatement":
          return ForLoopEvaluation(node);
        case "FunctionDeclaration": {
          return NormalCompletion(Empty);
        }
        case "FunctionExpression": {
          const closure = InstantiateOrdinaryFunctionExpression(node);
          return NormalCompletion(closure);
        }
        case "IfStatement":
          Evaluate(node.test);
          Evaluate(node.consequent);
          Evaluate(node.alternate);
          return;
        case "ReturnStatement": {
          let v: unknown;
          if (node.argument) {
            const exprRef = Evaluate(node.argument);
            v = GetValue(exprRef);
          }
          return new CompletionRecord("return", v);
        }
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
          const runningContext = getRunningContext();
          const oldEnv = runningContext.LexicalEnvironment;
          const blockEnv = new DeclarativeEnvironment(oldEnv);
          BlockDeclarationInstantiation(node.cases, blockEnv);
          runningContext.LexicalEnvironment = blockEnv;
          Evaluate(node.cases);
          runningContext.LexicalEnvironment = oldEnv;
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

  function ForInOfLoopEvaluation(node: ForInStatement | ForOfStatement): CompletionRecord {
    // ForIn/OfHeadEvaluation
    // ForIn/OfBodyEvaluation
  }

  function ForInOfHeadEvaluation(uninitializedBoundNames: string[], expr: VariableDeclaration | LVal, iterationKind: "enumerate" | "iterate"): CompletionRecord {
    const runningContext = getRunningContext();
    const oldEnv = runningContext.LexicalEnvironment;
    if (uninitializedBoundNames.length > 0) {
      const uninitializedBoundNames = collectBoundNames(expr);
      const newEnv = new DeclarativeEnvironment(oldEnv);
      for (const name of uninitializedBoundNames) {
        newEnv.CreateMutableBinding(name, false);
      }
      runningContext.LexicalEnvironment = newEnv;
    }
    const exprRef = Evaluate(expr);
    runningContext.LexicalEnvironment = oldEnv;
    const exprValue = GetValue(exprRef);
    if (iterationKind === "enumerate") {
      if(exprValue === null || exprValue === undefined) {
        return new CompletionRecord("break", Empty);
      }
      // const obj = exprValue;
      // const iterator =
    } else {
      const iterator = CreateListIteratorRecord(exprValue as Iterable<unknown>);
      return NormalCompletion(iterator);
    }
  }

  function ForInOfBodyEvaluation(lhs: EstreeNode, stmt: EstreeNode, iteratorRecord: Iterator<unknown>, iterationKind: "enumerate" | "iterate", lhsKind: "varBinding" | "lexicalBinding" | "assignment"): CompletionRecord {
    const oldEnv = getRunningContext().LexicalEnvironment;
    let V: unknown;
    // Let destructuring be IsDestructuring of lhs.
    const destructuring = lhs.type === "AssignmentPattern";
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = iteratorRecord.next();
      if (done) {
        return NormalCompletion(V);
      }
      let lhsRef: CompletionRecord | ReferenceRecord;
      let iterationEnv: DeclarativeEnvironment;
      if (lhsKind === "lexicalBinding") {
        iterationEnv = new DeclarativeEnvironment(oldEnv);
        ForDeclarationBindingInstantiation(
          lhs as VariableDeclaration,
          iterationEnv
        );
        getRunningContext().LexicalEnvironment = iterationEnv;
        if (!destructuring) {
          const [lhsName] = collectBoundNames(lhs);
          lhsRef = ResolveBinding(lhsName);
        }
      } else {
        if (!destructuring) {
          lhsRef = Evaluate(lhs);
        }
      }
      let status: CompletionRecord;
      if (!destructuring) {
        if (lhsRef instanceof CompletionRecord && lhsRef.Type !== "normal") {
          status = lhsRef;
        } else {
          if (lhsRef instanceof CompletionRecord) {
            lhsRef = lhsRef.Value as ReferenceRecord;
          }
          if (lhsKind === "lexicalBinding") {
            status = InitializeReferencedBinding(lhsRef, value);
          } else {
            status = PutValue(lhsRef, value);
          }
        }
      } else {
        if (lhsKind === "assignment") {
          status = DestructuringAssignmentEvaluation(lhs, value);
        } else if (lhsKind === "varBinding") {
          status = BindingInitialization(lhs, value, undefined);
        } else {
          status = BindingInitialization(lhs, value, iterationEnv);
        }
      }
      // If status is an abrupt completion, then
      if (status.Type !== "normal") {
        getRunningContext().LexicalEnvironment = oldEnv;
        if (iterationKind === "enumerate") {
          return status;
        }
        return status;
      }
      const result = Evaluate(stmt);
      getRunningContext().LexicalEnvironment = oldEnv;
      if (!LoopContinues(result)) {
        return UpdateEmpty(result, V);
      }
      if (result.Value !== Empty) {
        V = result.Value;
      }
    }
  }

  function DestructuringAssignmentEvaluation(pattern: ObjectPattern | ArrayPattern, value: unknown): CompletionRecord {
    if (pattern.type === "ObjectPattern") {
      RequireObjectCoercible(value);
      if (pattern.properties.length > 0) {
        PropertyDestructuringAssignmentEvaluation(pattern.properties, value);
      }
      return NormalCompletion(Empty);
    }
    const iteratorRecord = CreateListIteratorRecord(value as Iterable<unknown>);
    let status = IteratorDestructuringAssignmentEvaluation(pattern.elements, iteratorRecord);
  }

  function IteratorDestructuringAssignmentEvaluation(elements: PatternLike[], iterator: Iterator<unknown): CompletionRecord {

  }

  // https://tc39.es/ecma262/#sec-runtime-semantics-forloopevaluation
  function ForLoopEvaluation(stmt: ForStatement): CompletionRecord {
    if (stmt.init?.type === "VariableDeclaration") {
      // `for (var … ; … ; … ) …`
      if (stmt.init.kind === "var") {
        Evaluate(stmt.init);
        return ForBodyEvaluation(stmt.test, stmt.update, stmt.body, []);
      }
      // `for (let/const … ; … ; … ) …`
      const oldEnv = getRunningContext().LexicalEnvironment;
      const loopEnv = new DeclarativeEnvironment(oldEnv);
      const isConst = stmt.init.kind === "const";
      const boundNames = collectBoundNames(stmt.init);
      for (const dn of boundNames) {
        if (isConst) {
          loopEnv.CreateImmutableBinding(dn, true);
        } else {
          loopEnv.CreateMutableBinding(dn, false);
        }
      }
      getRunningContext().LexicalEnvironment = loopEnv;
      const forDcl = Evaluate(stmt.init) as CompletionRecord;
      if (forDcl.Type !== "normal") {
        getRunningContext().LexicalEnvironment = oldEnv;
        return { ...forDcl };
      }
      const perIterationLets = isConst ? [] : Array.from(boundNames);
      const bodyResult = ForBodyEvaluation(
        stmt.test,
        stmt.update,
        stmt.body,
        perIterationLets
      );
      getRunningContext().LexicalEnvironment = oldEnv;
      return bodyResult;
    }
    // `for ( … ; … ; … ) …`
    if (stmt.init) {
      const exprRef = Evaluate(stmt.init);
      GetValue(exprRef);
    }
    return ForBodyEvaluation(stmt.test, stmt.update, stmt.body, []);
  }

  function ForBodyEvaluation(
    test: Expression,
    increment: Expression,
    stmt: Statement,
    perIterationBindings: string[]
  ): CompletionRecord {
    CreatePerIterationEnvironment(perIterationBindings);
    let V: unknown;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (test) {
        const testRef = Evaluate(test);
        const testValue = GetValue(testRef);
        if (!testValue) {
          return NormalCompletion(V);
        }
      }
      const result = Evaluate(stmt) as CompletionRecord;
      if (!LoopContinues(result)) {
        return UpdateEmpty(result, V);
      }
      if (result.Value) {
        V = result.Value;
      }
      CreatePerIterationEnvironment(perIterationBindings);
      if (increment) {
        const incRef = Evaluate(increment);
        GetValue(incRef);
      }
    }
  }

  function CreatePerIterationEnvironment(
    perIterationBindings: string[]
  ): unknown {
    if (perIterationBindings.length === 0) {
      return;
    }
    const lastIterationEnv = getRunningContext().LexicalEnvironment;
    const outer = lastIterationEnv.OuterEnv;
    const thisIterationEnv = new DeclarativeEnvironment(outer);
    for (const bn of perIterationBindings) {
      thisIterationEnv.CreateMutableBinding(bn, false);
      const lastValue = lastIterationEnv.GetBindingValue(bn, false);
      thisIterationEnv.InitializeBinding(bn, lastValue);
    }
    getRunningContext().LexicalEnvironment = thisIterationEnv;
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

  function ResolveBinding(name: string, env?: EnvironmentRecord): ReferenceRecord {
    if (!env) {
      env = getRunningContext().LexicalEnvironment;
    }
    // ReturnIfAbrupt
    return GetIdentifierReference(env, name, true);
  }

  function GetIdentifierReference(
    env: EnvironmentRecord,
    name: string,
    strict: boolean
  ): ReferenceRecord {
    if (!env) {
      return new ReferenceRecord("unresolvable", name, strict);
    }
    // ReturnIfAbrupt
    if (env.HasBinding(name)) {
      return new ReferenceRecord(env, name, strict);
    }
    // ReturnIfAbrupt
    return GetIdentifierReference(env.OuterEnv, name, strict);
  }

  function BlockDeclarationInstantiation(
    code: Statement[] | SwitchCase[],
    env: EnvironmentRecord
  ): void {
    const declarations = collectScopedDeclarations(code, {
      var: false,
      topLevel: false,
    });
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
        const fo = InstantiateFunctionObject(d, env);
        if (env.IsUninitializedBinding(fn)) {
          env.InitializeBinding(fn, fo);
        } else {
          env.SetMutableBinding(fn, fo, false);
        }
      }
    }
  }

  function CallFunction(closure: FunctionObject, args: Iterable<unknown>): unknown {
    PrepareOrdinaryCall(closure);
    const result = OrdinaryCallEvaluateBody(closure, args);
    executionContextStack.pop();
    if (result.Type === "return") {
      return result.Value;
    }
    // ReturnIfAbrupt(result)
    return undefined;
  }

  function PrepareOrdinaryCall(F: FunctionObject): ExecutionContext {
    // const callerContext = getRunningContext();
    const calleeContext = new ExecutionContext();
    calleeContext.Function = F;
    const localEnv = new FunctionEnvironment(F[Environment]);
    calleeContext.VariableEnvironment = localEnv;
    calleeContext.LexicalEnvironment = localEnv;
    // callerContext.suspend();
    executionContextStack.push(calleeContext);
    return calleeContext;
  }

  function OrdinaryCallEvaluateBody(
    F: FunctionObject,
    args: Iterable<unknown>
  ): CompletionRecord {
    return EvaluateFunctionBody(F[ECMAScriptCode], F, args);
  }

  function EvaluateFunctionBody(
    body: Statement[] | Expression,
    F: FunctionObject,
    args: Iterable<unknown>
  ): CompletionRecord {
    FunctionDeclarationInstantiation(F, args);
    return Array.isArray(body) ? EvaluateStatementList(body) : Evaluate(body);
  }

  function EvaluateStatementList(statements: Statement[]): CompletionRecord {
    let result = NormalCompletion(Empty);
    for (const stmt of statements) {
      const s = Evaluate(stmt);
      if (s.Type !== "normal") {
        return s;
      }
      if (s.Value) {
        result = s;
      }
    }
    return result;
  }

  function FunctionDeclarationInstantiation(
    func: FunctionObject,
    args: Iterable<unknown>
  ): void {
    const calleeContext = getRunningContext();
    const code = func[ECMAScriptCode] as BlockStatement | Expression;
    const formals = func[FormalParameters] as FunctionDeclaration["params"];
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

    const env = calleeContext.LexicalEnvironment;
    for (const paramName of parameterNames) {
      // In strict mode, it's guaranteed no duplicate params exist.
      env.CreateMutableBinding(paramName, false);
    }

    const iteratorRecord = CreateListIteratorRecord(args);
    IteratorBindingInitialization(formals, iteratorRecord, env);

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
      varEnv = new DeclarativeEnvironment(env);
      calleeContext.VariableEnvironment = varEnv;
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
    calleeContext.LexicalEnvironment = lexEnv;

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

    for (const f of functionsToInitialize) {
      const [fn] = collectBoundNames(f);
      const fo = InstantiateFunctionObject(f, lexEnv);
      varEnv.SetMutableBinding(fn, fo, false);
    }
  }

  function IteratorBindingInitialization(node: EstreeNode | EstreeNode[], iterator: Iterator<unknown>, environment: EnvironmentRecord): CompletionRecord {
    if (Array.isArray(node)) {
      for (const n of node) {
        IteratorBindingInitialization(n, iterator, environment);
      }
    } else if (node) {
      // `node` maybe `null` in some cases.
      switch (node.type) {
        case "AssignmentPattern": {
          let v: unknown;
          const { done, value } = iterator.next();
          if (!done) {
            v = value;
          }
          if (v === undefined) {
            const defaultValue = Evaluate(node.right);
            // ReturnIfAbrupt
            v = GetValue(defaultValue);
          }
          return BindingInitialization(node.left, v, environment);
        }
        case "Identifier": {
          const bindingId = node.name;
          // ReturnIfAbrupt
          const lhs = ResolveBinding(bindingId, environment);
          let v: unknown;
          const { done, value } = iterator.next();
          if (!done) {
            v = value;
          }
          return InitializeReferencedBinding(lhs, v);
        }
        case "RestElement": {
          const A: unknown[] = [];
          let n = 0;
          // eslint-disable-next-line no-constant-condition
          while (true) {
            const { done, value } = iterator.next();
            if (done) {
              return BindingInitialization(node.argument, A, environment);
            }
            A[n] = value;
            n ++;
          }
        }
      }
    }
  }

  function BindingInitialization(node: EstreeNode, value: unknown, environment: EnvironmentRecord): CompletionRecord {
    switch (node.type) {
      case "Identifier":
        return InitializeBoundName(node.name, value, environment);
      case "ObjectPattern":
        // ReturnIfAbrupt
        RequireObjectCoercible(value);
        return PropertyBindingInitialization((node as EstreeObjectPattern).properties, value, environment);
      case "ArrayPattern": {
        const iteratorRecord = CreateListIteratorRecord(value as Iterable<unknown>);
        return IteratorBindingInitialization(node, iteratorRecord, environment);
      }
    }
  }

  function PropertyBindingInitialization(properties: (EstreeProperty | RestElement)[], value: unknown, environment: EnvironmentRecord): CompletionRecord {
    const excludedNames: (PropertyKey)[] = [];
    for (const prop of properties) {
      if (prop.type === "Property") {
        if (!prop.computed && prop.key.type === "Identifier") {
          KeyedBindingInitialization(prop.key, value, environment, prop.key.name);
        } else {
          const P = EvaluatePropertyName(prop.key);
          // ReturnIfAbrupt(P)
          // ReturnIfAbrupt
          KeyedBindingInitialization(prop.value, value, environment, P);
          excludedNames.push(P);
        }
      } else {
        return RestBindingInitialization(prop, value, environment, excludedNames);
      }
    }
    return NormalCompletion(Empty);
  }

  function EvaluatePropertyName(node: Expression): string | symbol {
    const exprValue = Evaluate(node);
    // ReturnIfAbrupt
    const propName = GetValue(exprValue);
    // ReturnIfAbrupt
    return ToPropertyKey(propName);
  }

  function ToPropertyKey(arg: unknown): string | symbol {
    if (typeof arg === "symbol") {
      return arg;
    }
    return String(arg);
  }

  function RestBindingInitialization(restProperty: RestElement, value: unknown, environment: EnvironmentRecord, excludedNames: (PropertyKey)[]): CompletionRecord {
    // ReturnIfAbrupt
    const lhs = ResolveBinding((restProperty.argument as Identifier).name, environment);
    // ReturnIfAbrupt
    const restObj = CopyDataProperties({}, value, excludedNames);
    if (!environment) {
      return PutValue(lhs, restObj);
    }
    return InitializeReferencedBinding(lhs, restObj);
  }

  function CopyDataProperties ( target: Record<PropertyKey, unknown>, source: unknown, excludedItems: (PropertyKey)[] ): Record<PropertyKey, unknown> {
    if (source === undefined || source === null) {
      return target;
    }
    const from = ToObject(source);
    const keys = (Object.getOwnPropertyNames(from) as (PropertyKey)[]).concat(Object.getOwnPropertySymbols(from));
    for (const nextKey of keys) {
      if (!excludedItems.includes(nextKey)) {
        const desc = Object.getOwnPropertyDescriptor(from, nextKey);
        if (desc?.enumerable) {
          target[nextKey] = from[nextKey];
        }
      }
    }
    return target;
  }

  function KeyedBindingInitialization(node: EstreeNode, value: unknown, environment: EnvironmentRecord, propertyName: string | symbol): CompletionRecord {
    const isIdentifier = node.type === "Identifier" || (node.type === "AssignmentPattern" && node.left.type === "Identifier");
    if (isIdentifier) {
      const bindingId = node.type === "Identifier" ? node.name : (node.left as Identifier).name;
      // ReturnIfAbrupt
      const lhs = ResolveBinding(bindingId, environment);
      // ReturnIfAbrupt
      let v = GetV(value, propertyName);
      if (node.type === "AssignmentPattern" && v === undefined) {
        // If IsAnonymousFunctionDefinition(Initializer)
        const defaultValue = Evaluate(node.right);
        // ReturnIfAbrupt
        v = GetValue(defaultValue);
      }
      if (!environment) {
        // ReturnIfAbrupt
        return PutValue(lhs, v);
      }
      return InitializeReferencedBinding(lhs, v);
    }

    // ReturnIfAbrupt
    let v = GetV(value, propertyName);
    if (node.type === "AssignmentPattern" && v === undefined) {
      const defaultValue = Evaluate(node.right);
      // ReturnIfAbrupt
      v = GetValue(defaultValue);
    }
    return BindingInitialization(node.type === "AssignmentPattern" ? node.left : node, v, environment);
  }

  function InitializeBoundName(name: string, value: unknown, environment?: EnvironmentRecord): CompletionRecord {
    if (environment) {
      environment.InitializeBinding(name, value);
      return NormalCompletion(Empty);
    }
    const lhs = ResolveBinding(name);
    // ReturnIfAbrupt
    return PutValue(lhs, value);
  }

  function PutValue(V: ReferenceRecord, W: unknown): CompletionRecord {
    // ReturnIfAbrupt(V).
    // ReturnIfAbrupt(W).
    if (!(V instanceof ReferenceRecord)) {
      throw new  ReferenceError();
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

  function InstantiateFunctionObject(
    func: FunctionDeclaration,
    scope: EnvironmentRecord
  ): FunctionObject {
    const F = OrdinaryFunctionCreate(func.params, func.body, scope);
    return F;
  }

  function InstantiateOrdinaryFunctionExpression(
    functionExpression: FunctionExpression
  ): FunctionObject {
    const scope = getRunningContext().LexicalEnvironment;
    if (functionExpression.id) {
      const name = functionExpression.id.name;
      const funcEnv = new DeclarativeEnvironment(scope);
      funcEnv.CreateImmutableBinding(name, false);
      const closure = OrdinaryFunctionCreate(
        functionExpression.params,
        functionExpression.body,
        funcEnv
      );
      funcEnv.InitializeBinding(name, closure);
      return closure;
    } else {
      const closure = OrdinaryFunctionCreate(
        functionExpression.params,
        functionExpression.body,
        scope
      );
      return closure;
    }
  }

  function InstantiateArrowFunctionExpression(
    arrowFunction: ArrowFunctionExpression
  ): FunctionObject {
    const scope = getRunningContext().LexicalEnvironment;
    const closure = OrdinaryFunctionCreate(
      arrowFunction.params,
      arrowFunction.body,
      scope
    );
    return closure;
  }

  function OrdinaryFunctionCreate(
    parameterList: FunctionDeclaration["params"],
    body: BlockStatement | Expression,
    scope: EnvironmentRecord
  ): FunctionObject {
    const F = (function(){
      // eslint-disable-next-line prefer-rest-params
      return CallFunction(F, arguments);
    }) as FunctionObject;
    Object.defineProperties(F, {
      [FormalParameters]: {
        enumerable: false,
        writable: false,
        value: parameterList,
      },
      [ECMAScriptCode]: {
        enumerable: false,
        writable: false,
        value: body.type === "BlockStatement" ? body.body : body,
      },
      [Environment]: {
        enumerable: false,
        writable: false,
        value: scope,
      },
    });
    return F;
  }

  if (expressionOnly) {
    return InstantiateArrowFunctionExpression(root);
  } else {
    const [fn] = collectBoundNames(root);
    const fo = InstantiateFunctionObject(root, rootEnv);
    rootEnv.CreateImmutableBinding(fn, true);
    rootEnv.InitializeBinding(fn, fo);
    return fo;
  }
}
