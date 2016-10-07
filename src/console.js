"use strict";

/**
* Override these functions to get debug data while using AdderScript.
*
* Author: Ronen Ness.
* Since: 2016
*/

module.exports = {

    // override these functions to get output
    log: function() {},
    debug: function() {},
    warn: function() {},
    info: function() {},

    // bind all functions to native javascript console
    bindToNativeConsole: function() {
        this.log = function()   {console.log    ("AdderScript.log>",      arguments);};
        this.debug = function() {console.debug  ("AdderScript.debug>",    arguments);};
        this.warn = function()  {console.warn   ("AdderScript.warn>",     arguments);};
        this.info = function()  {console.info   ("AdderScript.info>",     arguments);};
    },
}