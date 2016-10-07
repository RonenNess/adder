"use strict";

/**
* A built-in list object.
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

// include basic object type
var _Object = require("./object");

// include variable
var Variable = require("./variable");

// builtin function
var BuiltinFunc = require("./builtin_func");

// make sure list length is valid
function validate_len(list) {
    if (list._list.length > list._context._interpreter._flags.maxContainersLen) {
        throw new Errors.ExceedMemoryLimit("List exceeded maximum container length (" + list._context._interpreter._flags.maxContainersLen + ")");
    }
}

// all the api functions of the list
var apiFuncs = {

    // clone the list
    clone: function()
    {
        return new List(this._context, this._list);
    },

    // check if empty list
    empty: function()
    {
        return this._list.length === 0;
    },

    // convert to set and return
    to_set: function()
    {
        return new _Set(this._context, this._list);
    },

    // return list length
    len: function()
    {
        return this._list.length;
    },

    // append item to list
    append: function(item)
    {
        this._list.push(item);
        validate_len(this);
        this._context._interpreter.updateMemoryUsage(item._estimatedSize);
        return this;
    },

    // return true if value exists in the list
    has: function(item)
    {
        return this.index(item) !== -1;
    },

    // clear list
    clear: function()
    {
        this._list = [];
    },

    // count how many times item appear in the list
    count: function(item)
    {
        // count occurrences
        var ret = 0;
        for (var i = 0; i < this._list.length; ++i)
        {
            if (Variable.equal(this._list[i], item)) {
                ret++;
            }
        }

        // return counter
        return ret;
    },

    // extend list with another list
    extend: function(other)
    {
        if (other.type !== "list") {
            throw new Errors.RuntimeError("List 'extend()' expecting another list as param ('" + other.type + "' given).");
        }
        this._list = this._list.concat(other._value._list);
        validate_len(this);
        return this;
    },

    // return first index found of value
    index: function(item)
    {
        // find item
        for (var i = 0; i < this._list.length; ++i)
        {
            if (Variable.equal(this._list[i], item)) {
                return i
            }
        }

        // not found - return -1
        return -1;
    },

    // insert a value to a specific index
    insert: function(item, position)
    {
        // insert and return item
        this._list.splice(position, 0, item);
        validate_len(this);
        return item;
    },

    // join function
    join: function(str)
    {
        var connector = (str ? str._value : str) || undefined;
        return this._list.map(function(x) {return x._value;}).join(connector);
    },

    // pop a value from list
    pop: function(index)
    {
        // for return value
        var ret;

        // pop without value (last index)
        if (index === undefined) {
            ret = this._list.pop();
        }
        // pop specific index
        else {
            ret = this._list.splice(index, 1)[0];
        }
        // invalid index? return None
        if (ret === undefined) {
            return new Variable(this._context, null);
        }

        // return the value we poped
        return ret;
    },

    // shift a value from list
    shift: function()
    {
        return this._list.shift() || new Variable(this._context, null);
    },

    // remove first occurrence of value.
    remove: function(item)
    {
        // get item index in list
        var index = this.index(item);

        // if found remove it
        if (index !== -1)
        {
            this._list.splice(index, 1);
            return true;
        }

        // not found - didn't remove
        return false;
    },

    // reverse the list
    reverse: function()
    {
        this._list.reverse();
    },

    // slice the list and return a sub list
    slice: function(start, end)
    {
        var sub = this._list.slice(start, end);
        return new List(this._context, sub);
    },

    // sort list
    sort: function()
    {
        this._list.sort();
    },

    // return n'th item
    at: function(index) {

        // make sure integer
        if (index.type !== "number") {
            throw new Errors.RuntimeError("List 'at()' must receive a number as param (got '" + index.type + "' instead).");
        }

        // convert to int
        index = Math.round(index._value);

        // handle negatives
        if (index < 0) {index = this._list.length + index;}

        // make sure in range
        if (index >= this._list.length) {
            throw new Errors.RuntimeError("Index out of list range!");
        }

        // return item
        return this._list[index];
    },
}

// List class
var List = Class(_Object, {

    // Object constructor
    // @param context - context of program currently executed.
    // @param args - starting list
    constructor: function(context, args)
    {
        // call parent constructor
        List.$super.call(this, context);

        // make sure all items are variables
        args = Variable.makeVariables(context, args);

        // set list
        this._list = args ? args.slice(0) : [];
        validate_len(this);
    },

    // iterate over object components
    forEach: function(callback, obj) {
        for (var i = 0; i < this._list.length; ++i) {
            if (callback.call(obj, this._list[i]) === false) {
                return;
            }
        }
    },

    // list api
    api: {
        clone: BuiltinFunc.create(apiFuncs.clone, 0, 0, false),
        empty: BuiltinFunc.create(apiFuncs.empty, 0, 0, false),
        to_set: BuiltinFunc.create(apiFuncs.to_set, 0, 0, false),
        len: BuiltinFunc.create(apiFuncs.len, 0, 0, false),
        shift: BuiltinFunc.create(apiFuncs.shift, 0, 0, false),
        append: BuiltinFunc.create(apiFuncs.append, 1, 0, false),
        has: BuiltinFunc.create(apiFuncs.has, 1, 0, false),
        clear: BuiltinFunc.create(apiFuncs.clear, 0, 0, false),
        count: BuiltinFunc.create(apiFuncs.count, 1, 0, false),
        extend: BuiltinFunc.create(apiFuncs.extend, 1, 0, false),
        index: BuiltinFunc.create(apiFuncs.index, 1, 0, false),
        insert: BuiltinFunc.create(apiFuncs.insert, 2, 0, false),
        pop: BuiltinFunc.create(apiFuncs.pop, 0, 1, false),
        remove: BuiltinFunc.create(apiFuncs.remove, 1, 0, false),
        reverse: BuiltinFunc.create(apiFuncs.reverse, 0, 0, false),
        slice: BuiltinFunc.create(apiFuncs.slice, 1, 1, false),
        join: BuiltinFunc.create(apiFuncs.join, 0, 1, false),
        sort: BuiltinFunc.create(apiFuncs.sort, 0, 0, false),
        at: BuiltinFunc.create(apiFuncs.at, 1, 0, false),
    },

    // convert to string
    toString: function()
    {
        var params = this._list.map(function(x) {
            return x.toString();
        });
        return params.join(",");
    },

    // convert to repr
    toRepr: function()
    {
        return "list(" + this.toString() + ")";
    },

    // convert to a native javascript object
    toNativeJs: function()
    {
        var ret = [];
        for (var i = 0; i < this._list.length; ++i) {
            ret.push(this._list[i].toNativeJs());
        }
        return ret;
    },

    // object identifier
    name: "list",

    // object type
    type: "list",
});

// init set builtint api
_Object.initBuiltinApi(List);

// export the list class
module.exports = List;

// require Set (do it in the end to prevent require loop)
var _Set = require('./set');