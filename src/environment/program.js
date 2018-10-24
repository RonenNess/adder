"use strict";

/**
* A program wraps an interpreter and a loaded compiled code.
* This class represent an instance of a loaded program ready to be executed.
*
* Author: Ronen Ness.
* Since: 2016
*/

// include errors
var Errors = require("./../errors");

// include jsface for classes
var jsface = require("./../dependencies/jsface"),
    Class  = jsface.Class,
    extend = jsface.extend;

// include the alternative console
var Console = require("./../console");

// include the interpreter class
var Interpreter = require("./../interpreter");

// the program class.
var Program = Class({

    // Program constructor.
    // @param compiledCode - code to load.
    // @param modules - list of modules to load.
    // @param flags - interpreter flags etc.
    // @param outputFunc - output function for 'print' statements.
    constructor: function(compiledCode, modules, flags, outputFunc)
    {
        // notify new program creation
        Console.info("Created a new program instance!", modules, flags);

        // create interpreter
        this._interpreter = new Interpreter(flags);
        if (outputFunc) {this._interpreter.output = outputFunc;}

        // load modules
        for (var i = 0; i < modules.length; ++i) {
            this._interpreter.addModule(modules[i]);
        }

        // load the code
        if (compiledCode) {this._interpreter.load(compiledCode);}
    },

    // execute program once.
	// @param funcName - if provided, will call this function instead of root block.
    execute: function(funcName) {

        // execute code
        this._interpreter.execute(funcName);
    },

    // reset context
    resetContext: function() {
        this._interpreter.resetContext();
    },

    // execute an external raw code snippet in global scope
    evalRawCode: function(code) {
        this._interpreter.eval(code);
        return this._interpreter.getLastValue();
    },

    // get last execution variable as an Adder variable object.
    _getLastValueAsVariable: function() {
        var ret = this._interpreter.getLastValue();
        return ret;
    },

    // get last execution value.
    getLastValue: function() {
        var ret = this._interpreter.getLastValue();
        return ret ? ret.toNativeJs() : ret;
    },

    // get global variable by name.
    // @param key - variable name to get from global scope.
    getGlobalVar: function(key) {
        return this._interpreter._context.getVar(key).toNativeJs();
    },

    // set a global variable by name.
    // @param key - variable name to set in global scope.
    setGlobalVar: function(key, val, readonly) {
        this._interpreter._context.setVar(key, val, readonly, true);
    },

    // get last execution error.
    getLastError: function() {
        return this._interpreter.getLastError() || null;
    },

    // propagate execution error (if we had any)
    propagateExecutionErrors: function() {
        this._interpreter.propagateExecutionErrors();
    },

    // add a builtin module
    addModule: function(moduleId, module) {
        this._interpreter.addModule(moduleId, module);
    },

    // return all global scope var names
    getGlobalScopeVarNames: function() {
        return this._interpreter._context.getAllIdentifiers();
    },
});

// export the Program class
module.exports = Program;
