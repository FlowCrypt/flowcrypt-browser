import * as ts from "typescript";
import * as tslint from "tslint";

const DO_NOT_USE_AJAX = `Direct ajax calls don't belong here.

Ajax methods should be defined in the common/api folder. Add a method there, then re-use it here.
`;

export class Rule extends tslint.Rules.AbstractRule {

  public apply(sourceFile: ts.SourceFile): tslint.RuleFailure[] {
    return this.applyWithWalker(new Walker(sourceFile, this.getOptions()));
  }
}

class Walker extends tslint.RuleWalker {

  public visitCallExpression(node: ts.CallExpression) {
    if (ts.isPropertyAccessExpression(node.expression)) {
      if (node.expression.name.escapedText === 'ajax') {
        this.addFailure(this.createFailure(node.getStart(this.getSourceFile()), node.getWidth(this.getSourceFile()), DO_NOT_USE_AJAX));
      }
    }
  }

}
