"use strict";

/**
* Implement 'pass' statement, which is either an empty line or the word 'pass', and it basically do nothing.
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

// require the executable class
var Core = require("./../../core");

// require language defs
var LanguageDefs = require("./../defs");

// get builtin keywords
var keywords = LanguageDefs.keywords;

// 'pass' statement
var Pass = Class(Core.Statement, {

    // statement constructor
    // @param context - context of program currently executed.
    // @param ast - parsed AST - the output of the parser
    // @param line - current line, for debug purposes
    constructor: function(context, ast, line)
    {
        // call base class ctor
        Pass.$super.call(this, context, line);

        // wrong tree length
        if (ast.length !== 1) {throw new Errors.SyntaxError("Illegal expression after pass statement!", line);}
    },

    // this command does nothing..
    execute: function()
    {
        return null;
    },

    $static: {
        // get this statement keyword
        getKeyword: function()
        {
            return keywords["pass"];
        },
    },

    // does not open a new block
    openNewBlock: false,
});

// export the Pass class
module.exports = Pass;

