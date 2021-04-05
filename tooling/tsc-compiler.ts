/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

// tslint:disable:no-unsafe-any

import * as path from 'path';
import * as ts from 'typescript';

import { readFileSync } from 'fs';

let tsconfigAbsPath: string | undefined;
for (let i = 0; i < process.argv.length; i++) {
  if (process.argv[i] === '-p' || process.argv[i] === '--project') {
    tsconfigAbsPath = process.argv[i + 1];
    break;
  }
}
tsconfigAbsPath = path.resolve(tsconfigAbsPath || './tsconfig.json');
const tsconfigAbsDir = path.dirname(tsconfigAbsPath);

const getNameAndPos = (f: ts.FunctionLike) => {
  const sf = f.getSourceFile();
  const { line, character } = sf.getLineAndCharacterOfPosition(f.pos);
  let name = f.name && f.name.getText();
  if (!name && ts.isArrowFunction(f)) {
    if (ts.isVariableDeclaration(f.parent) || ts.isPropertyDeclaration(f.parent)) { // get the variable or property name anon f is assigned to
      const firstIdentifier = f.parent.getChildren(sf).find(ts.isIdentifier);
      if (firstIdentifier && firstIdentifier.getText()) {
        name = firstIdentifier.getText();
      }
    } else if (ts.isPropertyAssignment(f.parent)) { // get property name anon f is assigned to
      name = f.parent.name && f.parent.name.getText();
    }
  }
  if (!name) {
    name = `<anonymous>`;
  }
  return `${name} (${sf.fileName.split('flowcrypt-browser').pop()}:${line + 1}:${character + 1})`;
};

/**
 * This transformer will wrap content of all async functions with a try/catch that helps preserve proper async stack traces
 */
const preserveAsyncStackTracesTransformerFactory = () => {
  const createStackTracePreservingCatchBlockStatements = (f: ts.FunctionLike): ts.Statement[] => {
    const statements: ts.Statement[] = [];
    const addStackLine = `\\n    at <async> ${getNameAndPos(f)}`;
    const code = `if(t instanceof Error){t.stack+="${addStackLine}";throw t}const e=new Error("Thrown["+typeof t+"]"+t);e.thrown=t;throw e`;
    statements.push(ts.createStatement(ts.createIdentifier(code)));
    return statements;
  };
  const visitor = (ctx: ts.TransformationContext) => {
    const recursiveVisitor: ts.Visitor = (node: ts.Node): ts.VisitResult<ts.Node> => {
      if (ts.isFunctionDeclaration(node) || ts.isArrowFunction(node) || ts.isMethodDeclaration(node) || ts.isFunctionExpression(node)) {
        if (node.modifiers && node.modifiers.filter(modifier => modifier.kind === ts.SyntaxKind.AsyncKeyword).length) {
          if (node.body) {
            const catchClause = ts.createCatchClause('t', ts.createBlock(createStackTracePreservingCatchBlockStatements(node), true));
            if ((node.body as ts.FunctionBody).statements && (node.body as ts.FunctionBody).statements.length) {
              const origFuncContent = ts.createBlock((node.body as ts.FunctionBody).statements, true);
              (node.body as any).statements = ts.createNodeArray([ts.createTry(origFuncContent, catchClause, undefined)]);
            } else if (ts.isCallExpression(node.body) || ts.isAwaitExpression(node.body)) { // eg: `x.click(async () => whatever())` or `x.click(async () => await whatever())`
              const origFuncContent = ts.createBlock([ts.createReturn(node.body)], true);
              (node.body as any) = ts.createBlock([ts.createTry(origFuncContent, catchClause, undefined)], true);
            }
          }
        }
      }
      return ts.visitEachChild(node, recursiveVisitor, ctx);
    };
    return recursiveVisitor;
  };
  return (ctx: ts.TransformationContext): ts.Transformer<ts.SourceFile> => {
    return (sf: ts.SourceFile) => ts.visitNode(sf, visitor(ctx));
  };
};

const printErrsAndExitIfPresent = (allDiagnostics: ts.Diagnostic[]) => {
  for (const diag of allDiagnostics) {
    if (diag.file) {
      const { line, character } = diag.file.getLineAndCharacterOfPosition(diag.start!);
      const message = ts.flattenDiagnosticMessageText(diag.messageText, "\n");
      console.error(`${diag.file.fileName} (${line + 1},${character + 1}): ${message}`);
    } else {
      console.error(`${ts.flattenDiagnosticMessageText(diag.messageText, "\n")}`);
    }
  }
  if (allDiagnostics.length) {
    process.exit(1);
  }
};

/*
 * Compile using the transformer above
 */
const compile = (): void => {
  const { compilerOptions, include, exclude, files } = JSON.parse(readFileSync(tsconfigAbsPath!).toString());
  const { options, errors } = ts.convertCompilerOptionsFromJson(compilerOptions, tsconfigAbsDir); // , tsconfigAbsPath!
  printErrsAndExitIfPresent(errors);
  const compilerHost = ts.createCompilerHost(options);
  const fileList = files && files.length ? files : compilerHost.readDirectory!(tsconfigAbsDir, ['.ts', '.tsx', '.d.ts'], exclude, include);
  if (!fileList.length) {
    console.error(`fileList empty for ${tsconfigAbsPath}\ninclude:\n${(include || []).join('\n')}\n\nexclude:\n${(exclude || []).join('\n')}\nfiles:\n${(files || []).join('\n')}`);
    process.exit(1);
  }
  const program = ts.createProgram(fileList, options, compilerHost);
  const emitResult = program.emit(undefined, undefined, undefined, undefined, { before: [preserveAsyncStackTracesTransformerFactory()] });
  printErrsAndExitIfPresent(ts.getPreEmitDiagnostics(program).concat(emitResult.diagnostics));
  if (emitResult.emitSkipped) {
    console.error(`Building ${tsconfigAbsPath} emitResult.emitSkipped`);
    process.exit(1);
  }
};

compile();
