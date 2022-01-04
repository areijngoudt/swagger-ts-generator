export interface GeneratorOptions {
    modelFolder: string;
    enumTSFile: string;

    generateClasses?: boolean;
    generateValidatorFile?: boolean;
    baseModelFileName?: string;
    subTypeFactoryFileName?: string;
    validatorsFileName?: string;
    exclude?: (string | RegExp)[];
    enumI18NHtmlFile?: string;
    enumLanguageFiles?: string[];
    modelModuleName?: string;
    enumModuleName?: string;
    enumRef?: string;
    subTypePropertyName?: string;
    namespacePrefixesToRemove?: string[];
    typeNameSuffixesToRemove?: string[];
    typesToFilter?: string[];
    sortModelProperties?: boolean;
    sortEnumTypes?: boolean;

    templates?: {
        validators?: string;
        baseModel?: string;
        models?: string;
        subTypeFactory?: string;
        enum?: string;
        enumLanguage?: string;
    };
}
