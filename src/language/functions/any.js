"use strict";

/**
* Implement the any() function
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

// built-in Any function.
var Any = Class(Core.BuiltinFunc, {

    __imp: function(args)
    {
        for (var i = 0; i < args.length; ++i)
        {
            if (args[i]._value) return true;
        }
        return false;
    },

    // accept any number of args
    requiredArgs: null,
});

// export the function
module.exports = Core.BuiltinFunc.create(function()
    {
        for (var i = 0; i < arguments.length; ++i)
        {
            if (arguments[i]._value) {return true;}
        }
        return false;
    },
    null, null);
