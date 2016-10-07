"use strict";

/**
* Implement the cmp() function
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

function getNumericVal(x){

    // if string
    if (typeof x === "string")
    {
        var ret = 0;
        for (var i = 0; i < x.length; i++) {
          ret += x.charCodeAt(i);
        }
        return ret;
    }

    // else, convert to numeric value
    return parseFloat(x);
}

// export the function
module.exports = Core.BuiltinFunc.create(function(a, b)
    {
        return getNumericVal(a._value) - getNumericVal(b._value);
    },
    2, null);
