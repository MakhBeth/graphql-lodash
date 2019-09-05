import { Source, Kind, parse, visit, print, } from 'graphql/language';
import { GraphQLError } from 'graphql/error/GraphQLError';
import { getOperationAST } from 'graphql/utilities/getOperationAST';
import { concatAST } from 'graphql/utilities/concatAST';
import { buildASTSchema } from 'graphql/utilities/buildASTSchema';
import { getArgumentValues, } from 'graphql/execution/values';
import get from 'lodash-es/get';
import set from 'lodash-es/set';
import each from 'lodash-es/each';
import keyBy from 'lodash-es/keyBy';
import isEqual from 'lodash-es/isEqual';
import { applyTransformations } from './transformations';
import { lodashIDL } from './lodash_idl';
export function graphqlLodash(query, operationName) {
    var pathToArgs = {};
    var queryAST = typeof query === 'string' ? parse(query) : query;
    traverseOperationFields(queryAST, operationName, function (node, resultPath) {
        var args = getLodashDirectiveArgs(node);
        if (args === null)
            return;
        // TODO: error if transformation applied on field that already
        // seen without any transformation
        var argsSetPath = resultPath.concat(['@_']);
        var previousArgsValue = get(pathToArgs, argsSetPath, null);
        if (previousArgsValue !== null && !isEqual(previousArgsValue, args))
            throw Error("Different \"@_\" args for the \"" + resultPath.join('.') + "\" path");
        set(pathToArgs, argsSetPath, args);
    });
    var stripedQuery = stripQuery(queryAST);
    return {
        query: typeof query === 'string' ? stripQuery(print(stripedQuery)) : stripedQuery,
        transform: function (data) { return applyLodashDirective(pathToArgs, data); }
    };
}
function getLodashDirectiveArgs(node) {
    var lodashNode = null;
    for (var _i = 0, _a = node.directives || []; _i < _a.length; _i++) {
        var directive = _a[_i];
        if (directive.name.value !== lodashDirectiveDef.name)
            continue;
        if (lodashNode)
            throw Error("Duplicating \"@_\" on the \"" + node.name.value + "\"");
        lodashNode = directive;
    }
    if (lodashNode === null)
        return null;
    var args = getArgumentValues(lodashDirectiveDef, lodashNode);
    return normalizeLodashArgs(lodashNode.arguments, args);
}
function normalizeLodashArgs(argNodes, args) {
    if (!argNodes)
        return args;
    //Restore order of arguments
    argNodes = keyBy(argNodes, function (argNode) { return argNode.name.value; });
    var orderedArgs = {};
    each(argNodes, function (node, name) {
        var argValue = args[name];
        if (node.value.kind === 'ObjectValue')
            orderedArgs[name] = normalizeLodashArgs(node.value.fields, argValue);
        else if (node.value.kind === 'ListValue') {
            var nodeValues = node.value.values;
            orderedArgs[name] = [];
            for (var i = 0; i < nodeValues.length; ++i)
                orderedArgs[name][i] = normalizeLodashArgs(nodeValues[i].fields, argValue[i]);
        }
        else if (node.value.kind === 'EnumValue' && node.value.value === 'none')
            orderedArgs[name] = undefined;
        else
            orderedArgs[name] = argValue;
    });
    return orderedArgs;
}
function applyLodashDirective(pathToArgs, data) {
    if (data === null)
        return null;
    var changedData = applyOnPath(data, pathToArgs);
    return applyLodashArgs([], changedData, pathToArgs['@_']);
}
function applyLodashArgs(path, object, args) {
    try {
        return applyTransformations(object, args);
    }
    catch (e) {
        // FIXME:
        console.log(path);
        throw e;
    }
}
function applyOnPath(result, pathToArgs) {
    var currentPath = [];
    return traverse(result, pathToArgs);
    function traverse(root, pathRoot) {
        if (root === null || root === undefined)
            return null;
        if (Array.isArray(root))
            return root.map(function (item) { return traverse(item, pathRoot); });
        if (typeof root === 'object') {
            var changedObject = Object.assign({}, root);
            for (var key in pathRoot) {
                if (key === '@_')
                    continue;
                currentPath.push(key);
                var changedValue = traverse(root[key], pathRoot[key]);
                if (changedValue === null || changedValue === undefined)
                    continue;
                var lodashArgs = pathRoot[key]['@_'];
                changedValue = applyLodashArgs(currentPath, changedValue, lodashArgs);
                changedObject[key] = changedValue;
                currentPath.pop();
            }
            return changedObject;
        }
        else {
            return root;
        }
    }
}
function stripQuery(queryAST) {
    return visit(queryAST, (_a = {},
        _a[Kind.DIRECTIVE] = function (node) {
            if (node.name.value === '_')
                return null;
        },
        _a));
    var _a;
}
export var lodashDirectiveAST = parse(new Source(lodashIDL, 'lodashIDL'));
var lodashDirectiveDef = getDirectivesFromAST(lodashDirectiveAST)[0];
function getDirectivesFromAST(ast) {
    var dummyIDL = "\n    type Query {\n      dummy: String\n    }\n  ";
    var fullAST = concatAST([ast, parse(dummyIDL)]);
    var schema = buildASTSchema(fullAST);
    schema.getTypeMap()['Path'].parseLiteral = (function (x) { return x.value; });
    schema.getTypeMap()['JSON'].parseLiteral = astToJSON;
    return schema.getDirectives();
}
// TODO: copy-pasted from JSON Faker move to graphql-js or separate lib
function astToJSON(ast) {
    switch (ast.kind) {
        case Kind.NULL:
            return null;
        case Kind.INT:
            return parseInt(ast.value, 10);
        case Kind.FLOAT:
            return parseFloat(ast.value);
        case Kind.STRING:
        case Kind.BOOLEAN:
            return ast.value;
        case Kind.LIST:
            return ast.values.map(astToJSON);
        case Kind.OBJECT:
            return ast.fields.reduce(function (object, _a) {
                var name = _a.name, value = _a.value;
                object[name.value] = astToJSON(value);
                return object;
            }, {});
    }
}
function traverseOperationFields(queryAST, operationName, cb) {
    var fragments = {};
    var operationAST = getOperationAST(queryAST, operationName);
    if (!operationAST) {
        throw new GraphQLError('Must provide operation name if query contains multiple operations.');
    }
    queryAST.definitions.forEach(function (definition) {
        if (definition.kind === Kind.FRAGMENT_DEFINITION)
            fragments[definition.name.value] = definition;
    });
    var resultPath = [];
    cb(operationAST, resultPath);
    traverse(operationAST);
    function traverse(root) {
        visit(root, {
            enter: function (node) {
                if (node.kind === Kind.FIELD)
                    resultPath.push((node.alias || node.name).value);
                if (node.kind === Kind.FRAGMENT_SPREAD) {
                    var fragmentName = node.name.value;
                    var fragment = fragments[fragmentName];
                    if (!fragment)
                        throw Error("Unknown fragment: " + fragmentName);
                    traverse(fragment);
                }
            },
            leave: function (node) {
                if (node.kind !== Kind.FIELD)
                    return;
                cb(node, resultPath);
                resultPath.pop();
            }
        });
    }
}
//# sourceMappingURL=index.js.map