"use strict";

/**
* Implement the int() function
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
module.exports = Core.BuiltinFunc.create(function(val, base)
    {
        return parseInt(val._value, base ? base._value : undefined);
    },
    1, 1);
