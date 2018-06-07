import { readFileSync } from 'fs';
import { isObject } from 'lodash';

import { ENCODING } from './lib/utils';
import { generateModelTSFiles } from './lib/modelGenerator';
import { generateEnumTSFile, generateEnumI18NHtmlFile, generateEnumLanguageFiles } from './lib/enumGenerator';

/**
* Generate TypeScript files based on the given SwaggerFile and some templates
*
* @param {string} swaggerInput The fileName of the swagger.json file including path
* @param {object} options Options which are used during generation
*                 .modelFolder: the name of the folder (path) to generate the models in.
                                each model class is generated in its own file.
*                 .enumTSFile: the name of the enum TS file including path
*                 .enumI18NHtmlFile: the name of the HTML file including path to generate enum values for translation.
*                 .enumLanguageFiles: array with the names of the enum languages file including path
*                 .modelModuleName: the name of the model module (aka namespace)
*                 .enumModuleName: the name of the enum module (aka namespace)
*/
export function generateTSFiles(swaggerInput, options) {
    options = enrichConfig(options);

    if (!swaggerInput) {
        throw 'swaggerFileName must be defined';
    }
    if (!isObject(options)) {
        throw 'options must be defined';
    }

    const isFile = typeof swaggerInput === 'string';
    let swagger = isFile
        ? JSON.parse(readFileSync(swaggerInput, ENCODING).trim())
        : swaggerInput;

    if (typeof swagger !== 'object') {
        throw new TypeError('The given swagger input is not of type object');
    }

    // let folder = path.normalize(options.modelFolder);
    // utils.removeFolder(folder);

    if(!options.hasOwnProperty("generateClasses"))
        options.generateClasses = true;

    generateModelTSFiles(swagger, options);
    generateEnumTSFile(swagger, options);
    if (options.enumI18NHtmlFile) {
        generateEnumI18NHtmlFile(swagger, options);
    }
    if (options.enumLanguageFiles) {
        generateEnumLanguageFiles(swagger, options);
    }
}

function enrichConfig(options) {
    return Object.assign({
        barrelFiles: true
    }, options);
}
