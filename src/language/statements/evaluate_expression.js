"use strict";

/**
* This statement is trying to evaluate the entire line as an expression or function call.
*
* We use this statement as a fallback when no other statement match the line, and it allow us to invoke
* functions and evaluate values without assigning them.
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

// evaluate expression statement
var EvaluateExpression = Class(Core.Statement, {


    // statement constructor
    // @param context - context of program currently executed.
    // @param ast - parsed AST - the output of the parser
    // @param line - current line, for debug purposes
    constructor: function(context, ast, line)
    {
        // call base class ctor
        EvaluateExpression.$super.call(this, context, line);
        if (ast.length != 1) { throw new Errors.SyntaxError("Invalid expression!", line);}
        this._expression = ast[0];
    },

    $static: {
        // get this statement keyword
        getKeyword: function()
        {
            return "";
        },
    },

    // get statement representation
    getRepr: function() {
        return "exp " + (this._expression._ast ? this._expression._ast.type : this._expression.type);
    },

    // execute expression
    execute: function()
    {
        // if not expression instance convert to it
        if (this._expression.constructor !== Core.Expression)
        {
            this._expression = new Core.Expression(this._context, this._expression);
        }

        // evaluate and return
        return this._expression.eval();
    },

    // does not open a new block
    openNewBlock: false,
});

// export the EvaluateExpression class
module.exports = EvaluateExpression;

