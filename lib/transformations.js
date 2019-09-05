import every from 'lodash-es/every';
import some from 'lodash-es/some';
import startsWith from 'lodash-es/startsWith';
import endsWith from 'lodash-es/endsWith';
import lt from 'lodash-es/lt';
import lte from 'lodash-es/lte';
import gt from 'lodash-es/gt';
import gte from 'lodash-es/gte';
import eq from 'lodash-es/eq';
import map from 'lodash-es/map';
import keyBy from 'lodash-es/keyBy';
import chunk from 'lodash-es/chunk';
import drop from 'lodash-es/drop';
import dropRight from 'lodash-es/dropRight';
import take from 'lodash-es/take';
import takeRight from 'lodash-es/takeRight';
import flattenDepth from 'lodash-es/flattenDepth';
import fromPairs from 'lodash-es/fromPairs';
import nth from 'lodash-es/nth';
import reverse from 'lodash-es/reverse';
import uniq from 'lodash-es/uniq';
import uniqBy from 'lodash-es/uniqBy';
import countBy from 'lodash-es/countBy';
import filter from 'lodash-es/filter';
import reject from 'lodash-es/reject';
import groupBy from 'lodash-es/groupBy';
import sortBy from 'lodash-es/sortBy';
import minBy from 'lodash-es/minBy';
import maxBy from 'lodash-es/maxBy';
import meanBy from 'lodash-es/meanBy';
import sumBy from 'lodash-es/sumBy';
import join from 'lodash-es/join';
import get from 'lodash-es/get';
import mapValues from 'lodash-es/mapValues';
import at from 'lodash-es/at';
import toPairs from 'lodash-es/toPairs';
import invert from 'lodash-es/invert';
import invertBy from 'lodash-es/invertBy';
import keys from 'lodash-es/keys';
import values from 'lodash-es/values';
var transformations = {
    Array: {
        each: function (array, arg) {
            return map(array, function (item) { return applyTransformations(item, arg); });
        },
        map: map,
        keyBy: keyBy,
        chunk: chunk,
        drop: drop,
        dropRight: dropRight,
        take: take,
        takeRight: takeRight,
        flattenDepth: flattenDepth,
        fromPairs: fromPairs,
        nth: nth,
        reverse: reverse,
        uniq: uniq,
        uniqBy: uniqBy,
        countBy: countBy,
        filter: filter,
        reject: reject,
        filterIf: function (array, arg) {
            return filter(array, function (item) { return applyTransformations(item, arg); });
        },
        rejectIf: function (array, arg) {
            return reject(array, function (item) { return applyTransformations(item, arg); });
        },
        groupBy: groupBy,
        sortBy: sortBy,
        minBy: minBy,
        maxBy: maxBy,
        meanBy: meanBy,
        sumBy: sumBy,
        join: join,
    },
    Object: {
        get: get,
        mapValues: mapValues,
        at: at,
        toPairs: toPairs,
        invert: invert,
        invertBy: invertBy,
        keys: keys,
        values: values,
    },
    Number: {
        lt: lt,
        lte: lte,
        gt: gt,
        gte: gte,
        eq: eq,
    },
    String: {
        startsWith: startsWith,
        endsWith: endsWith,
    },
};
var opToExpectedType = {};
for (var type in transformations)
    for (var name_1 in transformations[type])
        opToExpectedType[name_1] = type;
export function applyTransformations(object, args) {
    if (!args)
        return object;
    for (var op in args) {
        if (object === null)
            break;
        var arg = args[op];
        if (op === 'and') {
            object = every(arg, function (predicateArgs) { return applyTransformations(object, predicateArgs); });
            continue;
        }
        if (op === 'or') {
            object = some(arg, function (predicateArgs) { return applyTransformations(object, predicateArgs); });
            continue;
        }
        var expectedType = opToExpectedType[op];
        var type = object.constructor && object.constructor.name;
        // handle objects created with Object.create(null)
        if (!type && (typeof object === 'object'))
            type = 'Object';
        if (expectedType !== type)
            throw Error("\"" + op + "\" transformation expect \"" + expectedType + "\" but got \"" + type + "\"");
        object = transformations[type][op](object, arg);
    }
    return object;
}
//# sourceMappingURL=transformations.js.map