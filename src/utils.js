"use strict";

// include errors
var Errors = require("./errors");

// convert iterable into arrays
// this is for platforms that don't support Array.from().
function toArray(x) {

    // if there's a standard Array.from function use it
    if (Array.from) {
        return Array.from(x);
    }

    // if x got .length
    if (x.length !== undefined) {
        return Array.prototype.slice.call(x);
    }

    // if got forEach function use it
    var ret = [];
    if (x.forEach) {
        x.forEach(function(item) {
            ret.push(item);
        });
        return ret;
    }

    // if got here no way to convert
    throw new Errors.InternalError("Cannot convert object " + (typeof x) + " to array!");
}

// create set from starting list.
// this is for browsers (looking at you IE!) that don't accept a list as init param in a new Set.
function toSet(values) {

    // create the set
    var ret = new Set(values);

    // if got starting values and yet the set is empty..
    if (values && values.length !== ret.size) {
        for (var i = 0; i < values.length; ++i){
            ret.add(values[i]);
        }
    }

    // return the new set
    return ret;
}

// get performance measurement - either 'performance' object or if doesn't exist takes the date object.
var performance = typeof performance !== "undefined" ? performance : Date;

// return accurate time now in ms
function getTime() {
    return performance.now();
}

// replace all occurrences in a string
function replaceAll(text, search, replacement) {

    // replace all and return
    // NOTE! the reson we use split() join() and not regex is to handle special characters in regex; to handle them
    // we needed to escape them first, which is another regex. two regex are not so efficient comparing to split().join().
    return text.split(search).join(replacement);
}

// export utility functions
module.exports = {
    toArray: toArray,
    toSet: toSet,
    getTime: getTime,
    replaceAll: replaceAll,
};