import {
    readFileSync,
    writeFileSync,
    existsSync,
    mkdirSync,
    readdirSync,
    statSync,
    lstatSync,
    unlinkSync,
    rmdirSync
} from 'fs';
import { dirname, join } from 'path';
import { compile } from 'handlebars';
import * as moment from 'moment';
import * as chalk from 'chalk';
import { kebabCase, find, sortBy, toPairs, fromPairs } from 'lodash';
import { SwaggerSchema } from '../bootstrap/swagger';
import { GeneratorOptions } from '../bootstrap/options';

export const ENCODING = 'utf8';

export function readAndCompileTemplateFile(templatePath: string) {
    let templateSource = readFileSync(templatePath, ENCODING);
    let template = compile(templateSource);
    return template;
}

function readFile(outputFileName: string): string {
    let file = readFileSync(outputFileName, ENCODING);
    return file;
}

function writeFile(outputFileName: string, contents: string): void {
    writeFileSync(outputFileName, contents, { flag: 'w', encoding: ENCODING });
}

export function writeFileIfContentsIsChanged(outputFileName: string, contents: string): boolean {
    let isChanged = true;
    if (existsSync(outputFileName)) {
        let oldContents = readFile(outputFileName);
        isChanged = oldContents !== contents;
    }
    if (isChanged) {
        writeFile(outputFileName, contents);
    }
    return isChanged;
}

export function ensureFile(outputFileName: string, contents: string): void {
    ensureFolder(dirname(outputFileName));
    if (!existsSync(outputFileName)) {
        writeFileSync(outputFileName, contents, ENCODING);
    }
}

export function ensureFolder(folder: string): void {
    if (!existsSync(folder)) {
        mkdirSync(folder);
    }
}

export function getDirectories(srcpath: string): string[] {
    return readdirSync(srcpath).filter(file => {
        return statSync(join(srcpath, file)).isDirectory();
    });
}

export function getFiles(srcpath: string): string[] {
    return readdirSync(srcpath).filter(file => {
        return statSync(join(srcpath, file)).isFile();
    });
}

export function removeFolder(folder: string): void {
    if (existsSync(folder)) {
        readdirSync(folder).forEach((file, index) => {
            let curPath = folder + '/' + file;
            if (lstatSync(curPath).isDirectory()) {
                // recurse
                removeFolder(curPath);
            } else {
                // delete file
                unlinkSync(curPath);
            }
        });
        rmdirSync(folder);
    }
}

export function getPathToRoot(namespace: string): string {
    let path = './';
    if (namespace) {
        path = '';
        let namespaceLength = namespace.split('.').length;
        for (let i = 0; i < namespaceLength; ++i) {
            path += '../';
        }
    }
    return path;
}

export function convertNamespaceToPath(namespace: string): string {
    let parts = namespace.split('.');
    for (let index = 0; index < parts.length; index++) {
        parts[index] = kebabCase(parts[index]);
    }
    let result = parts.join('/');
    // let result = namespace.replace(/\./g, '/');
    return result;
}

// export function getTypeFromDescription(description: string) {
//     if (hasTypeFromDescription(description)) {
//         description = description.replace('ts-type', '');
//         return description.replace('type', '').trim();
//     }
//     return description;
// }
// export function hasTypeFromDescription(description: string) {
//     if (description) {
//         return description.startsWith('ts-type') || description.startsWith('type');
//     }
//     return false;
// }

export function getSortedObjectProperties(object: Object): Object {
    const pairs = sortBy(toPairs(object), 0);
    const result = fromPairs(pairs as [string, {}][]);
    return result;
}

export function isInTypesToFilter(item: SwaggerSchema, key: string, options: GeneratorOptions): boolean {
    if (options && options.typesToFilter) {
        const result = !!find(options.typesToFilter, element => {
            return element === key;
        });
        // if (result) {
        //     console.log('item in typesToFilter', key, result);
        // }
        return result;
    }
    return false;
}

export function removeExtension(file: string): string {
    return file.replace('.ts', '');
}

export function log(message: string): void {
    let time = moment().format('HH:mm:SS');
    console.log(`[${time}] ${message}`);
}

export function logError(message: string): void {
    let time = moment().format('HH:mm:SS');
    console.error(`[${time}]`, chalk.red(`*** ERROR *** ${message}`));
}
