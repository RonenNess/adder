"use strict";

/**
* The Executable class define the API of anything that can be executed as a code - a statement or a block.
*
* Author: Ronen Ness.
* Since: 2016
*/

// include jsface for classes
var jsface = require("./../dependencies/jsface"),
    Class  = jsface.Class,
    extend = jsface.extend;

// Executable base class
var Executable = Class({

    // executable constructor.
    // @param context - context of program currently executed.
    constructor: function(context)
    {
        // store context and arguments
        this._context = context;

        // block undefined until set via setParentBlock()
        this._parentBlock = null;
        this._followingBlock = null;
        this._position = -1;
    },

    // execute this statement.
    execute: function()
    {
        throw new Errors.NotImplemented();
    },

    // set parent block of this executable.
    // @param block - the parent block to assign.
    // @param position - position (index) of this statement inside the parent block.
    setParentBlock: function(block, position)
    {
        this._parentBlock = block;
        this._position = position;
    },

    // set the block that comes right after this statement / block.
    // this is important for statements like 'def', 'for', 'if', etc..
    // @param block - the following block to assign.
    setFollowingBlock: function(block)
    {
        this._followingBlock = block;
    },

    // executable type
    type: "executable",
});

// export the Executable class
module.exports = Executable;

