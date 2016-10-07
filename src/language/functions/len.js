"use strict";

/**
* Implement the len() function
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
        var val = val._value;
        if (val) {
            if (val.api && val.len) {return val.len();}
            if (val.length !== undefined) {return val.length;}
        }
        return null;
    },
    1, null);
