"use strict";

/**
* Index file to include everything and wrap it up.
*
* Author: Ronen Ness.
* Since: 2016
*/

// prepare the object to export
var adder = require("./environment");

// if in browsers add to window object
if (typeof window !== undefined) {
    window.AdderScript = adder;
};

// export main object
module.exports = adder;