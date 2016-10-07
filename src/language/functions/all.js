"use strict";

/**
* Implement the all() function
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
module.exports = Core.BuiltinFunc.create(function()
    {
        for (var i = 0; i < arguments.length; ++i) {
            if (!(arguments[i]._value)) {return false;}
        }
        return true;
    },
    null, null);
