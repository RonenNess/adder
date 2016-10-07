"use strict";

/**
* Misc language-related defs, like which character is used for comment, prefix for user variables, etc.
*
* Author: Ronen Ness.
* Since: 2016.
*/

var defs = {
    charsLegalInVarName: ['_', '$'],   // list of characters we allow to have in variable / function names
    keywords: {
        'def':      "def",            // keyword used to define new function.
        'pass':     "pass",           // keyword used for the 'pass' null statement that does nothing.
        'return':   "return",         // keyword used for 'return' statement.
        'for':      "for",            // keyword for the 'for' statement.
        'while':    "while",          // keyword for the 'while' statement.
        'continue': "continue",       // keyword for the 'continue' statement.
        'break':    "break",          // keyword for the 'break' statement.
        'if':       "if",             // keyword for the 'if' statement.
        'else':     "else",           // keyword for the 'else' statement.
        'elif':     "elif",           // keyword for the 'elif' statement.

        // built-in consts. make sure these match the values in language/consts (but opposite)
        'true': 'True',
        'false': 'False',
        'null': 'None',
        'NaN': 'NaN',

        // operators
        "not":      "not",
        "in":       "in",
        "or":       "or",
        "and":      "and",
        "is":       "is",
    },
};

module.exports = defs;

