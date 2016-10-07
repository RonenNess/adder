"use strict";

/**
* Implement the 'while' statement.
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

// "while x" statement
var While = Class(Core.Statement, {

    // statement constructor
    // @param context - context of program currently executed.
    // @param ast - parsed AST - the output of the parser
    // @param line - current line, for debug purposes
    constructor: function(context, ast, line)
    {
        // call base class ctor
        While.$super.call(this, context, line);

        // validate for ast
        if (ast.length !== 3) {throw new Errors.SyntaxError("Invalid 'while' statement!", line)}
        if (ast[ast.length-1].value !== ":") {throw new Errors.SyntaxError("Missing colon after 'while' statement!", line)}

        // get while condition
        this._condition = new Core.Expression(this._context, ast[1]);
    },

    $static: {
        // get this statement keyword
        getKeyword: function()
        {
            return keywords["while"];
        },
    },

    // return from current scope
    execute: function()
    {
        // evaluate condition
        var conditionResult = this._condition.eval();

        // condition is false? don't execute block
        if (!conditionResult || !(this._followingBlock)) {
            return;
        }

        // just in case...
        var maxAttemptsLeft = 10000000;

        // create scope for the loop block
        this._context.stackPush("loop");

        // execute blocks in the loop
        try {

            while (maxAttemptsLeft--) {

                // call block
                this._followingBlock.execute();

                // get current scope
                var scope = this._context.getScope();

                // was break / return called?
                if (scope.calledBreak || scope.calledReturn) {
                    break;
                }

                // remove the 'continue' flag
                scope.calledContinue = false;

                // check condition again and break if false
                if (!this._condition.eval()) {
                    break;
                }
            }

        }
        catch (e) {

            // pop stack
            this._context.stackPop();

            // rethrow exception
            throw e;
        }

        // pop stack
        this._context.stackPop();
    },

    // execute block one time per value in iteration
    _execBlock: function(val) {

        // if called break stop here and return false. returning false in iteration supposed to stop it
        if (this._context.getScope().calledBreak) {
            return false;
        }

        // set variable
        this._context.setVar(this.identifier, val);

        // call block
        if (this._followingBlock) {
            this._followingBlock.execute();
        }

        // remove the 'continue' flag
        this._context.getScope().calledContinue = false;

        // to continue loop
        return true;
    },

    // this statement opens a new block
    openNewBlock: true,

    // skip following block on execution
    skipFollowingBlock: true,
});

// export the While class
module.exports = While;
