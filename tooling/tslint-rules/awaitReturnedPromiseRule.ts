import * as ts from "typescript";
import * as tslint from "tslint";

import { isIdentifier } from 'tsutils';

const AWAIT_RETURNED_PROMISE = `must explicitly await returned promise (see https://github.com/FlowCrypt/flowcrypt-browser/pull/2349)`;

export class Rule extends tslint.Rules.TypedRule {

  public static metadata: tslint.IRuleMetadata = {
    ruleName: "await-returned-promise",
    description: "Requres returned promises in async functions to be explicitly awaited",
    options: undefined,
    optionsDescription: 'Not configurable.',
    type: "typescript",
    typescriptOnly: true,
    requiresTypeInfo: true,
  };

  public applyWithProgram(sourceFile: ts.SourceFile, program: ts.Program): tslint.RuleFailure[] {
    return this.applyWithWalker(new Walker(sourceFile, this.getOptions(), program));
  }
}

class Walker extends tslint.ProgramAwareRuleWalker {

  public visitReturnStatement(node: ts.ReturnStatement) {
    if (node.expression === undefined || (isIdentifier(node.expression) && node.expression.text === "undefined")) {
      return false;
    }
    const checker = this.getTypeChecker();
    const inferredType = checker.getTypeAtLocation(node.expression);
    if (this.returnsPromise(checker, inferredType)) {
      this.addFailureAtNode(node, AWAIT_RETURNED_PROMISE);
    }
  }

  private returnsPromise(checker: ts.TypeChecker, typeAt: ts.Type) {
    if (!typeAt) {
      return false;
    }
    const typeStr = checker.typeToString(typeAt);
    if (/^Promise</.test(typeStr)) {
      return true;
    }
    return false;
  }

}
