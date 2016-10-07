"use strict";

/**
* A Scope contains all the params, vars, etc. of the current scope or block.
*
* Author: Ronen Ness.
* Since: 2016
*/

// include jsface for classes
var jsface = require("./../dependencies/jsface"),
    Class  = jsface.Class,
    extend = jsface.extend;

// include errors
var Errors = require("./../errors");

// include variable class
var Variable = require("./variable");

// console for logging
var Console = require("./../console");

// Scope class
var Scope = Class({

    // scope constructor
    // @param context - context of program currently executed.
    // @param depth - integer, scope depth in stack.
    // @param type - scope type, eg what is it for: "block", "function", "loop", ...
    constructor: function(context, depth, type, maxVars)
    {
        // store context
        this._context = context;

        // create vars dictionary and dictionary of read-only stuff
        this._type = type || "block";
        this._maxVars = maxVars || 100000;
        this._vars = {};
        this._varKeys = new Set();
        this._readonly = {};
        this._depth = depth;

        // some scope registers
        this.calledReturn = false;
        this.returnValue = null;
        this.calledContinue = false;
        this.calledBreak = false;
    },

    // set variable
    // @param key - variable key.
    // @param val - variable value.
    // @param readonly - if this variable readonly?
    // @param force - if true, will not do limit validations etc. used internally for builtins etc.
    setVar: function(key, val, readonly, force) {

        // make sure variable is a variable
        val = Variable.makeAdderObjects(this._context, val, true);

        // set scope data
        val.setScopeData(this, key, readonly);

        // update memory usage
        if (!force) {
            this._context._interpreter.updateMemoryUsage(val._estimatedSize);
        }

        // set var
        this._vars[key] = val;
        this._varKeys.add(key);

        // validate length
        if (!force && this._varKeys.size > this._maxVars) {
            throw new Errors.ExceedMemoryLimit("Exceeded scope size limit of " + this._maxVars + " variables!");
        }

        // return new variable
        return val;
    },

    // remove a variable
    remove: function(key) {

        // delete variable
        delete this._vars[key];
        this._varKeys.delete(key);
    },

    // get variable.
    // @parm key - variable identifier (string).
    // @param object - object to get from (if undefined, get from current scope).
    getVar: function(key, object) {

        return this._vars[key];
    },

    // get all identifier names in current scope
    getAllIdentifiers: function()
    {
        return Object.keys(this._vars);
    },
});

// export the scope class
module.exports = Scope;

