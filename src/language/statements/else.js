"use strict";

/**
* Implement the 'if' statement.
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

// conditional else statement
var Else = Class(Core.Statement, {

    // statement constructor
    // @param context - context of program currently executed.
    // @param ast - parsed AST - the output of the parser
    // @param line - current line, for debug purposes
    constructor: function(context, ast, line)
    {
        // call base class ctor
        Else.$super.call(this, context, line);

        // validate 'else' ast
        if (ast[1].value !== ":") {throw new Errors.SyntaxError("Missing colon after 'else' statement!", line)}
    },

    $static: {
        // get this statement keyword
        getKeyword: function()
        {
            return keywords["else"];
        },
    },

    // set the statement before this one in this block
    setPreviousStatement: function(statement) {

        // make sure previous statement is if
        if (!statement || !statement.isIfStatement) {
            throw new Errors.SyntaxError("'else' statement not after 'if'!")
        }

        // store previous statement
        this._prevStatement = statement;
    },

    // check if condition and execute block
    execute: function()
    {
        // make sure last if statement was false
        if (this._prevStatement._conditionMet) {
            return;
        }

        // call block
        if (this._followingBlock) {
            this._followingBlock.execute();
        }
    },

    // this statement opens a new block
    openNewBlock: true,

    // skip following block on execution
    skipFollowingBlock: true,
});

// export the Else class
module.exports = Else;
