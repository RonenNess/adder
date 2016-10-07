"use strict";

/**
* A Statement is a single logical line that do a certain action, like placing var, calling a function, etc.
* There's a predefined set of built-in statements, like "if", "for", "while", etc. that define the language.
*
* Author: Ronen Ness.
* Since: 2016
*/

// include jsface for classes
var jsface = require("./../dependencies/jsface"),
    Class  = jsface.Class,
    extend = jsface.extend;

// include errors
var Errors = require("./../errors");

// require the executable class
var Executable = require("./executable");

// Statement base class
var Statement = Class(Executable, {

    // statement constructor
    // @param context - context of program currently executed.
    // @param line - current line, for debug purposes
    constructor: function(context, line)
    {
        // call base class
        Statement.$super.call(this, context);
        this._line = line;
    },

    $static: {
        // get this statement keyword
        getKeyword: function()
        {
            return null;
        },
    },

    // set the statement before this one in this block
    setPreviousStatement: function(statement) {
    },

    // get statement representation
    getRepr: function() {
        return this.constructor.getKeyword();
    },

    // if true, it means this statement must open a new block, like 'if', 'for', 'def', etc.
    openNewBlock: false,

    // if true, when executing this command we need to skip the block following it
    skipFollowingBlock: false,

    // if true, will break current block once this statement is executed
    isBreakingBlock: false,

    // executable type
    type: "statement",
});

// export the statement class
module.exports = Statement;

