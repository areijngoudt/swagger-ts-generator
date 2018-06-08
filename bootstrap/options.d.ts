export interface GeneratorOptions {
    modelFolder: string;
    enumTSFile: string;
    barrelFiles?: boolean;
    generateClasses?: boolean;
    enumI18NHtmlFile?: string;
    enumLanguageFiles?: string[];
    modelModuleName?: string;
    enumModuleName?: string;
    enumRef?: string;
    subTypePropertyName?: string[];
    namespacePrefixesToRemove?: string[];
    typeNameSuffixesToRemove?: string[];
    typesToFilter?: string[];
    sortModelProperties?: boolean;
    sortEnumTypes?: boolean;
}