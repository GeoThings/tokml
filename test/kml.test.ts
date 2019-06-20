import fs from 'fs'
import glob from 'glob'
import path from 'path'
import tokml from '../src'
const fuzzer = require('fuzzer')

function geq(name: string, options?: any) {
    return test(name, () => {
        var expected = tokml(file(name + '.geojson'), options);
        if (process.env.UPDATE) {
            fs.writeFileSync(path.join(__dirname, '/data/', name + '.kml'), expected);
        }
        expect(expected).toBe(output(name + '.kml'));
    })
}

function testColor(inputColor: string | null, inputOpacity: number | null , expected: string) {
    return test(expected, () => {
        var featureCollection = file('linestring.geojson');
        var props = featureCollection.features[0].properties;
        if (inputColor !== null) props['stroke'] = inputColor;
        if (inputOpacity !== null) props['stroke-opacity'] = inputOpacity;

        var kml = tokml(featureCollection, { simplestyle: true });

        if (inputColor) {
            var colorValue = kml.substr(kml.indexOf('<color>') + 7, 8);

            expect(colorValue).toBe(expected)
        } else {
            expect(kml.indexOf('<color>')).toBe(-1);
        }
    })
}

describe('geometry', function () {
    geq('polygon');
    geq('linestring');
    geq('multilinestring');
    geq('multipoint');
    geq('multipolygon');
    geq('geometrycollection');
    geq('geometrycollection_nogeometries');
});

describe('quirks', function () {
    geq('cdata');
    geq('singlefeature');
    geq('singlegeometry');
    geq('unknown');
    geq('nulldata');
    geq('unknowngeom');
    geq('unknowntype');
    geq('notype');
    geq('number_property');
    geq('polygon_norings');
    geq('multipolygon_none');
    geq('multipoint_none');
    geq('multilinestring_none');
});

describe('name & description', function () {
    geq('name_desc');
    geq('document_name_desc', {
        documentName: 'Document Title',
        documentDescription: 'Document Description'
    });
});

describe('timestamp', function () {
    geq('timestamp', {
        name: 'name',
        description: 'description',
        timestamp: 'moment'
    });
});

describe('simplestyle spec', function () {
    var options = { simplestyle: true };

    geq('simplestyle_optionnotset');
    geq('simplestyle_nostyle', options);

    geq('simplestyle_multiple_same', options);
    geq('simplestyle_multiple_different', options);

    geq('simplestyle_point', options);
    geq('simplestyle_point_nosymbol', options);
    geq('simplestyle_point_defaults', options);

    geq('simplestyle_linestring', options);
    geq('simplestyle_linestring_defaults', options);
    geq('simplestyle_multilinestring', options);

    geq('simplestyle_polygon', options);
    geq('simplestyle_polygon_defaults', options);
    geq('simplestyle_multipolygon', options);
    geq('simplestyle_polygon_multiple_same', options);
    geq('simplestyle_polygon_multiple_different', options);

    geq('simplestyle_geometrycollection', options);
});

describe('simplestyle hex to kml color conversion', function () {
    testColor('#ff5500', 1, 'ff0055ff');
    testColor('#0000ff', 1, 'ffff0000');
    testColor('#00ff00', 1, 'ff00ff00');
    testColor('#000000', 1, 'ff000000');
    testColor('#ffffff', 1, 'ffffffff');

    testColor('#ff5500', 0.5, '7f0055ff');
    testColor('#ff5500', 0, '000055ff');
    testColor('#ff5500', 0.01, '020055ff');
    testColor('#ff5500', 0.02, '050055ff');
    testColor('#ff5500', 0.99, 'fc0055ff');
    testColor('#ff5500', 1, 'ff0055ff');

    testColor('#f50', null, 'ff0055ff');
    testColor('f50', null, 'ff0055ff');

    testColor(null, null, 'ff0055ff');
    testColor('', null, 'ff0055ff');

    testColor('aa', null, 'ff555555');

    // TODO: this still fails
    //testColor('sqdgfd', null, 'ff555555');
    //testColor('ggg', null, 'ff555555');
});

describe('fuzz', function () {
    fuzzer.seed(0);
    glob.sync(__dirname + '/data/*.geojson').forEach(function (gj) {
        var generator = fuzzer.mutate.object(JSON.parse(fs.readFileSync(gj) as any));
        for (var i = 0; i < 10; i++) {
            var gen = generator();
            tokml(gen);
        }
    });
});

function file(f: string) {
    return JSON.parse(fs.readFileSync(__dirname + '/data/' + f) as any);
}

function output(f: string) {
    return fs.readFileSync(__dirname + '/data/' + f, 'utf8');
}
