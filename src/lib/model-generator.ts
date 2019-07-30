const util = require("util");

import { readdirSync, unlinkSync } from "fs";
import { normalize, join } from "path";
import {
  forEach,
  keys,
  indexOf,
  has,
  some,
  lowerFirst,
  kebabCase,
  snakeCase,
  upperFirst,
  endsWith,
  find,
  each,
  uniqBy
} from "lodash";

import {
  log,
  readAndCompileTemplateFile,
  ensureFolder,
  writeFileIfContentsIsChanged,
  isInTypesToFilter,
  getPathToRoot,
  getSortedObjectProperties,
  convertNamespaceToPath,
  hasTypeFromDescription,
  getTypeFromDescription,
  getDirectories,
  removeFolder,
  removeExtension,
  checkExclution
} from "./utils";
import { GeneratorOptions } from "../bootstrap/options";
import {
  Swagger,
  SwaggerDefinition,
  SwaggerPropertyDefinition,
  SwaggerDefinitionProperties
} from "../bootstrap/swagger";

interface Type {
  fileName: string;
  typeName: string;
  namespace: string;
  fullNamespace: string;
  fullTypeName: string;
  importFile: string;
  isSubType: boolean;
  hasSubTypeProperty: boolean;
  isBaseType: boolean;
  baseType: Type;
  baseImportFile: string;
  path: string;
  pathToRoot: string;
  properties: TypeProperty[];
}

interface TypeProperty {
  name: string;
  staticFieldName: string;
  type: Type;
  typeName: string;
  namespace: string;
  description: string;
  hasValidation: boolean;
  isComplexType: boolean;
  isImportType: boolean;
  isUniqueImportType: boolean;
  importType: string;
  importFile: string;
  isEnum: boolean;
  isUniqueImportEnumType: boolean;
  importEnumType: string;
  isArray: boolean;
  isArrayComplexType: boolean;
  arrayTypeName: string;
  validators: {
    validation: {
      required: boolean;
      minimum: number;
      maximum: number;
      enum: string;
      minLength: number;
      maxLength: number;
      pattern: string;
    };
    validatorArray: string[];
  };
  enum: string[];
}

interface NamespaceGroups {
  [namespace: string]: Type[];
}

const TS_SUFFIX = ".ts";
const MODEL_SUFFIX = ".model";
const MODEL_FILE_SUFFIX = `${MODEL_SUFFIX}${TS_SUFFIX}`;
const ROOT_NAMESPACE = "root";
// const BASE_TYPE_WAIT_FOR_SECOND_PASS = 'wait-for-second-pass';

export function generateModelTSFiles(
  swagger: Swagger,
  options: GeneratorOptions
) {

  let folder = normalize(options.modelFolder);
  // generate fixed file with non-standard validators for validation rules which can be defined in the swagger file
  if (options.generateValidatorFile) {
    generateTSValidations(folder, options);
  }
  // generate fixed file with the BaseModel class
  generateTSBaseModel(folder, options);
  // get type definitions from swagger
  let typeCollection = getTypeDefinitions(
    swagger,
    options,
    MODEL_SUFFIX,
    MODEL_FILE_SUFFIX
  );
  // console.log('typeCollection', util.inspect(typeCollection, false, null, true))

  // group types per namespace
  let namespaceGroups = getNamespaceGroups(typeCollection, options);
  // console.log('namespaceGroups', namespaceGroups);
  // generate model files
  generateTSModels(namespaceGroups, folder, options);
  // generate subTypeFactory
  generateSubTypeFactory(namespaceGroups, folder, options);
  // generate barrel files (index files to simplify import statements)
  if (options.generateBarrelFiles) {
    generateBarrelFiles(namespaceGroups, folder, options);
  }
}

function generateTSValidations(folder: string, options: GeneratorOptions) {
  if (!options.generateClasses) return;

  let outputFileName = join(folder, options.validatorsFileName);
  let data = {};
  let template = readAndCompileTemplateFile(options.templates.validators);
  let result = template(data);
  ensureFolder(folder);
  let isChanged = writeFileIfContentsIsChanged(outputFileName, result);
  if (isChanged) {
    log(`generated ${outputFileName}`);
  }
}

function generateTSBaseModel(folder: string, options: GeneratorOptions) {
  if (!options.generateClasses) return;

  let outputFileName = join(folder, options.baseModelFileName);
  let data = {
    subTypePropertyName: options.subTypePropertyName
  };
  let template = readAndCompileTemplateFile(options.templates.baseModel);
  let result = template(data);
  ensureFolder(folder);
  let isChanged = writeFileIfContentsIsChanged(outputFileName, result);
  if (isChanged) {
    log(`generated ${outputFileName}`);
  }
}

function getTypeDefinitions(
  swagger: Swagger,
  options: GeneratorOptions,
  suffix: string,
  fileSuffix: string
) {
  let typeCollection: Type[] = new Array();
  // console.log('typesToFilter', options.typesToFilter);
  // // sort the definitions so subTypes are on top
  // // console.log('swagger.definitions', swagger.definitions);
  // console.log('----------------------------------------------');
  // // _(object).toPairs().sortBy(0).fromPairs().value();
  // swagger.definitions = _(swagger.definitions).toPairs().sortBy(0, [
  //     item => {
  //         console.log(item, 'isSubType', getIsSubType(item))
  //         return getIsSubType(item)
  //     }
  // ]).fromPairs().value();
  // // console.log('sorted swagger.definitions', swagger.definitions);
  // console.log('----------------------------------------------');
  forEach(swagger.definitions, (item, key) => {
    if (!isInTypesToFilter(item, key, options)) {
      let type = getTypeDefinition(
        swagger,
        typeCollection,
        item,
        key,
        options,
        suffix,
        fileSuffix
      );
      if (type) {
        typeCollection.push(type);
      }
    }
  });
  // second pass: fill baseTypes that are still null
  // (if the swagger is generated by SpringFox, the definitions might be sorted by propertyName
  //  so baseTypes are not on the top. In that case, baseTypes might not have been found when
  //  finding a subtype)
  fillMissingBaseTypes(swagger, typeCollection, options, suffix, fileSuffix);

  // fill types of the properties
  fillPropertyTypes(swagger, typeCollection, options, suffix, fileSuffix);

  // filter on unique types
  typeCollection = uniqBy(typeCollection, "typeName");

  return typeCollection;
}

function getTypeDefinition(
  swagger: Swagger,
  typeCollection: Type[],
  item: SwaggerDefinition,
  key: string,
  options: GeneratorOptions,
  suffix: string,
  fileSuffix: string
) {
  // filter enum types (these are generated by the enumGenerator)
  let isEnumType = getIsEnumType(item);
  if (isEnumType) {
    return undefined;
  }

  let required = (item.required as string[]) || [];
  let namespace = getNamespace(key, options, true);
  let fullNamespace = getNamespace(key, options, false);
  let typeName = getTypeName(key, options);
  if (getIsGenericType(typeName)) {
    typeName = convertGenericToGenericT(typeName);
  }
  let fullTypeName = fullNamespace ? `${fullNamespace}.${typeName}` : typeName;
  let pathToRoot = getPathToRoot(namespace);
  let importFile = getImportFile(typeName, namespace, pathToRoot, suffix);
  let properties = options.sortModelProperties
    ? (getSortedObjectProperties(
        item.properties
      ) as SwaggerDefinitionProperties)
    : item.properties;
  let baseType = undefined;
  let baseImportFile = undefined;
  let isSubType = getIsSubType(item);
  let hasSubTypeProperty = isSubType || getHasSubTypeProperty(properties, options);
  if (isSubType) {
    baseType = getBaseType(typeName, typeCollection, item, options);
    // baseType might not be in the typeCollection yet
    // in that case, a second pass will be done with method fillMissingBaseTypes
    if (baseType) {
      // set that the baseType is a baseType
      baseType.isBaseType = true;
      // determine baseImportFile
      baseImportFile = getImportFile(
        baseType.typeName,
        baseType.namespace,
        pathToRoot,
        suffix
      );
      required = getSubTypeRequired(item);
      properties = getSubTypeProperties(item, baseType);
    }
  }

  let type: Type = {
    fileName: getFileName(key, options, fileSuffix),
    typeName: typeName,
    namespace: namespace,
    fullNamespace: fullNamespace,
    fullTypeName: fullTypeName,
    isSubType: isSubType,
    hasSubTypeProperty: hasSubTypeProperty,
    importFile: importFile,
    isBaseType: false, // set elsewhere
    baseType: baseType,
    baseImportFile: baseImportFile,
    path: convertNamespaceToPath(namespace),
    pathToRoot: pathToRoot,
    properties: []
  };
  fillTypeProperties(
    swagger,
    type,
    baseType,
    required,
    properties,
    item,
    key,
    options,
    suffix,
    fileSuffix
  );
  return type;
}

function fillMissingBaseTypes(
  swagger: Swagger,
  typeCollection: Type[],
  options: GeneratorOptions,
  suffix: string,
  fileSuffix: string
) {
  // console.log('-------------------> In fillMissingBaseTypes <---------------------------')
  forEach(swagger.definitions, (item, key) => {
    let isSubType = getIsSubType(item);
    let type = findTypeInTypeCollection(typeCollection, getTypeName(key, options));
    if (isSubType && !type.baseType) {
      let namespace = getNamespace(key, options, true);
      let pathToRoot = getPathToRoot(namespace);

      let baseType = getBaseType(key, typeCollection, item, options);
      // set that the baseType is a baseType
      baseType.isBaseType = true;
      // determine baseImportFile
      let baseImportFile = getImportFile(
        baseType.typeName,
        baseType.namespace,
        pathToRoot,
        suffix
      );
      let required = getSubTypeRequired(item);
      let properties = getSubTypeProperties(item, baseType);

      type.baseType = baseType;
      type.baseImportFile = baseImportFile;
      fillTypeProperties(
        swagger,
        type,
        baseType,
        required,
        properties,
        item,
        key,
        options,
        suffix,
        fileSuffix
      );
    }
  });
}

function fillPropertyTypes(
  swagger: Swagger,
  typeCollection: Type[],
  options: GeneratorOptions,
  suffix: string,
  fileSuffix: string
) {
  forEach(typeCollection, (type, typeKey) => {
    forEach(type.properties, (property, propertyKey) => {
      const propertyType = findTypeInTypeCollection(
        typeCollection,
        property.typeName
      );
      property.type = propertyType;
    });
  });
}

function fillTypeProperties(
  swagger: Swagger,
  type: Type,
  baseType: Type,
  required: string[],
  properties: SwaggerDefinitionProperties,
  item: SwaggerDefinition,
  key: string,
  options: GeneratorOptions,
  suffix: string,
  fileSuffix: string
) {
  type.properties = [];
  forEach(properties, (item, key) => {
    let property = getTypePropertyDefinition(
      swagger,
      type,
      baseType,
      required,
      item,
      key,
      options,
      suffix,
      fileSuffix
    );
    type.properties.push(property);
  });
}

function getTypePropertyDefinition(
  swagger: Swagger,
  type: Type,
  baseType: Type,
  required: string[],
  item: SwaggerPropertyDefinition,
  key: string,
  options: GeneratorOptions,
  suffix: string,
  fileSuffix: string
) {
  const staticFieldName = `${snakeCase(key).toUpperCase()}_FIELD_NAME`;
  let isRefType = !!item.$ref;
  let isArray = item.type == "array";
  let isEnum =
    (item.type == "string" && !!item.enum) ||
    (isArray &&
      item.items &&
      item.items.type == "string" &&
      !!item.items.enum) ||
    ((isRefType || isArray) && getIsEnumRefType(swagger, item, isArray));
  // enum ref types are not handles as model types (they are handled in the enumGenerator)
  if (isEnum) {
    isRefType = false;
  }
  let propertyType = getPropertyType(item, key, options, isEnum);
  let isComplexType = isRefType || isArray; // new this one in constructor
  let isImportType = isRefType || (isArray && item.items.$ref && !isEnum);
  let importType = isImportType
    ? getImportType(propertyType.typeName, isArray)
    : undefined;
  let importFile = isImportType
    ? getImportFile(importType, propertyType.namespace, type.pathToRoot, suffix)
    : undefined;
  let importTypeIsPropertyType = importType === type.typeName;
  let isUniqueImportType =
    isImportType &&
    !importTypeIsPropertyType &&
    getIsUniqueImportType(importType, baseType, type.properties); // import this type
  let validators = getTypePropertyValidatorDefinitions(
    required,
    item,
    key,
    propertyType.typeName,
    isEnum
  );
  let hasValidation = keys(validators.validation).length > 0;

  let importEnumType = isEnum
    ? removeGenericArray(propertyType.typeName, isArray)
    : undefined;
  let isUniqueImportEnumType =
    isEnum && getIsUniqueImportEnumType(importEnumType, type.properties); // import this enumType
  let property = {
    name: key,
    staticFieldName: staticFieldName,
    type: null, // filled elsewhere
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
    enum: item.enum
  };
  return property;
}

function getTypePropertyValidatorDefinitions(
  required: string[],
  item: SwaggerPropertyDefinition,
  key: string,
  typeName: string,
  isEnum: boolean
) {
  let isRequired = indexOf(required, key) !== -1;
  // console.log('key=', key, 'typeName', typeName, 'item=', item, 'enum=', item.enum);

  let validators = {
    validation: {} as any,
    validatorArray: []
  };
  if (isRequired) {
    validators.validation.required = isRequired;
    validators.validatorArray.push("Validators.required");
  }
  if (has(item, "minimum")) {
    validators.validation.minimum = item.minimum;
    validators.validatorArray.push(`minValueValidator(${item.minimum})`);
  }
  if (has(item, "maximum")) {
    validators.validation.maximum = item.maximum;
    validators.validatorArray.push(`maxValueValidator(${item.maximum})`);
  }
  if (isEnum) {
    validators.validation.enum = `'${item.enum}'`;
    validators.validatorArray.push(`enumValidator(${typeName})`);
  }
  if (has(item, "minLength")) {
    validators.validation.minLength = item.minLength;
    validators.validatorArray.push(`Validators.minLength(${item.minLength})`);
  }
  if (has(item, "maxLength")) {
    validators.validation.maxLength = item.maxLength;
    validators.validatorArray.push(`Validators.maxLength(${item.maxLength})`);
  }
  if (has(item, "pattern")) {
    validators.validation.pattern = `'${item.pattern}'`;
    validators.validatorArray.push(`Validators.pattern('${item.pattern}')`);
  }
  return validators;
}

function getIsUniqueImportType(
  currentTypeName: string,
  baseType: Type,
  typeProperties: TypeProperty[]
) {
  let baseTypeName = baseType ? baseType.typeName : undefined;
  if (currentTypeName === baseTypeName) {
    return false;
  }
  return !some(typeProperties, property => {
    return property.importType === currentTypeName;
  });
}

function getIsUniqueImportEnumType(
  currentTypeName: string,
  typeProperties: TypeProperty[]
) {
  return !some(typeProperties, property => {
    return property.importEnumType === currentTypeName;
  });
}

function getTypeNameWithoutNamespacePrefixesToRemove(
  key: string,
  options: GeneratorOptions
) {
  if (!options.namespacePrefixesToRemove) {
    return key;
  }
  let namespaces = options.namespacePrefixesToRemove;
  namespaces.forEach(item => {
    key = key.replace(item, "");
    if (key[0] === ".") {
      key = key.substring(1);
    }
  });
  return key;
}

function getPropertyType(
  item: SwaggerPropertyDefinition,
  name: string,
  options: GeneratorOptions,
  isEnum: boolean
) {
  let result = {
    typeName: "",
    namespace: "",
    fullNamespace: undefined,
    isArrayComplexType: false,
    arrayTypeName: undefined
  };
  if (item.type) {
    result.typeName = item.type;
    if (item.type == "integer") {
      result.typeName = "number";
    }
    if (item.type == "string" && item.format == "date") {
      result.typeName = "Date";
    }
    if (item.type == "string" && item.format == "date-time") {
      result.typeName = "Date";
    }
    if (item.type == "string" && item.enum) {
      result.typeName = `${name}`;
    }
    if (item.type == "array" && item.items) {
      let arrayPropType = getPropertyType(item.items, name, options, isEnum);
      result.typeName = `Array<${arrayPropType.typeName}>`;
      result.namespace = arrayPropType.namespace;
      result.isArrayComplexType = !isEnum ? !!item.items.$ref : false;
      result.arrayTypeName = arrayPropType.typeName;
    }
    // description may contain an overrule type for enums, eg /** type CoverType */
    if (hasTypeFromDescription(item.description)) {
      result.typeName = lowerFirst(getTypeFromDescription(item.description));
      // fix enum array with overrule type
      if (item.type == "array" && item.items) {
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
      if (genericTType && genericTType === "System.DateTime") {
        result.typeName = result.typeName.replace(genericTType, "Date");
      }
    }

    return result;
  }
}

function removeDefinitionsRef(value: string) {
  let result = value.replace("#/definitions/", "");
  return result;
}

function getFileName(
  type: string,
  options: GeneratorOptions,
  fileSuffix: string
) {
  let typeName = removeGenericTType(getTypeName(type, options));
  return `${kebabCase(typeName)}${fileSuffix}`;
}

function getTypeName(type: string, options: GeneratorOptions) {
  let typeName;
  if (getIsGenericType(type)) {
    let startGenericT = type.indexOf("[");
    let startGenericType = type.lastIndexOf(".", startGenericT) + 1;
    typeName = type.substring(startGenericType);
    typeName = convertGenericTypeName(typeName);
    typeName = getTypeNameWithoutSuffixesToRemove(typeName, options);
  } else {
    typeName = type.split(".").pop();
    typeName = getTypeNameWithoutSuffixesToRemove(typeName, options);
    // C# Object affects Typescript Object - fix this
    if (typeName === "Object") {
      typeName = "SystemObject";
    }
    //classNameSuffixesToRemove
  }
  return upperFirst(typeName);
}

function getTypeNameWithoutSuffixesToRemove(typeName, options) {
  if (!options.typeNameSuffixesToRemove) {
    return typeName;
  }
  let typeNameSuffixesToRemove = options.typeNameSuffixesToRemove;
  typeNameSuffixesToRemove.forEach(item => {
    if (endsWith(typeName, item)) {
      typeName = typeName.slice(0, -item.length);
    }
  });
  return typeName;
}

function getIsGenericType(type: string) {
  return type.indexOf("[") !== -1 || type.indexOf("<") !== -1;
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
function removeGenericTType(type: string) {
  if (getIsGenericType(type)) {
    type = type.substring(0, type.indexOf("<"));
  }
  return type;
}
/**
 * NullableOrEmpty[System.Date] -> NullableOrEmpty<System.Date>
 */
function convertGenericTypeName(typeName) {
  return typeName.replace("[", "<").replace("]", ">");
}
/**
 * NullableOrEmpty<System.Date> -> NullableOrEmpty<T>
 */
function convertGenericToGenericT(typeName) {
  return typeName.replace(/\<.*\>/, "<T>");
}

function getIsSubType(item: SwaggerDefinition) {
  return item.allOf !== undefined;
}

function getHasSubTypeProperty(
  properties: SwaggerDefinitionProperties,
  options: GeneratorOptions
) {
  return has(properties, options.subTypePropertyName);
}

function getBaseType(
  superTypeName: string,
  typeCollection: Type[],
  item: SwaggerDefinition,
  options: GeneratorOptions
) {
  // TODO how about more than one baseType?
  let type = removeDefinitionsRef(item.allOf[0].$ref);
  let typeName = getTypeName(type, options);
  //let namespace = getNamespace(type, options);
  let baseType = findTypeInTypeCollection(typeCollection, typeName);
  // console.log('---------------------')
  // console.log('getBaseType superTypeName', superTypeName, 'type', type, /*'item', item,*/ 'typeName', typeName, 'baseType', baseType ? baseType.typeName : null, /*'typeCollection', typeCollection*/ )
  return baseType;
}

function findTypeInTypeCollection(typeCollection: Type[], typeName: string) {
  let result = find(typeCollection, type => {
    return type.typeName === typeName;
    //return type.typeName === typeName && type.namespace === namespace;
  });
  return result;
}

function getSubTypeProperties(item: SwaggerDefinition, baseType) {
  // TODO strip properties which are defined in the baseType?
  let properties = item.allOf[1].properties;
  return properties;
}

function getSubTypeRequired(item: SwaggerDefinition) {
  let required = (item.allOf[1].required as string[]) || [];
  return required;
}

function getIsEnumType(item: SwaggerDefinition) {
  return !!(item && item.enum);
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

function getNamespace(
  type: string,
  options: GeneratorOptions,
  removePrefix: boolean
) {
  let typeName = removePrefix
    ? getTypeNameWithoutNamespacePrefixesToRemove(type, options)
    : type;

  if (getIsGenericType(typeName)) {
    let first = typeName.substring(0, typeName.indexOf("["));
    typeName = first + first.substring(typeName.indexOf("]"));
  }
  let parts = typeName.split(".");
  parts.pop();
  return parts.join(".");
}

function getImportType(type: string, isArray: boolean) {
  if (isArray) {
    let result = removeGenericArray(type, isArray);
    return result;
  }
  type = removeGenericTType(type);

  return type;
}

function removeGenericArray(type: string, isArray: boolean) {
  if (isArray) {
    let result = type.replace("Array<", "").replace(">", "");
    return result;
  }
  return type;
}

function getImportFile(
  propTypeName: string,
  propNamespace: string,
  pathToRoot: string,
  suffix: string
) {
  //return `${_.lowerFirst(type)}${suffix}`;
  let importPath = `${kebabCase(propTypeName)}${suffix}`;
  if (propNamespace) {
    let namespacePath = convertNamespaceToPath(propNamespace);
    importPath = `${namespacePath}/${importPath}`;
  }

  return (pathToRoot + importPath).toLocaleLowerCase();
}

function getNamespaceGroups(typeCollection: Type[], options: GeneratorOptions) {
  let namespaces: NamespaceGroups = {
    [ROOT_NAMESPACE]: []
  };
  for (let i = 0; i < typeCollection.length; ++i) {
    let type = typeCollection[i];
    let namespace = type.namespace || ROOT_NAMESPACE;
    if (checkExclution(namespace, options.exclude)) {
      continue;
    }
    if (!namespaces[namespace]) {
      namespaces[namespace] = [];
    }
    namespaces[namespace].push(type);
  }
  return namespaces;
}

function excludeNamespace(
  namespace: string,
  excludeOptions: (string | RegExp)[]
) {
  if (!excludeOptions || !excludeOptions.length) {
    return false;
  }

  for (const excludeCheck of excludeOptions) {
    if (
      (excludeCheck instanceof RegExp && excludeCheck.test(namespace)) ||
      ~namespace.indexOf(<string>excludeCheck)
    ) {
      return true;
    }
  }
  return false;
}

function generateTSModels(
  namespaceGroups: NamespaceGroups,
  folder: string,
  options: GeneratorOptions
) {
  let data = {
    generateClasses: options.generateClasses,
    hasComplexType: false,
    validatorFileName: removeExtension(options.validatorsFileName),
    baseModelFileName: removeExtension(options.baseModelFileName),
    subTypeFactoryFileName: removeExtension(options.subTypeFactoryFileName),
    moduleName: options.modelModuleName,
    enumModuleName: options.enumModuleName,
    enumRef: options.enumRef,
    subTypePropertyName: options.subTypePropertyName,
    subTypePropertyConstantName: snakeCase(
      options.subTypePropertyName
    ).toUpperCase(),
    type: undefined
  };
  let template = readAndCompileTemplateFile(options.templates.models);
  ensureFolder(folder);
  for (let namespace in namespaceGroups) {
    let typeCol = namespaceGroups[namespace];

    let firstType =
      typeCol[0] ||
      <Type>{
        namespace: ""
      };
    let namespacePath = convertNamespaceToPath(firstType.namespace);
    let typeFolder = `${folder}${namespacePath}`;
    let folderParts = namespacePath.split("/");
    let prevParts = folder;
    folderParts.forEach(part => {
      prevParts += part + "/";
      ensureFolder(prevParts);
    });

    let nrGeneratedFiles = 0;
    each(typeCol, type => {
      let outputFileName = join(typeFolder, type.fileName);
      data.type = type;
      data.hasComplexType = type.properties.some(
        property => property.isComplexType
      );
      let result = template(data);
      let isChanged = writeFileIfContentsIsChanged(outputFileName, result);
      if (isChanged) {
        nrGeneratedFiles++;
      }
      //fs.writeFileSync(outputFileName, result, { flag: 'w', encoding: utils.ENCODING });
    });
    log(
      `generated ${nrGeneratedFiles} type${
        nrGeneratedFiles === 1 ? "" : "s"
      } in ${typeFolder}`
    );
    removeFilesOfNonExistingTypes(
      typeCol,
      typeFolder,
      options,
      MODEL_FILE_SUFFIX
    );
  }
  let namespacePaths = Object.keys(namespaceGroups).map(namespace => {
    return join(folder, convertNamespaceToPath(namespace));
  });
  cleanFoldersForObsoleteFiles(folder, namespacePaths);
}

function cleanFoldersForObsoleteFiles(
  folder: string,
  namespacePaths: string[]
) {
  getDirectories(folder).forEach(name => {
    let folderPath = join(folder, name);
    // TODO bij swagger-zib-v2 wordt de webapi/ZIB folder weggegooid !
    let namespacePath = find(namespacePaths, path => {
      return path.startsWith(folderPath);
    });
    if (!namespacePath) {
      removeFolder(folderPath);
      log(`removed obsolete folder ${name} in ${folder}`);
    } else {
      cleanFoldersForObsoleteFiles(folderPath, namespacePaths);
    }
  });
}

function generateSubTypeFactory(
  namespaceGroups: NamespaceGroups,
  folder: string,
  options: GeneratorOptions
) {
  let data = {
    subTypes: undefined,
    subTypePropertyName: options.subTypePropertyName
  };
  let template = readAndCompileTemplateFile(options.templates.subTypeFactory);
  for (let key in namespaceGroups) {
    data.subTypes = namespaceGroups[key].filter(type => {
      return type.hasSubTypeProperty;
    });
    let namespacePath = namespaceGroups[key][0]
      ? namespaceGroups[key][0].path
      : "";
    let outputFileName = join(folder, options.subTypeFactoryFileName);

    let result = template(data);
    let isChanged = writeFileIfContentsIsChanged(outputFileName, result);
    if (isChanged) {
      log(`generated ${outputFileName}`);
    }
  }
}

function generateBarrelFiles(
  namespaceGroups: NamespaceGroups,
  folder: string,
  options: GeneratorOptions
) {
  let data: { fileNames: string[] } = {
    fileNames: undefined
  };
  let template = readAndCompileTemplateFile(options.templates.barrel);

  for (let key in namespaceGroups) {
    data.fileNames = namespaceGroups[key].map(type => {
      return removeExtension(type.fileName);
    });
    if (key === ROOT_NAMESPACE) {
      addRootFixedFileNames(data.fileNames, options);
    }
    let namespacePath = namespaceGroups[key][0]
      ? namespaceGroups[key][0].path
      : "";
    let outputFileName = join(folder + namespacePath, "index.ts");

    let result = template(data);
    let isChanged = writeFileIfContentsIsChanged(outputFileName, result);
    if (isChanged) {
      log(`generated ${outputFileName}`);
    }
  }
}

function addRootFixedFileNames(fileNames: string[], options: GeneratorOptions) {
  let enumOutputFileName = normalize(options.enumTSFile.split("/").pop());
  fileNames.splice(0, 0, removeExtension(enumOutputFileName));
  if (options.generateClasses) {
    let validatorsOutputFileName = normalize(options.validatorsFileName);
    fileNames.splice(0, 0, removeExtension(validatorsOutputFileName));
  }
}

function removeFilesOfNonExistingTypes(
  typeCollection,
  folder: string,
  options: GeneratorOptions,
  suffix: string
) {
  // remove files of types which are no longer defined in typeCollection
  let counter = 0;
  let files = readdirSync(folder);
  each(files, file => {
    if (
      endsWith(file, suffix) &&
      !find(typeCollection, type => {
        return type.fileName == file;
      })
    ) {
      counter++;
      unlinkSync(join(folder, file));
      log(`removed ${file} in ${folder}`);
    }
  });
  if (counter > 0) {
    log(`removed ${counter} types in ${folder}`);
  }
}
