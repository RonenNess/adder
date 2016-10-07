"use strict";

/**
* A builtin function that link between JavaScript code and a function accessible in the script execution.
* Note: this is not the same as a function that the user script define in runtime. The built-in functions are pre-defined and
* hard coded and are part of the language itself.
*
* With these we implement the most basic things like print, max, min, etc.. all the language built-ins.
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

// include variable class
var Variable = require("./variable");

// include utils
var Utils = require("./../utils");

// BuiltinFunction class
// NOTE! when the function is executed, 'this' will always be the containing object.
var BuiltinFunction = Class({

    // built-in function constructor
    constructor: function()
    {
    },

    // the actual function implementation.
    // @param args - list of arguments (evaluated values).
    __imp: function(args)
    {
        throw Errors.NotImplemented();
    },

    // execute this statement.
    // @param args - list of arguments (evaluated values) to send to the function.
    execute: function(args, obj)
    {
        // call function
        try {
            return this.__imp.apply(obj, args);
        }
        // catch errors
        catch (e)
        {
            if (e.expectedError){
                throw e;
            }
            throw new Errors.InternalError("Exception in built-in function!", e);
        }
    },

    // functions are built-in Adder objects
    __isAdderObject: true,

    // this must always be true (used internally)
    isFunction: true,

    // indicate that this object is  abuilt-in function
    isBuiltinFunc: true,

    // indicate that this function is deterministic (eg for func(x) result will always be 'y').
    deterministic: true,

    // how many args are required for this function
    // note: set to null for any number of args
    requiredArgs: 0,

    // number of optional params
    optionalArgs: 0,

    // convert to string
    toString: function() {
        return '<' + this.identifier + '>';
    },

    // convert to repr
    toRepr: function() {
        return this.toString();
    },

    // static stuff
    $static: {

        // create a new built-in function type from a plain function.
        // @param func - function that implements the built-in function logic (get list of variables as arguments).
        // @param mandatoryParams - integer, how many params must be provided to this function (null for any number of params).
        // @param optionalParams - integer, how many additional optional params can be provided to this function.
        // @param deterministic - indicate if this function is deterministic (default to true).
        create: function(func, mandatoryParams, optionalParams, deterministic) {

            // create and return the builtin function prototype
            var type = Class(BuiltinFunction, {
                __imp: func,
                requiredArgs: mandatoryParams || null,
                optionalArgs: optionalParams || null,
                deterministic: deterministic === undefined ? true : deterministic,
            });
            return new type();
        },

        // if got only one argument and its a list or a set, return the list internal array.
        // else, just return arguments
        getArgumentsOrListContent: function(context, args) {

            // if we got only one argument..
            if (args.length === 1) {

                // if its a list:
                if (args[0].type === "list") {
                    return args[0]._value._list;
                }
                // else if its a set:
                else if (args[0].type === "set") {
                    var ret = Utils.toArray(args[0]._value._set);
                    return Variable.makeVariables(context, ret);
                }
            }

            // if not list / set one arg, return the arguments we got
            return args;
        },
    },
});

// export the Executable class
module.exports = BuiltinFunction;

