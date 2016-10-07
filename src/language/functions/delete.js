"use strict";

/**
* Implement the delete() function
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
module.exports = Core.BuiltinFunc.create(function(variable)
    {
        if (variable && variable.deleteSelf) {
            return variable.deleteSelf();
        }
        throw new Errors.RuntimeError("Invalid object to delete!");
    },
    1, 0, false);
