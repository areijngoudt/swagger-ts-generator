export interface Swagger {
    openapi: string;
    info: {
        title: string;
        description: string;
        version: string;
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
    components: {
        schemas: SwaggerSchemas;
        requestBodies: any;
        securitySchemes: any;
    };
}

export interface SwaggerSchemas {
    [namespace: string]: SwaggerSchema;
}

export interface SwaggerSchema extends Schema {
    properties: SwaggerSchemaProperties;
    // description?: string;
    required?: (keyof SwaggerSchemaProperties)[];
    allOf?: SwaggerSchema[];
    enum?: string[];
}

export interface SwaggerSchemaProperties {
    [propertyName: string]: SwaggerPropertyDefinition;
}

export interface SwaggerPropertyDefinition extends Schema {
    description?: string;
    maxLength?: number;
    minLength?: number;
    maximum?: number;
    minimum?: number;
    format?: string;
    pattern?: string;
    items?: SwaggerSchema;
    readonly?: boolean;
    enum?: string[];
}

export interface Schema {
    $ref?: string;
    oneOf?: Schema[];
    type?: string;
}

export interface SwaggerHttpEndpoint {
    tags: string[];
    summary?: string;
    description?: string;
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

type Consumers =
    | 'application/json'
    | 'text/json'
    | 'application/xml'
    | 'text/xml'
    | 'application/x-www-form-urlencoded';
type Producers = 'application/json' | 'text/json' | 'application/xml' | 'text/xml';
