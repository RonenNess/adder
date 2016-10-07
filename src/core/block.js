"use strict";

/**
* The Block class represent a chunk of code, made of statements and sub-blocks to execute by order.
* Do not confuse the Block with the Scope class; Scope is the runtime params, vars, registers, which are alive while executing the code,
* while blocks are the structure of a compiled, loaded code, persistent and const between executions.
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

// Block class
var Block = Class(Executable, {

    // Block constructor
    // @param context - context of program currently executed.
    constructor: function(context)
    {
        // call base class
        Block.$super.call(this, context, null);

        // create executable (sub blocks and statements) queue
        this._executables = [];
    },

    // execute the block statements.
    execute: function()
    {
        // get current scope
        var scope = this._context.getScope();

        // iterate over executables (statements and sub blocks)
        var lastExecutable = null;
        for (var i = 0; i < this._executables.length; ++i)
        {
            // if "return" statement was called
            if (scope.calledReturn) {
                break;
            }

            // if "continue" or "break" statement was called (both raise the continue flag.
            else if (scope.calledContinue) {
                break;
            }

            // get current executable
            var curr = this._executables[i];

            // do some tests on last executable block / statement
            if (lastExecutable)
            {
                // check if previous executable is a statement that cause a break
                if (lastExecutable.isBreakingBlock)
                {
                    return;
                }

                // check if current executable is a block that we need to skip
                if (lastExecutable.skipFollowingBlock && curr.constructor === Block)
                {
                    continue;
                }
            }

            // execute child block / statement
            this._context._interpreter.evalStatement(curr);
            lastExecutable = curr;
        }
    },

    // add statement to block.
    addStatement: function(statement)
    {
        statement.setParentBlock(this, this._executables.length);
        this._executables.push(statement);
        this._lastStatement = statement;
    },

    // add sub block to block.
    addBlock: function(block)
    {
        // get last executable to set its following block
        var lastExecutable = this._executables[this._executables.length-1];
        if (lastExecutable === undefined)
        {
            throw new Errors.SyntaxError("Unexpected new block indent!");
        }
        lastExecutable.setFollowingBlock(block);

        // set block parent block and add to executables list
        block.setParentBlock(this, this._executables.length);
        this._executables.push(block);
    },

    // return all sub-blocks and statements.
    getChildren: function()
    {
        return this._executables;
    },

    // return a debug representation of this block
    getDebugBlocksView: function(indent) {

        // default indent levels
        indent = indent || 1;

        // get indent spaces prefix
        var indentPrefix = "";
        for (var i = 0; i < indent; ++i) {indentPrefix += '    ';}

        // return string
        var ret = "block:" + "\n";

        // iterate over executables and print them
        for (var i = 0; i < this._executables.length; ++i)
        {
            // get current executable
            var curr = this._executables[i];

            // if block
            if (curr.type === "block") {
                ret += indentPrefix + curr.getDebugBlocksView(indent + 1) + "\n";
            }
            else {
                ret += indentPrefix + curr.getRepr() + "\n";
            }
        }

        // add block closure
        ret += indentPrefix + "end_block" + "\n";

        // return the result string
        return ret;
    },

    // executable type
    type: "block",
});

// export the scope class
module.exports = Block;
