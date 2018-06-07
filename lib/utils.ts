import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync, lstatSync, unlinkSync, rmdirSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { compile } from 'handlebars';
import * as moment from 'moment';
import { kebabCase, find, sortBy, toPairs, fromPairs } from 'lodash';

const TEMPLATE_FOLDER = '../templates';
export const ENCODING = 'utf8';

// module.exports = {
//     ENCODING: ENCODING,
//     readAndCompileTemplateFile: readAndCompileTemplateFile,
//     readFile: readFile,
//     writeFile: writeFile,
//     writeFileIfContentsIsChanged: writeFileIfContentsIsChanged,
//     ensureFile: ensureFile,
//     ensureFolder: ensureFolder,
//     getDirectories: getDirectories,
//     removeFolder: removeFolder,
//     getPathToRoot: getPathToRoot,
//     convertNamespaceToPath: convertNamespaceToPath,
//     getTypeFromDescription: getTypeFromDescription,
//     hasTypeFromDescription: hasTypeFromDescription,
//     getSortedObjectProperties: getSortedObjectProperties,
//     isInTypesToFilter: isInTypesToFilter,
//     log: log,
// }

export function readAndCompileTemplateFile(templateFileName) {
    let templateSource = readFileSync(resolve(__dirname, TEMPLATE_FOLDER, templateFileName), ENCODING);
    let template = compile(templateSource);
    return template;
}

function readFile(outputFileName) {
    let file = readFileSync(outputFileName, ENCODING);
    return file;
}

function writeFile(outputFileName, contents) {
    writeFileSync(outputFileName, contents, { flag: 'w', encoding: ENCODING });
}

export function writeFileIfContentsIsChanged(outputFileName, contents) {
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

export function ensureFile(outputFileName, contents) {
    ensureFolder(dirname(outputFileName));
    if (!existsSync(outputFileName)) {
        writeFileSync(outputFileName, contents, ENCODING);
    }
}

export function ensureFolder(folder) {
    if (!existsSync(folder)) {
        mkdirSync(folder);
    }
}

export function getDirectories(srcpath) {
    return readdirSync(srcpath).filter((file) => {
        return statSync(join(srcpath, file)).isDirectory();
    });
}

export function removeFolder(folder) {
    if (existsSync(folder)) {
        readdirSync(folder).forEach((file, index) => {
            let curPath = folder + "/" + file;
            if (lstatSync(curPath).isDirectory()) { // recurse
                removeFolder(curPath);
            } else { // delete file
                unlinkSync(curPath);
            }
        });
        rmdirSync(folder);
    }
}

export function getPathToRoot(namespace) {
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

export function convertNamespaceToPath(namespace) {
    let parts = namespace.split('.');
    for (let index = 0; index < parts.length; index++) {
        parts[index] = kebabCase(parts[index]);
    }
    let result = parts.join('/');
    // let result = namespace.replace(/\./g, '/');
    return result;
}

export function getTypeFromDescription(description) {
    if (hasTypeFromDescription(description)) {
        description = description.replace('ts-type', '');
        return description.replace('type', '').trim();
    }
    return description;
}
export function hasTypeFromDescription(description) {
    if (description) {
        return (description.startsWith('ts-type') || description.startsWith('type'));
    }
    return false;
}

export function getSortedObjectProperties(object) {
    const pairs = sortBy(toPairs(object), 0);
    const result = fromPairs(pairs as [string, {}][]);
    return result;
}

export function isInTypesToFilter(item, key, options) {
    if (options && options.typesToFilter) {
        const result = !!find(options.typesToFilter, element => { return element === key; });
        // if (result) {
        //     console.log('item in typesToFilter', key, result);
        // }
        return result;
    }
    return false;
}

export function log(message) {
    let time = moment().format('HH:mm:SS');
    console.log(`[${time}] ${message}`);
}