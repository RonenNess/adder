"use strict";

/**
* Represent a value in program's memory. Everything inside the running environment is stored inside variables.
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

// include language defs
var LanguageDefs = require("./../language/defs");

// require basic utils
var Utils = require("./../utils");

// set of simple variable types
var simpleTypes = Utils.toSet(["string", "number", "boolean", "none"]);

// Variable class
var Variable = Class({

    // variable constructor
    // @param context - context of program currently executed.
    // @param value - variable value - must be raw, native type. NOT an expression.
    constructor: function(context, value)
    {
        // store context and arguments
        this._context = context;

        // set type
        // special case for null and undefined
        if (value === null || value === undefined)
        {
            value = null; // <-- in case we got "undefined" convert it to null.
            this.type = "none";
            this.isSimple = true;
            this._estimatedSize = 1;
        }
        // if its an object set type
        else
        {
            // function
            if (value.isFunction) {
                this.type = "function";
                this.isSimple = false;
                this._estimatedSize = 4;
            }
            // NaN
            else if (typeof value === "number" && isNaN(value))
            {
                this.type = "NaN";
                this.isSimple = false;
                this._estimatedSize = 4;
            }
            // if object and have type
            else if (value.type)
            {
                this.type = value.type;
                this.isSimple = false;
                this._estimatedSize = 4;
            }
            // any other object
            else {

                // set type
                this.type = typeof value;

                // special case - if string - remove quotes
                if (this.type === "string") {

                    // make sure don't exceed max string length
                    var maxLen = this._context._interpreter._flags.maxStringLen;
                    if (maxLen && value.length > maxLen) {
                        throw new Errors.ExceedMemoryLimit("String exceeded length limit of " + maxLen + "!");
                    }

                    // set estimated size
                    this._estimatedSize = value.length;
                }
                // for any other simple type estimated size is 1 byte
                else {
                    this._estimatedSize = 1;
                }

                // its a simple type
                this.isSimple = true;
            }
        }

        // add API based on variable type
        this.api = APIs[this.type];

        // set scope data
        this._scopeData = {};

        // store value
        this._value = value;
    },

    // set scope-related data of this variable
    setScopeData: function(scope, name, readonly) {
        this._scopeData = {
            scope: scope,
            name: name,
            readonly: readonly,
        };
    },

    // some static functions
    $static: {

        // return if given value is a variable instance
        isVariable: function(val) {
            return val && val.constructor === Variable;
        },

        // check if two variables are equal
        equal: function(a, b) {

            // if same object return true
            if (a === b) {
                return true;
            }

            // first get types and check if different types
            var typeA = a.type;
            var typeB = b.type;
            if (typeA !== typeB) {return false;}

            // get values
            a = a._value;
            b = b._value;

            // compare based on type
            switch (typeA) {

                // special case - NaN (remember we checked types before, so we don't need to check if both are NaN).
                // why we need this? because in JS if you do NaN === NaN the result is false, and I want to fix that.
                case "NaN":
                    return true;

                // if list compare lists
                case "list":
                    // if different length return false
                    if (a.len() !== b.len()) {return false;}

                    // iterate over items and compare recursively
                    for (var i = 0; i < a._list.length; ++i) {
                        if (!Variable.equal(a._list[i], b._list[i])) {
                            return false;
                        }
                    }

                    // if got here it means they are equal
                    return true;

                // if dict compare as dicts
                case "dict":
                    // get keys
                    var ak = a.keys(); var bk = b.keys();

                    // different length? not equal
                    if (ak.len() !== bk.len()) {return false;}

                    // iterate over keys and compare recursively
                    for (var i = 0; i < ak._list.length; ++i) {

                        var key = ak._list[i]._value;
                        if (!Variable.equal(a._dict[key], b._dict[key])) {
                            return false;
                        }
                    }

                    // if got here it means they are equal
                    return true;

                // if set compare sets
                case "set":
                        // if different length return false
                        if (a.len() !== b.len()) {return false;}

                        // convert both sets to lists
                        a = a.to_list(); b = b.to_list();

                        // iterate over items and compare recursively
                        for (var i = 0; i < a._list.length; ++i) {
                            if (!Variable.equal(a._list[i], b._list[i])) {
                                return false;
                            }
                        }

                        // if got here it means they are equal
                        return true;

                // for default types just compare
                default:
                    return a === b;
            };
        },

        // check if two variables are the same (like 'is' in python)
        is: function(a, b) {

            // if same object return true
            if (a === b) {
                return true;
            }

            // first get types and check if different types
            var typeA = a.type;
            var typeB = b.type;
            if (typeA !== typeB) {return false;}

            // get values
            a = a._value;
            b = b._value;

            // special case - NaN (remember we checked types before, so we don't need to check if both are NaN).
            // why we need this? because in JS if you do NaN === NaN the result is false, and I want to fix that.
            if (typeA === "NaN") {return true;}

            // if its an object, check if the same instance
            if (a && a.api)
            {
                return a === b;
            }

            // for native types return comparison
            return a === b;
        },

        // make sure given value is a variable (or a list of variables, if array is given).
        // note: this can either handle a single value or an array. if array, it will convert all items inside to variables.
        // @param forceCreateNew - if true, and val is already a variable, clone it to a new variable.
        makeVariables: function(context, val, forceCreateNew) {

            // if array convert all items into variable
            if (val instanceof Array) {

                // length is 0? stop here!
                if (val.length === 0) {return val;}

                // convert to variables and return
                for (var i = 0; i < val.length; ++i) {
                    val[i] = Variable.makeVariables(context, val[i], forceCreateNew);
                }

                // return value
                return val;
            }

            // if already variable stop here..
            if (val && val.constructor === Variable)
            {
                if (forceCreateNew) {
                    return new Variable(context, val._value);
                }
                return val;
            }

            // convert to variable
            return new Variable(context, val);
        },


        // similar to makeVariables but slightly different in a way that it will convert arrays into Adder lists, Sets
        // into adder Sets, etc..
        makeAdderObjects: function(context, val, forceCreateNew) {

            // if already a variable stop here..
            if (val && val.constructor === Variable)
            {
                // unless forced to create a new var, in which case create a copy
                if (forceCreateNew) {
                    return new Variable(context, val._value);
                }
                return val;
            }
            // if array convert all items inside into adder objects
            else if (val instanceof Array)
            {
                for (var i = 0; i < val.length; ++i) {
                    val[i] = Variable.makeAdderObjects(context, val[i], forceCreateNew);
                }
                // create and return the new list
                val = new _List(context, val);
            }
            // if a Set
            else if (val && val.constructor === Set)
            {
                // create and return the new Set
                val = new _Set(context, Utils.toArray(val));
            }
            // else if a dictionary convert to a dict
            else if (val instanceof Object && !val.__isAdderObject)
            {

                // convert to variables and return
                for (var key in val) {
                    val[key] = Variable.makeAdderObjects(context, val[key], forceCreateNew);
                }

                // create and return the new dictionary
                val = new _Dict(context, val);
            }

            // now convert to a variable and return
            return new Variable(context, val);
        },
    },

    // get variable value.
    getValue: function()
    {
        return this._value;
    },

    // get variable type
    getType: function()
    {
        return this.type;
    },

    // delete this variable
    deleteSelf: function()
    {
        // if no scope
        if (!this._scopeData.scope) {
            throw new Errors.RuntimeError("Cannot delete object '" + this.toString() + "'!");
        }

        // remove self from context and reset scope data
        this._context.remove(this._scopeData.name);
        this._scopeData = {};

    },

    // implement the 'in' operator, eg if val is inside this
    has: function(val)
    {
        // first check if have value
        if (this._value === null || this._value === undefined) {
            return false;
        }

        // now check if this var have 'has()' implemented internally. if so, use it.
        if (this._value.has) {
            return this._value.has(val);
        }

        // make sure value to check is not a variable
        if (val && val.getValue) {
            val = val._value;
        }

        // if has() is not supported, fallback to simple string indexOf
        return String(this._value).indexOf(val) !== -1;
    },

    // convert variable to a native javascript object
    toNativeJs: function()
    {
        // get value
        var val = this._value;

        // if its null etc.
        if (!val) {
            return val;
        }

        // if value is an object with its own to toNativeJs function, call it.
        if (val.toNativeJs) {
            return val.toNativeJs();
        }

        // special case for dictionaries
        if (val.isFunction) {
            return val.func || val.__imp;
        }

        // if a simple value return the value itself
        return val;
    },

    // convert to repr
    toRepr: function()
    {
        // get value
        var val = this._value;

        // return string based on type
        switch (this.type)
        {
            case "string":
                return '"' + val + '"';
            case "number":
                return String(val);
            case "none":
                return LanguageDefs.keywords['null'];
            case "boolean":
                return LanguageDefs.keywords[String(val)];
            case "function":
                return val.toRepr();
            default:
                // check if value got a string function of its own
                if (val && val.toRepr) {
                    return val.toRepr();
                }
                // if not just convert to a string and return
                return String(val);
        }
    },

    // convert to string
    toString: function()
    {
        // return string based on type
        switch (this.type)
        {
            case "string":
                return this._value;
            case "number":
                return String(this._value);
            case "none":
                return "";
            case "boolean":
                return LanguageDefs.keywords[String(this._value)];
            case "function":
                return this._value.toString();
            default:
                // check if value got a string function of its own
                if (this._value && this._value.toString) {
                    return this._value.toString();
                }
                // if not just convert to a string and return
                return String(this._value);
        }
    },
});

// export the Executable class
module.exports = Variable;

// get List, Dict and Set
var _List = require("./list");
var _Set = require("./set");
var _Dict = require("./dict");

// different APIs for different variable types
var APIs = {
    'string': require("./string_api"),
};