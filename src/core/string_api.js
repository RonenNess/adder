"use strict";

/**
* Implement special API for string variables.
*
* Author: Ronen Ness.
* Since: 2016.
*/

// include jsface for classes
var jsface = require("./../dependencies/jsface"),
    Class  = jsface.Class,
    extend = jsface.extend;

// include errors
var Errors = require("./../errors");

// require builtin-functions
var BuiltinFunc = require("./builtin_func");

// string api
var api = {};

// return string length
api.len = BuiltinFunc.create(function() {
        return this.length;
    }, 0, 0, false);

// split string into list
api.split = BuiltinFunc.create(function(delimiter) {
        delimiter = delimiter ? delimiter._value : " ";
        return this.split(delimiter);
    }, 0, 1, false);

// replace word with another
api.replace = BuiltinFunc.create(function(find, replace) {
        find = find._value;
        replace = replace ? replace._value : replace;
        return this.split(find).join(replace);
    }, 2, 0, false);

// remove word from string
api.remove = BuiltinFunc.create(function(word) {
        word = word._value;
        return this.split(word).join("");
    }, 1, 0, false);

// return the index of a search term
api.index = BuiltinFunc.create(function(find) {
        find = find._value;
        return this.indexOf(find);
    }, 1, 0, false);

// return if value is in string
api.has = BuiltinFunc.create(function(find) {
        find = find._value;
        return this.indexOf(find) !== -1;
    }, 1, 0, false);

// count how many times a word appears in the string
api.count = BuiltinFunc.create(function(word) {
        return this.split(word).length - 1;
    }, 1, 1, false);

// strip whitespaces etc
api.trim = BuiltinFunc.create(function() {
        return this.trim();
    }, 0, 0, false);

// get string hash value
api.hash = BuiltinFunc.create(function() {
        var hash = 0, i, chr, len;
        if (this.length === 0) return hash;
        for (i = 0, len = this.length; i < len; i++) {
            chr   = this.charCodeAt(i);
            hash  = ((hash << 5) - hash) + chr;
            hash |= 0; // Convert to 32bit integer
        }
        return hash;
    }, 0, 0, false);

// return if string ends with a word
api.ends_with = BuiltinFunc.create(function(word) {
        word = word._value;
        return this.indexOf(word) === this.length - word.length;
    }, 1, 0, false);

// return if string starts with a word
api.starts_with = BuiltinFunc.create(function(word) {
        word = word._value;
        return this.indexOf(word) === 0;
    }, 1, 0, false);

// return true if string is only alphabetic characters
api.is_alpha = BuiltinFunc.create(function() {
        return /^[a-zA-Z()]+$/.test(this);
    }, 0, 0, false);

// return true if string is only digit characters
api.is_digit = BuiltinFunc.create(function() {
        return /^\d+$/.test(this);
    }, 0, 0, false);

// return this string in lower case
api.lower = BuiltinFunc.create(function() {
        return this.toLowerCase();
    }, 0, 0, false);

// return this string in upper case
api.upper = BuiltinFunc.create(function() {
        return this.toUpperCase();
    }, 0, 0, false);

// return this string in title case
api.title = BuiltinFunc.create(function() {
    return this.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
}, 0, 0, false);

// slice the list and return a sub list
api.slice = BuiltinFunc.create(function(start, len)
{
    start = start._value;
    len = len ? len._value : len;
    return this.substr(start, len);
}, 1, 1, false);

// export the api
module.exports = api;