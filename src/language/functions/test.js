"use strict";

/**
* Implement the special test function, that calls the function "window.__adder_script_test" with the arguments.
* Note: its your responsibility to impalement __adder_script_test.
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

// require misc utils
var Utils = require("./../../utils");

// export the function
module.exports = Core.BuiltinFunc.create(function(args)
    {
        args = Utils.toArray(arguments);
        var _window = typeof window === "undefined" ? global : window;
        if (_window.__adder_script_test) {return _window.__adder_script_test.apply(null, args)};
        return args;
    },
    null, null);
