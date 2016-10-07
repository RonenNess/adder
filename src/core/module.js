"use strict";

/**
* A module is a collection of built-in functions and consts related to a certain topic.
* The host machine (eg whatever executes the script) can load and unload modules to choose which functionality and APIs
* to provide to the user's code. In addition you can create your own custom module to extend the language APIs.
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

// include basic object type
var _Object = require("./object");

// Module class
var Module = Class(_Object, {

    // Object constructor
    // @param context - context of program currently executed.
    constructor: function(context, identifier)
    {
        // set identifier
        this.identifier = identifier || this.identifier;

        // call object constructor
        Module.$super.call(this, context);

        // set api identifiers
        if (!this.__proto__._wasInit) {
            this.__proto__._wasInit = true;
            for (var key in this.api) {
                var curr = this.api[key];
                if (curr && curr.identifier) {
                    curr.identifier = this.identifier + "." + key;
                }
            }
        }
    },

    // set to true only modules you know that are safe to use for production
    isSafe: false,

    // module identifier
    name: "module",

    // object type
    type: "module",

    // module version
    version: "1.0.0",
});

// export the scope class
module.exports = Module;
