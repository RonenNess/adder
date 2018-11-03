"use strict";

/**
* A basic object API.
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

// include variable object
var Variable = require("./variable");

// require general utils
var Utils = require("./../utils");

// builtin functions
var BuiltinFunc = require("./builtin_func");

// Object class
var _Object = Class({

    // Object constructor
    // @param context - context of program currently executed.
    constructor: function(context)
    {
        // store context
        this._context = context;
    },

    // set attribute
    setAttr: function(key, value)
    {
        // wrap value as variable (unless its already an adder variable)
        if (value === null || value === undefined || value.constructor !== Variable) {
            value = new Variable(this._context, value);
        }

        // set value
        this.api[key] = value;
    },

    // convert to a native javascript object
    toNativeJs: function()
    {
        return this.toString();
    },

    // convert to a object string representation
    toRepr: function()
    {
        return this.toString();
    },

    // get attribute
    getAttr: function(key)
    {
        return this.api[key];
    },

    // object api - override this with the public functions and values of the object type.
    // user scripts can access only objects in this dictionary.
    api: {},

    // basic api all objects share.
    // don't override this one.
    _objectApi: {

        // convert to string
        str: BuiltinFunc.create(function() {
            return this.toString ? this.toString() : this.type;
        }, 0, 0),

    },

    // object identifier
    name: "object",

    // object type
    type: "object",

    // this is a built-in adder object
    __isAdderObject: true,

    // convert to string
    toString: function() {
        return '<' + this.identifier + '>';
    },

    // static stuff
    $static: {

        // fix object's api and create aliases to functions for internal access
        initBuiltinApi: function(obj) {

            // get object prototype
            obj = obj.prototype;

            // first copy _objectApi stuff
            for (var key in obj._objectApi) {
                if (obj.api[key] === undefined) {
                    obj.api[key] = obj._objectApi[key];
                }
            }

            // special case - rename _set() and _get() into set() and get()
            if (obj.api._get) {obj.api.get = obj.api._get; delete obj.api._get;}
            if (obj.api._set) {obj.api.set = obj.api._set; delete obj.api._set;}

            // iterate over api keys and create alias to function calls
            for (var key in obj.api)
            {
                // get current api object
                var curr = obj.api[key];
                if (curr.isBuiltinFunc) {
                    (function(key) {

                        obj[key] = function() {
                            return this.api[key].execute.call(this.api[key], arguments, this);
                        }
                    })(key);
                }
            }

        },

    },
});

// export the scope class
module.exports = _Object;
