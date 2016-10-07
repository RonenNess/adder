"use strict";

/**
* A built-in set object.
* Important notice about sets - unlike other objects, in set we store everything as native js object instead of a variable.
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

// make sure set length is valid
function validate_len(set) {
    if (set._set.size > set._context._interpreter._flags.maxContainersLen) {
        throw new Errors.ExceedMemoryLimit("Set exceeded maximum container length (" + set._context._interpreter._flags.maxContainersLen + ")");
    }
}

// all the api functions of the set
// remember - everything in a set is stored as native js and not as Variable object
var apiFuncs = {

    // clone the set
    clone: function()
    {
        return new _Set(this._context, Utils.toArray(this._set));
    },

    // convert to a list and return
    to_list: function()
    {
        var setAsList = Utils.toArray(this._set);
        return new List(this._context, setAsList);
    },

    // return set length
    len: function()
    {
        return this._set.size;
    },

    // join function
    join: function(str)
    {
        return this.to_list().join(str);
    },

    // return if set is empty
    empty: function()
    {
        return this._set.size === 0;
    },

    // add item to set
    add: function(item)
    {
        // get value
        item = item._value;

        // make sure not an object
        if (item && typeof item === "object") {
            throw new Errors.RuntimeError("Cannot add objects to set(), only simple types (bool, string, number, or none).");
        }

        // add estimated memory usage
        this._context._interpreter.updateMemoryUsage(item ? item.length || 4 : 1);

        // add to set and return
        this._set.add(item);
        validate_len(this);
        return this;
    },

    // clear the set
    clear: function()
    {
        this._set = new Set();
    },

    // return true if value exists in the set
    has: function(item)
    {
        return this._set.has(item._value);
    },

    // extend set with another set
    extend: function(other)
    {
        // make sure got set to extend
        if (other.type !== "set") {
            throw new Errors.RuntimeError("Set 'extend()' expecting another set as param ('" + other.type + "' given).");
        }

        // extend the set
        var _this = this;
        other._value._set.forEach(function(x)
        {
            _this._set.add(x);
        });

        // validate length
        validate_len(this);
    },

    // return first index found of value
    index: function(item)
    {
        // get item value
        item = item._value;

        // special exception to break forEach as soon as we find value
        var BreakException = {};

        // for return value
        var i = 0;
        var ret = -1;

        // iterate and search for item
        try {
            this._set.forEach(function(x) {
                if (x === item) {
                    ret = i;
                    throw BreakException;
                } i++;
            });
        } catch (e) {
            if (e !== BreakException) throw e;
        }

        // return index
        return ret;
    },

    // remove value from set
    remove: function(item)
    {
        return this._set.delete(item._value);
    },
}

// Set class
var _Set = Class(_Object, {

    // Object constructor
    // @param context - context of program currently executed.
    // @param args - starting set
    constructor: function(context, args)
    {
        // call parent constructor
        _Set.$super.call(this, context);

        // create the set
        this._set = new Set();

        // add starting args to it
        for (var i = 0; i < args.length; ++i)
        {
            var curr = args[i];
            this.add(curr);
        }
    },

    // iterate over object components
    forEach: function(callback, obj) {
        this._set.forEach(function(x) {
            callback.call(obj, x);
        });
    },

    // set api
    api: {
        clone: BuiltinFunc.create(apiFuncs.clone, 0, 0, false),
        to_list: BuiltinFunc.create(apiFuncs.to_list, 0, 0, false),
        len: BuiltinFunc.create(apiFuncs.len, 0, 0, false),
        add: BuiltinFunc.create(apiFuncs.add, 1, 0, false),
        clear: BuiltinFunc.create(apiFuncs.clear, 0, 0, false),
        empty: BuiltinFunc.create(apiFuncs.empty, 0, 0, false),
        has: BuiltinFunc.create(apiFuncs.has, 1, 0, false),
        extend: BuiltinFunc.create(apiFuncs.extend, 1, 0, false),
        index: BuiltinFunc.create(apiFuncs.index, 1, 0, false),
        remove: BuiltinFunc.create(apiFuncs.remove, 1, 0, false),
        join: BuiltinFunc.create(apiFuncs.join, 0, 1, false),
    },

    // convert to string
    toString: function()
    {
        var params = Utils.toArray(this._set).map(function(x) {
            return x.toString();
        });
        return params.join(",");
    },

    // convert to repr
    toRepr: function()
    {
        return "set(" + this.toString() + ")";
    },

    // convert to a native javascript object
    toNativeJs: function()
    {
        var ret = new Set();
        this._set.forEach(function(x) {
            ret.add(x);
        });
        return ret;
    },

    // object identifier
    name: "set",

    // object type
    type: "set",
});

// init set builtint api
_Object.initBuiltinApi(_Set);

// export the Set class
module.exports = _Set;

// require the list object (do it in the end to prevent require loop)
var List = require('./list');