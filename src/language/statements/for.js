"use strict";

/**
* Implement the 'for' statement.
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

// "for x in y" statement
var For = Class(Core.Statement, {

    // statement constructor
    // @param context - context of program currently executed.
    // @param ast - parsed AST - the output of the parser
    // @param line - current line, for debug purposes
    constructor: function(context, ast, line)
    {
        // call base class ctor
        For.$super.call(this, context, line);

        // validate for ast
        if (!ast[1] || ast[1].type !== "in") {throw new Errors.SyntaxError("Expecting 'in' operator after for identifier.", line);}
        if (!ast[1] || ast[1].left.type !== "identifier") {throw new Errors.SyntaxError("Expecting variable name after 'for' statement.", line);}
        if (ast.length < 3) {throw new Errors.SyntaxError("Incomplete 'for' statement!", line)}
        if (ast[ast.length-1].value !== ":") {throw new Errors.SyntaxError("Missing colon after 'for' statement!", line)}

        // get the expression to iterate inside
        this._target = new Core.Expression(this._context, ast[1].right);

        // get identifier name
        this.identifier = ast[1].left.value;
    },

    $static: {
        // get this statement keyword
        getKeyword: function()
        {
            return keywords["for"];
        },
    },

    // return from current scope
    execute: function()
    {
        // evaluate target to iterate on
        var target = this._target.eval();

        // check if unsupported
        if (!target || (!target.forEach && target.length === undefined)) {
            throw new Errors.RuntimeError("Object type '" + (typeof target) + "' does not support iteration!");
        }

        // create scope for the loop block
        this._context.stackPush("loop");

        // execute blocks in the loop
        try {

            // if got 'forEach' use it
            if (target.forEach)
            {
                target.forEach(this._execBlock, this);
            }
            else
            {
                // if don't have 'forEach' use length (used for strings for example)
                for (var i = 0; i < target.length; ++i) {

                    if (this._execBlock(target[i]) === false) {
                        break;
                    }
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

        // get scope
        var scope = this._context.getScope();

        // if called break stop here and return false. returning false in iteration supposed to stop it
        if (scope.calledBreak || scope.calledReturn) {
            return false;
        }

        // set variable
        this._context.setVar(this.identifier, val);

        // call block
        if (this._followingBlock) {
            this._followingBlock.execute();
        }

        // remove the 'continue' flag
        scope.calledContinue = false;

        // to continue loop
        return true;
    },

    // this statement opens a new block
    openNewBlock: true,

    // skip following block on execution
    skipFollowingBlock: true,
});

// export the For class
module.exports = For;
