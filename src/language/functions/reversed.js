"use strict";

/**
* Implement the reversed function
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
        if (val.type !== "list")
        {
            throw new Errors.RuntimeError("'reversed()' expecting a list as param (" + val.type + " given).");
        }
        var ret = val._value.clone();
        ret.reverse();
        return ret;
    },
    1, null);
