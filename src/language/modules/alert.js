"use strict";

/**
* Module to show alert boxes
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

// require the core stuff
var Core = require("./../../core");

// built-in Alert function.
var Alert = Core.BuiltinFunc.create(function(val)
    {
        // if no alert, use console instead
        if (typeof alert === "undefined") {
            return console.log(val._value);
        }

        // how alert
        return alert(val._value);
    }, 1, 0, false);

// create the module and export it
var AlertModule = Class(Core.Module, {

    // all the module builtin functions and consts (key is their name)
    api: {
        alert: Alert,
    },

    // not safe for production
    isSafe: false,

    // module identifier
    name: "Alert",

    // module version
    version: "1.0.0",
});

// export the Alert class
module.exports = AlertModule;
