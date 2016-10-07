"use strict";

/**
* Math module contains math related functions and consts.
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

// include misc utils
var Utils = require("./../../utils");

// require the core stuff
var Core = require("./../../core");

// built-in abs function.
var Abs = Core.BuiltinFunc.create(function(val)
    {
        return Math.abs(val._value);
    },1,0,true);

// built-in max function.
var Max = Core.BuiltinFunc.create(function()
    {
        var args = Core.BuiltinFunc.getArgumentsOrListContent(this._context, arguments);
        return Math.max.apply(null, Utils.toArray(args).map(function(x) {return x._value;}));
    },1, 100, true);

// built-in min function.
var Min = Core.BuiltinFunc.create(function(val)
    {
        var args = Core.BuiltinFunc.getArgumentsOrListContent(this._context, arguments);
        return Math.min.apply(null, Utils.toArray(args).map(function(x) {return x._value;}));
    },1,100,true);

// built-in Pow function.
var Pow = Core.BuiltinFunc.create(function(val, pow)
    {
        return Math.pow(val._value, pow ? pow._value : undefined);
    },1,1,true);

// built-in Round function.
var Round = Core.BuiltinFunc.create(function(val)
    {
        return Math.round(val._value);
    },1,0,true);

// built-in Floor function.
var Floor = Core.BuiltinFunc.create(function(val)
    {
        return Math.floor(val._value);
    },1,0,true);

// built-in Ceil function.
var Ceil = Core.BuiltinFunc.create(function(val)
    {
        return Math.ceil(val._value);
    },1,0,true);

// built-in cos function.
var Cos = Core.BuiltinFunc.create(function(val)
    {
        return Math.cos(val._value);
    },1,0,true
);

// built-in sin function.
var Sin = Core.BuiltinFunc.create(function(val)
    {
        return Math.sin(val._value);
    },1,0,true);

// built-in atan function.
var Atan = Core.BuiltinFunc.create(function(val)
    {
        return Math.atan(val._value);
    },1,0,true);

// built-in exp function.
var Exp = Core.BuiltinFunc.create(function(val)
    {
        return Math.exp(val._value);
    },1,0,true);

// built-in tan function.
var Tan = Core.BuiltinFunc.create(function(val)
    {
        return Math.tan(val._value);
    },1,0,true);

// built-in log function.
var Log = Core.BuiltinFunc.create(function(val)
    {
        return Math.log(val._value);
    },1,0,true);

// built-in sqrt function.
var Sqrt = Core.BuiltinFunc.create(function(val)
    {
        return Math.sqrt(val._value);
    },1,0,true);

// built-in sign function.
var Sign = Core.BuiltinFunc.create(function(val)
    {
        if (Math.sign) {
            return Math.sign(val._value);
        }
        return val._value < 0 ? -1 : val._value > 0 ? 1 : 0;
    },1,0,true);

// built-in sum function.
var Sum = Core.BuiltinFunc.create(function()
    {
        // convert to args
        var args = Core.BuiltinFunc.getArgumentsOrListContent(this._context, arguments);

        // sum and return result
        var ret = 0;
        for (var i = 0; i < args.length; ++i)
        {
            ret += parseFloat(args[i]._value);
        }
        return ret;
    },null, null, true);

// built-in mul function.
var Mul = Core.BuiltinFunc.create(function()
    {
        // convert to args
        var args = Core.BuiltinFunc.getArgumentsOrListContent(this._context, arguments);

        // sum and return result
        var ret = 1;
        for (var i = 0; i < args.length; ++i)
        {
            ret *= parseFloat(args[i]._value);
        }
        return ret;
    },null, null, true);

// some consts
var E = Math.E;
var PI = Math.PI;
var SQRT2 = Math.SQRT2;

// create the module and export it
var MathModule = Class(Core.Module, {

    // all the module builtin functions and consts (key is their name)
    api: {
        abs: Abs,
        min: Min,
        max: Max,
        pow: Pow,
        round: Round,
        floor: Floor,
        ceil: Ceil,
        cos: Cos,
        sin: Sin,
        atan: Atan,
        exp: Exp,
        tan: Tan,
        log: Log,
        sqrt: Sqrt,
        sign: Sign,
        sum: Sum,
        mul: Mul,
        E: E,
        PI: PI,
        SQRT2: SQRT2,
    },

    // safe for production
    isSafe: true,

    // module identifier
    name: "Math",

    // module version
    version: "1.0.0",
});

// export the Math class
module.exports = MathModule;
