"use strict";

/**
* Implement the ord() function
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

// export the function
module.exports = Core.BuiltinFunc.create(function(val)
    {
        // get value
        var str = val._value;

        // make sure its string
        if (typeof str !== "string") {
            throw new Errors.RuntimeError("'ord()' expect a string as parameter (called with '" + (typeof str) + "').");
        }

        // make sure length is ok
        if (str.length !== 1) {
            throw new Errors.RuntimeError("'ord()' expect string with length of 1 (called with length '" + str.length + "').");
        }

        // return result
        return str.charCodeAt(0);
    },
    1, null);
