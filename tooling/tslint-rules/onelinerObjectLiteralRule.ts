import * as ts from "typescript";
import * as tslint from "tslint";

const DO_NOT_SHORT_MULTILINE_OBJ_LITERALS = `If object literal fits on one line comfortably, please keep it on one line.

There are possible exceptions:
 - if it's important for ease of security review that each item is distintly on it's own line
 - if you want to maintain visual consistency with similar object literals nearby which are multiline

In such cases you can mute supress this rule with:
// tslint:disable-line:oneliner-object-literal
.`;
const MAX_LINE_LEN_WITH_OBJ_LITERAL = 140;

export class Rule extends tslint.Rules.AbstractRule {

  public apply(sourceFile: ts.SourceFile): tslint.RuleFailure[] {
    return this.applyWithWalker(new Walker(sourceFile, this.getOptions()));
  }
}

class Walker extends tslint.RuleWalker {

  public visitObjectLiteralExpression(node: ts.ObjectLiteralExpression) {
    const sf = this.getSourceFile();
    if (node.getWidth(sf) > 500) {
      return; // surely too big to fit on one line
    }
    const text = node.getText(sf);
    if (text.indexOf('\n') === -1) {
      return; // is single line
    }
    const potentialObjLiteralLen = text.replace(/\n +/g, '').length;
    if (potentialObjLiteralLen > MAX_LINE_LEN_WITH_OBJ_LITERAL) {
      return; // would become too long
    }
    if (text.indexOf(` => `) !== -1) {
      return; // may contain function definitions, better keep multiline
    }
    const sourceText = sf.getFullText();
    const objLiteralStart = node.getStart(sf);
    const objLiteralLineStart = sourceText.lastIndexOf('\n', objLiteralStart);
    const objLiteralLeftOffset = objLiteralStart - objLiteralLineStart;
    if (potentialObjLiteralLen + objLiteralLeftOffset < MAX_LINE_LEN_WITH_OBJ_LITERAL) {
      // is multiline, but short enough fit on the line
      this.addFailure(this.createFailure(node.getStart(sf), node.getWidth(sf), DO_NOT_SHORT_MULTILINE_OBJ_LITERALS));
    }
  }

}
