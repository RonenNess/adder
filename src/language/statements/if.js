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

// conditional if statement
var If = Class(Core.Statement, {

    // statement constructor
    // @param context - context of program currently executed.
    // @param ast - parsed AST - the output of the parser
    // @param line - current line, for debug purposes
    constructor: function(context, ast, line)
    {
        // call base class ctor
        If.$super.call(this, context, line);

        // validate 'if' ast
        if (ast.length < 3) {throw new Errors.SyntaxError("Incomplete 'if' statement!", line)}
        if (ast[2].value !== ":") {throw new Errors.SyntaxError("Missing colon after 'if' statement!", line)}

        // get the expression to iterate inside
        this._condition = new Core.Expression(this._context, ast[1]);
    },

    $static: {
        // get this statement keyword
        getKeyword: function()
        {
            return keywords["if"];
        },
    },

    // check if condition and execute block
    execute: function()
    {
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

// export the If class
module.exports = If;
