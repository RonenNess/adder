"use strict";

/**
* Implement the range() function
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
module.exports = Core.BuiltinFunc.create(function(start, stop, step)
    {
        // one arg - its stop step
        if (stop === undefined && step === undefined)
        {
            stop = start._value;
            start = 0;
            step = 1;
        }
        // more than one arg - start, stop, [step]
        else
        {
            start = start._value;
            stop = stop._value;
            step = step ? step._value : 1;
        }

        // check legal params
        if (typeof start !== "number" ||
            typeof stop !== "number" ||
            typeof step !== "number")
            {
                throw new Errors.RuntimeError("Illegal arguments!");
            }

        // make sure values are legal
        if (step === 0) {return new Core.List(this._context, []);}
        if (step > 0 && stop < start) {return new Core.List(this._context, []);}
        if (step < 0 && stop > start) {return new Core.List(this._context, []);}

        // get range
        var ret = [];
        var curr = start;
        while (!(isNaN(curr) ||
                (step > 0 && curr >= stop) ||
                (step < 0 && curr <= stop) ||
                ret.length >= 100000))
        {
            // push value and increase
            ret.push(curr);
            curr += step;
        }
        return new Core.List(this._context, ret);
    },
    1, 2);
