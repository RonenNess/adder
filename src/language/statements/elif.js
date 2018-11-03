"use strict";

/**
* Implement the 'elif' statement.
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
var Elif = Class(Core.Statement, {

    // statement constructor
    // @param context - context of program currently executed.
    // @param ast - parsed AST - the output of the parser
    // @param line - current line, for debug purposes
    constructor: function(context, ast, line)
    {
        // call base class ctor
        Elif.$super.call(this, context, line);

        // validate 'if' ast
        if (ast.length < 3) {throw new Errors.SyntaxError("Incomplete 'elif' statement!", line)}
        if (ast[2].value !== ":") {throw new Errors.SyntaxError("Missing colon after 'elif' statement!", line)}

        // get the expression to iterate inside
        this._condition = new Core.Expression(this._context, ast[1]);
    },

    $static: {
        // get this statement keyword
        getKeyword: function()
        {
            return keywords["elif"];
        },
    },

    // set the statement before this one in this block
    setPreviousStatement: function(statement) {

        // make sure previous statement is if
        if (!statement || !statement.isIfStatement) {
            throw new Errors.SyntaxError("'elif' statement not after 'if'!")
        }

        // store previous statement
        this._prevStatement = statement;
    },

    // check if condition and execute block
    execute: function()
    {
        // make sure last 'if' statement was false
        if (this._prevStatement._conditionMet || this._prevStatement._lastIfWasTrue) {
            this._lastIfWasTrue = true;
            return;
        }

        // last 'if' statement was not true
        this._lastIfWasTrue = false;

        // evaluate condition
        this._conditionMet = Boolean(this._condition.eval());

        // condition is false? don't execute block
        if (!this._conditionMet) {
            return;
        }

        // call block
        if (this._followingBlock) {
            this._followingBlock.execute();
        }
    },

    // this is a type of if statement
    isIfStatement: true,

    // this statement opens a new block
    openNewBlock: true,

    // skip following block on execution
    skipFollowingBlock: true,
});

// export the Elif class
module.exports = Elif;
