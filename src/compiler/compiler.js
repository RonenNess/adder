"use strict";

/**
* The main class that takes a raw code and compile it into a "bytecode" code ready for the interpreter.
* The output of the compiler is the program AST (abstract syntax tree).
*
* Author: Ronen Ness.
* Since: 2016
*/

// include errors
var Errors = require("./../errors");

// include jsface for classes
var jsface = require("./../dependencies/jsface"),
    Class  = jsface.Class,
    extend = jsface.extend;

// include the lexer
var Lexer = require("./lexer");

// include the parser
var Parser = require("./parser");

// include default flags
var defaultFlags = require("./default_flags");

// include language components
var Language = require("./../language");

// include core stuff
var Core = require("./../core");

// the Compiler class - compile raw code into AST.
var Compiler = Class({

    // Compiler constructor
    // @param flags - compiler flags to set. for more info and defaults, see file default_flags.Js.
    constructor: function(flags)
    {
        // store compiler flags
        this._flags = flags || {};

        // set default flags
        for (var key in defaultFlags)
        {
            if (this._flags[key] === undefined)
            {
                this._flags[key] = defaultFlags[key];
            }
        }

        // how many spaces equal one tab
        this._spacesPerTab = ''
        for (var i = 0; i < this._flags.spacesNeededForBlockIndent; ++i)
        {
            this._spacesPerTab += ' ';
        }

        // create the lexer
        this._lexer = new Lexer(this._flags);
    },

    // compile raw code into blocks of expressions
    // return value is a list of AST expressions and their corresponding line number ([ast, line]).
	// @param code - code to compile. Must be English only and use \n as line breaks, no \r\n.
	// @param flags - different compilation flags:
	//					fixLineBreaks: if true (default), will fix line breaks to be \n without \r.
    compile: function(code, flags)
    {
		// default flags
		flags = flags || {};
		
		// remove illegal characters
		if (flags.fixLineBreaks !== false)
		{
			code = code.trim().replace(/\r\n/g, "\n").replace(/\r/g, "");
		}
		
        // use the lexer to convert to tokens
        var tokens = this._lexer.parseExpression(code);

        // last block indent
        var lastBlockIndent = 0;

        // keep track on line index
        var lineIndex = 1;

        // return ast
        var ret = [];

        // iterate over lines and parse them
        for (var i = 0; i < tokens.length; ++i)
        {
            // if its a block indent change token
            if (tokens[i].t === "_")
            {
                // get current block indent
                var currBlockIndent = tokens[i].v;

                // check if need to create new block
                if (currBlockIndent > lastBlockIndent)
                {
                    for (var k = currBlockIndent; k > lastBlockIndent; --k) {
                        ret.push(["NEW_BLOCK", lineIndex]);
                    }
                }
                // check if need to close current block
                else if (currBlockIndent < lastBlockIndent)
                {
                    for (var k = currBlockIndent; k < lastBlockIndent; ++k) {
                        ret.push(["END_BLOCK", lineIndex]);
                    }
                }

                // store last block indent
                lastBlockIndent = currBlockIndent;
                continue;
            }

            // take chunk of tokens until break
            var j = i;
            var endToken = tokens[i];
            while (endToken && endToken.t !== 'b') {
                endToken = tokens[++j];
            }

            // if its line break (and not ';' for example), increase line index.
            if (endToken && endToken.v === "\n") {
                lineIndex++;
            }

            // get the tokens we handle now
            var currTokens = tokens.slice(i, j);

            // remove breaks from the end of tokens
            while (currTokens[currTokens.length-1] && currTokens[currTokens.length-1].t === "b") {
                currTokens.pop();
            }

            // set i to the end of the tokens we just processed
            i = j;

            // no tokens? skip
            if (currTokens.length === 0) continue;

            // compile current line
            var ast = Parser.parse(currTokens, lineIndex);
            if (ast && ast !== []) {
                ret.push([ast, lineIndex]);
            }
        }

        // return the parsed AST list
        return ret;
    },
});

// export the Compiler class
module.exports = Compiler;

