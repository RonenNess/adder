"use strict";

/**
* Implement the 'def' statement, that creates new function.
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

// function def statement
//
// a typical Def statement get AST that looks like that:
// [{"type":"identifier","value":"def"},
//  {"type":"call", "args":[{"type":"identifier","value":"a"}, {"type":"identifier","value":"b"}], "name":"test"},
//  {"type":"blockopen","value":":"}]"
var Def = Class(Core.Statement, {

    // statement constructor
    // @param context - context of program currently executed.
    // @param ast - parsed AST - the output of the parser
    // @param line - current line, for debug purposes
    constructor: function(context, ast, line)
    {
        // call base class ctor
        Def.$super.call(this, context, line);

        // wrong tree length
        if (ast.length < 3) {throw new Errors.SyntaxError("Incomplete function def line", line);}

        // validate def ast
        if (ast[1].type !== "call") {throw new Errors.SyntaxError("Expecting parenthesis and arguments list after function name.", line);}
        if (ast[2].type !== "blockopen") {throw new Errors.SyntaxError("Expecting colon after function arguments list.", line);}

        // get function data
        var funcData = ast[1];

        // parse function def arguments
        this._name = funcData.name;
        this._args = [];
        for (var i = 0; i < funcData.args.length; ++i)
        {
            var argData = funcData.args[i];
            if (argData.type !== "identifier") {
                throw new Errors.SyntaxError("Unexpected token '" + argData.value + "' in function arguments list.", line);
            }
            this._args.push(argData.value);
        }
    },

    $static: {
        // get this statement keyword
        getKeyword: function()
        {
            return keywords["def"];
        },
    },

    // define the new function.
    // note: execute of 'def' is not calling the func, its creating it.
    execute: function()
    {
        return this._context._interpreter.defineFunction(  this._name,
                                                           this._followingBlock,
                                                           this._args );
    },

    // this statement opens a new block
    openNewBlock: true,

    // skip following block on execution
    skipFollowingBlock: true,
});

// export the Def class
module.exports = Def;

