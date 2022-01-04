import { normalize, resolve } from 'path';
import * as ts from 'typescript';
import { GeneratorOptions } from '../bootstrap/options';
import { Swagger } from '../bootstrap/swagger';
import { getFiles, log, logError } from './utils';

export function compileGeneratedArtifacts(swagger: Swagger, options: GeneratorOptions) {
    log('compiling generated artifacts...');
    const modelFolder = normalize(options.modelFolder);
    const folder = resolve(modelFolder);
    const fileNames = getFiles(folder);
    const fullFileNames = fileNames.map(item => resolve(__dirname, folder, item));

    let program = ts.createProgram(fullFileNames, {
        noEmitOnError: true,
        noImplicitAny: false,
        target: ts.ScriptTarget.ES5,
        module: ts.ModuleKind.CommonJS
    });
    let emitResult = program.emit();

    let allDiagnostics = ts.getPreEmitDiagnostics(program).concat(emitResult.diagnostics);

    allDiagnostics.forEach(diagnostic => {
        if (diagnostic.file) {
            // ignore files in node_modules
            if (diagnostic.file.fileName.indexOf('/node_modules') === -1) {
                let { line, character } = ts.getLineAndCharacterOfPosition(diagnostic.file, diagnostic.start!);
                let message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
                logError(`${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`);
            }
        } else {
            logError(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
        }
    });

    let exitCode = emitResult.emitSkipped ? 1 : 0;
    log(`TS Compile exiting with code '${exitCode}'.`);
    // process.exit(exitCode);
}
