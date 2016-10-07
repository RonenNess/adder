"use strict";

/**
* A built-in dictionary object.
*
* Author: Ronen Ness.
* Since: 2016
*/

// include jsface for classes
var jsface = require("./../dependencies/jsface"),
    Class  = jsface.Class,
    extend = jsface.extend;

// include errors
var Errors = require("./../errors");

// include variable
var Variable = require("./variable");

// builtin function
var BuiltinFunc = require("./builtin_func");

// require misc utils
var Utils = require("./../utils");

// include basic object type
var _Object = require("./object");

// get list object
var List = require('./list');

// make sure dictionary length is valid
function validate_len(dict) {
    if (Object.keys(dict._dict).length > dict._context._interpreter._flags.maxContainersLen) {
        throw new Errors.ExceedMemoryLimit("Dictionary exceeded maximum container length (" + dict._context._interpreter._flags.maxContainersLen + ")");
    }
}

// all the api functions of the set
// remember - everything in a set is stored as native js and not as Variable object
var apiFuncs = {

    // clone the set
    clone: function()
    {
        // create the dictionary to return
        var ret = new Dict(this._context);

        // add all values
        for (var key in this._dict) {
            ret.set(Variable.makeVariables(this._context, key), this._dict[key]);
        }

        // return the new dictionary
        return ret;
    },

    // return a list of keys
    keys: function()
    {
        return new List(this._context, Object.keys(this._dict));
    },

    // return a list of values
    values: function()
    {
        var ret = [];
        for (var key in this._dict) {
            ret.push(this._dict[key]);
        }
        return ret;
    },

    // return how many keys in dictionary
    len: function()
    {
        return Object.keys(this._dict).length;
    },

    // return if dictionary is empty
    empty: function()
    {
        return this.len() === 0;
    },

    // set value
    set: function(key, value)
    {
        // validate key type
        if (!key.isSimple) {
            throw new Errors.RuntimeError("Invalid key type '" + key.type + "'. Dictionary keys can only be strings, numbers, booleans or none.");
        }
        // add to dictionary
        this._dict[key._value] = value;
        validate_len(this);

        // update memory usage
        this._context._interpreter.updateMemoryUsage(value._estimatedSize + key.length);
    },

    // get value
    get: function(key, defaultVal)
    {
        return this._dict[key._value] || defaultVal;
    },

    // remove value from dictionary
    remove: function(key)
    {
        delete this._dict[key._value];
    },

    // clear the dictionary
    clear: function()
    {
        this._dict = {};
    },

    // return true if value exists in the dictionary
    has: function(key)
    {
        return this._dict[key._value] !== undefined;
    },

    // extend set with another dictionary
    extend: function(other)
    {
        // make sure got a dict to extend
        if (other.type !== "dict") {
            throw new Errors.RuntimeError("Dict 'extend()' expecting another dictionary as param ('" + other.type + "' given).");
        }

        // extend the dictionary
        other = other._value;
        for (var key in other._dict) {
            this._dict[key] = other._dict[key];
        }
    },
}

// Dictionary class
var Dict = Class(_Object, {

    // Object constructor
    // @param context - context of program currently executed.
    // @param startingDict - optional dictionary to put as starting data
    constructor: function(context, startingDict)
    {
        // call parent constructor
        Dict.$super.call(this, context);

        // create the dictionary
        this._dict = startingDict || {}
    },

    // iterate over object components
    forEach: function(callback, obj) {
        for (var key in this._dict) {
            if (callback.call(obj, key) === false) {
                return;
            }
        }
    },

    // dictionary api
    api: {
        clone: BuiltinFunc.create(apiFuncs.clone, 0, 0, false),
        keys: BuiltinFunc.create(apiFuncs.keys, 0, 0, false),
        values: BuiltinFunc.create(apiFuncs.values, 0, 0, false),
        len: BuiltinFunc.create(apiFuncs.len, 0, 0, false),
        _set: BuiltinFunc.create(apiFuncs.set, 2, 0, false),
        _get: BuiltinFunc.create(apiFuncs.get, 1, 1, false),
        remove: BuiltinFunc.create(apiFuncs.remove, 1, 0, false),
        clear: BuiltinFunc.create(apiFuncs.clear, 0, 0, false),
        empty: BuiltinFunc.create(apiFuncs.empty, 0, 0, false),
        has: BuiltinFunc.create(apiFuncs.has, 1, 0, false),
        extend: BuiltinFunc.create(apiFuncs.extend, 1, 0, false),
    },

    // convert to string
    toString: function()
    {
        var ret = []
        for (var key in this._dict) {
            ret.push('"' + key + '": ' + this._dict[key].toString());
        }
        return ret.join(",");
    },

    // convert to repr
    toRepr: function()
    {
        return "dict(" + this.toString() + ")";
    },

    // convert to a native javascript object
    toNativeJs: function()
    {
        var ret = {};
        for (var key in this._dict) {
            ret[key] = this._dict[key].toNativeJs();
        }
        return ret;
    },

    // object identifier
    name: "dict",

    // object type
    type: "dict",
});

// init set builtint api
_Object.initBuiltinApi(Dict);

// export the Dict class
module.exports = Dict;
