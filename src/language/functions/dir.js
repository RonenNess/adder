"use strict";

/**
* Implement the dir() function
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
module.exports = Core.BuiltinFunc.create(function(obj)
    {
        // if object provided
        if (obj)
        {
            var val = obj._value;
            if (val && val.api) {
                return Object.keys(val.api);
            }
            throw new Errors.RuntimeError("'" + obj.type + "' Is not a valid object type for dir().");
        }

        // if no object provided return the context variables
        return this._context.getAllIdentifiers();

    },
    0, 1, false);
