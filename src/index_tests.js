"use strict";

/**
* Index file for unit tests, that just include all objects and provide public access to them.
*
* Author: Ronen Ness.
* Since: 2016
*/

// get the global object (either for browser or node.js)
var _window = typeof window === "undefined" ? global : window;

// get general defs
var defs = require('./defs');

// require and export all base objects
var AdderScript = {
    version: defs.version,
    Errors: require('./errors'),
    Utils: require('./utils'),
    Compiler: require('./compiler'),
    Interpreter: require('./interpreter'),
    Core: require('./core'),
    Language: require('./language/index'),
    Lexer: require('./compiler/lexer'),
    Parser: require('./compiler/parser'),
    Adder: require('./environment'),

    // console - you can override this if you want debug output
    Console: require("./console"),
};

// set in global scope and return
_window.AdderScript = AdderScript;
module.exports = AdderScript;
