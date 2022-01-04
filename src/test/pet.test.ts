import { Category } from '../../test-gen/app/models/webapi/category.model';
import { Pet } from '../../test-gen/app/models/webapi/pet.model';
import { status } from '../../test-gen/app/models/webapi/enums';

describe('Pet', () => {
    const values = {
        [Pet.ID_FIELD_NAME]: '123',
        [Pet.CATEGORY_FIELD_NAME]: {
            [Category.ID_FIELD_NAME]: '321',
            [Category.NAME_FIELD_NAME]: 'cat'
        },
        [Pet.NAME_FIELD_NAME]: 'Snoetje',
        [Pet.PHOTO_URLS_FIELD_NAME]:
            'https://i0.wp.com/katzenworld.co.uk/wp-content/uploads/2017/12/cat-crying-1.jpg?resize=610%2C415&ssl=1',
        [Pet.TAGS_FIELD_NAME]: [],
        [Pet.STATUS_FIELD_NAME]: status.approved
    };

    it('setValues keeps original values intact', () => {
        const pet = new Pet(values);
        expect(pet.name).toBe('Snoetje');

        pet.setValues({ [Pet.NAME_FIELD_NAME]: 'Poesje' });
        expect(pet.name).toBe('Poesje');
        expect(pet.id).toBe('123');
    });

    it('setValues ignores unknown properties', () => {
        const pet = new Pet(values);

        pet.setValues(<any>{ hopla: 'Poesje' });
        expect(pet['hopla']).toBeUndefined();
        expect(pet.id).toBe('123');
    });
});
