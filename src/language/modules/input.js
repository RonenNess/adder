"use strict";

/**
* Module to get input from users view alert box.
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

// built-in RawInput function.
var RawInput = Core.BuiltinFunc.create(function(text, defval)
    {
        // if no prompt, raise exception
        if (typeof prompt === "undefined") {
            throw new Errors.RuntimeError("rawInput not supported on this platform!");
        }

        // show prompt and return result value
        return window.prompt(text._value, defval ? defval._value : "");
    }, 1, 1, false
);

// create the module and export it
var Input = Class(Core.Module, {

    // all the module builtin functions and consts (key is their name)
    api: {
        rawInput: RawInput,
    },

    // not safe for production
    isSafe: false,

    // module identifier
    name: "Input",

    // module version
    version: "1.0.0",
});

// export the Input class
module.exports = Input;
