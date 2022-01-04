# CHANGELOG

### 2.0.0

-   support openapi v3 (instead of swagger v2)
-   removed generateBarrelFile
-   removed generateFormGroups

### 1.2.10

-   log missing types

### 1.2.7

-   in model interface: use interface for properties of complex types
-   in model: use Partial<interface> instead of any in ctor and setValues

### 1.2.3

-   fixed an error in model generation using the FormGroups

### 1.2.2

-   added some unit tests to test generated code

### 1.2.1

-   added generateFormGroups option

### 1.1.59

-   fixed compile error

### 1.1.58

-   generate AllEnumsType in enums

### 1.1.49

-   generate static xxx_FIELD_NAME fields in the models

### 1.1.48

-   generate subtype stuff when a class had the subTypeProperty

### 1.1.45

-   addFormControl and setFormGroupValuesInAddedFormControls added to BaseModel.
-   better support for subTypes in generated models and baseModel
-   SubTypeFactory is now generated
-   switched parameters type and subTypeFactoryFn in BaseModel.fillModelArray

### 1.1.39

static classname as a string now only in subtypes

### 1.1.38

in model subtypes: static classname as a string

### 1.1.37

Better support for subTypes. The file sub-type-factory.ts is now generated.

### 1.1.36

`swaggerInput` now can contain a filepath or the parsed contents of the swagger file.
generator code now is converted to Typescript

### 1.1.34

`subTypes` now extend there `baseType` instead of `BaseModel`

### 1.1.34

forgot to push the changed `generate-model-ts.hsb`

### 1.1.33

config: new setting subTypePropertyName added.
Implementation of baseClasses changed

### 1.1.31

enum-i18n-html: convert label to PascalCasing when value is not uppercase or value.length > 3

### 1.1.30

bugfix option generateClasses (classes were not generated anymore when set to true)

### 1.1.28

option generateClasses added

### 1.1.27

modelGenerator, enumGenerator: options sortModelProperties and sortEnumTypes added.

### 1.1.26

modelGenerator, enumGenerator: option typesToFilter added.

### 1.1.25

modelGenerator: removed console.log statement.

### 1.1.24

modelGenerator: generate validators for 0 values.

### 1.1.23

enumGenerator: option enumI18NHtmlFile added.

### 1.1.22

modelGenerator: now supportes enums which are defined with \$ref

### 1.1.21

modelGenerator, enumGenerator: enum array is now supported.

### 1.1.20

modelGenerator, enumGenerator: overrule generated type with /\*_ type [type] _/ in comment above property. Handy for reusing enums.

### 1.1.19

enumGenerator: remove console.log

### 1.1.18

enumGenerator: remove duplicate enum types (if both type and values are the same)

### 1.1.17

enumValidator: && control.value !== ''

### 1.1.16

enumValidator: && control.value !== null

### 1.1.15

enumValidator generated and used in \*.model.ts classes

### 1.1.14

\*.model.ts: if (this.\_formGroup) in setFormGroupValues() {

### 1.1.13

\*.model.ts: don't call setFormGroupValues in getFormGroup()

### 1.1.9

\*.model.ts: setFormGroupValues

### 1.1.7

\*.model.ts: if (values) check added to setValues

### 1.1.5

gulp.config: config.files defined

### 1.1.4

Readme: link changed to angular-swagger-form-field-sample

### 1.1.3

Readme: link to angular2-swagger-form-field-sample added

### 1.1.2

Pushed this package to public github repo

### 1.1.1

Readme now contains setup guide.
package.json now contains devDependencies.

### 1.1.0

Module published to npm.
