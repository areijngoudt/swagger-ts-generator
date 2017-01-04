"use strict";

let fs = require('fs');
let path = require('path');
let _ = require('lodash');

let utils = require('./utils');


module.exports = {
    generateEnumTSFile: generateEnumTSFile,
    generateEnumLanguageFiles: generateEnumLanguageFiles,
}

function generateEnumTSFile(swagger, options) {
    let outputFileName = path.normalize(options.enumTSFile);
    // get enum definitions from swagger
    let enumTypeCollection = getEnumDefinitions(swagger);
    generateTSEnums(enumTypeCollection, outputFileName, options)

    function generateTSEnums(enumTypeCollection, outputFileName, options) {
        let data = {
            moduleName: options.enumModuleName,
            enumTypeCollection: enumTypeCollection
        }
        let template = utils.readAndCompileTemplateFile('generate-enum-ts.hbs');
        let result = template(data);
        let isChanged = utils.writeFileIfContentsIsChanged(outputFileName, result);
        if (isChanged) {
            utils.log(`generated ${enumTypeCollection.length}  enums in ${outputFileName}`);
        }
    }
}

function generateEnumLanguageFiles(swagger, options) {
    _.each(options.enumLanguageFiles, (outputFileName) => {
        outputFileName = path.normalize(outputFileName);
        // read contents of the current language file
        utils.ensureFile(outputFileName, '{}');
        let enumLanguage = JSON.parse(fs.readFileSync(outputFileName, utils.ENCODING));
        // get enum definitions from swagger
        let enumTypeCollection = getEnumDefinitions(swagger);
        // add new enum types/values to the enumLanguage (leave existing ones intact)
        let newValuesAdded = buildNewEnumLanguage(enumTypeCollection, enumLanguage);
        // generateEnumLanguageFile
        generateEnumLanguageFile(enumLanguage, outputFileName, newValuesAdded)
    });

    function buildNewEnumLanguage(enumTypeCollection, enumLanguage) {
        let result = false;
        let currentEnumLanguage = _.clone(enumLanguage);
        let properties = _.keys(enumLanguage);
        _.map(properties, (property) => {
            _.unset(enumLanguage, property);
        });
        _.forEach(enumTypeCollection, function (enumType) {
            enumLanguage[enumType.type] = '-------ENUM-TYPE-------';
            _.forEach(enumType.values, function (value, key) {
                if (!_.has(enumLanguage, value)) {
                    if (_.has(currentEnumLanguage, value)) {
                        enumLanguage[value] = currentEnumLanguage[value];
                    } else {
                        enumLanguage[value] = value;
                        result = true;
                    }
                }
            });
        });
        return result;
    }

    function generateEnumLanguageFile(enumLanguage, outputFileName, newValuesAdded) {
        let message = newValuesAdded ? 'generated new enum values in' : 'nothing new';
        utils.log(`${message} in ${outputFileName}`);
        let isChanged = utils.writeFileIfContentsIsChanged(outputFileName, JSON.stringify(enumLanguage, null, 2));
        //fs.writeFileSync(outputFileName, JSON.stringify(enumLanguage, null, 2), utils.ENCODING);
    }
}

function getEnumDefinitions(swagger) {
    let enumTypeCollection = new Array();
    filterEnumDefinitions(enumTypeCollection, swagger.definitions);
    // filter on unique types
    enumTypeCollection = _.uniq(enumTypeCollection, 'type');
    //log('enumTypeCollection', enumTypeCollection);
    return enumTypeCollection;
}
function filterEnumDefinitions(enumTypeCollection, node) {
    _.forEach(node, function (item, key) {
        if (_.isObject(item)) {
            if (item.enum) {
                let enumType = {
                    'type': key,
                    values: item.enum
                };
                enumTypeCollection.push(enumType)
            } else {
                filterEnumDefinitions(enumTypeCollection, item);
            }
        }
    });
}
