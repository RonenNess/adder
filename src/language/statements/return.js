"use strict";

/**
* Implement the 'return' statement.
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

// return statement
var Return = Class(Core.Statement, {

    // statement constructor
    // @param context - context of program currently executed.
    // @param ast - parsed AST - the output of the parser
    // @param line - current line, for debug purposes
    constructor: function(context, ast, line)
    {
        // call base class ctor
        Return.$super.call(this, context, line);

        // get return expression
        this._retExpression = ast[1];

        // wrong tree length
        if (ast.length > 2) {throw new Errors.SyntaxError("Illegal return expression!", line);}
    },

    $static: {
        // get this statement keyword
        getKeyword: function()
        {
            return keywords["return"];
        },
    },

    // return from current scope
    execute: function()
    {
        // return value (default to null)
        var retVal = null;

        // if got expression to evaluate as return value eval it
        if (this._retExpression)
        {
            // if not expression instance convert to it and store for future calls
            if (this._retExpression.constructor !== Core.Expression)
            {
                this._retExpression = new Core.Expression(this._context, this._retExpression);
            }

            // evaluate return expression and set as return value
            retVal = this._retExpression.eval();
        }

        // do return statement
        this._context._interpreter.returnValue(retVal);
        return retVal;
    },

    // this statement does not open a new block
    openNewBlock: false,
});

// export the Return class
module.exports = Return;

