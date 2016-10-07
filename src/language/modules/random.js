"use strict";

/**
* Random module contains random utilities.
*
* Author: Ronen Ness.
* Since: 2016.
*/

// include jsface for classes
var jsface = require("./../../dependencies/jsface"),
    Class  = jsface.Class,
    extend = jsface.extend;

// include errors
var Errors = require("./../../errors");

// include misc utils
var Utils = require("./../../utils");

// require the core stuff
var Core = require("./../../core");

// built-in rand function.
var Rand = Core.BuiltinFunc.create(function()
    {
        return Math.random();
    },0,0,false);

// built-in rand int function.
var RandInt = Core.BuiltinFunc.create(function(min, max)
    {
        if (max === undefined){
            return Math.round(Math.random() * min._value);
        }
        return min._value + Math.round(Math.random() * (max._value - min._value));
    },1,1,false);

// built-in rand float function.
var RandFloat = Core.BuiltinFunc.create(function(min, max)
    {
        if (max === undefined){
            return (Math.random() * min._value);
        }
        return min._value + (Math.random() * (max._value - min._value));
    },1,1,false);

// built-in rand selection function
var Select = Core.BuiltinFunc.create(function(selection)
    {
        // get list to get random item from
        var list = undefined;

        // if selection is a dictionary
        if (selection.type === "dict") {
            list = Object.keys(selection._value._dict);
        }

        // if a list
        if (selection.type === "list") {
            list = selection._value._list;
        }

        // if its a set
        if (selection.type === "set") {
            list = Utils.toArray(selection._value._set);
        }

        // list is undefined? it means its unsupported object
        if (list === undefined) {
            throw new Errors.RuntimeError("Object '" + selection.type + "' does not support random selection.");
        }

        // return a random item from the list
        var val = list[Math.floor(Math.random() * list.length)];
        return val && val.getValue ? val.getValue() : val;

    },1,0,false);

// built-in function to random true or false.
var BooleanRand = Core.BuiltinFunc.create(function()
    {
        return Math.random() < 0.5 ? false : true;
    },0,0,false);

// built-in function to random 0 or 1.
var BinaryRand = Core.BuiltinFunc.create(function()
    {
        return Math.round(Math.random());
    },0,0,false);

// create the module and export it
var RandomModule = Class(Core.Module, {

    // all the module builtin functions and consts (key is their name)
    api: {
        rand: Rand,
        rand_int: RandInt,
        rand_float: RandFloat,
        select: Select,
        boolean: BooleanRand,
        binary: BinaryRand,
    },

    // safe for production
    isSafe: true,

    // module identifier
    name: "Random",

    // module version
    version: "1.0.0",
});

// export the Random class
module.exports = RandomModule;
