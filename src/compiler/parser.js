"use strict";

/**
* The parser takes tokens list and convert into a tree of expressions, optimized for evaluation.
* To put it simple: it converts a list of tokens into an AST.
*
* Author: Ronen Ness.
* Since: 2016
*/

// include errors
var Errors = require("./../errors");

// dictionary of symbols that are part of the AST
var symbols = {};

// include general utils
var Utils = require("./../utils");

// require some language defs
var LanguageDefs = require("./../language/defs");

// set of operators that are words
var wordOperators = Utils.toSet(Object.keys(LanguageDefs.keywords));

// global scope that holds the current tokens and position we are parsing.
// these are used internally in all the helper and parsing functions.
var gscope = {
    i: 0,
    tokens: [],
    line: undefined,
};

// function to define a new symbol type
var defineSymbol = function (id, nud, lbp, led) {
    var sym = symbols[id] || {};
    symbols[id] = {
        lbp: sym.lbp || lbp,
        nud: sym.nud || nud,
        led: sym.lef || led
    };
};

// define an infix symbol type
var defineInfix = function (id, lbp, rbp, led) {
    rbp = rbp || lbp;
    defineSymbol(id, null, lbp, led || function (left) {
        return {
            type: id,
            left: left,
            right: parseExpression(rbp)
        };
    });
};

// define a prefix symbol type
var definePrefix = function (id, rbp) {
    defineSymbol(id, function () {
        return {
            type: id,
            right: parseExpression(rbp)
        };
    });
};

// define comma and colon symbols
defineSymbol(",");
defineSymbol("blockopen", function (val) {
    return val;
});

// define number symbol
defineSymbol("number", function (number) {
    return number;
});

// define string symbol
defineSymbol("string", function (str) {
    return str;
});

// define identifier symbol
defineSymbol("identifier", function (name) {
    var token = currToken();
    if (token && token.type === "(" && !wordOperators.has(name.value)) {
        var args = [];
        if (gscope.tokens[gscope.i + 1].v === ")") {popToken();}
        else {
            do {
                popToken();
                if (!currToken()) {
                    throw new Errors.SyntaxError("Missing closing parenthesis ')'");
                }
                args.push(parseExpression(2));
            } while (currToken() && currToken().type === ",");
            if (!currToken() || currToken().type !== ")") {
                throw new Errors.SyntaxError("Missing closing parenthesis ')'");
            }
        }
        popToken();
        return {
            type: "call",
            args: args,
            name: name.value
        };
    }
    return name;
});

// define the '(' symbol
defineSymbol("(", function () {
    var value = parseExpression(2);
    if (currToken().type !== ")") new Errors.SyntaxError("Missing closing parenthesis!");
    popToken();
    return value;
});

// define the ')' symbol
defineSymbol(")");

definePrefix("-", 10);
definePrefix("+", 10);
definePrefix("not", 3);
definePrefix("for", 10);
defineInfix("*", 7);
defineInfix("**", 9, 8);
defineInfix("/", 7);
defineInfix("+", 6);
defineInfix("-", 6);
defineInfix("%", 7);
defineInfix("|", 4, 4);
defineInfix("&", 5, 5);
defineInfix("or", 3);
defineInfix("and", 3);
defineInfix("in", 4);
defineInfix("not in", 4);
defineInfix("is", 4);
defineInfix("is not", 4);
defineInfix("==", 4);
defineInfix("!=", 4);
defineInfix(">=", 4);
defineInfix("<=", 4);
defineInfix("<", 4);
defineInfix(">", 4);
defineInfix(".", 13);

// assignment operator
defineInfix("=", 1, 2, function (left) {
    if (left.type === "call") {
        for (var i = 0; i < left.args.length; i++) {
            if (left.args[i].type !== "identifier") throw new Errors.SyntaxError("Invalid argument name '" + left.args[i].value + "'!");
        }
        return {
            type: "function",
            name: left.name,
            args: left.args,
            value: parseExpression(2)
        };
    } else if (left.type === "identifier") {
        return {
            type: "assign",
            name: left.value,
            value: parseExpression(2)
        };
    }
    else throw new Errors.SyntaxError("Can't assign to literal!");
});

// add all assignment+ operators
var assignmentWith = ["+", "-", "*", "/", "|", "&", "%"];
for (var i = 0; i < assignmentWith.length; ++i)
{
    (function(operator){
        defineInfix(operator + "=", 1, 2, function (left) {
            if (left.type === "call") {
                for (var i = 0; i < left.args.length; i++) {
                    if (left.args[i].type !== "identifier") throw new Errors.SyntaxError("Invalid argument name '" + left.args[i].value + "'!");
                }
                return {
                    type: "function",
                    name: left.name,
                    args: left.args,
                    value: parseExpression(2)
                };
            } else if (left.type === "identifier") {
                return {
                    type: "assign+",
                    op: operator,
                    name: left.value,
                    value: parseExpression(2)
                };
            }
            else throw new Errors.SyntaxError("Can't assign to literal!");
        });
    })(assignmentWith[i]);
}

// convert a token to a symbol instance
var tokenToSymbol = function (token) {

    // convert from token types to symbol types
    var type;
    switch (token.t)
    {
        case 'o':
        case 'p':
            if (token.v === ':') {type = 'blockopen';}
            else {type = token.v;}
            break;

        case 'n':
            type = 'number';
            break;

        case 'v':
            type = 'identifier';
            break;

        case 's':
            type = 'string';
            break;

        default:
            throw new Errors.SyntaxError("Unknown token type '" + token.t + "'!");
    }

    // create symbol and set its type and value
    var sym = Object.create(symbols[type]);
    sym.type = type;
    sym.value = token.v;

    // return the newly created symbol
    return sym;
};

// start the actual parsing!

// function to get current token
var currToken = function () {
    return gscope.tokens[gscope.i] ? tokenToSymbol(gscope.tokens[gscope.i]) : null;
};

// function to get current token and advance index to next token
var popToken = function () {
    var ret = currToken();
    gscope.i++;
    return ret;
};

// parse an expression
var parseExpression = function (rbp) {

    // default rbp
    if (rbp === undefined) {rbp = 0;}

    // get current token and advance to next
    var t = popToken();
    if (t === null) {return;}

    // if current token is nud type
    if (!t.nud) {throw new Errors.SyntaxError("Unexpected token: " + t.type);}

    // get left operand
    var left = t.nud(t);

    // parse next gscope.tokens
    while (currToken() && rbp < currToken().lbp) {
        t = popToken();
        if (!t.led) {throw new Errors.SyntaxError("Unexpected token: " + t.type);}
        left = t.led(left);
    }

    // return left operand
    return left;
};

// take a list of tokens and generate a parsed tree
// @param tokens - list of tokens, output of lexer.
// @param line - is the line we are parsing (optional, used for exceptions etc)
function parse(tokens, line)
{
    // set global scope of current parsing - current tokens and index
    gscope.tokens = tokens;
    gscope.i = 0;
    gscope.line = line;

    try {
        // parse all tokens and return AST
        var parseTree = [];
        while (currToken()) {
            parseTree.push(parseExpression());
        }
        return parseTree;
    }
    catch(e) {
        if (e.expectedError) {
            if (e.line === undefined) {
                e.message += " [at line: " + gscope.line + "]";
                e.line = gscope.line;
            }
            throw e;
        }
        throw new Errors.SyntaxError("Unknown syntax error!", gscope.line);
    }
}

// export the parser functions
module.exports = {
    parse: parse,
};

