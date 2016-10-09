"use strict";

/**
* Index file to include everything and wrap it up.
*
* Author: Ronen Ness.
* Since: 2016
*/

// prepare the object to export
var adder = require("./environment");

// get general defs
var defs = require('./defs');

// set adder internals
adder._internals = {
    version: defs.version,
    Utils: require('./utils'),
    Compiler: require('./compiler'),
    Interpreter: require('./interpreter'),
    Core: require('./core'),
    Language: require('./language/index'),
    Lexer: require('./compiler/lexer'),
    Parser: require('./compiler/parser'),
    Adder: require('./environment'),
    Console: require("./console"),
};

// if in browsers add to window object
if (typeof window !== "undefined") {
    window.AdderScript = adder;
};

// export main object
module.exports = adder;