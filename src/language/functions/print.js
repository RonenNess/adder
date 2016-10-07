"use strict";

/**
* Implement the print function (translated to console.log)
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
module.exports = Core.BuiltinFunc.create(function()
    {
        // convert arguments to array
        var args = Utils.toArray(arguments);

        // convert to native js objects and print
        args = args.map(function(x) {return x.toString()});
        this._context._interpreter.output.apply(this._context._interpreter, args);
    },
    0, 100);
