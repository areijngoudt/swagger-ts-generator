"use strict";

let fs = require('fs');
let path = require('path');
let _ = require('lodash');

let utils = require('./utils');

const TS_SUFFIX = '.ts';
const MODEL_SUFFIX = '.model';
const MODEL_FILE_SUFFIX = `${MODEL_SUFFIX}${TS_SUFFIX}`;
const ROOT_NAMESPACE = 'root';
const VALDIDATORS_FILE_NAME = 'validators.ts';
const BASE_MODEL_FILE_NAME = 'base-model.ts';

module.exports = {
    generateModelTSFiles: generateModelTSFiles,
}

function generateModelTSFiles(swagger, options) {
    let folder = path.normalize(options.modelFolder);

    // generate fixed file with non-standard validators for validation rules which can be defined in the swagger file
    generateTSValidations(folder, options);
    // generate fixed file with the BaseModel class
    generateTSBaseModel(folder, options);
    // get type definitions from swagger
    let typeCollection = getTypeDefinitions(swagger, options, MODEL_SUFFIX, MODEL_FILE_SUFFIX);
    // group types per namespace
    let namespaceGroups = getNamespaceGroups(typeCollection);
    // generate model files
    generateTSModels(namespaceGroups, folder, options);
    // generate barrel files (index files to simplify import statements)
    generateBarrelFiles(namespaceGroups, folder, options);
}

function generateTSValidations(folder, options) {
    if(!options.generateClasses)
        return;

    let outputFileName = path.join(folder, VALDIDATORS_FILE_NAME);
    let data = {}
    let template = utils.readAndCompileTemplateFile('generate-validators-ts.hbs');
    let result = template(data);
    utils.ensureFolder(folder);
    let isChanged = utils.writeFileIfContentsIsChanged(outputFileName, result);
    if (isChanged) {
        utils.log(`generated ${outputFileName}`);
    }
}

function generateTSBaseModel(folder, options) {
    if(!options.generateClasses)
        return;

    let outputFileName = path.join(folder, BASE_MODEL_FILE_NAME);
    let data = {}
    let template = utils.readAndCompileTemplateFile('generate-base-model-ts.hbs');
    let result = template(data);
    utils.ensureFolder(folder);
    let isChanged = utils.writeFileIfContentsIsChanged(outputFileName, result);
    if (isChanged) {
        utils.log(`generated ${outputFileName}`);
    }
}

function getTypeDefinitions(swagger, options, suffix, fileSuffix) {
    let typeCollection = new Array();
    // console.log('typesToFilter', options.typesToFilter);
    _.forEach(swagger.definitions, (item, key) => {
        if (!utils.isInTypesToFilter(item, key, options)) {
            let type = getTypeDefinition(swagger, typeCollection, item, key, options, suffix, fileSuffix);
            if (type) {
                typeCollection.push(type);
            }
        }
    });
    // filter on unique types
    typeCollection = _.uniq(typeCollection, 'type');
    return typeCollection;
}

function getTypeDefinition(swagger, typeCollection, item, key, options, suffix, fileSuffix) {
    // filter enum types (these are gererated by the enumGenerator)
    let isEnumType = getIsEnumType(item);
    if (isEnumType) {
        return undefined;
    }

    let required = item.required || [];
    let namespace = getNamespace(key, options, true);
    let fullNamespace = getNamespace(key, options, false);
    let typeName = getTypeName(key, options);
    if (getIsGenericType(typeName)) {
        typeName = convertGenericToGenericT(typeName);
    }
    let pathToRoot = utils.getPathToRoot(namespace);
    let properties = options.sortModelProperties ?  utils.getSortedObjectProperties(item.properties) : item.properties;
    let baseType = undefined;
    let baseImportFile = undefined;
    let isSubType = getIsSubType(item);
    if (isSubType) {
        baseType = getBaseType(typeCollection, item, options);
        baseImportFile = getImportFile(baseType.typeName, baseType.namespace, pathToRoot, suffix);
        required = getSubTypeRequired(item);
        properties = getSubTypeProperties(item, baseType);
    }

    let type = {
        fileName: getFileName(key, options, fileSuffix),
        typeName: typeName,
        namespace: namespace,
        fullNamespace: fullNamespace,
        isSubType: isSubType,
        baseType: baseType,
        baseImportFile: baseImportFile,
        path: utils.convertNamespaceToPath(namespace),
        pathToRoot: pathToRoot,
        properties: []
    }
    _.forEach(properties, (item, key) => {
        let property = getTypePropertyDefinition(swagger, type, baseType, required, item, key, options, suffix, fileSuffix)
        type.properties.push(property);
    });
    return type;
}

function getTypePropertyDefinition(swagger, type, baseType, required, item, key, options, suffix, fileSuffix) {
    let isRefType = item.$ref;
    let isArray = item.type == 'array';
    let isEnum = (item.type == 'string' && item.enum) ||
        (isArray && item.items && item.items.type == 'string' && item.items.enum) ||
        ((isRefType || isArray) && getIsEnumRefType(swagger, item, isArray));
    // enum ref types are not handles as model types (they are handled in the enumGenerator)
    if (isEnum) {
        isRefType = false;
    }
    let propertyType = getPropertyType(item, key, options, isEnum);
    let isComplexType = isRefType || isArray; // new this one in constructor
    let isImportType = isRefType || (isArray && item.items.$ref && !isEnum);
    let importType = isImportType ? getImportType(propertyType.typeName, isArray) : undefined;
    let importFile = isImportType ? getImportFile(importType, propertyType.namespace, type.pathToRoot, suffix) : undefined;
    let importTypeIsPropertyType = importType === type.typeName;
    let isUniqueImportType = isImportType && !importTypeIsPropertyType && getIsUniqueImportType(importType, baseType, type.properties); // import this type

    let validators = getTypePropertyValidatorDefinitions(required, item, key, propertyType.typeName, isEnum);
    let hasValidation = _.keys(validators.validation).length > 0;

    let importEnumType = isEnum ? removeGenericArray(propertyType.typeName, isArray) : undefined;
    let isUniqueImportEnumType = isEnum && getIsUniqueImportEnumType(propertyType.typeName, type.properties); // import this enumType
    let property = {
        name: key,
        typeName: propertyType.typeName,
        namespace: propertyType.namespace,
        description: item.description,
        hasValidation: hasValidation,
        isComplexType: isComplexType,
        isImportType: isImportType,
        isUniqueImportType: isUniqueImportType,
        importType: importType,
        importFile: importFile,
        isEnum: isEnum,
        isUniqueImportEnumType: isUniqueImportEnumType,
        importEnumType: importEnumType,
        isArray: isArray,
        isArrayComplexType: propertyType.isArrayComplexType,
        arrayTypeName: propertyType.arrayTypeName,
        validators: validators,
        enum: item.enum,
    }
    return property;
}

function getTypePropertyValidatorDefinitions(required, item, key, typeName, isEnum) {
    let isRequired = _.indexOf(required, key) !== -1;
    // console.log('key=', key, 'typeName', typeName, 'item=', item, 'enum=', item.enum);

    let validators = {
        validation: {},
        validatorArray: []
    }
    if (isRequired) {
        validators.validation.required = isRequired
        validators.validatorArray.push('Validators.required');
    }
    if (_.has(item, 'minimum')) {
        validators.validation.minimum = item.minimum
        validators.validatorArray.push(`minValueValidator(${item.minimum})`);
    }
    if (_.has(item, 'maximum')) {
        validators.validation.maximum = item.maximum
        validators.validatorArray.push(`maxValueValidator(${item.maximum})`);
    }
    if (isEnum) {
        validators.validation.enum = `'${item.enum}'`
        validators.validatorArray.push(`enumValidator(${typeName})`);
    }
    if (_.has(item, 'minLength')) {
        validators.validation.minLength = item.minLength
        validators.validatorArray.push(`Validators.minLength(${item.minLength})`);
    }
    if (_.has(item, 'maxLength')) {
        validators.validation.maxLength = item.maxLength
        validators.validatorArray.push(`Validators.maxLength(${item.maxLength})`);
    }
    if (_.has(item, 'pattern')) {
        validators.validation.pattern = `'${item.pattern}'`
        validators.validatorArray.push(`Validators.pattern('${item.pattern}')`);
    }
    return validators;
}

function getIsUniqueImportType(currentTypeName, baseType, typeProperties) {
    let baseTypeName = baseType ? baseType.typeName : undefined;
    if (currentTypeName === baseTypeName) {
        return false;
    }
    return !_.some(typeProperties, (property) => {
        return property.importType === currentTypeName;
    });
}

function getIsUniqueImportEnumType(currentTypeName, typeProperties) {
    return !_.some(typeProperties, (property) => {
        return property.importEnumType === currentTypeName;
    });
}

function getTypeNameWithoutNamespacePrefixesToRemove(key, options) {
    if (!options.namespacePrefixesToRemove) {
        return key;
    }
    let namespaces = options.namespacePrefixesToRemove;
    namespaces.forEach((item) => {
        key = key.replace(item, '');
        if (key[0] === '.') {
            key = key.substring(1);
        }
    });
    return key;
}

function getPropertyType(item, name, options, isEnum) {
    let result = {
        typeName: '',
        namespace: '',
        fullNamespace: undefined,
        isArrayComplexType: false,
        arrayTypeName: undefined
    }
    if (item.type) {
        result.typeName = item.type;
        if (item.type == 'integer') {
            result.typeName = 'number'
        };
        if (item.type == 'string' && item.format == 'date') {
            result.typeName = 'Date'
        };
        if (item.type == 'string' && item.format == 'date-time') {
            result.typeName = 'Date'
        };
        if (item.type == 'string' && item.enum) {
            result.typeName = `${name}`
        };
        if (item.type == 'array' && item.items) {
            let arrayPropType = getPropertyType(item.items, name, options, isEnum);
            result.typeName = `Array<${arrayPropType.typeName}>`;
            result.namespace = arrayPropType.namespace;
            result.isArrayComplexType = !isEnum ? item.items.$ref : false;
            result.arrayTypeName = arrayPropType.typeName;
        };
        // description may contain an overrule type for enums, eg /** type CoverType */
        if (utils.hasTypeFromDescription(item.description)) {
            result.typeName = _.lowerFirst(utils.getTypeFromDescription(item.description))
            // fix enum array with overrule type
            if (item.type == 'array' && item.items) {
                result.arrayTypeName = result.typeName;
                result.typeName = `Array<${result.typeName}>`;
            }
        }

        return result;
    }
    if (item.$ref) {
        let type = removeDefinitionsRef(item.$ref);
        result.typeName = getTypeName(type, options);
        result.namespace = getNamespace(type, options, true);
        result.fullNamespace = getNamespace(type, options, false);

        // TODO add more C# primitive types
        if (getIsGenericType(result.typeName)) {
            let genericTType = getGenericTType(result.typeName);
            if (genericTType && genericTType === 'System.DateTime') {
                result.typeName = result.typeName.replace(genericTType, 'Date');
            }
        }

        return result;
    }
}

function removeDefinitionsRef(value) {
    let result = value.replace('#/definitions/', '');
    return result;
}

function getFileName(type, options, fileSuffix) {
    let typeName = removeGenericTType(getTypeName(type, options));
    return `${_.kebabCase(typeName)}${fileSuffix}`;
}

function getTypeName(type, options) {
    let typeName;
    if (getIsGenericType(type)) {
        let startGenericT = type.indexOf('[');
        let startGenericType = type.lastIndexOf('.', startGenericT) + 1;
        typeName = type.substring(startGenericType);
        typeName = convertGenericTypeName(typeName);
        typeName = getTypeNameWithoutSuffixesToRemove(typeName, options);
    } else {
        typeName = type.split('.').pop();
        typeName = getTypeNameWithoutSuffixesToRemove(typeName, options);
        // C# Object affects Typescript Object - fix this
        if (typeName === 'Object') {
            typeName = 'SystemObject';
        }
        //classNameSuffixesToRemove
    }
    return _.upperFirst(typeName);
}

function getTypeNameWithoutSuffixesToRemove(typeName, options) {
    if (!options.typeNameSuffixesToRemove) {
        return typeName;
    }
    let typeNameSuffixesToRemove = options.typeNameSuffixesToRemove;
    typeNameSuffixesToRemove.forEach((item) => {
        if (_.endsWith(typeName, item)) {
            typeName = typeName.slice(0, -item.length);
        }
    });
    return typeName;
}

function getIsGenericType(type) {
    return type.indexOf('[') !== -1 || type.indexOf('<') !== -1;
}
/**
 * NullableOrEmpty<System.Date> -> System.Data
 */
function getGenericTType(type) {
    if (getIsGenericType(type)) {
        return /\<(.*)\>/.exec(type)[1];
    }
    return undefined;
}
/**
 * NullableOrEmpty<System.Date> -> NullableOrEmpty
 */
function removeGenericTType(type) {
    if (getIsGenericType(type)) {
        type = type.substring(0, type.indexOf('<'));
    }
    return type;
}
/**
 * NullableOrEmpty[System.Date] -> NullableOrEmpty<System.Date>
 */
function convertGenericTypeName(typeName) {
    return typeName.replace('[', '<').replace(']', '>');
}
/**
 * NullableOrEmpty<System.Date> -> NullableOrEmpty<T>
 */
function convertGenericToGenericT(typeName) {
    return typeName.replace(/\<.*\>/, '<T>');
}

function getIsSubType(item) {
    return item.allOf !== undefined;
}

function getBaseType(typeCollection, item, options) {
    // TODO how about more than one baseType?
    let type = removeDefinitionsRef(item.allOf[0].$ref);
    let typeName = getTypeName(type, options);
    //let namespace = getNamespace(type, options);
    let baseType = _.find(typeCollection, type => {
        return type.typeName === typeName;
        //return type.typeName === typeName && type.namespace === namespace;
    })
    return baseType;
}

function getSubTypeProperties(item, baseType) {
    // TODO strip properties which are defined in the baseType?
    let properties = item.allOf[1].properties;
    return properties;
}

function getSubTypeRequired(item) {
    let required = item.allOf[1].required || [];
    return required;
}

function getIsEnumType(item) {
    return item && item.enum;
}

function getIsEnumRefType(swagger, item, isArray) {
    let refItemName;
    if (isArray) {
        // "perilTypesIncluded": {
        //     "type": "array",
        //     "items": {
        //         "$ref": "#/definitions/PerilTypeIncluded"
        //     }
        // },
        if (item.items.$ref) {
            refItemName = removeDefinitionsRef(item.items.$ref);
        }
    } else {
        // "riskLocationSupraentity": {
        //     "$ref": "#/definitions/LocationSupraentity",
        //     "description": "type LocationSupraentity "
        // },
        refItemName = removeDefinitionsRef(item.$ref);
    }
    let refItem = swagger.definitions[refItemName];
    return getIsEnumType(refItem);
}

function getNamespace(type, options, removePrefix) {
    let typeName = removePrefix ? getTypeNameWithoutNamespacePrefixesToRemove(type, options) : type;

    if (getIsGenericType(typeName)) {
        let first = typeName.substring(0, typeName.indexOf('['));
        typeName = first + first.substring(typeName.indexOf(']'));
    }
    let parts = typeName.split('.');
    parts.pop();
    return parts.join('.');
}

function getImportType(type, isArray) {
    if (isArray) {
        let result = removeGenericArray(type, isArray);
        return result;
    }
    type = removeGenericTType(type);

    return type;
}

function removeGenericArray(type, isArray) {
    if (isArray) {
        let result = type.replace('Array<', '').replace('>', '');
        return result;
    }
    return type;
}

function getImportFile(propTypeName, propNamespace, pathToRoot, suffix) {
    //return `${_.lowerFirst(type)}${suffix}`;
    let importPath = `${_.kebabCase(propTypeName)}${suffix}`;
    if (propNamespace) {
        let namespacePath = utils.convertNamespaceToPath(propNamespace);
        importPath = `${namespacePath}/${importPath}`;
    }

    return (pathToRoot + importPath).toLocaleLowerCase();
}

function getNamespaceGroups(typeCollection) {
    let namespaces = {
        [ROOT_NAMESPACE]: []
    };
    for (let i = 0; i < typeCollection.length; ++i) {
        let type = typeCollection[i];
        let namespace = type.namespace || ROOT_NAMESPACE;
        if (!namespaces[namespace]) {
            namespaces[namespace] = [];
        }
        namespaces[namespace].push(type);
    }
    return namespaces;
}

function generateTSModels(namespaceGroups, folder, options) {
    let data = {
        generateClasses: options.generateClasses,
        moduleName: options.modelModuleName,
        enumModuleName: options.enumModuleName,
        enumRef: options.enumRef,
        type: undefined,
    }
    let template = utils.readAndCompileTemplateFile('generate-model-ts.hbs');
    utils.ensureFolder(folder);
    for (let namespace in namespaceGroups) {
        let typeCol = namespaceGroups[namespace];

        let firstType = typeCol[0] || {
            namespace: ''
        };
        let namespacePath = utils.convertNamespaceToPath(firstType.namespace);
        let typeFolder = `${folder}${namespacePath}`;
        let folderParts = namespacePath.split('/');
        let prevParts = folder;
        folderParts.forEach((part) => {
            prevParts += part + '/';
            utils.ensureFolder(prevParts);
        });

        let nrGeneratedFiles = 0;
        _.each(typeCol, (type) => {
            let outputFileName = path.join(typeFolder, type.fileName);
            data.type = type;
            let result = template(data);
            let isChanged = utils.writeFileIfContentsIsChanged(outputFileName, result);
            if (isChanged) {
                nrGeneratedFiles++;
            }
            //fs.writeFileSync(outputFileName, result, { flag: 'w', encoding: utils.ENCODING });
        });
        utils.log(`generated ${nrGeneratedFiles} type${nrGeneratedFiles === 1 ? '' : 's'} in ${typeFolder}`);
        removeFilesOfNonExistingTypes(typeCol, typeFolder, options, MODEL_FILE_SUFFIX);
    }
    let namespacePaths = Object.keys(namespaceGroups).map(namespace => {
        return path.join(folder, utils.convertNamespaceToPath(namespace));
    });
    cleanFoldersForObsoleteFiles(folder, namespacePaths);
}

function cleanFoldersForObsoleteFiles(folder, namespacePaths) {
    utils.getDirectories(folder).forEach(name => {
        let folderPath = path.join(folder, name);
        // TODO bij swagger-zib-v2 wordt de webapi/ZIB folder weggegooid !
        let namespacePath = _.find(namespacePaths, path => {
            return path.startsWith(folderPath);
        });
        if (!namespacePath) {
            utils.removeFolder(folderPath);
            utils.log(`removed obsolete folder ${name} in ${folder}`);
        } else {
            cleanFoldersForObsoleteFiles(folderPath, namespacePaths);
        }
    });
}

function generateBarrelFiles(namespaceGroups, folder, options) {
    let data = {
        fileNames: undefined
    };
    let template = utils.readAndCompileTemplateFile('generate-barrel-ts.hbs');

    for (let key in namespaceGroups) {
        data.fileNames = namespaceGroups[key].map((type) => {
            return removeTsExtention(type.fileName);
        });
        if (key === ROOT_NAMESPACE) {
            addRootFixedFileNames(data.fileNames, options);
        }
        let namespacePath = namespaceGroups[key][0] ? namespaceGroups[key][0].path : '';
        let outputFileName = path.join(folder + namespacePath, 'index.ts');

        let result = template(data);
        let isChanged = utils.writeFileIfContentsIsChanged(outputFileName, result);
        if (isChanged) {
            utils.log(`generated ${outputFileName}`);
        }
    }
}

function addRootFixedFileNames(fileNames, options) {
    let enumOutputFileName = path.normalize(options.enumTSFile.split('/').pop());
    fileNames.splice(0, 0, removeTsExtention(enumOutputFileName));
    if(options.generateClasses) {
        let validatorsOutputFileName = path.normalize(VALDIDATORS_FILE_NAME);
        fileNames.splice(0, 0, removeTsExtention(validatorsOutputFileName));
    }
}

function removeTsExtention(fileName) {
    return fileName.replace('.ts', '');
}

function removeFilesOfNonExistingTypes(typeCollection, folder, options, suffix) {
    // remove files of types which are no longer defined in typeCollection
    let counter = 0;
    let files = fs.readdirSync(folder);
    _.each(files, (file) => {
        if (_.endsWith(file, suffix) && !_.find(typeCollection, (type) => {
                return type.fileName == file;
            })) {
            counter++;
            fs.unlinkSync(path.join(folder, file));
            utils.log(`removed ${file} in ${folder}`);
        }
    });
    if (counter > 0) {
        utils.log(`removed ${counter} types in ${folder}`);
    }
}
