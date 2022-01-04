# Swagger TypeScript code generator

Node module to generate TypeScript code for Angular (2 and above) based on Webapi meta data in OpenAPI v3 format.

# Setup

Download the module with npm:

```bash
npm install --save-dev swagger-ts-generator
```

# Usage in NodeJS

Create a simple `.js` file and run it using `node path/to/file.js`

You can then run this from `npm` by adding the `node` line from above as a task in your `package.json`

```typescript
const { generateTSFiles } = require('swagger-ts-generator');

const config = {
    file: __dirname + '\\swagger.json'
};

generateTSFiles(
    config.file, // This can be either a file containing the Swagger json or the Swagger object itself
    {
        modelFolder: './path/to/models',
        enumTSFile: './path/to/models/enums.ts'
        // + optionally more configuration
    }
);
```

# Usage in Gulp

## `gulp.config`

Create a `gulp.config` file with the settings you want:

-   generateClasses (default: true) - If this flag is set to false, the generator will output only interfaces and enums. It will not output classes and validators.

```javascript
'use strict';

module.exports = config();

function config() {
    var root = './src/';
    var srcAppFolder = root + 'app/';
    var folders = {
        // root
        root: root,
        // sources
        srcWebapiFolder: srcAppFolder + 'models/webapi/',
        srcLanguagesFolder: root + 'assets/i18n/',
        // swagger
        swaggerFolder: root + 'swagger/'
    };
    var files = {
        swaggerJson: 'swagger.json'
    };

    var swagger = {
        url: 'http://petstore.swagger.io/v2/swagger.json',
        swaggerFile: folders.swaggerFolder + files.swaggerJson,
        swaggerFolder: folders.swaggerFolder,
        swaggerTSGeneratorOptions: {
            modelFolder: folders.srcWebapiFolder,
            enumTSFile: folders.srcWebapiFolder + 'enums.ts',
            enumI18NHtmlFile: folders.enumI18NHtmlFolder + 'enum-i18n.component.html',
            enumLanguageFiles: [folders.srcLanguagesFolder + 'nl.json', folders.srcLanguagesFolder + 'en.json'],
            generateClasses: true,
            generateValidatorFile: true,
            modelModuleName: 'webapi.models',
            enumModuleName: 'webapi.enums',
            enumRef: './enums',
            subTypePropertyName: 'typeSelector',
            namespacePrefixesToRemove: [],
            typeNameSuffixesToRemove: [],
            typesToFilter: [
                'ModelAndView', // Springfox artifact
                'View' // Springfox artifact
            ]
        }
    };

    var config = {
        root: root,
        files: files,
        swagger: swagger
    };
    return config;
}
```

## `gulpfile.js`

Create a `gulpfile.js`:

```javascript
/*global __dirname */
'use strict';

var gulp = require('gulp');

var $ = require('gulp-load-plugins')({ lazy: true });
var args = require('yargs').argv;
var swaggerTSGenerator = require('swagger-ts-generator');
var request = require('request');
var source = require('vinyl-source-stream');

var config = require('./gulp.config');

//--------------- gulp tasks ---------------

gulp.task('default', ['show-help']); // Set default gulp tasks
gulp.task('show-help', $.taskListing);

gulp.task('gen', ['gen-webapi']);
gulp.task('gen-webapi', ['gen-webapi-download-swagger'], genWebapi);
gulp.task('gen-webapi-download-swagger', genWebapiDownloadSwagger);

//--------------- generator tasks ---------------

function genWebapi(done) {
    swaggerTSGenerator.generateTSFiles(config.swagger.swaggerFile, config.swagger.swaggerTSGeneratorOptions);
    done();
}
function genWebapiDownloadSwagger(done) {
    process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0'; // Ignore 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' authorization error

    return request
        .get({
            url: config.swagger.url,
            headers: {
                'User-Agent': 'request',
                'content-type': 'application/json'
            }
        })
        .pipe(customPlumber('Error gen-webapi-autorest'))
        .pipe(source(config.files.swaggerJson))
        .pipe($.streamify($.jsbeautifier(/*{ mode: 'VERIFY_AND_WRITE' }*/)))
        .pipe(gulp.dest(config.folders.swaggerFolder));
}

function customPlumber(errTitle) {
    return $.plumber({
        errorHandler: $.notify.onError({
            // Customizing error title
            title: errTitle || 'Error running Gulp',
            message: 'Error: <%= error.message %>',
            sound: 'Glass'
        })
    });
}

function log(msg) {
    $.util.log($.util.colors.yellow(msg));
}
```

## Execute the gulp task(s)

Download the swagger file and generate the code:

```bash
gulp gen
```

# Generated files

## `validators.ts`

The generated validators.ts is fixed (its always generated regardless of the Swagger unless `swaggerTSGeneratorOptions.generateValidatorFile` is set to `false`).
It contains some extra validators to implement validation rules for the Swagger which are not part of the standard Angular validators:

```typescript
maxValueValidator;
minValueValidator;
enumValidator;
```

## `base-model.ts`

The generated base-model.ts is generated regardless of the Swagger.
It contains the base class for all generated models.

The generated file looks like this:

```typescript
/**
 * This file is generated by the SwaggerTSGenerator.
 * Do not edit.
 */
/* tslint:disable */

export abstract class BaseModel {
    /**
     * set the values.
     * @param values Can be used to set a webapi response to this newly constructed model
     */
    abstract setValues(values: any): void;

    /**
     * fill array property in model.
     * for complex types, type must be defined.
     * for complex types with subtypes, subTypeFactoryFn must be filled in.
     */
    protected fillModelArray<T>(
        object: BaseModel,
        key: string,
        values: Array<T>,
        type = undefined,
        subTypeFactoryFn: Function = undefined
    ): void {
        if (values) {
            object[key] = new Array<T>();
            for (let value of values) {
                if (type) {
                    if (this.isSubType(value)) {
                        const subTypeInstance = subTypeFactoryFn(value);
                        object[key].push(subTypeInstance);
                    } else {
                        object[key].push(new type(value));
                    }
                } else {
                    object[key].push(value);
                }
            }
        }
    }

    protected isSubType(value: any): boolean {
        return value.hasOwnProperty('typeSelector') && value.typeSelector;
    }

    protected getValue<T>(values: any, propertyName: string): T {
        return values.hasOwnProperty(propertyName) ? values[propertyName] : this[propertyName];
    }
}
```

## `sub-type-factory.ts`

This class is used in the generated models to instantiate subTypes. It uses the `swaggerTSGeneratorOptions.subTypePropertyName` from the generator config.

The generated file looks like this:

```typescript
/**
 * This file is generated by the SwaggerTSGenerator.
 * Do not edit.
*/
/* tslint:disable */

import { Company } from './company.model';
...

export class SubTypeFactory {
    /**
     * create subType based on the value if the typeSelector property
     */
    static createSubTypeInstance(value: any): object {
        switch (value.typeSelector) {
            case 'Company':
                return new Company(value);
            ...
            default:
                throw new Error(`${value.typeSelector} not supported here`);
        }
    }
}
```

## `*.model.ts`

For each definition in the Swagger an Interface and a Class are generated.

Properties of an enum type are generated referencing this type which are generated in the next section.

This is an example of a generated TypeScript file with one model (definition) from the Swagger file:

```typescript
/**
 * This file is generated by the SwaggerTSGenerator.
 * Do not edit.
 */
/* tslint:disable */
import { BaseModel } from './base-model';
import { SubTypeFactory } from './sub-type-factory';

import { type } from './enums';
import { gender } from './enums';
import { Address } from './address.model';
import { Veterinarian } from './veterinarian.model';
import { Tag } from './tag.model';
import { NullableOrEmpty } from './nullable-or-empty.model';

export interface IPet {
    name: string;
    age?: number;
    dob?: Date;
    type: type;
    gender?: gender;
    address?: Address;
    vet?: Veterinarian;
    tags?: Array<Tag>;
    isFavorate?: boolean;
    testDate?: NullableOrEmpty<Date>;
    primitiveArray?: Array<string>;
}

export class Pet extends BaseModel implements IPet {
    name: string;
    age: number;
    dob: Date;
    type: type;
    gender: gender;
    address: Address;
    vet: Veterinarian;
    tags: Array<Tag>;
    isFavorate: boolean;
    testDate: NullableOrEmpty<Date>;
    primitiveArray: Array<string>;

    /**
     * constructor
     * @param values Can be used to set a webapi response or formValues to this newly constructed model
     * @useFormGroupValuesToModel if true use formValues
     */
    constructor(values?: Partial<IPet>) {
        super();
        this.address = new Address();
        this.vet = new Veterinarian();
        this.tags = new Array<Tag>();
        this.testDate = new NullableOrEmpty<Date>();
        this.primitiveArray = new Array<string>();
        if (values) {
            this.setValues(values);
        }
    }

    /**
     * set the values.
     * @param values Can be used to set a webapi response to this newly constructed model
     */
    setValues(values: Partial<IPet>): void {
        if (values) {
            const rawValues = this.getValuesToUse(values);
            this.name = rawValues.name;
            this.age = rawValues.age;
            this.dob = rawValues.dob;
            this.type = rawValues.type;
            this.gender = rawValues.gender;
            this.address.setValues(rawValues.address);
            this.vet.setValues(rawValues.vet);
            this.fillModelArray<Tag>(this, 'tags', rawValues.tags, Tag, SubTypeFactory.createSubTypeInstance);
            this.isFavorate = rawValues.isFavorate;
            this.testDate.setValues(rawValues.testDate);
            this.fillModelArray<string>(
                this,
                'primitiveArray',
                rawValues.primitiveArray,
                string,
                SubTypeFactory.createSubTypeInstance
            );
        }
    }
}
```

## `enums.ts`

This is een excerpt from a generated TypeScript file with enums.

```typescript
// THIS IS GENERATED CODE. DO NOT CHANGE MANUALLY!
/* tslint:disable */

// generate enum based on strings instead of numbers
// (see https://blog.rsuter.com/how-to-implement-an-enum-with-string-values-in-typescript/)
export enum type {
    cat = <any>'cat',
    dog = <any>'dog',
    bird = <any>'bird',
    whale = <any>'whale'
}

export enum gender {
    unknown = <any>'unknown',
    male = <any>'male',
    female = <any>'female'
}

export enum hairColor {
    red = <any>'red',
    blond = <any>'blond',
    brown = <any>'brown',
    black = <any>'black',
    white = <any>'white',
    gray = <any>'gray'
}

/**
 * bundle of all enums for databinding to options, radio-buttons etc.
 * usage in component:
 *   import { AllEnums, minValueValidator, maxValueValidator } from '../../models/webapi';
 *
 *   @Component({
 *       ...
 *   })
 *   export class xxxComponent implements OnInit {
 *       allEnums = AllEnums;
 *       ...
 *       ngOnInit() {
 *           this.allEnums = AllEnums.instance;
 *       }
 *   }
 */
export class AllEnums {
    private static _instance: AllEnums = new AllEnums();
    constructor() {
        if (AllEnums._instance) {
            throw new Error('Error: Instantiation failed: Use AllEnums.instance instead of new');
        }
        AllEnums._instance = this;
    }
    static get instance(): AllEnums {
        return AllEnums._instance;
    }

    type = type;
    gender = gender;
    hairColor = hairColor;
}

/**
 * union type of all enums.
 * Useful for typing params and variables in generic components.
 */
export type AllEnumsType = type | gender | haircolor;
```

Normally enums are numbers based in TypeScript. In out Webapi's whe use stringbased Enums.
The thick with <code>cat = `<any>`"cat"</code> is used to make the TypeScript enums string based.

## `enum-i18n.component.html`

When the [I18N features](https://github.com/angular/angular-cli/wiki/stories-internationalization) of the [angular-cli](https://github.com/angular/angular-cli/wiki) are used in your application, a view can be gerenarted containing a translatable entry for each enum value. This is triggered by the presence of the `enumLanguageFiles` property in the options in the `gulp.config` file.

```html
<!--
 * This file is generated by the SwaggerTSGenerator.
 * Do not edit.
-->

<!-- ngx-translate-data for enums -->
<div class="hidden">
    <!-- Role -->
    <span i18n="type.cat|ngx-translate">Cat</span>
    <span i18n="type.dog|ngx-translate">Dog</span>
    <span i18n="type.brid|ngx-translate">Bird</span>
    <span i18n="type.whale|ngx-translate">Whale</span>
    ...
</div>
```

Using the [xliffmerge](https://github.com/martinroob/ngx-i18nsupport/wiki/ngx-translate-usage) tool, this file can be used to generate the enum language `.json` files for [ngx-translate](http://www.ngx-translate.com/).

Make sure this view is part of lazy loaded Angular component (it does not have to be loaded, it will only be used by the angular-cli i18n extraction tool).

## enums language files

As an alternative for the `enum-i18n.component.html` file from the section above, enum language files can be generated. Translation must be done by hand. Each new enum value is added to the given enumLanguageFile(s). Enum values already present are left intact.

```typescript
{
  "type": "-------ENUM-TYPE-------",
  "cat": "kat",
  "dog": "hond",
  "bird": "vogel",
  "whale": "whale",
  "gender": "-------ENUM-TYPE-------",
  "unknown": "onbekend",
  "male": "man",
  "female": "vrouw",
  "hairColor": "-------ENUM-TYPE-------",
  "red": "rood",
  "blond": "blond",
  "brown": "bruin",
  "black": "zwart",
  "white": "wit",
  "gray": "grijs"
}
```
