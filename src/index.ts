import XMLBuilder, { XMLElement } from 'xmlbuilder'
import { GeoJSON, Feature, Point, MultiPoint, LineString, MultiLineString, Polygon, MultiPolygon, GeometryCollection, GeoJsonProperties, Geometry } from 'geojson'

interface ToKMLOption {
    documentName?: string
    documentDescription?: string
    name?: string
    description?: string
    simplestyle?: boolean
    timestamp?: string
}

export default function tokml(geojson: GeoJSON, initialOptions?: ToKMLOption) {
    const options: ToKMLOption = initialOptions || {
        documentName: undefined,
        documentDescription: undefined,
        name: 'name',
        description: 'description',
        simplestyle: false,
        timestamp: 'timestamp'
    };

    const xml = XMLBuilder.create('kml', {
        encoding: 'UTF-8',
        stringify: {
            // Compatibility with old tokml
            attValue: obj => (
                (typeof obj !== 'string') ? obj : obj.replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
            )
        }
    })
    xml.att('xmlns', 'http://www.opengis.net/kml/2.2')
    const documentElement = xml.ele({
        Document: {
            ...documentName(options),
            ...documentDescription(options)
        }
    });
    root(geojson, options, documentElement)
    return xml.end({allowEmpty: true})
};

function feature(options: ToKMLOption, styleHashesArray: string[], documentElement: XMLElement) {
    return function (_: Feature) {
        if (!_.properties || !geometry.valid(_.geometry)) return;

        var styleDefinition = {},
            styleReference = {};
        if (options.simplestyle) {
            var styleHash = hashStyle(_.properties);
            if (styleHash) {
                if (geometry.isPoint(_.geometry) && hasMarkerStyle(_.properties)) {
                    if (styleHashesArray.indexOf(styleHash) === -1) {
                        styleDefinition = markerStyle(_.properties, styleHash);
                        styleHashesArray.push(styleHash);
                    }
                    styleReference = { 'styleUrl': '#' + styleHash };
                } else if ((geometry.isPolygon(_.geometry) || geometry.isLine(_.geometry)) &&
                    hasPolygonAndLineStyle(_.properties)) {
                    if (styleHashesArray.indexOf(styleHash) === -1) {
                        styleDefinition = polygonAndLineStyle(_.properties, styleHash);
                        styleHashesArray.push(styleHash);
                    }
                    styleReference = { 'styleUrl': '#' + styleHash };
                }
                // Note that style of GeometryCollection / MultiGeometry is not supported
            }
        }
        if (Object.keys(styleDefinition).length > 0) {
            documentElement.ele(styleDefinition)
        }
        const PlacemarkElement = documentElement.ele({
            Placemark: {
                ...name(_.properties, options),
                ...description(_.properties, options),
                ...extendeddata(_.properties),
                ...timestamp(_.properties, options),
            }
        });
        geometry.any(_.geometry, PlacemarkElement)
        if (Object.keys(styleReference).length > 0) {
            PlacemarkElement.ele(styleReference)
        }
    };
}

function root(_: GeoJSON, options: ToKMLOption, documentElement: XMLElement) {
    if (!_.type) return '';
    var styleHashesArray: string[] = [];

    switch (_.type) {
        case 'FeatureCollection':
            if (!_.features) return '';
            _.features.map(feature(options, styleHashesArray, documentElement));
        case 'Feature':
            feature(options, styleHashesArray, documentElement)(_ as Feature);
        default:
            feature(options, styleHashesArray, documentElement)({
                type: 'Feature',
                geometry: _ as (Point | MultiPoint | LineString | MultiLineString | Polygon | MultiPolygon | GeometryCollection),
                properties: {}
            });
    }
}

function documentName(options: ToKMLOption) {
    return (options.documentName !== undefined) ? { 'name': options.documentName } : {};
}

function documentDescription(options: ToKMLOption) {
    return (options.documentDescription !== undefined) ? { 'description': options.documentDescription } : {};
}

function name(_: GeoJsonProperties, options: ToKMLOption) {
    return (_ && options.name && options.name in _) ? { 'name': _[options.name] } : {};
}

function description(_: GeoJsonProperties, options: ToKMLOption) {
    return (_ && options.description && _[options.description]) ? { 'description': _[options.description] } : {};
}

function timestamp(_: GeoJsonProperties, options: ToKMLOption) {
    return (_ && options.timestamp && _[options.timestamp]) ? { 'TimeStamp': { 'when': _[options.timestamp] } } : {};
}

// ## Geometry Types
//
// https://developers.google.com/kml/documentation/kmlreference#geometry
var geometry = {
    Point: function (_: Point, e: XMLElement) {
        e.ele({ 'Point': { 'coordinates': _.coordinates.join(',') } });
    },
    LineString: function (_: LineString, e: XMLElement) {
        e.ele({ 'LineString': { 'coordinates': linearring(_.coordinates) } });
    },
    Polygon: function (_: Polygon, e: XMLElement) {
        if (!_.coordinates.length) return;
        var outer = _.coordinates[0],
            inner = _.coordinates.slice(1);
        var outerRing = {
            outerBoundaryIs: {
                LinearRing: {
                    coordinates: linearring(outer)
                }
            }
        };
        var innerRings = {
            innerBoundaryIs: inner.map(i => ({
                LinearRing: {
                    coordinates: linearring(i)
                }
            }))
        };
        e.ele({ 'Polygon': { ...outerRing, ...innerRings } });
    },
    MultiPoint: function (_: MultiPoint, e: XMLElement) {
        if (!_.coordinates.length) return;
        const multi = e.ele('MultiGeometry');
        _.coordinates.forEach(c => {
            geometry.Point({ type: 'Point', coordinates: c }, multi);
        });
    },
    MultiPolygon: function (_: MultiPolygon, e: XMLElement) {
        if (!_.coordinates.length) return;
        const multi = e.ele('MultiGeometry');
        _.coordinates.forEach(c => {
            geometry.Polygon({ type: 'Polygon', coordinates: c }, multi);
        });
    },
    MultiLineString: function (_: MultiLineString, e: XMLElement) {
        if (!_.coordinates.length) return;
        const multi = e.ele('MultiGeometry');
        _.coordinates.forEach(c => {
            geometry.LineString({ type: 'LineString', coordinates: c }, multi);
        });
    },
    GeometryCollection: function (_: GeometryCollection, e: XMLElement) {
        const multi = e.ele('MultiGeometry');
        _.geometries.forEach(g => {
            geometry.any(g, multi);
        });
    },
    valid: function (_: Geometry) {
        return _ && _.type && (('coordinates' in _ && _.coordinates) ||
            _.type === 'GeometryCollection' && _.geometries && _.geometries.every(geometry.valid));
    },
    any: function (_: Geometry, e: XMLElement) {
        switch (_.type) {
            case 'Point':
                return geometry.Point(_, e)
            case 'LineString':
                return geometry.LineString(_, e)
            case 'Polygon':
                return geometry.Polygon(_, e)
            case 'MultiPoint':
                return geometry.MultiPoint(_, e)
            case 'MultiPolygon':
                return geometry.MultiPolygon(_, e)
            case 'MultiLineString':
                return geometry.MultiLineString(_, e)
            case 'GeometryCollection':
                return geometry.GeometryCollection(_, e)
        }
    },
    isPoint: function (_: Geometry) {
        return _.type === 'Point' ||
            _.type === 'MultiPoint';
    },
    isPolygon: function (_: Geometry) {
        return _.type === 'Polygon' ||
            _.type === 'MultiPolygon';
    },
    isLine: function (_: Geometry) {
        return _.type === 'LineString' ||
            _.type === 'MultiLineString';
    }
};

function linearring(_: number[][]) {
    return _.map(function (cds) { return cds.join(','); }).join(' ');
}

// ## Data
function extendeddata(_: GeoJsonProperties) {
    return { 'ExtendedData': { 'Data': pairs(_).map(data) } };
}

function data(_: [string, any]) {
    return { '@name': _[0], 'value': _[1] || '' };
}

// ## Marker style
function hasMarkerStyle(_: {[name: string]: any}) {
    return !!(_['marker-size'] || _['marker-symbol'] || _['marker-color']);
}

function markerStyle(_: {[name: string]: any}, styleHash: string) {
    return {
        'Style': {
            '@id': styleHash,
            'IconStyle': {
                'Icon': { 'href': iconUrl(_) }
            },
            ...iconSize()
        }
    };
}

function iconUrl(_: {[name: string]: any}) {
    var size = _['marker-size'] || 'medium',
        symbol = _['marker-symbol'] ? '-' + _['marker-symbol'] : '',
        color = (_['marker-color'] || '7e7e7e').replace('#', '');

    return 'https://api.tiles.mapbox.com/v3/marker/' + 'pin-' + size.charAt(0) +
        symbol + '+' + color + '.png';
}

function iconSize() {
    return {
        'hotSpot': {
            '@xunits': 'fraction',
            '@yunits': 'fraction',
            '@x': 0.5,
            '@y': 0.5
        }
    }
}

// ## Polygon and Line style
function hasPolygonAndLineStyle(_: {[name: string]: any}) {
    return ('stroke' in _ || 'stroke-opacity' in _ || 'stroke-width' in _ || 'fill' in _ || 'fill-opacity' in _)
}

function polygonAndLineStyle(_: {[name: string]: any}, styleHash: string) {
    var lineStyle = {
        'LineStyle': {
            'color': hexToKmlColor(_['stroke'], _['stroke-opacity']) || 'ff555555',
            'width': _['stroke-width'] === undefined ? 2 : _['stroke-width']
        }
    };
    var polyStyle = {};
    if (_['fill'] || _['fill-opacity']) {
        polyStyle = {
            'PolyStyle': {
                'color': hexToKmlColor(_['fill'], _['fill-opacity']) || '88555555'
            }
        }
    };

    return { 'Style': { ...lineStyle, ...polyStyle, '@id': styleHash } };
}

// ## Style helpers
function hashStyle(_: GeoJsonProperties) {
    if (!_) { return '' }
    var hash = '';

    if (_['marker-symbol']) hash = hash + 'ms' + _['marker-symbol'];
    if (_['marker-color']) hash = hash + 'mc' + _['marker-color'].replace('#', '');
    if (_['marker-size']) hash = hash + 'ms' + _['marker-size'];
    if (_['stroke']) hash = hash + 's' + _['stroke'].replace('#', '');
    if (_['stroke-width']) hash = hash + 'sw' + _['stroke-width'].toString().replace('.', '');
    if (_['stroke-opacity']) hash = hash + 'mo' + _['stroke-opacity'].toString().replace('.', '');
    if (_['fill']) hash = hash + 'f' + _['fill'].replace('#', '');
    if (_['fill-opacity']) hash = hash + 'fo' + _['fill-opacity'].toString().replace('.', '');

    return hash;
}

function hexToKmlColor(hexColor: string, opacity: number) {
    if (typeof hexColor !== 'string') return '';

    hexColor = hexColor.replace('#', '').toLowerCase();

    if (hexColor.length === 3) {
        hexColor = hexColor[0] + hexColor[0] +
            hexColor[1] + hexColor[1] +
            hexColor[2] + hexColor[2];
    } else if (hexColor.length !== 6) {
        return '';
    }

    var r = hexColor[0] + hexColor[1];
    var g = hexColor[2] + hexColor[3];
    var b = hexColor[4] + hexColor[5];

    var o = 'ff';
    if (typeof opacity === 'number' && opacity >= 0.0 && opacity <= 1.0) {
        o = (opacity * 255).toString(16);
        if (o.indexOf('.') > -1) o = o.substr(0, o.indexOf('.'));
        if (o.length < 2) o = '0' + o;
    }

    return o + b + g + r;
}

// ## General helpers
function pairs(_: GeoJsonProperties) {
    var o: [string, any][] = [];
    for (var i in _) o.push([i, _[i]]);
    return o;
}