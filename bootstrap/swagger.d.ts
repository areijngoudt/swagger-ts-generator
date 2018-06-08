declare type Consumers = 'application/json' | 'text/json' | 'application/xml' | 'text/xml' | 'application/x-www-form-urlencoded';
declare type Producers = 'application/json' | 'text/json' | 'application/xml' | 'text/xml';
interface Schema {
    $ref?: string;
    type?: string;
}
export interface SwaggerDefinitions {
    [namespace: string]: SwaggerDefinition;
}
export interface SwaggerDefinitionProperties {
    [propertyName: string]: SwaggerPropertyDefinition;
}
export interface Swagger {
    swagger: string;
    info: {
        version: string;
        title: string;
        description: string;
    };
    host: string;
    basePath: string;
    schemes: string[];
    paths: {
        [endpointPath: string]: {
            get: SwaggerHttpEndpoint;
            post: SwaggerHttpEndpoint;
            put: SwaggerHttpEndpoint;
            delete: SwaggerHttpEndpoint;
        };
    };
    definitions: SwaggerDefinitions;
}
export interface SwaggerHttpEndpoint {
    tags: string[];
    summary?: string;
    operationId: string;
    consumes: Consumers[];
    produces: Producers[];
    parameters: {
        name: string;
        in: 'path' | 'query' | 'body';
        required: boolean;
        description?: string;
        type?: string;
        schema?: Schema;
        maxLength?: number;
        minLength?: number;
    }[];
    respones: {
        [httpStatusCode: string]: {
            description: string;
            schema: Schema;
        };
    };
    deprecated: boolean;
}
export interface SwaggerDefinition extends Schema {
    properties: SwaggerDefinitionProperties;
    description?: string;
    required?: (keyof SwaggerDefinitionProperties)[];
    allOf?: SwaggerDefinition[];
    enum?: string[];
}
export interface SwaggerPropertyDefinition extends Schema {
    description?: string;
    maxLength?: number;
    minLength?: number;
    maximum?: number;
    minimum?: number;
    format?: string;
    pattern?: string;
    items?: SwaggerDefinition;
    readonly?: boolean;
    enum?: string[];
}
export {};
