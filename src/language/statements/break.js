"use strict";

/**
* Implement 'break' statement.
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

// 'break' statement
var Break = Class(Core.Statement, {

    // statement constructor
    // @param context - context of program currently executed.
    // @param ast - parsed AST - the output of the parser
    // @param line - current line, for debug purposes
    constructor: function(context, ast, line)
    {
        // call base class ctor
        Break.$super.call(this, context, line);

        // wrong tree length
        if (ast.length !== 1) {throw new Errors.SyntaxError("Illegal expression after 'break' statement!", line);}
    },

    // this command does nothing..
    execute: function()
    {
        var blockType = this._context.getCurrBlockType();
        if (blockType !== "loop") {
            throw new Errors.RuntimeError("'break' outside loop!");
        }
        var scope = this._context.getScope();
        scope.calledContinue = true;
        scope.calledBreak = true;
    },

    $static: {
        // get this statement keyword
        getKeyword: function()
        {
            return keywords["break"];
        },
    },

    // does not open a new block
    openNewBlock: false,
});

// export the Break class
module.exports = Break;
