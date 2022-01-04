import { first, isArray, some, uniqBy } from 'lodash';
export interface IImportType {
    importType: string;
    importFile: string;
}
export interface IImportEnumType {
    importEnumType: string;
}

export interface IType {
    fileName: string;
    typeName: string;
    namespace: string;
    fullNamespace: string;
    fullTypeName: string;
    importFile: string;
    isSubType: boolean;
    hasSubTypeProperty: boolean;
    isBaseType: boolean;
    baseType: IType;
    baseImportFile: string;
    path: string;
    pathToRoot: string;
    properties: ITypeProperty[];
    get templateImportTypes(): IImportType[];
    get templateImportEnumTypes(): IImportEnumType[];
}

export class Type implements IType {
    fileName: string;
    typeName: string;
    namespace: string;
    fullNamespace: string;
    fullTypeName: string;
    importFile: string;
    isSubType: boolean;
    hasSubTypeProperty: boolean;
    isBaseType: boolean;
    baseType: IType;
    baseImportFile: string;
    path: string;
    pathToRoot: string;
    properties: TypeProperty[];
    constructor(values: Partial<IType>) {
        if (values) {
            this.fileName = values.fileName;
            this.typeName = values.typeName;
            this.namespace = values.namespace;
            this.fullNamespace = values.fullNamespace;
            this.fullTypeName = values.fullTypeName;
            this.importFile = values.importFile;
            this.isSubType = values.isSubType;
            this.hasSubTypeProperty = values.hasSubTypeProperty;
            this.isBaseType = values.isBaseType;
            this.baseType = values.baseType;
            this.baseImportFile = values.baseImportFile;
            this.path = values.path;
            this.pathToRoot = values.pathToRoot;
            this.properties = values.properties;
        }
    }

    get templateImportTypes(): IImportType[] {
        const importTypes: IImportType[] = this.properties
            .filter(prop => prop.hasUniqueImportTypes)
            .flatMap(prop => {
                return prop.importTypes.map((item, index) => {
                    return { importType: prop.importTypes[index], importFile: prop.importFiles[index] };
                });
            });
        return uniqBy(importTypes, item => item.importType);
    }

    get templateImportEnumTypes(): IImportEnumType[] {
        return uniqBy(
            this.properties
                .filter(prop => prop.isUniqueImportEnumType)
                .map(prop => {
                    return { importEnumType: prop.importEnumType };
                }),
            item => item.importEnumType
        );
    }
}

export interface IValidators {
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
}

export interface ITypeProperty {
    name: string;
    staticFieldName: string;
    type: IType | IType[]; // array if isUnionType
    typeName: string; // `Type1 | Type2` if isUnionType
    interfaceTypeName: string; // `IType1 | IType2` if isUnionType
    isUnionType: boolean;
    unionTypeNames: string[];
    unionInterfaceTypeNames: string[];
    namespace: string;
    description: string;
    isComplexType: boolean;
    hasImportTypes: boolean;
    hasUniqueImportTypes: boolean;
    importTypes: string[];
    importFiles: string[];
    isEnum: boolean;
    enum: string[];
    isUniqueImportEnumType: boolean;
    importEnumType: string;
    isArray: boolean;
    isArrayComplexType: boolean;
    isArrayUnionType: boolean;
    arrayTypeName: string; // `Array<Type1 | Type2>` if isUnionType
    arrayInterfaceTypeName: string; // `Array<IType1 | IType2>` if isUnionType
    hasValidation: boolean;
    validators: IValidators;

    get templateTypeNameForInstantiation(): string;
    get templateTypeNameForComplexArray(): string;
    get templateUseInstantiateSubType(): boolean;
}

export class TypeProperty implements ITypeProperty {
    name: string;
    staticFieldName: string;
    type: IType | IType[];
    typeName: string; //
    interfaceTypeName: string;
    isUnionType: boolean;
    unionTypeNames: string[];
    unionInterfaceTypeNames: string[];
    namespace: string;
    description: string;
    isComplexType: boolean;
    hasImportTypes: boolean;
    hasUniqueImportTypes: boolean;
    importTypes: string[];
    importFiles: string[];
    isEnum: boolean;
    enum: string[];
    isUniqueImportEnumType: boolean;
    importEnumType: string;
    isArray: boolean;
    isArrayComplexType: boolean;
    isArrayUnionType: boolean;
    arrayTypeName: string;
    arrayInterfaceTypeName: string;
    hasValidation: boolean;
    validators: IValidators;
    constructor(values: Partial<ITypeProperty>) {
        if (values) {
            this.name = values.name;
            this.staticFieldName = values.staticFieldName;
            this.type = values.type;
            this.typeName = values.typeName;
            this.interfaceTypeName = values.interfaceTypeName;
            this.isUnionType = values.isUnionType;
            this.unionTypeNames = values.unionTypeNames;
            this.unionInterfaceTypeNames = values.unionInterfaceTypeNames;
            this.namespace = values.namespace;
            this.description = values.description;
            this.isComplexType = values.isComplexType;
            this.hasImportTypes = values.hasImportTypes;
            this.hasUniqueImportTypes = values.hasUniqueImportTypes;
            this.importTypes = values.importTypes;
            this.importFiles = values.importFiles;
            this.isEnum = values.isEnum;
            this.enum = values.enum;
            this.isUniqueImportEnumType = values.isUniqueImportEnumType;
            this.importEnumType = values.importEnumType;
            this.isArray = values.isArray;
            this.isArrayComplexType = values.isArrayComplexType;
            this.isArrayUnionType = values.isArrayUnionType;
            this.arrayTypeName = values.arrayTypeName;
            this.arrayInterfaceTypeName = values.arrayInterfaceTypeName;
            this.hasValidation = values.hasValidation;
            this.validators = values.validators;
        }
    }

    get templateTypeNameForInstantiation(): string {
        if (this.isUnionType && !this.isArray) {
            return first(this.unionTypeNames);
        }
        return this.typeName;
    }

    get templateTypeNameForComplexArray(): string {
        if (this.isUnionType) {
            return first(this.unionTypeNames);
        }
        return this.arrayTypeName;
    }

    get templateUseInstantiateSubType(): boolean {
        if (this.isUnionType) {
            return true;
        }
        if (isArray(this.type)) {
            return some(this.type, item => item.isBaseType);
        }
        return this.type?.isBaseType;
    }
}

export interface INamespaceGroups {
    [namespace: string]: Type[];
}
