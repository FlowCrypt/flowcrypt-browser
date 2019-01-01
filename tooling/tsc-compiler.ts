
import * as ts from 'typescript';
import * as path from 'path';
import { readFileSync } from 'fs';

let tsconfigAbsPath: string | undefined;
for (let i = 0; i < process.argv.length; i++) {
  if (process.argv[i] === '-p' || process.argv[i] === '--project') {
    tsconfigAbsPath = process.argv[i + 1];
    break;
  }
}
tsconfigAbsPath = path.resolve(tsconfigAbsPath || './tsconfig.json');
const tsconfigAbsDir = tsconfigAbsPath.replace(/\/[^/]+$/g, '');

/**
 * This transformer will wrap content of all async functions with a try/catch that helps preserve proper async stack traces
 */
const preserveAsyncStackTracesTransformerFactory = () => {

  const createStackTracePreservingCatchBlockStatements = (f: ts.FunctionLike): ts.Statement[] => {
    const sf = f.getSourceFile();
    const statements: ts.Statement[] = [];
    let name = f.name && f.name.getText();
    if (!name && ts.isArrowFunction(f) && (ts.isVariableDeclaration(f.parent) || ts.isPropertyDeclaration(f.parent))) {
      const firstIdentifier = f.parent.getChildren(sf).find(ts.isIdentifier);
      if (firstIdentifier && firstIdentifier.getText()) {
        name = `${firstIdentifier.getText()}`;
      }
    }
    if (!name) {
      name = `<anonymous>`;
    }
    const { line, character } = sf.getLineAndCharacterOfPosition(f.pos);
    const addStackLine = `\\n    at <async> ${name} (${sf.fileName.split('flowcrypt-browser').pop()}:${line + 1}:${character + 1})`;
    const code = `if(t instanceof Error){t.stack+="${addStackLine}";throw t}const e=new Error("Thrown["+typeof t+"]"+t);e.thrown=t;throw e`;
    statements.push(ts.createStatement(ts.createIdentifier(code)));
    // const ifInstanceofError: ts.Expression = ts.createBinary(ts.createIdentifier('e'), ts.SyntaxKind.InstanceOfKeyword, ts.createIdentifier("Error"));
    // const errStack = ts.createIdentifier("e.stack");
    // const fixStack: ts.Statement = ts.createStatement(ts.createAssignment(
    //   errStack,
    //   ts.createAdd(
    //     ts.createLogicalOr(errStack, ts.createStringLiteral('(no stack)')),
    //     ts.createStringLiteral(`\n    at <async> ${name} (${sf.fileName.split('flowcrypt-browser').pop()}:${line + 1}:${character + 1})`),
    //   ),
    // ));
    // const
    // const rethrow: ts.Statement = ts.createThrow(ts.createIdentifier("e"));
    // statements.push(ts.createIf(ifInstanceofError, ts.createBlock([fixStack, rethrow], false)));
    // const newErrMsg: ts.Expression = ts.createAdd(
    //   ts.createStringLiteral('Thrown['), ts.createAdd(
    //     ts.createTypeOf(ts.createIdentifier('e')), ts.createAdd(
    //       ts.createStringLiteral(']'),
    //       ts.createNew(ts.createIdentifier('String'), undefined, [ts.createIdentifier('e')]),
    //     )
    //   )
    // );
    // statements.push(ts.createThrow(ts.createNew(ts.createIdentifier("Error"), undefined, [newErrMsg])));
    return statements;
  };

  const visitor = (ctx: ts.TransformationContext) => {
    const recursiveVisitor: ts.Visitor = (node: ts.Node): ts.VisitResult<ts.Node> => {
      if ((ts.isFunctionDeclaration(node) || ts.isArrowFunction(node) || ts.isMethodDeclaration(node))) {
        if (node.modifiers && node.modifiers.filter(modifier => modifier.kind === ts.SyntaxKind.AsyncKeyword).length) {
          if (node.body && (node.body as ts.FunctionBody).statements && (node.body as ts.FunctionBody).statements.length) {
            const origFuncContent = ts.createBlock((node.body as ts.FunctionBody).statements, true);
            const catchClause = ts.createCatchClause('t', ts.createBlock(createStackTracePreservingCatchBlockStatements(node), false));
            (node.body as ts.FunctionBody).statements = ts.createNodeArray([ts.createTry(origFuncContent, catchClause, undefined)]);
            return node;
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
      console.log(`${diag.file.fileName} (${line + 1},${character + 1}): ${message}`);
    } else {
      console.log(`${ts.flattenDiagnosticMessageText(diag.messageText, "\n")}`);
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
