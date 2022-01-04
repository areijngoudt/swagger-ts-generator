import { readFileSync } from 'fs';
import { normalize } from 'path';
import {
    each,
    clone,
    keys,
    map,
    unset,
    forEach,
    has,
    sortBy,
    isObject,
    lowerFirst,
    uniqBy,
    upperCase,
    startCase
} from 'lodash';

import { Swagger, SwaggerSchemas, SwaggerSchema } from '../bootstrap/swagger';
import { GeneratorOptions } from '../bootstrap/options';
import {
    ENCODING,
    readAndCompileTemplateFile,
    writeFileIfContentsIsChanged,
    log,
    ensureFile,
    isInTypesToFilter
    // hasTypeFromDescription,
    // getTypeFromDescription
} from './utils';

interface EnumType {
    type: string;
    valuesAndLabels: EnumTypeValueAndLabel[];
    joinedValues: string;
}

interface EnumTypeValueAndLabel {
    value: string;
    label: string;
}

export function generateEnumTSFile(swagger: Swagger, options: GeneratorOptions) {
    log('generating enums...');

    let outputFileName = normalize(options.enumTSFile);
    // get enum definitions from swagger
    let enumTypeCollection = getEnumDefinitions(swagger, options);
    generateTSEnums(enumTypeCollection, outputFileName, options);

    function generateTSEnums(enumTypeCollection: EnumType[], outputFileName: string, options: GeneratorOptions) {
        let data = {
            moduleName: options.enumModuleName,
            generateClasses: options.generateClasses,
            enumTypeCollection: enumTypeCollection
        };
        let template = readAndCompileTemplateFile(options.templates.enum);
        let result = template(data);
        let isChanged = writeFileIfContentsIsChanged(outputFileName, result);
        if (isChanged) {
            log(`generated ${enumTypeCollection.length}  enums in ${outputFileName}`);
        }
    }
}

export function generateEnumI18NHtmlFile(swagger: Swagger, options: GeneratorOptions) {
    let outputFileName = normalize(options.enumI18NHtmlFile);
    // get enum definitions from swagger
    let enumTypeCollection = getEnumDefinitions(swagger, options);
    generateI18NEnumsHtml(enumTypeCollection, outputFileName, options);

    function generateI18NEnumsHtml(enumTypeCollection: EnumType[], outputFileName: string, options: GeneratorOptions) {
        let data = {
            enumTypeCollection
        };
        let template = readAndCompileTemplateFile(options.templates.enumLanguage);
        let result = template(data);
        let isChanged = writeFileIfContentsIsChanged(outputFileName, result);
        if (isChanged) {
            log(`generated ${enumTypeCollection.length}  enums in ${outputFileName}`);
        }
    }
}

export function generateEnumLanguageFiles(swagger: Swagger, options: GeneratorOptions) {
    each(options.enumLanguageFiles, outputFileName => {
        outputFileName = normalize(outputFileName);
        // read contents of the current language file
        ensureFile(outputFileName, '{}');
        let enumLanguage = JSON.parse(readFileSync(outputFileName, ENCODING));
        // get enum definitions from swagger
        let enumTypeCollection = getEnumDefinitions(swagger, options);
        // add new enum types/values to the enumLanguage (leave existing ones intact)
        let newValuesAdded = buildNewEnumLanguage(enumTypeCollection, enumLanguage);
        // generateEnumLanguageFile
        generateEnumLanguageFile(enumLanguage, outputFileName, newValuesAdded);
    });

    function buildNewEnumLanguage(enumTypeCollection: EnumType[], enumLanguage) {
        let result = false;
        let currentEnumLanguage = clone(enumLanguage);
        let properties = keys(enumLanguage);
        map(properties, property => {
            unset(enumLanguage, property);
        });
        forEach(enumTypeCollection, function (enumType) {
            enumLanguage[enumType.type] = '-------ENUM-TYPE-------';
            forEach(enumType.valuesAndLabels, function (valueAndLabel, key) {
                if (!has(enumLanguage, valueAndLabel.value)) {
                    if (has(currentEnumLanguage, valueAndLabel.value)) {
                        enumLanguage[valueAndLabel.value] = currentEnumLanguage[valueAndLabel.value];
                    } else {
                        enumLanguage[valueAndLabel.value] = valueAndLabel.label;
                        result = true;
                    }
                }
            });
        });
        return result;
    }

    function generateEnumLanguageFile(enumLanguage, outputFileName: string, newValuesAdded: boolean) {
        let message = newValuesAdded ? 'generated new enum values in' : 'nothing new';
        log(`${message} in ${outputFileName}`);
        let isChanged = writeFileIfContentsIsChanged(outputFileName, JSON.stringify(enumLanguage, null, 2));
        //fs.writeFileSync(outputFileName, JSON.stringify(enumLanguage, null, 2), utils.ENCODING);
    }
}

function getEnumDefinitions(swagger: Swagger, options: GeneratorOptions) {
    let enumTypeCollection: EnumType[] = new Array();
    filterEnumDefinitions(enumTypeCollection, swagger.components.schemas, options);
    // filter on unique types
    enumTypeCollection = uniqBy(enumTypeCollection, 'type');
    // patch enumTypes which have the same values (to prevent non-unique consts in Go)
    enumTypeCollection = removeEnumTypesWithSameValues(enumTypeCollection);
    // sort on type
    if (options.sortEnumTypes) {
        enumTypeCollection = sortBy(enumTypeCollection, 'type');
    }
    // console.log('enumTypeCollection', enumTypeCollection);
    return enumTypeCollection;
}

function filterEnumDefinitions(
    enumTypeCollection: EnumType[],
    node: SwaggerSchemas | SwaggerSchema,
    options: GeneratorOptions,
    enumArrayType?: string
) {
    forEach(node, (item, key) => {
        const itemDef = item as SwaggerSchema;
        if (isObject(itemDef) && !isInTypesToFilter(itemDef, key, options)) {
            if (itemDef.enum) {
                let type = enumArrayType ? enumArrayType : key;
                let values = itemDef.enum;
                let enumType: EnumType = {
                    type,
                    valuesAndLabels: getEnumValuesAndLabels(values, options),
                    joinedValues: undefined
                };
                // // description may contain an overrule type, eg /** type coverType */
                // if (hasTypeFromDescription(itemDef.description)) {
                //     enumType.type = lowerFirst(
                //         getTypeFromDescription(itemDef.description)
                //     );
                // }
                // add string with joined values so enums with the same values can be detected
                enumType.joinedValues = values.join(';');
                // console.log(enumType);
                // console.log('----------------------');
                enumTypeCollection.push(enumType);
            } else {
                // enum array's has enum definition one level below (under "items")
                let enumArrayType = undefined;
                if (itemDef.type === 'array') {
                    enumArrayType = key;
                    // if (hasTypeFromDescription(itemDef.description)) {
                    //     enumArrayType = lowerFirst(
                    //         getTypeFromDescription(itemDef.description)
                    //     );
                    // }
                }
                filterEnumDefinitions(enumTypeCollection, itemDef, options, enumArrayType);
            }
        }
    });
}

function removeEnumTypesWithSameValues(enumTypeCollection: EnumType[]) {
    const result = uniqBy(enumTypeCollection, element => {
        return element.type + element.joinedValues;
    });
    // console.log('#enumTypes with and without duplicates', enumTypeCollection.length, result.length);
    // console.log('======================> original <======================', enumTypeCollection);
    // console.log('======================> result <======================', result);
    return result;
    // // get enumTypes with duplicate enumValues
    // let groupped = _.groupBy(enumTypeCollection, (e) => { return e.joinedValues });
    // var duplicates = _.uniqBy(_.flatten(_.filter(groupped, (g) => { return g.length > 1 })), element => { return element.type; });
    // console.log('duplicates', JSON.stringify(duplicates));
    // // prefix enumValue.pascalCaseValue with typeName to make sure the genertaed Go consts are unique
    // _.forEach(duplicates, (item, key) => {
    //     // _.forEach(item.values, (value) => {
    //     //     value.pascalCaseValue = `${item.typeName}${value.pascalCaseValue}`;
    //     // });
    // })
    // // console.log('enumTypeCollection', JSON.stringify(enumTypeCollection));
    // return enumTypeCollection;
}

function getEnumValuesAndLabels(enumValues: string[], options: GeneratorOptions) {
    let result: EnumTypeValueAndLabel[] = new Array();
    forEach(enumValues, value => {
        const valueAndLabel = {
            value,
            // only convert label when the value contains not only uppercase chars and length > 3
            // (only uppercase with short length are considered codes like Country or Currency)
            label: upperCase(value) === value && value.length <= 3 ? value : startCase(value.toLowerCase())
        };
        result.push(valueAndLabel);
    });
    if (options.sortEnumTypes) {
        result = sortBy(result, 'value');
    }

    return result;
}
