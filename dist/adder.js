(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.AdderScript = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
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

// all token types
var TokenTypes = require("./tokens");

// include default flags
var defaultFlags = require("./default_flags");

// include errors
var Errors = require("./../errors");

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
        this._spacesPerTab = ' '.repeat(this._flags.spacesNeededForBlockIndent);

        // create the lexer
        this._lexer = new Lexer(this._flags);
    },

    // compile raw code into blocks of expressions
    // return value is a list of AST expressions and their corresponding line number ([ast, line]).
	// @param code - code to compile. Must be English only and use \n as line breaks, no \r\n.
	// @param flags - misc compilation flags:
    //					fixLineBreaks: if true (default), will fix line breaks to be \n without \r.
    compile: function(code, flags)
    {
		// default flags
		flags = flags || {};
        
        // trim code (right side trim only)
        code = code.replace(/\s+$/, '');
        
		// remove illegal line breaks
		if (flags.fixLineBreaks || flags.fixLineBreaks === undefined) {
			code = code.replace(/\r\n/g, "\n").replace(/\r/g, "");
        }
        
        // make sure there's no \r in code
        if (code.indexOf('\r') !== -1) {
            throw new Errors.SyntaxError("Illegal character found in code: '\\r'! Please use '\\n' only for line breaks.", 0);
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
            if (tokens[i].t === TokenTypes.cblock)
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
            while (endToken && endToken.t !== TokenTypes.lbreak) {
                endToken = tokens[++j];
            }

            // if its line break (and not ';' for example), increase line index.
            if (endToken && endToken.v === "\n") {
                lineIndex++;
            }

            // get the tokens we handle now
            var currTokens = tokens.slice(i, j);

            // remove breaks from the end of tokens
            while (currTokens[currTokens.length-1] && currTokens[currTokens.length-1].t === TokenTypes.lbreak) {
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


},{"./../dependencies/jsface":24,"./../errors":28,"./default_flags":2,"./lexer":4,"./parser":5,"./tokens":6}],2:[function(require,module,exports){
"use strict";

module.exports = {
    spacesNeededForBlockIndent: 4,      // how many spaces are needed to open a new scope / block.
};

},{}],3:[function(require,module,exports){
module.exports = require("./compiler");
},{"./compiler":1}],4:[function(require,module,exports){
"use strict";

/**
* The lexer takes a code string and convert it to a list of tokens.
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

// include console
var Console = require("./../console");

// all arithmetic operators
// note: its important to put the double operators (==, **, ..) before their singles version. sometimes we iterate and try to match first)
var signOperators = ["+=", "-=", "*=", "/=", "|=", "&=", "%=", "**", "==", "!=", ">=", "<=", ">", "<", "+", "-", "*", "/", "|", "&", "%", "=", "."];
var wordsOperators = ["not in", "is not", "not", "in", "or", "and", "is"];
var operators = signOperators.concat(wordsOperators);

// get default flags
var defaultFlags = require("./default_flags");

// comment sign
var commentPrefix = '#';

// get utils
var Utils = require("./../utils");

// all token types
var TokenTypes = require("./tokens");

// values that break between words
// note: undefined is to identify out-of-string-range.
var breakingSigns = [' ', '(', ')', '[',  ']', undefined, ',', ':', ';', '\n', '\\'];
breakingSigns = breakingSigns.concat(operators);
breakingSigns = Utils.toSet(breakingSigns);

// the Lexer class - convert code into tokens.
var Lexer = Class({

    // static stuff
    $static: {
        wordsOperators: wordsOperators,
        operators: operators,
    },

    // Lexer constructor
    constructor: function(flags)
    {
        // store flags
        this._flags = flags || defaultFlags;
    },

    // create a token instance
    /*
        token types:
        "p"   // punctuation: commas, etc.
        "n"   // numbers.
        "s"   // strings.
        "v"   // identifiers / variables / keywords.
        "o"   // operators.
        "b"   // line / command break.
        "_"   // change in block index
    */
    makeToken: function(type, val)
    {
        return {t: type, v: val};
    },

    // return if a character is a breaker, eg something that separate words etc
    isBreaker: function(expression, pos)
    {
        // first check comment
        if (this.isComment(expression, pos)) {return true;}

        // get character at position
        var c = expression[pos];

        // check if space, undefined (means end of string) or operator
        return breakingSigns.has(c);
    },

    // return if a character is a digit
    isNumber: function(c)
    {
        return (c >= '0' && c <= '9');
    },

    // return if opening string
    isOpeningString: function(c)
    {
        return c === '"' || c === "'";
    },

    // return if a character is a punctuation
    isPunc: function(c)
    {
        return c === "," || c === ":";
    },

    // return if a comment
    isComment: function(expression, start)
    {
        return expression[start] === commentPrefix;
    },

    // read a whole number from starting pos until the end of the number
    // return [number, last_index]
    readNumber: function(expression, start)
    {
        // iterate until space
        var pos = start;
        var alreadyGotDot = false;
        while (expression[pos] === '.' || !this.isBreaker(expression, pos))
        {
            // get current char
            var c = expression[pos];

            // check if current char is a dot
            var isDot = c === '.';

            // if we got non-digit (it means something like this: "4d41") its illegal expression.
            if (!this.isNumber(c) && !isDot) {
                throw new Errors.IllegalExpression(expression, "Invalid syntax (non-digits inside a number)", this.lineIndex);
            }

            // if its a dot:
            if (isDot)
            {
                // if already got dot in this expression its syntax error
                if (alreadyGotDot) {
                    throw new Errors.IllegalExpression(expression, "Invalid syntax (multiple decimal marks in float)", this.lineIndex);
                }

                // set that already got dot
                alreadyGotDot = true;
            }

            // take next character
            pos++;
        }

        // return the number
        return [expression.substr(start, pos-start), pos-1];
    },

    // read the whole operator from string pos
    // return [operator, last_index]
    readOperator: function(expression, start)
    {
        // get current part that might contain the operator
        var currSeg = expression.substr(start, 10);

        // first check word operators
        for (var i = 0; i < wordsOperators.length; ++i) {

            // get current word operator
            var currOp = wordsOperators[i];

            // check if match and if so return
            if (currSeg.indexOf(currOp + " ") === 0) {
                return [currOp, start + currOp.length - 1];
            }
        }

        // now iterate over sign operators
        for (var i = 0; i < signOperators.length; ++i)
        {
            // get curr operator
            var curr = signOperators[i];

            // check if operator match
            if (currSeg.substr(0, curr.length) === curr) {
                return [curr, start + curr.length - 1];
            }
        }

        // if operator not found return null
        return null;
    },

    // read the whole string from string pos
    // return [string, last_index]
    readString: function(expression, start)
    {
        // check if our quote sign is ' or "
        var quote = expression[start] === '"' ? '"' : "'";

        // loop until finding the closing quotes (quotes without \ before them)
        var i = start;
        var lastC; var c;
        while (c = expression[++i])
        {
            lastC = c;
            if (c === quote && lastC !== '\\') break;
        }

        // didn't find closing quotes?
        if (c === undefined) {
            throw new Errors.IllegalExpression(expression, "EOL while scanning string literal.", this.lineIndex);
        }

        // parse the string inside
        var val = expression.substr(start, i-start+1);
        return [val, i];
    },

    // read the whole punctuation from string pos
    // return [punctuation, last_index]
    readPunctuation: function(expression, start)
    {
        return [expression[start], start];
    },

    // read a comment until the end
    // unlike the other 'read' functions, this won't return the actual comment, just the ending position
    readComment: function(expression, start) {

        // iterate until end of string or until line break
        var pos = start;
        while (expression[pos] !== undefined && expression[pos] !== "\n") {
            pos++;
        }

        // return new position
        return ["", pos];
    },

    // read a word from string pos
    // return [word, last_index]
    readWord: function(expression, start)
    {
        // read characters until complete current word
        var pos = start;
        while (!this.isBreaker(expression, pos))
        {
            pos++;
        }

        // get whole word
        var word = expression.substr(start, pos-start);

        // return word and position
        // take one char back so we won't skip the breaking character
        return [word, pos-1];
    },

    // convert string expression into list of tokens.
    parseExpression: function(expression) {

        // return list
        var ret = [];

        // current and last character parsed
        var lastC; var c;

        // count lines
        this.lineIndex = 1;

        // if true we need to skip next line break
        var skipNextLineBreak = false;

        // last block indent
        var lastBlockIndent = 0;

        // was last character a line break?
        var wasLineBreak = false;

        // indicating that last token was an inline block
        var inlineBlocks = 0;

        // count spaces we had in a row after line break
        var spacesInRow = 0;

        // iterate over all characters of expression
        for (var i = 0; i < expression.length; ++i)
        {
            // skip white spaces
            if (expression[i] === ' ') {
                if (wasLineBreak) spacesInRow++;
                continue;
            }
            if (expression[i] === '\t') {
                if (wasLineBreak) spacesInRow += this._flags.spacesNeededForBlockIndent;
                continue;
            }

            // if we got spaces after line break, calc block indent
            if (wasLineBreak) {

                // if this is break after inline block
                if (inlineBlocks > 0)
                {
                    lastBlockIndent -= inlineBlocks;
                    ret.push(this.makeToken(TokenTypes.cblock, lastBlockIndent));
                    inlineBlocks = 0;
                }
                // if its a regular block and line break wasn't ';'
                else if (lastC !== ';')
                {
                    // get spaces needed for block indent
                    var spacesForIndent = this._flags.spacesNeededForBlockIndent;

                    // make sure current character is not line break, so we won't change blocks / validate indent for empty lines
                    if (expression[i] !== '\n')
                    {
                        // check if spaces are not multiply indent spaces, but only if last token wasn't ';' (inline break)
                        if ((spacesInRow % spacesForIndent) !== 0) {
                            throw new Errors.SyntaxError("Bad block indent (spaces not multiply of " +
                                                        this._flags.spacesNeededForBlockIndent + ")", this.lineIndex);
                        }

                        // calc current block indent and add block change token
                        var blockIndent = spacesInRow / spacesForIndent;
                        if (blockIndent !== lastBlockIndent) 
                        {
                                ret.push(this.makeToken(TokenTypes.cblock, blockIndent));
                                lastBlockIndent = blockIndent;
                        }
                    }
                }

                // zero spaces count
                spacesInRow = 0;
            }

            // if its a comment - read it
            if (this.isComment(expression, i))
            {
                // read comment
                var tokenData = this.readComment(expression, i);
                i = tokenData[1];

                // add line break after the comment
                // but only if didn't reach the end
                if (expression[i])
                {
                    this.lineIndex++;
                    wasLineBreak = true;
                    ret.push(this.makeToken(TokenTypes.lbreak, '\n'));
                }

                // continue to next character
                continue;
            }

            // store last character and get current character
            lastC = c;
            var c = expression[i];

            // special case - command break
            if (c === ';' || c === '\n') {

                // increase line count
                this.lineIndex++;

                // if should skip line break skip it
                if (skipNextLineBreak) {
                    skipNextLineBreak = false;
                    continue;
                }

                // do line break
                lastC = c;
                wasLineBreak = true;
                ret.push(this.makeToken(TokenTypes.lbreak, c));
                continue;
            }
            // special case 2 - anti-line break, eg character that combine lines together
            else if (c === '\\') {
                if (expression[i+1] !== '\n') {
                    throw new Errors.SyntaxError("Invalid character after \\ sign.", this.lineIndex);
                }
                skipNextLineBreak = true;
                continue;
            }

            // special case - if last character was ':', but we didn't get a new line, it means its an inline block
            if (lastC === ":") {

                // add break + open block
                ret.push(this.makeToken(TokenTypes.lbreak, ";"));
                lastBlockIndent++;
                ret.push(this.makeToken(TokenTypes.cblock, lastBlockIndent));
                inlineBlocks++;
            }

            // not a line break
            wasLineBreak = false;

            // if we got an parenthesis parse it
            if (c === "(" || c === ")")
            {
                // add to tokens list
                ret.push(this.makeToken('o', c));
                continue;
            }

            // if punctuation
            if (this.isPunc(c))
            {
                // read punctuation
                var tokenData = this.readPunctuation(expression, i);
                var token = tokenData[0]; i = tokenData[1];

                // add punctuation to tokens list
                ret.push(this.makeToken(TokenTypes.punctuation, token));
                continue;
            }

            // if a number
            if (this.isNumber(c))
            {
                // read punctuation
                var tokenData = this.readNumber(expression, i);
                var token = tokenData[0]; i = tokenData[1];

                // add punctuation to tokens list
                ret.push(this.makeToken(TokenTypes.number, token));
                continue;
            }

            // try to read an operator
            // with operators its a little different - we just try to read it and return null if not found
            var tokenData = this.readOperator(expression, i);
            if (tokenData)
            {
                // get token and new index
                var token = tokenData[0]; i = tokenData[1];

                // add operator to tokens list
                ret.push(this.makeToken(TokenTypes.operator, token));
                continue;
            }

            // if got string read it all until its closed
            if (this.isOpeningString(c))
            {
                // read operator
                var tokenData = this.readString(expression, i);
                var token = tokenData[0]; i = tokenData[1];

                // add operator to tokens list
                ret.push(this.makeToken(TokenTypes.string, token));
                continue;
            }

            // if got here it means its a keyword, var-name, statement, etc..
            // read word and add it
            var tokenData = this.readWord(expression, i);
            var token = tokenData[0]; i = tokenData[1];

            // illegal token?
            if (token === "") {
                throw new Errors.IllegalExpression(expression, "Invalid or unexpected token '" + c + "'!", this.lineIndex);
            }

            // add operator to tokens list
            ret.push(this.makeToken(TokenTypes.identifier, token));

        }

        // return parsed expression
        Console.debug("Lexer parsed", ret);
        return ret;
    },
});

// export the Lexer class
module.exports = Lexer;
},{"./../console":7,"./../dependencies/jsface":24,"./../errors":28,"./../utils":79,"./default_flags":2,"./tokens":6}],5:[function(require,module,exports){
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

// get all token types
var TokenTypes = require("./tokens");

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
        case TokenTypes.operator:
        case TokenTypes.punctuation:
            if (token.v === ':') {type = 'blockopen';}
            else {type = token.v;}
            break;

        case TokenTypes.number:
            type = 'number';
            break;

        case TokenTypes.identifier:
            type = 'identifier';
            break;

        case TokenTypes.string:
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


},{"./../errors":28,"./../language/defs":34,"./../utils":79,"./tokens":6}],6:[function(require,module,exports){
module.exports = {
    punctuation: 'p',       // punctuation: commas, etc.
    number: 'n',            // numbers.
    string: 's',            // strings.
    identifier: 'v',        // identifiers / variables / keywords.
    operator: 'o',          // operators.
    lbreak: 'b',            // line / command break.
    cblock: '_',            // change in block index
}
},{}],7:[function(require,module,exports){
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
},{}],8:[function(require,module,exports){
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

},{"./../dependencies/jsface":24,"./../errors":28,"./executable":12}],9:[function(require,module,exports){
"use strict";

/**
* A builtin function that link between JavaScript code and a function accessible in the script execution.
* Note: this is not the same as a function that the user script define in runtime. The built-in functions are pre-defined and
* hard coded and are part of the language itself.
*
* With these we implement the most basic things like print, max, min, etc.. all the language built-ins.
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

// include variable class
var Variable = require("./variable");

// include utils
var Utils = require("./../utils");

// BuiltinFunction class
// NOTE! when the function is executed, 'this' will always be the containing object.
var BuiltinFunction = Class({

    // built-in function constructor
    constructor: function()
    {
    },

    // the actual function implementation.
    // @param args - list of arguments (evaluated values).
    __imp: function(args)
    {
        throw Errors.NotImplemented();
    },

    // execute this statement.
    // @param args - list of arguments (evaluated values) to send to the function.
    execute: function(args, obj)
    {
        // call function
        try {
            return this.__imp.apply(obj, args);
        }
        // catch errors
        catch (e)
        {
            if (e.expectedError){
                throw e;
            }
            throw new Errors.InternalError("Exception in built-in function!", e);
        }
    },

    // functions are built-in Adder objects
    __isAdderObject: true,

    // this must always be true (used internally)
    isFunction: true,

    // indicate that this object is  abuilt-in function
    isBuiltinFunc: true,

    // indicate that this function is deterministic (eg for func(x) result will always be 'y').
    deterministic: true,

    // how many args are required for this function
    // note: set to null for any number of args
    requiredArgs: 0,

    // number of optional params
    optionalArgs: 0,

    // convert to string
    toString: function() {
        return '<' + this.identifier + '>';
    },

    // convert to repr
    toRepr: function() {
        return this.toString();
    },

    // static stuff
    $static: {

        // create a new built-in function type from a plain function.
        // @param func - function that implements the built-in function logic (get list of variables as arguments).
        // @param mandatoryParams - integer, how many params must be provided to this function (null for any number of params).
        // @param optionalParams - integer, how many additional optional params can be provided to this function.
        // @param deterministic - indicate if this function is deterministic (default to true).
        create: function(func, mandatoryParams, optionalParams, deterministic) {

            // create and return the builtin function prototype
            var type = Class(BuiltinFunction, {
                __imp: func,
                requiredArgs: mandatoryParams || null,
                optionalArgs: optionalParams || null,
                deterministic: deterministic === undefined ? true : deterministic,
            });
            return new type();
        },

        // if got only one argument and its a list or a set, return the list internal array.
        // else, just return arguments
        getArgumentsOrListContent: function(context, args) {

            // if we got only one argument..
            if (args.length === 1) {

                // if its a list:
                if (args[0].type === "list") {
                    return args[0]._value._list;
                }
                // else if its a set:
                else if (args[0].type === "set") {
                    var ret = Utils.toArray(args[0]._value._set);
                    return Variable.makeVariables(context, ret);
                }
            }

            // if not list / set one arg, return the arguments we got
            return args;
        },
    },
});

// export the Executable class
module.exports = BuiltinFunction;


},{"./../dependencies/jsface":24,"./../errors":28,"./../utils":79,"./variable":22}],10:[function(require,module,exports){
"use strict";

/**
* A global object persistent to the execution of a program, that contains stuff like pointer to the current interpreter, the code,
* the global scope, sub scopes, etc.
*
* The context is one of the main internal objects / APIs that statements and expressions use inside.
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

// include scopes
var Scope = require("./scope");

// require utils
var Utils = require("./../utils");

// require variable type
var Variable = require("./variable");

// Context class
var Context = Class({

    // context constructor.
    // @param interpreter - interpreter instance.
    // @param stackLimit - max stack depth (cause stack overflow if exceed this limit).
    // @param maxVarsInScope - maximum number of vars allowed per scope.
    constructor: function(interpreter, stackLimit, maxVarsInScope)
    {
        // set interpreter
        this._interpreter = interpreter;

        // create globals
        this._globals = new Scope(this, 0, null, maxVarsInScope);
        this._currScope = this._globals;

        // set flags
        this._stackLimit = stackLimit;
        this._maxVarsPerScope = maxVarsInScope;

        // readonly variables
        this._readonly = new Set();

        // create stack
        this._stack = [];

        // push default root stack
        this.stackPush();
    },

    // return the type of the current scope
    getCurrBlockType: function() {
        return this._currScope._type;
    },

    // clear the context stack until global (will end of at global scope)
    clearStack: function() {
        while (this._stack.length > 1) {
            this.stackPop();
        }
    },

    // reset context (clear stack and remove all user defined global vars)
    reset: function() {

        // clear stack
        this.clearStack();

        // remove all user variables
        for (var key in this._globals._vars) {
            if (!this._readonly.has(key)) {
                this._globals.remove(key);
            }
        }
    },

    // add to stack
    // @param type is the type of current scope - "function", "loop", ...
    stackPush: function(type) {

        // get scope
        var scope = this._stack.length === 0 ?
                        this._globals : new Scope(this, this._stack.length, type, this._maxVarsPerScope);

        // create new stack entry
        this._stack.push({
            scope: scope,                       // the scope itself
            breakAccess: type === "function",   // does this scope break access to variables from previous scope?
        });

        // check stack size
        if (this._stack.length > this._stackLimit)
        {
            throw new Errors.StackOverflow(this._stackLimit);
        }

        // set new current scope
        this._currScope = this._stack[this._stack.length - 1].scope;
    },

    // pop from stack
    stackPop: function() {

        // get current scope and parent scope as default globals
        var thisScope = this._currScope;
        var parentScope = this._globals;

        // if its not first stack and current scope is not breaking
        if (this._stack.length > 1 &&
            !this._stack[this._stack.length - 1].breakAccess) {

            // get this stack and previous stack
            parentScope = this._stack[this._stack.length - 2].scope;

            // iterate current scope vars and copy to upper scope
            for (var key in thisScope._vars) {
                parentScope.setVar(key, thisScope._vars[key]);
            }
        }

        // set return value for global scope
        parentScope.returnValue = thisScope.returnValue;

        // if variable existed in global scope, update it too
        for (var key in thisScope._vars) {
            if (this._globals._vars[key] !== undefined) {
                this._globals.setVar(key, thisScope._vars[key]);
            }
        }

        // pop stack
        this._stack.pop();

        // if stack is empty (should never happen) raise exception
        if (this._stack.length === 0)
        {
            throw new Errors.RuntimeError("Invalid return statements at global block!");
        }

        // set new current scope
        this._currScope = this._stack[this._stack.length - 1].scope;
    },

    // remove variable
    remove: function(varName) {

        // make sure not readonly
        if (this._readonly.has(varName)) {
            throw new Errors.RuntimeError("Cannot delete readonly variable '" + varName + "'!");
        }

        // first get all relevant scopes
        var scopes = this._getSharedScopes();

        // now remove var from all scopes
        for (var i = 0; i < scopes.length; ++i) {
            scopes[i].remove(varName);
        }
    },

    // return a list with all scopes that share the following variables (eg non-breaking scopes) + the global scope
    _getSharedScopes: function() {

        // the list of scopes to return, starting with current scope
        var ret = [this.getScope()];

        // iterate from one scope above current until global (not including global)
        for (var i = this._stack.length - 2; i > 0; --i)
        {
            // add current scope
            var curr = this._stack[i];
            ret.push(curr.scope);

            // note: we need to break AFTER access break, not before, as the scope of a new function has access break
            if (curr.breakAccess) {
                break;
            }
        }


        // add global and return
        if (this._stack.length > 0) {ret.push(this._globals);}
        return ret;
    },

    // return local scope
    getScope: function() {

        return this._currScope;
    },

    // get variable either from local or global scope.
    // @param key - variable name / key.
    // @param object - object to get variable from (if undefined will get from current scope).
    getVar: function(key, object) {

        // first, if we got an object to fetch variable from, use that object
        if (object !== undefined) {

            // this is important so if for example we have a function that return a list we can use it like this:
            // foo().someListFind(x)...
            if (!object.__isAdderObject) {
                object = Variable.makeAdderObjects(this, object);
                if (!object.isSimple) {
                    object = object._value;
                }
            }

            // if got object to get from
            // try to get variable from object's api, and assert if not found
            var resultObj = object && object.api ? object.api[key] : undefined;
            if (resultObj === undefined) {
                throw new Errors.RuntimeError("Object '" + (object.name || object.type || object.identifier || typeof object) +
                                                "' has no attribute '" + key + "'.");
            }

            // return variable
            return resultObj;
        }

        // if we got here it means its not from an object, we need to search for the variable in scopes.
        // climb up from current scope until breaking and try to get the variable (not including index 0 which is global)
        var val;
        for (var i = this._stack.length-1; ((i > 0) && (val === undefined)); --i) {

            // try to get var from current scope
            val = this._stack[i].scope.getVar(key, object);

            // if this scope breaks access stop here
            if (this._stack[i].breakAccess) {
                break;
            }
        }

        // still not found? try global scope
        if (val === undefined) {
            val = this._globals.getVar(key, object);
        }

        // raise undefined var exception
        if (val === undefined) {
            throw new Errors.UndefinedVariable(key);
        }

        // return value
        return val;
    },

    // return if a variable name exists.
    // @param key - variable name / key.
    // @param object - object to get variable from (if undefined will get from current scope).
    exist: function(key, object) {

        // first try local scope
        var val = this.getScope().getVar(key, object);

        // not defined? try global scope
        if (val === undefined) {
            val = this._globals.getVar(key, object);
        }

        // return if exist
        return val !== undefined;
    },

    // set variable in current scope.
    // @param key - variable name / key.
    // @param val - value to set, must be of 'variable' type.
    // @param readonly - if true, cannot override this variable / object.
    // @param force - if true, will override variable even if exist and readonly.
    setVar: function(key, val, readonly, force) {

        // readonly vars can only be set at global scope
        if (readonly && this._stack.length > 1) {
            throw new Errors.RuntimeError("Cannot set readonly variable outside global scope. Variable key: '" + key + "'.");
        }

        // make sure its not readonly in global scope
        if (this._readonly.has(key) && !force) {
            throw new Errors.RuntimeError("Trying to override readonly variable or reserved word: '" + key + "'.");
        }

        // set readonly
        if (readonly) {
            this._readonly.add(key);
        }

        // set variable
        return this.getScope().setVar(key, val, readonly, force);
    },

    // create a variable in this context
    createVariable: function(val, forceNew) {
        return Variable.makeVariables(this, val, forceNew);
    },

    // return a list with all identifiers in current scope, including global scope
    getAllIdentifiers: function() {

        // get all scopes that share variables with current scope including global
        var scopes = this._getSharedScopes();

        // create empty list for all identifiers
        var ret = [];

        // iterate over scopes and get identifiers
        for (var i = 0; i < scopes.length; ++i) {
            ret = ret.concat(scopes[i].getAllIdentifiers());
        }

        // make unique by converting to a set and back into an array
        ret = Utils.toArray(Utils.toSet(ret));

        // return final list
        return ret;
    },
});

// export the Context class
module.exports = Context;


},{"./../dependencies/jsface":24,"./../errors":28,"./../utils":79,"./scope":18,"./variable":22}],11:[function(require,module,exports){
"use strict";

/**
* A built-in dictionary object.
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

// include variable
var Variable = require("./variable");

// builtin function
var BuiltinFunc = require("./builtin_func");

// require misc utils
var Utils = require("./../utils");

// include basic object type
var _Object = require("./object");

// get list object
var List = require('./list');

// make sure dictionary length is valid
function validate_len(dict) {
    if (Object.keys(dict._dict).length > dict._context._interpreter._flags.maxContainersLen) {
        throw new Errors.ExceedMemoryLimit("Dictionary exceeded maximum container length (" + dict._context._interpreter._flags.maxContainersLen + ")");
    }
}

// all the api functions of the set
// remember - everything in a set is stored as native js and not as Variable object
var apiFuncs = {

    // clone the set
    clone: function()
    {
        // create the dictionary to return
        var ret = new Dict(this._context);

        // add all values
        for (var key in this._dict) {
            ret.set(Variable.makeVariables(this._context, key), this._dict[key]);
        }

        // return the new dictionary
        return ret;
    },

    // return a list of keys
    keys: function()
    {
        return new List(this._context, Object.keys(this._dict));
    },

    // return a list of values
    values: function()
    {
        var ret = [];
        for (var key in this._dict) {
            ret.push(this._dict[key]);
        }
        return ret;
    },

    // return how many keys in dictionary
    len: function()
    {
        return Object.keys(this._dict).length;
    },

    // return if dictionary is empty
    empty: function()
    {
        return this.len() === 0;
    },

    // set value
    set: function(key, value)
    {
        // validate key type
        if (!key.isSimple) {
            throw new Errors.RuntimeError("Invalid key type '" + key.type + "'. Dictionary keys can only be strings, numbers, booleans or none.");
        }
        // add to dictionary
        this._dict[key._value] = value;
        validate_len(this);

        // update memory usage
        this._context._interpreter.updateMemoryUsage(value._estimatedSize + key.length);
    },

    // get value
    get: function(key, defaultVal)
    {
        return this._dict[key._value] || defaultVal;
    },

    // remove value from dictionary
    remove: function(key)
    {
        delete this._dict[key._value];
    },

    // clear the dictionary
    clear: function()
    {
        this._dict = {};
    },

    // return true if value exists in the dictionary
    has: function(key)
    {
        return this._dict[key._value] !== undefined;
    },

    // extend set with another dictionary
    extend: function(other)
    {
        // make sure got a dict to extend
        if (other.type !== "dict") {
            throw new Errors.RuntimeError("Dict 'extend()' expecting another dictionary as param ('" + other.type + "' given).");
        }

        // extend the dictionary
        other = other._value;
        for (var key in other._dict) {
            this._dict[key] = other._dict[key];
        }
    },
}

// Dictionary class
var Dict = Class(_Object, {

    // Object constructor
    // @param context - context of program currently executed.
    // @param startingDict - optional dictionary to put as starting data
    constructor: function(context, startingDict)
    {
        // call parent constructor
        Dict.$super.call(this, context);

        // create the dictionary
        this._dict = startingDict || {}
    },

    // iterate over object components
    forEach: function(callback, obj) {
        for (var key in this._dict) {
            if (callback.call(obj, key) === false) {
                return;
            }
        }
    },

    // dictionary api
    api: {
        clone: BuiltinFunc.create(apiFuncs.clone, 0, 0, false),
        keys: BuiltinFunc.create(apiFuncs.keys, 0, 0, false),
        values: BuiltinFunc.create(apiFuncs.values, 0, 0, false),
        len: BuiltinFunc.create(apiFuncs.len, 0, 0, false),
        _set: BuiltinFunc.create(apiFuncs.set, 2, 0, false),
        _get: BuiltinFunc.create(apiFuncs.get, 1, 1, false),
        remove: BuiltinFunc.create(apiFuncs.remove, 1, 0, false),
        clear: BuiltinFunc.create(apiFuncs.clear, 0, 0, false),
        empty: BuiltinFunc.create(apiFuncs.empty, 0, 0, false),
        has: BuiltinFunc.create(apiFuncs.has, 1, 0, false),
        extend: BuiltinFunc.create(apiFuncs.extend, 1, 0, false),
    },

    // convert to string
    toString: function()
    {
        var ret = []
        for (var key in this._dict) {
            ret.push('"' + key + '": ' + this._dict[key].toString());
        }
        return ret.join(",");
    },

    // convert to repr
    toRepr: function()
    {
        return "dict(" + this.toString() + ")";
    },

    // convert to a native javascript object
    toNativeJs: function()
    {
        var ret = {};
        for (var key in this._dict) {
            ret[key] = this._dict[key].toNativeJs();
        }
        return ret;
    },

    // object identifier
    name: "dict",

    // object type
    type: "dict",
});

// init set builtint api
_Object.initBuiltinApi(Dict);

// export the Dict class
module.exports = Dict;

},{"./../dependencies/jsface":24,"./../errors":28,"./../utils":79,"./builtin_func":9,"./list":15,"./object":17,"./variable":22}],12:[function(require,module,exports){
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


},{"./../dependencies/jsface":24}],13:[function(require,module,exports){
"use strict";

/**
* A single value, function call, or an arithmetic expression that can be evaluated.
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

// get variable instance
var Variable = require("./variable");

// get parse utils
var Lexer = require("./../compiler/lexer");

// set node optimized value
function setNodeOptimizedVal(node, val) {
    node.type = typeof val;
    node.value = val;
    node.wasOptimized = true;
    delete node.left;
    delete node.right;
}

// dictionary of operators and the corresponding function to execute them
var opFuncs = {
    "*": function(exp,a,b) {return a*b;},
    "/": function(exp,a,b) {return a/b;},
    "+": function(exp,a,b) {return b === undefined ? +a : a+b;},
    "-": function(exp,a,b) {return b === undefined ? -a : a-b;},
    "|": function(exp,a,b) {return a|b;},
    "&": function(exp,a,b) {return a&b;},
    "%": function(exp,a,b) {return a%b;},
    "or": function(exp,a,b) {return a||b;},
    "and": function(exp,a,b) {return a&&b;},
    "in": function(exp,a,b) {
        a = Variable.makeVariables(exp._context,a);
        b = Variable.makeAdderObjects(exp._context,b);
        if (!b.has) {
            throw new Errors.RuntimeError(exp._context, "Object " + (b.type || "undefined") + " does not support 'in' operator!");
        }
        return b.has(a);
    },
    "not in": function(exp,a,b) {
        a = Variable.makeVariables(exp._context,a);
        b = Variable.makeAdderObjects(exp._context,b);
        if (!b.has) {
            throw new Errors.RuntimeError(exp._context, "Object " + (b.type || "undefined") + " does not support 'in' operator!");
        }
        return !b.has(a);
    },
    "not": function(exp,a) {return !a;},
    "**": function(exp,a,b) {return Math.pow(a,b);},
    "<": function(exp,a,b) {return a<b;},
    ">": function(exp,a,b) {return a>b;},
    "<=": function(exp,a,b) {return a<=b;},
    ">=": function(exp,a,b) {return a>=b;},
    "==": function(exp,a,b) {
        a = Variable.makeVariables(exp._context,a);
        b = Variable.makeVariables(exp._context,b);
        return Variable.equal(a, b);
    },
    "is": function(exp,a,b) {
        return a === b;
    },
    "is not": function(exp,a,b) {
        return a !== b;
    },
    "!=": function(exp,a,b) {
        a = Variable.makeVariables(exp._context,a);
        b = Variable.makeVariables(exp._context,b);
        return !Variable.equal(a, b);
    },
};

// expression base class
var Expression = Class({

    // expression constructor
    // @param context - context of program currently executed.
    // @param ast - expression ast node to evaluate (output of compile).
    constructor: function(context, ast)
    {
        // store context and expression
        this._context = context;
        this._ast = ast;
    },

    // parse a single AST node
    // @param node - current AST node to evaluate.
    // @param currObj - current object we are holding (used for expressions like "foo.bar.bla()").
    // @param returnAsVar - if true, will return variable objects if possible.
    parseNode: function (node, currObj, returnAsVar) {

        // undefined node? that happens if we're missing a side of an expression, like "5 + "
        if (node === undefined)
        {
            throw new Errors.SyntaxError("Unexpected EOL or missing argument!");
        }

        // parse based on node type
        switch (node.type) {

            // if its a connecting dot (eg the dot in "foo.bar()")
            case '.':
                var leftObj = this.parseNode(node.left);
                return this.parseNode(node.right, leftObj);
                break;

            // if its a number
            case "number":
                return parseFloat(node.value);

            // if its a boolean
            case "boolean":
                return node.value;

            // if its an object
            case "object":
                return node.value;

            // if its a string
            case "string":
                var ret = String(node.value);
                if (ret[0] === '"' || ret[0] === "'") {
                    ret = ret.substr(1, ret.length-2);
                }
                return ret;

            // if it a variable / identifier / keyword
            case "identifier":

                // get variable
                var value = this._context.getVar(node.value, currObj);

                // if requested value and not variable
                if (!returnAsVar) {

                    // get value from variable
                    var readonly = true;
                    if (value._value !== undefined) {
                        readonly = value._scopeData.readonly;
                        value = value._value;
                    }

                    // if its a readonly var, cache value
                    if (readonly) {
                        setNodeOptimizedVal(node, value);
                    }
                }

                // return value
                return value;

            // if its assignment expression
            case "assign":
                return this._context.setVar(node.name, this.parseNode(node.value));

            // if its assignment+ expression (+=, -=, *=, ...)
            case "assign+":
                // get the operator part (the +, -, *, ..)
                var opFunc = opFuncs[node.op];
                if (!opFunc) {
                    throw new Errors.SyntaxError("Unknown operator '" + node.op + "='.");
                }

                // get both sides, evaluate and set
                var _var = this._context.getVar(node.name, currObj);
                var a = _var._value;
                var b = this.parseNode(node.value);
                if (b && b._value !== undefined) {b = b._value;}
                var result = opFunc(this, a, b);
                return (_var._scopeData.scope || this._context).setVar(node.name, result);

            // a function call
            case "call":

                // get function to invoke
                var func = this._context.getVar(node.name, currObj);

                // parse args (and also check if they are all simple types)
                var args = [];
                var isAllSimple = true;
                for (var i = 0; i < node.args.length; i++) {

                    // parse arg
                    var arg = this.parseNode(node.args[i], undefined, true);
                    args.push(arg);

                    // if this arg was not optimized, it means it contained parts that are not const / simple
                    if (arg && typeof arg === "object" && !arg.wasOptimized) {
                        isAllSimple = false;
                    }
                }

                // execute function and get return value
                var ret = this._context._interpreter.callFunction(func, args, currObj);

                // if function is deterministic (eg func(x) will always be y) and all args are simple types, optimize by saving the return value.
                if (func.deterministic && typeof ret !== "object" && isAllSimple) {
                    setNodeOptimizedVal(node, ret);
                }

                // return function result
                return ret;

            // default - check if its an operator
            default:
                // if its an operator
                if (opFuncs[node.type]) {

                    // get operator function
                    var opFunc = opFuncs[node.type];

                    // will contain evaluation return value
                    var ret;

                    // if got left-side evaluate with left and right side (eg "5 + 2")
                    if (node.left) {
                        var l = this.parseNode(node.left);
                        var r = this.parseNode(node.right);
                        if (l && l._value !== undefined) {l = l._value;}
                        if (r && r._value !== undefined) {r = r._value;}
                        ret = opFunc(this, l, r);
                    }
                    // else evaluate only with right side (eg "-2")
                    else {
                        var r = this.parseNode(node.right);
                        if (r && r._value !== undefined) {r = r._value;}
                        return opFunc(this, r);
                    }

                    // special optimization!
                    // if both left and right expressions are consts (string / number) set this node after first evaluation
                    // this optimization turns stuff like "5 + 2" into just "7" and save a lot of time.
                    if (node.wasOptimized === undefined) {
                        if ((!node.left || node.left.type === "string" || node.left.type === "number") &&
                            (node.right.type === "string" || node.right.type === "number")) {
                                setNodeOptimizedVal(node, ret);
                        }
                        else {node.wasOptimized = false;}
                    }

                    // return value
                    return ret;
                }

                // if got here it means its unknown node type!
                return node;
        }
    },

    // evaluate and return expression
    eval: function()
    {
        return this.parseNode(this._ast);
    },
});

// export the statement class
module.exports = Expression;


},{"./../compiler/lexer":4,"./../dependencies/jsface":24,"./../errors":28,"./variable":22}],14:[function(require,module,exports){
"use strict";

// all builtin functions
var core = {
    Statement: require('./statement'),
    Expression: require('./expression'),
    Scope: require('./scope'),
    Object: require('./object'),
    Context: require('./context'),
    Block: require('./block'),
    Variable: require('./variable'),
    BuiltinFunc: require('./builtin_func'),
    List: require('./list'),
    Set: require('./set'),
    Dict: require('./dict'),
    Module: require('./module'),
};

// set identifier field
for (var key in core)
{
    core[key].prototype.identifier = "core." + key;
}

// export core objects
module.exports = core;


},{"./block":8,"./builtin_func":9,"./context":10,"./dict":11,"./expression":13,"./list":15,"./module":16,"./object":17,"./scope":18,"./set":19,"./statement":20,"./variable":22}],15:[function(require,module,exports){
"use strict";

/**
* A built-in list object.
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

// include variable
var Variable = require("./variable");

// builtin function
var BuiltinFunc = require("./builtin_func");

// make sure list length is valid
function validate_len(list) {
    if (list._list.length > list._context._interpreter._flags.maxContainersLen) {
        throw new Errors.ExceedMemoryLimit("List exceeded maximum container length (" + list._context._interpreter._flags.maxContainersLen + ")");
    }
}

// all the api functions of the list
var apiFuncs = {

    // clone the list
    clone: function()
    {
        return new List(this._context, this._list);
    },

    // check if empty list
    empty: function()
    {
        return this._list.length === 0;
    },

    // convert to set and return
    to_set: function()
    {
        return new _Set(this._context, this._list);
    },

    // return list length
    len: function()
    {
        return this._list.length;
    },

    // append item to list
    append: function(item)
    {
        this._list.push(item);
        validate_len(this);
        this._context._interpreter.updateMemoryUsage(item._estimatedSize);
        return this;
    },

    // return true if value exists in the list
    has: function(item)
    {
        return this.index(item) !== -1;
    },

    // clear list
    clear: function()
    {
        this._list = [];
    },

    // count how many times item appear in the list
    count: function(item)
    {
        // count occurrences
        var ret = 0;
        for (var i = 0; i < this._list.length; ++i)
        {
            if (Variable.equal(this._list[i], item)) {
                ret++;
            }
        }

        // return counter
        return ret;
    },

    // extend list with another list
    extend: function(other)
    {
        if (other.type !== "list") {
            throw new Errors.RuntimeError("List 'extend()' expecting another list as param ('" + other.type + "' given).");
        }
        this._list = this._list.concat(other._value._list);
        validate_len(this);
        return this;
    },

    // return first index found of value
    index: function(item)
    {
        // find item
        for (var i = 0; i < this._list.length; ++i)
        {
            if (Variable.equal(this._list[i], item)) {
                return i
            }
        }

        // not found - return -1
        return -1;
    },

    // insert a value to a specific index
    insert: function(item, position)
    {
        // insert and return item
        this._list.splice(position, 0, item);
        validate_len(this);
        return item;
    },

    // join function
    join: function(str)
    {
        var connector = (str ? str._value : str) || undefined;
        return this._list.map(function(x) {return x._value;}).join(connector);
    },

    // pop a value from list
    pop: function(index)
    {
        // for return value
        var ret;

        // pop without value (last index)
        if (index === undefined) {
            ret = this._list.pop();
        }
        // pop specific index
        else {
            ret = this._list.splice(index, 1)[0];
        }
        // invalid index? return None
        if (ret === undefined) {
            return new Variable(this._context, null);
        }

        // return the value we poped
        return ret;
    },

    // shift a value from list
    shift: function()
    {
        return this._list.shift() || new Variable(this._context, null);
    },

    // remove first occurrence of value.
    remove: function(item)
    {
        // get item index in list
        var index = this.index(item);

        // if found remove it
        if (index !== -1)
        {
            this._list.splice(index, 1);
            return true;
        }

        // not found - didn't remove
        return false;
    },

    // reverse the list
    reverse: function()
    {
        this._list.reverse();
    },

    // slice the list and return a sub list
    slice: function(start, end)
    {
        var sub = this._list.slice(start, end);
        return new List(this._context, sub);
    },

    // sort list
    sort: function()
    {
        this._list.sort();
    },

    // return n'th item
    at: function(index) {

        // make sure integer
        if (index.type !== "number") {
            throw new Errors.RuntimeError("List 'at()' must receive a number as param (got '" + index.type + "' instead).");
        }

        // convert to int
        index = Math.round(index._value);

        // handle negatives
        if (index < 0) {index = this._list.length + index;}

        // make sure in range
        if (index >= this._list.length) {
            throw new Errors.RuntimeError("Index out of list range!");
        }

        // return item
        return this._list[index];
    },
}

// List class
var List = Class(_Object, {

    // Object constructor
    // @param context - context of program currently executed.
    // @param args - starting list
    constructor: function(context, args)
    {
        // call parent constructor
        List.$super.call(this, context);

        // make sure all items are variables
        args = Variable.makeVariables(context, args);

        // set list
        this._list = args ? args.slice(0) : [];
        validate_len(this);
    },

    // iterate over object components
    forEach: function(callback, obj) {
        for (var i = 0; i < this._list.length; ++i) {
            if (callback.call(obj, this._list[i]) === false) {
                return;
            }
        }
    },

    // list api
    api: {
        clone: BuiltinFunc.create(apiFuncs.clone, 0, 0, false),
        empty: BuiltinFunc.create(apiFuncs.empty, 0, 0, false),
        to_set: BuiltinFunc.create(apiFuncs.to_set, 0, 0, false),
        len: BuiltinFunc.create(apiFuncs.len, 0, 0, false),
        shift: BuiltinFunc.create(apiFuncs.shift, 0, 0, false),
        append: BuiltinFunc.create(apiFuncs.append, 1, 0, false),
        has: BuiltinFunc.create(apiFuncs.has, 1, 0, false),
        clear: BuiltinFunc.create(apiFuncs.clear, 0, 0, false),
        count: BuiltinFunc.create(apiFuncs.count, 1, 0, false),
        extend: BuiltinFunc.create(apiFuncs.extend, 1, 0, false),
        index: BuiltinFunc.create(apiFuncs.index, 1, 0, false),
        insert: BuiltinFunc.create(apiFuncs.insert, 2, 0, false),
        pop: BuiltinFunc.create(apiFuncs.pop, 0, 1, false),
        remove: BuiltinFunc.create(apiFuncs.remove, 1, 0, false),
        reverse: BuiltinFunc.create(apiFuncs.reverse, 0, 0, false),
        slice: BuiltinFunc.create(apiFuncs.slice, 1, 1, false),
        join: BuiltinFunc.create(apiFuncs.join, 0, 1, false),
        sort: BuiltinFunc.create(apiFuncs.sort, 0, 0, false),
        at: BuiltinFunc.create(apiFuncs.at, 1, 0, false),
    },

    // convert to string
    toString: function()
    {
        var params = this._list.map(function(x) {
            return x.toString();
        });
        return params.join(",");
    },

    // convert to repr
    toRepr: function()
    {
        return "list(" + this.toString() + ")";
    },

    // convert to a native javascript object
    toNativeJs: function()
    {
        var ret = [];
        for (var i = 0; i < this._list.length; ++i) {
            ret.push(this._list[i].toNativeJs());
        }
        return ret;
    },

    // object identifier
    name: "list",

    // object type
    type: "list",
});

// init set builtint api
_Object.initBuiltinApi(List);

// export the list class
module.exports = List;

// require Set (do it in the end to prevent require loop)
var _Set = require('./set');
},{"./../dependencies/jsface":24,"./../errors":28,"./builtin_func":9,"./object":17,"./set":19,"./variable":22}],16:[function(require,module,exports){
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

},{"./../dependencies/jsface":24,"./../errors":28,"./object":17}],17:[function(require,module,exports){
"use strict";

/**
* A basic object API.
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

// include variable object
var Variable = require("./variable");

// require general utils
var Utils = require("./../utils");

// builtin functions
var BuiltinFunc = require("./builtin_func");

// Object class
var _Object = Class({

    // Object constructor
    // @param context - context of program currently executed.
    // @param unique - if true, it means this object is one-of-kind and have private API.
    constructor: function(context, unique)
    {
        // store context
        this._context = context;
        if (unique) this.api = {};
    },

    // set attribute
    setAttr: function(key, value)
    {
        // wrap value as variable (unless its already an adder variable)
        if (value === null || value === undefined || value.constructor !== Variable) {
            value = new Variable(this._context, value);
        }

        // set value
        this.api[key] = value;
    },

    // convert to a native javascript object
    toNativeJs: function()
    {
        return this.toString();
    },

    // convert to a object string representation
    toRepr: function()
    {
        return this.toString();
    },

    // get attribute
    getAttr: function(key)
    {
        return this.api[key];
    },

    // object api - override this with the public functions and values of the object type.
    // user scripts can access only objects in this dictionary.
    api: {},

    // basic api all objects share.
    // don't override this one.
    _objectApi: {

        // convert to string
        str: BuiltinFunc.create(function() {
            return this.toString ? this.toString() : this.type;
        }, 0, 0),

    },

    // object identifier
    name: "object",

    // object type
    type: "object",

    // this is a built-in adder object
    __isAdderObject: true,

    // convert to string
    toString: function() {
        return '<' + this.identifier + '>';
    },

    // static stuff
    $static: {

        // fix object's api and create aliases to functions for internal access
        initBuiltinApi: function(obj) {

            // get object prototype
            obj = obj.prototype;

            // first copy _objectApi stuff
            for (var key in obj._objectApi) {
                if (obj.api[key] === undefined) {
                    obj.api[key] = obj._objectApi[key];
                }
            }

            // special case - rename _set() and _get() into set() and get()
            if (obj.api._get) {obj.api.get = obj.api._get; delete obj.api._get;}
            if (obj.api._set) {obj.api.set = obj.api._set; delete obj.api._set;}

            // iterate over api keys and create alias to function calls
            for (var key in obj.api)
            {
                // get current api object
                var curr = obj.api[key];
                if (curr.isBuiltinFunc) {
                    (function(key) {

                        obj[key] = function() {
                            return this.api[key].execute.call(this.api[key], arguments, this);
                        }
                    })(key);
                }
            }

        },

    },
});

// export the scope class
module.exports = _Object;

},{"./../dependencies/jsface":24,"./../errors":28,"./../utils":79,"./builtin_func":9,"./variable":22}],18:[function(require,module,exports){
"use strict";

/**
* A Scope contains all the params, vars, etc. of the current scope or block.
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

// include variable class
var Variable = require("./variable");

// console for logging
var Console = require("./../console");

// Scope class
var Scope = Class({

    // scope constructor
    // @param context - context of program currently executed.
    // @param depth - integer, scope depth in stack.
    // @param type - scope type, eg what is it for: "block", "function", "loop", ...
    constructor: function(context, depth, type, maxVars)
    {
        // store context
        this._context = context;

        // create vars dictionary and dictionary of read-only stuff
        this._type = type || "block";
        this._maxVars = maxVars || 100000;
        this._vars = {};
        this._varKeys = new Set();
        this._readonly = {};
        this._depth = depth;

        // some scope registers
        this.calledReturn = false;
        this.returnValue = null;
        this.calledContinue = false;
        this.calledBreak = false;
    },

    // set variable
    // @param key - variable key.
    // @param val - variable value.
    // @param readonly - if this variable readonly?
    // @param force - if true, will not do limit validations etc. used internally for builtins etc.
    setVar: function(key, val, readonly, force) {

        // make sure variable is a variable
        val = Variable.makeAdderObjects(this._context, val, true);

        // set scope data
        val.setScopeData(this, key, readonly);

        // update memory usage
        if (!force) {
            this._context._interpreter.updateMemoryUsage(val._estimatedSize);
        }

        // set var
        this._vars[key] = val;
        this._varKeys.add(key);

        // validate length
        if (!force && this._varKeys.size > this._maxVars) {
            throw new Errors.ExceedMemoryLimit("Exceeded scope size limit of " + this._maxVars + " variables!");
        }

        // return new variable
        return val;
    },

    // remove a variable
    remove: function(key) {

        // delete variable
        delete this._vars[key];
        this._varKeys.delete(key);
    },

    // get variable.
    // @parm key - variable identifier (string).
    // @param object - object to get from (if undefined, get from current scope).
    getVar: function(key, object) {

        return this._vars[key];
    },

    // get all identifier names in current scope
    getAllIdentifiers: function()
    {
        return Object.keys(this._vars);
    },
});

// export the scope class
module.exports = Scope;


},{"./../console":7,"./../dependencies/jsface":24,"./../errors":28,"./variable":22}],19:[function(require,module,exports){
"use strict";

/**
* A built-in set object.
* Important notice about sets - unlike other objects, in set we store everything as native js object instead of a variable.
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

// include variable
var Variable = require("./variable");

// builtin function
var BuiltinFunc = require("./builtin_func");

// require misc utils
var Utils = require("./../utils");

// include basic object type
var _Object = require("./object");

// make sure set length is valid
function validate_len(set) {
    if (set._set.size > set._context._interpreter._flags.maxContainersLen) {
        throw new Errors.ExceedMemoryLimit("Set exceeded maximum container length (" + set._context._interpreter._flags.maxContainersLen + ")");
    }
}

// all the api functions of the set
// remember - everything in a set is stored as native js and not as Variable object
var apiFuncs = {

    // clone the set
    clone: function()
    {
        return new _Set(this._context, Utils.toArray(this._set));
    },

    // convert to a list and return
    to_list: function()
    {
        var setAsList = Utils.toArray(this._set);
        return new List(this._context, setAsList);
    },

    // return set length
    len: function()
    {
        return this._set.size;
    },

    // join function
    join: function(str)
    {
        return this.to_list().join(str);
    },

    // return if set is empty
    empty: function()
    {
        return this._set.size === 0;
    },

    // add item to set
    add: function(item)
    {
        // get value
        item = item._value;

        // make sure not an object
        if (item && typeof item === "object") {
            throw new Errors.RuntimeError("Cannot add objects to set(), only simple types (bool, string, number, or none).");
        }

        // add estimated memory usage
        this._context._interpreter.updateMemoryUsage(item ? item.length || 4 : 1);

        // add to set and return
        this._set.add(item);
        validate_len(this);
        return this;
    },

    // clear the set
    clear: function()
    {
        this._set = new Set();
    },

    // return true if value exists in the set
    has: function(item)
    {
        return this._set.has(item._value);
    },

    // extend set with another set
    extend: function(other)
    {
        // make sure got set to extend
        if (other.type !== "set") {
            throw new Errors.RuntimeError("Set 'extend()' expecting another set as param ('" + other.type + "' given).");
        }

        // extend the set
        var _this = this;
        other._value._set.forEach(function(x)
        {
            _this._set.add(x);
        });

        // validate length
        validate_len(this);
    },

    // return first index found of value
    index: function(item)
    {
        // get item value
        item = item._value;

        // special exception to break forEach as soon as we find value
        var BreakException = {};

        // for return value
        var i = 0;
        var ret = -1;

        // iterate and search for item
        try {
            this._set.forEach(function(x) {
                if (x === item) {
                    ret = i;
                    throw BreakException;
                } i++;
            });
        } catch (e) {
            if (e !== BreakException) throw e;
        }

        // return index
        return ret;
    },

    // remove value from set
    remove: function(item)
    {
        return this._set.delete(item._value);
    },
}

// Set class
var _Set = Class(_Object, {

    // Object constructor
    // @param context - context of program currently executed.
    // @param args - starting set
    constructor: function(context, args)
    {
        // call parent constructor
        _Set.$super.call(this, context);

        // create the set
        this._set = new Set();

        // add starting args to it
        for (var i = 0; i < args.length; ++i)
        {
            var curr = args[i];
            this.add(curr);
        }
    },

    // iterate over object components
    forEach: function(callback, obj) {
        this._set.forEach(function(x) {
            callback.call(obj, x);
        });
    },

    // set api
    api: {
        clone: BuiltinFunc.create(apiFuncs.clone, 0, 0, false),
        to_list: BuiltinFunc.create(apiFuncs.to_list, 0, 0, false),
        len: BuiltinFunc.create(apiFuncs.len, 0, 0, false),
        add: BuiltinFunc.create(apiFuncs.add, 1, 0, false),
        clear: BuiltinFunc.create(apiFuncs.clear, 0, 0, false),
        empty: BuiltinFunc.create(apiFuncs.empty, 0, 0, false),
        has: BuiltinFunc.create(apiFuncs.has, 1, 0, false),
        extend: BuiltinFunc.create(apiFuncs.extend, 1, 0, false),
        index: BuiltinFunc.create(apiFuncs.index, 1, 0, false),
        remove: BuiltinFunc.create(apiFuncs.remove, 1, 0, false),
        join: BuiltinFunc.create(apiFuncs.join, 0, 1, false),
    },

    // convert to string
    toString: function()
    {
        var params = Utils.toArray(this._set).map(function(x) {
            return x.toString();
        });
        return params.join(",");
    },

    // convert to repr
    toRepr: function()
    {
        return "set(" + this.toString() + ")";
    },

    // convert to a native javascript object
    toNativeJs: function()
    {
        var ret = new Set();
        this._set.forEach(function(x) {
            ret.add(x);
        });
        return ret;
    },

    // object identifier
    name: "set",

    // object type
    type: "set",
});

// init set builtint api
_Object.initBuiltinApi(_Set);

// export the Set class
module.exports = _Set;

// require the list object (do it in the end to prevent require loop)
var List = require('./list');
},{"./../dependencies/jsface":24,"./../errors":28,"./../utils":79,"./builtin_func":9,"./list":15,"./object":17,"./variable":22}],20:[function(require,module,exports){
"use strict";

/**
* A Statement is a single logical line that do a certain action, like placing var, calling a function, etc.
* There's a predefined set of built-in statements, like "if", "for", "while", etc. that define the language.
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

// Statement base class
var Statement = Class(Executable, {

    // statement constructor
    // @param context - context of program currently executed.
    // @param line - current line, for debug purposes
    constructor: function(context, line)
    {
        // call base class
        Statement.$super.call(this, context);
        this._line = line;
    },

    $static: {
        // get this statement keyword
        getKeyword: function()
        {
            return null;
        },
    },

    // set the statement before this one in this block
    setPreviousStatement: function(statement) {
    },

    // get statement representation
    getRepr: function() {
        return this.constructor.getKeyword();
    },

    // if true, it means this statement must open a new block, like 'if', 'for', 'def', etc.
    openNewBlock: false,

    // if true, when executing this command we need to skip the block following it
    skipFollowingBlock: false,

    // if true, will break current block once this statement is executed
    isBreakingBlock: false,

    // executable type
    type: "statement",
});

// export the statement class
module.exports = Statement;


},{"./../dependencies/jsface":24,"./../errors":28,"./executable":12}],21:[function(require,module,exports){
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
},{"./../dependencies/jsface":24,"./../errors":28,"./builtin_func":9}],22:[function(require,module,exports){
"use strict";

/**
* Represent a value in program's memory. Everything inside the running environment is stored inside variables.
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

// include language defs
var LanguageDefs = require("./../language/defs");

// require basic utils
var Utils = require("./../utils");

// set of simple variable types
var simpleTypes = Utils.toSet(["string", "number", "boolean", "none"]);

// Variable class
var Variable = Class({

    // variable constructor
    // @param context - context of program currently executed.
    // @param value - variable value - must be raw, native type. NOT an expression.
    constructor: function(context, value)
    {
        // store context and arguments
        this._context = context;

        // set type
        // special case for null and undefined
        if (value === null || value === undefined)
        {
            value = null; // <-- in case we got "undefined" convert it to null.
            this.type = "none";
            this.isSimple = true;
            this._estimatedSize = 1;
        }
        // if its an object set type
        else
        {
            // function
            if (value.isFunction) {
                this.type = "function";
                this.isSimple = false;
                this._estimatedSize = 4;
            }
            // NaN
            else if (typeof value === "number" && isNaN(value))
            {
                this.type = "NaN";
                this.isSimple = false;
                this._estimatedSize = 4;
            }
            // if object and have type
            else if (value.type)
            {
                this.type = value.type;
                this.isSimple = false;
                this._estimatedSize = 4;
            }
            // any other object
            else {

                // set type
                this.type = typeof value;

                // special case - if string - remove quotes
                if (this.type === "string") {

                    // make sure don't exceed max string length
                    var maxLen = this._context._interpreter._flags.maxStringLen;
                    if (maxLen && value.length > maxLen) {
                        throw new Errors.ExceedMemoryLimit("String exceeded length limit of " + maxLen + "!");
                    }

                    // set estimated size
                    this._estimatedSize = value.length;
                }
                // for any other simple type estimated size is 1 byte
                else {
                    this._estimatedSize = 1;
                }

                // its a simple type
                this.isSimple = true;
            }
        }

        // add API based on variable type
        this.api = APIs[this.type];

        // set scope data
        this._scopeData = {};

        // store value
        this._value = value;
    },

    // set scope-related data of this variable
    setScopeData: function(scope, name, readonly) {
        this._scopeData = {
            scope: scope,
            name: name,
            readonly: readonly,
        };
    },

    // some static functions
    $static: {

        // return if given value is a variable instance
        isVariable: function(val) {
            return val && val.constructor === Variable;
        },

        // check if two variables are equal
        equal: function(a, b) {

            // if same object return true
            if (a === b) {
                return true;
            }

            // first get types and check if different types
            var typeA = a.type;
            var typeB = b.type;
            if (typeA !== typeB) {return false;}

            // get values
            a = a._value;
            b = b._value;

            // compare based on type
            switch (typeA) {

                // special case - NaN (remember we checked types before, so we don't need to check if both are NaN).
                // why we need this? because in JS if you do NaN === NaN the result is false, and I want to fix that.
                case "NaN":
                    return true;

                // if list compare lists
                case "list":
                    // if different length return false
                    if (a.len() !== b.len()) {return false;}

                    // iterate over items and compare recursively
                    for (var i = 0; i < a._list.length; ++i) {
                        if (!Variable.equal(a._list[i], b._list[i])) {
                            return false;
                        }
                    }

                    // if got here it means they are equal
                    return true;

                // if dict compare as dicts
                case "dict":
                    // get keys
                    var ak = a.keys(); var bk = b.keys();

                    // different length? not equal
                    if (ak.len() !== bk.len()) {return false;}

                    // iterate over keys and compare recursively
                    for (var i = 0; i < ak._list.length; ++i) {

                        var key = ak._list[i]._value;
                        if (!Variable.equal(a._dict[key], b._dict[key])) {
                            return false;
                        }
                    }

                    // if got here it means they are equal
                    return true;

                // if set compare sets
                case "set":
                        // if different length return false
                        if (a.len() !== b.len()) {return false;}

                        // convert both sets to lists
                        a = a.to_list(); b = b.to_list();

                        // iterate over items and compare recursively
                        for (var i = 0; i < a._list.length; ++i) {
                            if (!Variable.equal(a._list[i], b._list[i])) {
                                return false;
                            }
                        }

                        // if got here it means they are equal
                        return true;

                // for default types just compare
                default:
                    return a === b;
            };
        },

        // check if two variables are the same (like 'is' in python)
        is: function(a, b) {

            // if same object return true
            if (a === b) {
                return true;
            }

            // first get types and check if different types
            var typeA = a.type;
            var typeB = b.type;
            if (typeA !== typeB) {return false;}

            // get values
            a = a._value;
            b = b._value;

            // special case - NaN (remember we checked types before, so we don't need to check if both are NaN).
            // why we need this? because in JS if you do NaN === NaN the result is false, and I want to fix that.
            if (typeA === "NaN") {return true;}

            // if its an object, check if the same instance
            if (a && a.api)
            {
                return a === b;
            }

            // for native types return comparison
            return a === b;
        },

        // make sure given value is a variable (or a list of variables, if array is given).
        // note: this can either handle a single value or an array. if array, it will convert all items inside to variables.
        // @param forceCreateNew - if true, and val is already a variable, clone it to a new variable.
        makeVariables: function(context, val, forceCreateNew) {

            // if array convert all items into variable
            if (val instanceof Array) {

                // length is 0? stop here!
                if (val.length === 0) {return val;}

                // convert to variables and return
                for (var i = 0; i < val.length; ++i) {
                    val[i] = Variable.makeVariables(context, val[i], forceCreateNew);
                }

                // return value
                return val;
            }

            // if already variable stop here..
            if (val && val.constructor === Variable)
            {
                if (forceCreateNew) {
                    return new Variable(context, val._value);
                }
                return val;
            }

            // convert to variable
            return new Variable(context, val);
        },


        // similar to makeVariables but slightly different in a way that it will convert arrays into Adder lists, Sets
        // into adder Sets, etc..
        makeAdderObjects: function(context, val, forceCreateNew) {

            // if already a variable stop here..
            if (val && val.constructor === Variable)
            {
                // unless forced to create a new var, in which case create a copy
                if (forceCreateNew) {
                    return new Variable(context, val._value);
                }
                return val;
            }
            // if array convert all items inside into adder objects
            else if (val instanceof Array)
            {
                for (var i = 0; i < val.length; ++i) {
                    val[i] = Variable.makeAdderObjects(context, val[i], forceCreateNew);
                }
                // create and return the new list
                val = new _List(context, val);
            }
            // if a Set
            else if (val && val.constructor === Set)
            {
                // create and return the new Set
                val = new _Set(context, Utils.toArray(val));
            }
            // else if a dictionary convert to a dict
            else if (val instanceof Object && !val.__isAdderObject)
            {

                // convert to variables and return
                for (var key in val) {
                    val[key] = Variable.makeAdderObjects(context, val[key], forceCreateNew);
                }

                // create and return the new dictionary
                val = new _Dict(context, val);
            }

            // now convert to a variable and return
            return new Variable(context, val);
        },
    },

    // get variable value.
    getValue: function()
    {
        return this._value;
    },

    // get variable type
    getType: function()
    {
        return this.type;
    },

    // delete this variable
    deleteSelf: function()
    {
        // if no scope
        if (!this._scopeData.scope) {
            throw new Errors.RuntimeError("Cannot delete object '" + this.toString() + "'!");
        }

        // remove self from context and reset scope data
        this._context.remove(this._scopeData.name);
        this._scopeData = {};

    },

    // implement the 'in' operator, eg if val is inside this
    has: function(val)
    {
        // first check if have value
        if (this._value === null || this._value === undefined) {
            return false;
        }

        // now check if this var have 'has()' implemented internally. if so, use it.
        if (this._value.has) {
            return this._value.has(val);
        }

        // make sure value to check is not a variable
        if (val && val.getValue) {
            val = val._value;
        }

        // if has() is not supported, fallback to simple string indexOf
        return String(this._value).indexOf(val) !== -1;
    },

    // convert variable to a native javascript object
    toNativeJs: function()
    {
        // get value
        var val = this._value;

        // if its null etc.
        if (!val) {
            return val;
        }

        // if value is an object with its own to toNativeJs function, call it.
        if (val.toNativeJs) {
            return val.toNativeJs();
        }

        // special case for dictionaries
        if (val.isFunction) {
            return val.func || val.__imp;
        }

        // if a simple value return the value itself
        return val;
    },

    // convert to repr
    toRepr: function()
    {
        // get value
        var val = this._value;

        // return string based on type
        switch (this.type)
        {
            case "string":
                return '"' + val + '"';
            case "number":
                return String(val);
            case "none":
                return LanguageDefs.keywords['null'];
            case "boolean":
                return LanguageDefs.keywords[String(val)];
            case "function":
                return val.toRepr();
            default:
                // check if value got a string function of its own
                if (val && val.toRepr) {
                    return val.toRepr();
                }
                // if not just convert to a string and return
                return String(val);
        }
    },

    // convert to string
    toString: function()
    {
        // return string based on type
        switch (this.type)
        {
            case "string":
                return this._value;
            case "number":
                return String(this._value);
            case "none":
                return "";
            case "boolean":
                return LanguageDefs.keywords[String(this._value)];
            case "function":
                return this._value.toString();
            default:
                // check if value got a string function of its own
                if (this._value && this._value.toString) {
                    return this._value.toString();
                }
                // if not just convert to a string and return
                return String(this._value);
        }
    },
});

// export the Executable class
module.exports = Variable;

// get List, Dict and Set
var _List = require("./list");
var _Set = require("./set");
var _Dict = require("./dict");

// different APIs for different variable types
var APIs = {
    'string': require("./string_api"),
};
},{"./../dependencies/jsface":24,"./../errors":28,"./../language/defs":34,"./../utils":79,"./dict":11,"./list":15,"./set":19,"./string_api":21}],23:[function(require,module,exports){
"use strict";

// global defs
module.exports = {
    'version': "1.0.2",
    'about': "AdderScript is a lightweight minimalistic script language, aimed to execute untrusted code in a safe way.\nDesigned and built by Ronen Ness.",
    'author': "Ronen Ness",
};


},{}],24:[function(require,module,exports){
"use strict";

!function(t,o,r,e,n,p,i,c,u,f){function s(t){return t&&typeof t===o&&!(typeof t.length===r&&!t.propertyIsEnumerable(e))&&t||null}function l(t){return t&&typeof t===o&&typeof t.length===r&&!t.propertyIsEnumerable(e)&&t||null}function y(t){return t&&"function"==typeof t&&t||null}function a(t){return y(t)&&t.prototype&&t===t.prototype.constructor&&t||null}function $(t,o,r,e){r&&r.hasOwnProperty(t)||(e[t]=o)}function b(t,o,r){if(l(o))for(var e=o.length;--e>=0;)b(t,o[e],r);else{r=r||{constructor:1,$super:1,prototype:1,$superp:1};var n,p,i=a(t),c=a(o),u=t.prototype;if(s(o)||i)for(n in o)$(n,o[n],r,t,i,u);if(c){p=o.prototype;for(n in p)$(n,p[n],r,t,i,u)}i&&c&&b(u,o.prototype,r)}}function g(t){var o,r;Object.freeze(t);for(r in t)o=t[r],t.hasOwnProperty(r)&&"object"==typeof o&&!Object.isFrozen(o)&&g(o)}function O(t,o){o||(o=t,t=0);var r,e,n,p,i,c,u,f,s,l,y,a=0,$={constructor:1,$singleton:1,$static:1,$statics:1,prototype:1,$super:1,$superp:1,main:1,toString:0},b=O.plugins;o=("function"==typeof o?o():o)||{},e=o.hasOwnProperty("constructor")?o.constructor:null,n=o.$singleton,p=o.$statics||o.$static;for(i in b)$[i]=1;for(t=!t||t instanceof Array?t:[t],u=t&&t.length,s=t[0],r=n?function(){}:e?e:function(){s&&s.apply(this,arguments)},!n&&u&&(l=s.prototype&&s===s.prototype.constructor&&s,l?(y=function(){},y.prototype=l.prototype,y.prototype.constructor=y,r.prototype=new y,r.prototype.constructor=r,l.prototype.constructor=l):r.prototype=s),c=n?r:r.prototype;u>a;){f=t[a++];for(i in f)$[i]||(r[i]=f[i]);if(!n&&0!==a)for(i in f.prototype)$[i]||(c[i]=f.prototype[i])}for(i in o)if(!$[i]){var g=o[i];g&&(g.get||g.set)?(g.enumerable=!0,Object.defineProperty(c,i,g)):c[i]=g}for(i in p)r[i]=p[i];f=t&&s||t,r.$super=f,r.$superp=f&&f.prototype||f;for(i in b)b[i](r,t,o);return"function"==typeof o.main&&o.main.call(r,r),r}O.plugins={$ready:function h(t,o,r,e){for(var n,c,u,f=r.$ready,s=o?o.length:0,l=s,a=s&&o[0].$super;s--;)for(c=0;i>c&&(u=p[c],n=o[s],n===u[0]&&(u[1].call(n,t,o,r),l--),l);c++);a&&h(t,[a],r,!0),!e&&y(f)&&(f.call(t,t,o,r),p.push([t,f]),i++)},$const:function(t,o,r){var e,n=r.$const;for(e in n)Object.defineProperty(t,e,{enumerable:!0,value:n[e]}),"object"!=typeof t[e]||Object.isFrozen(t[e])||g(t[e])}},f={Class:O,extend:b,mapOrNil:s,arrayOrNil:l,functionOrNil:y,classOrNil:a},"undefined"!=typeof module&&module.exports?module.exports=f:(u=t.Class,t.Class=O,t.jsface=f,f.noConflict=function(){t.Class=u})}(this,"object","number","length",Object.prototype.toString,[],0);

},{}],25:[function(require,module,exports){
"use strict";

/**
* The main API class that spawn programs and load code.
* This is the main class you need to use.
*
* Author: Ronen Ness.
* Since: 2016
*/

// include jsface for classes
var jsface = require("./../dependencies/jsface"),
    Class  = jsface.Class,
    extend = jsface.extend;

// include the alternative console
var Console = require("./../console");

// include the program class
var Program = require("./program");

// include the compiler class
var Compiler = require("./../compiler");

// include core objects
var Core = require("./../core");

// include errors
var Errors = require("./../errors");

// include utils
var Utils = require("./../utils");

// include language stuff
var Language = require("./../language");

var uniqueObjectName = 0;

// the environment class.
var Environment = Class({

    // the environment is a singleton class
    $singleton: true,

    // add access to errors and utils
    Errors: Errors,
    Utils: Utils,

    // Environment constructor.
    // @param params is a dictionary with all environment params. contains:
    //      flags - compiler and interpreter flags.
    //      modules - a list of modules to load by default. Can also be ['ALL'] to load all builtin modules.
    //      outputFunc - a function to handle output from script execution (print calls).
    //      showDebugConsole - if true, will output debug prints to console.
    init: function(params)
    {
        // default params
        params = params || {};

        // store interpreter flags
        this._flags = params.flags || {};
        this._modules = params.modules || ["SAFE"];
        this._outputFunc = params.outputFunc || null;

        // all custom modules
        this._customModules = {};

        // set debug console
        if (params.showDebugConsole) {
            Console.bindToNativeConsole();
        }

        // show basic info
        Console.info("Created a new environment!", this._flags, this._modules);

        // create the compiler instance
        this._compiler = new Compiler(this._flags);
    },

    // compile code and return the compiled code
    compile: function(code) {
        return this._compiler.compile(code);
    },

    // spawn a program from compiled code
    newProgram: function(compiledCode) {

        // create and return the new program
        var program = new Program(compiledCode, this._modules, this._flags, this._outputFunc);

        // add custom modules
        for (var key in this._customModules) {
            program.addModule(key, this._customModules[key]);
        }

        // return the newly created program
        return program;
    },

    // convert data dictionary to a builtin function or an object
    __toBuiltin: function(data, key, containerName) {

        // if its a function convert to a function instance and return
        if (typeof data === "object" && data.func) {
            data = Core.BuiltinFunc.create(data.func, data.requiredParams, data.optionalParams, data.deterministic || false);
            data.identifier = containerName + ".functions." + key;
            data.convertParamsToNativeJs = true;
            return data;
        }

        // else just return the object
        return data;
    },

    // add a built-in function to Adder. This will only affect future programs, not already existing ones.
    // @param data is a dictionary with the following keys:
    //      name:           builtin function name.
    //      func:           function to register.
    //      requiredParams: minimum amount of required params. set null any number of params.
    //      optionalParams: number of optional params. default to 0.
    //      deterministic:  if for input X output will always be Y, eg the function is deterministic and predictable,
    //                      set this to true. this will allow Adder to cache results and greatly optimize using this function.
    //                      note: default to false.
    addBuiltinFunction: function(data) {

        // add to builtin functions dictionary
        Language.Builtins.Functions[data.name] = this.__toBuiltin(data, data.name, "custom.builtin");
    },

    // remove a built-in function
    removeBuiltinFunction: function(name) {
        delete Language.Builtins.Functions[name];
    },

    // create and add a builtin module.
    // @param name - module name.
    // @param moduleApi - a dictionary with module's API.
    //                      to add a const value just add key value.
    //                      to add a function add a dictionary with 'func', 'requiredParams', and 'optionalParams'.
    //                      see addBuiltinFunction() for options.
    //
    // Usage example:
    // AdderScript.addBuiltinModule("Test", {
    //                                "foo": {
    //                                    func: function(x) {alert(x)},
    //                                    requiredParams: 1,
    //                                    optionalParams: 0
    //                                 },
    //                                 "bar": 5,
    //                              });
    addBuiltinModule: function(name, moduleApi) {

        // iterate over module api and convert to items
        for (var key in moduleApi) {

            // get current item and convert to builtin object
            var curr = moduleApi[key];
            curr = this.__toBuiltin(curr, key, name);

            // set back into api
            moduleApi[key] = curr;
        }

        // create the module and add it
        var CustomModule = Class(Core.Module, {
            api: moduleApi,
            name: name,
            version: "1.0.0",
        });
        this._customModules[name] = CustomModule;
    },

    // remove a built-in module
    removeBuiltinModule: function(name) {
        delete this._customModules[name];
    },

    // define a built-in object (like list, dict, set..) you can return and use in your modules and builtin functions.
    // @param name - object type name (for example when doing type(obj) this string will be returned).
    // @param api - a dictionary with object's API.
    //                      to add a const value just add key -> value pair.
    //                      to add a function add a dictionary with 'func', 'requiredParams', and 'optionalParams'.
    //                      see addBuiltinFunction() for options.
    //
    // Usage example:
    // createFunc = AdderScript.defineBuiltinObject("Person", {
    //                                "say_hello": {
    //                                    func: function() {alert("Hello World!")},
    //                                    requiredParams: 0,
    //                                    optionalParams: 0
    //                                 },
    //                                 "race": "human",
    //                              });
    //
    // to create a new object instance:
    //      var newInstance = createFunc(this);
    //
    // Where 'this' is an interpreter instance.
    //
    // Note: by default users won't be able to create instances of this object on their own, you'll need to provide a function to generate it.
    //
    defineBuiltinObject: function(name, api) {

        // iterate over module api and convert to items
        for (var key in api) {

            // get current item and convert to builtin object
            var curr = api[key];
            curr = this.__toBuiltin(curr, key, name);

            // set back into api
            api[key] = curr;
        }

        // create the object type and return the function to create new instance
        var ret = (function() {

            // create the object type
            var _ObjType = Class(Core.Object, {

                // set api
                api: api,

                // convert to string
                toString: function()
                {
                    return this.type;
                },

                // convert to repr
                toRepr: function()
                {
                    return "<" + this.type + ">";
                },

                // convert to a native javascript object
                toNativeJs: function()
                {
                    return this;
                },

                // object identifier
                name: name,
                type: name,
            });

            // create the function to return the object instance
            return function(parent) {
                var context = parent._context || parent._interpreter._context;
                if (!context) throw "Invalid parent param, must be interpreter or program!";
                return new _ObjType(context);
            }
        })();

        // return the new object creation function
        return ret;
    },

    // Convert a JavaScript object into a simple Adder object.
    // You can use this to return complex objects without having to define them as builtins first. For example:
    //
    //   function someFunc() {
    //        return AdderScript.toAdderObject("Target", {type: "car", hp: 5, isEnemy: true});
    //   }
    //
    // and later Adder script can simple use this object's API, ie:
    //
    //      if target.type == "car":
    //          print ("its a car!")
    //
    // @param name - object type name (for example when doing type(obj) this string will be returned).
    // @param api - a dictionary with object's API.
    //                      to add a const value just add key value.
    //                      to add a function add a dictionary with 'func', 'requiredParams', and 'optionalParams'.
    //                      see addBuiltinFunction() for options.
    //
    // Usage example:
    // var retObj = AdderScript.toAdderObject("Person", {
    //                                "say_hello": {
    //                                    func: function() {alert("Hello World!")},
    //                                    requiredParams: 0,
    //                                    optionalParams: 0
    //                                 },
    //                                 "race": "human",
    //                              });
    //
    // Note: calls defineBuiltinObject() internally.
    //
    toAdderObject: function(name, api, program) {

        var ret = new Core.Object(program._context || program._interpreter._context, true);
        for (var key in api) {
            ret.setAttr(key, api[key]);
        }
        return ret;
    },

});

// export the Environment class
module.exports = Environment;

},{"./../compiler":3,"./../console":7,"./../core":14,"./../dependencies/jsface":24,"./../errors":28,"./../language":61,"./../utils":79,"./program":27}],26:[function(require,module,exports){
module.exports = require("./environment");
},{"./environment":25}],27:[function(require,module,exports){
"use strict";

/**
* A program wraps an interpreter and a loaded compiled code.
* This class represent an instance of a loaded program ready to be executed.
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

// include the alternative console
var Console = require("./../console");

// include the interpreter class
var Interpreter = require("./../interpreter");

// the program class.
var Program = Class({

    // Program constructor.
    // @param compiledCode - code to load.
    // @param modules - list of modules to load.
    // @param flags - interpreter flags etc.
    // @param outputFunc - output function for 'print' statements.
    constructor: function(compiledCode, modules, flags, outputFunc)
    {
        // notify new program creation
        Console.info("Created a new program instance!", modules, flags);

        // create interpreter
        this._interpreter = new Interpreter(flags);
        if (outputFunc) {this._interpreter.output = outputFunc;}

        // load modules
        for (var i = 0; i < modules.length; ++i) {
            this._interpreter.addModule(modules[i]);
        }

        // load the code
        if (compiledCode) {this._interpreter.load(compiledCode);}
    },

    // execute program once.
	// @param funcName - if provided, will call this function instead of root block.
    execute: function(funcName) {

        // execute code
        this._interpreter.execute(funcName);
    },

    // reset context
    resetContext: function() {
        this._interpreter.resetContext();
    },

    // execute an external raw code snippet in global scope
    evalRawCode: function(code) {
        this._interpreter.eval(code);
        return this._interpreter.getLastValue();
    },

    // get last execution variable as an Adder variable object.
    _getLastValueAsVariable: function() {
        var ret = this._interpreter.getLastValue();
        return ret;
    },

    // get last execution value.
    getLastValue: function() {
        var ret = this._interpreter.getLastValue();
        return ret ? ret.toNativeJs() : ret;
    },

    // get global variable by name.
    // @param key - variable name to get from global scope.
    getGlobalVar: function(key) {
        return this._interpreter._context.getVar(key).toNativeJs();
    },

    // set a global variable by name.
    // @param key - variable name to set in global scope.
    setGlobalVar: function(key, val, readonly) {
        this._interpreter._context.setVar(key, val, readonly, true);
    },

    // get last execution error.
    getLastError: function() {
        return this._interpreter.getLastError() || null;
    },

    // propagate execution error (if we had any)
    propagateExecutionErrors: function() {
        this._interpreter.propagateExecutionErrors();
    },

    // add a builtin module
    addModule: function(moduleId, module) {
        this._interpreter.addModule(moduleId, module);
    },

    // return all global scope var names
    getGlobalScopeVarNames: function() {
        return this._interpreter._context.getAllIdentifiers();
    },
});

// export the Program class
module.exports = Program;

},{"./../console":7,"./../dependencies/jsface":24,"./../errors":28,"./../interpreter":31}],28:[function(require,module,exports){
"use strict";

/**
* Define custom errors.
*
* Author: Ronen Ness.
* Since: 2016
*/

// get console for printing
var Console = require("./console");

// add line number to message
function addLineToError(error, line) {
    error.message += (line !== undefined ? " [at line: " + parseInt(line) + "]" : "");
    error.line = line;
};

// init error instance
function initError(err)
{
    err.expectedError = true;
    err.type = "exception";
    Console.warn("Exception: ", err.message, err.stack);
}

// error for a function that the user needed to implement but didn't do it
function NotImplemented() {
    this.name = 'NotImplemented';
    this.message = 'You must implement this function in the child class.';
    this.stack = (new Error()).stack;
    initError(this);
}
NotImplemented.prototype = Object.create(Error.prototype);
NotImplemented.prototype.constructor = NotImplemented;

// error for illegal arithmetic expressions
function IllegalExpression(expression, reason, line) {
    this.name = 'IllegalExpression';
    this.message = 'Illegal Expression (' + reason + ') in "' + String(expression).substr(0, 12) + '".'
    this.stack = (new Error()).stack;
    addLineToError(this, line);
    initError(this);
}
IllegalExpression.prototype = Object.create(Error.prototype);
IllegalExpression.prototype.constructor = IllegalExpression;

// error for internal problems
function InternalError(msg, extraData) {
    this.name = 'InternalError';
    this.message = msg;
    if (extraData) {this.message += " [" + extraData + "].";}
    this.stack = (new Error()).stack;
    initError(this);
}
InternalError.prototype = Object.create(Error.prototype);
InternalError.prototype.constructor = InternalError;

// syntax errors in input code.
function SyntaxError(reason, line) {
    this.name = 'SyntaxError';
    this.message = "Syntax Error (" + reason + ").";
    this.stack = (new Error()).stack;
    addLineToError(this, line);
    initError(this);
}
SyntaxError.prototype = Object.create(Error.prototype);
SyntaxError.prototype.constructor = SyntaxError;

// exception in interpreter
function InterpreterError(reason, statement) {
    this.name = 'InterpreterError';
    this.message = "Interpreter Error (" + reason + ").";
    if (statement !== undefined) {this.message += " [at statement: " + statement + "].";}
    this.stack = (new Error()).stack;
    initError(this);
}
InterpreterError.prototype = Object.create(Error.prototype);
InterpreterError.prototype.constructor = InterpreterError;

// error while executing code
function RuntimeError(reason, statement) {
    this.name = 'RuntimeError';
    this.message = "Runtime Error (" + reason + ").";
    if (statement !== undefined) {this.message += " [at statement: " + statement + "].";}
    this.stack = (new Error()).stack;
    initError(this);
}
RuntimeError.prototype = Object.create(Error.prototype);
RuntimeError.prototype.constructor = RuntimeError;

// when user's script exceed memory limit
function ExceedMemoryLimit(msg) {
    this.name = 'ExceedMemoryLimit';
    this.message = msg;
    this.stack = (new Error()).stack;
    initError(this);
}
ExceedMemoryLimit.prototype = Object.create(Error.prototype);
ExceedMemoryLimit.prototype.constructor = ExceedMemoryLimit;

// when user's script exceed stack limit
function StackOverflow(stackLimit) {
    this.name = 'StackOverflow';
    this.message = "Stack overflow! Stack limit: " + stackLimit + ".";
    this.stack = (new Error()).stack;
    initError(this);
}
StackOverflow.prototype = Object.create(Error.prototype);
StackOverflow.prototype.constructor = StackOverflow;

// when user's script exceed statements limit
function ExceededStatementsLimit(limit) {
    this.name = 'ExceededStatementsLimit';
    this.message = "Script exceeded maximum statements limit of " + limit + " calls per run.";
    this.stack = (new Error()).stack;
    initError(this);
}
ExceededStatementsLimit.prototype = Object.create(Error.prototype);
ExceededStatementsLimit.prototype.constructor = ExceededStatementsLimit;

// when user's script exceed execution time limit
function ExceededTimeLimit(limit) {
    this.name = 'ExceededTimeLimit';
    this.message = "Script exceeded execution time limit of " + limit + " MS per run.";
    this.stack = (new Error()).stack;
    initError(this);
}
ExceededTimeLimit.prototype = Object.create(Error.prototype);
ExceededTimeLimit.prototype.constructor = ExceededTimeLimit;

// when user's script try to access undefined variable
function UndefinedVariable(key) {
    this.name = 'UndefinedVariable';
    this.message = "Undefined variable '" + key + "'!";
    this.stack = (new Error()).stack;
    initError(this);
}
UndefinedVariable.prototype = Object.create(Error.prototype);
UndefinedVariable.prototype.constructor = UndefinedVariable;

module.exports = {
    NotImplemented: NotImplemented,
    UndefinedVariable: UndefinedVariable,
    IllegalExpression: IllegalExpression,
    ExceededStatementsLimit: ExceededStatementsLimit,
    ExceededTimeLimit: ExceededTimeLimit,
    SyntaxError: SyntaxError,
    InterpreterError: InterpreterError,
    RuntimeError: RuntimeError,
    InternalError: InternalError,
    ExceedMemoryLimit: ExceedMemoryLimit,
    StackOverflow: StackOverflow,
};


},{"./console":7}],29:[function(require,module,exports){
"use strict";

/**
* Index file to include everything and wrap it up.
*
* Author: Ronen Ness.
* Since: 2016
*/

// prepare the object to export
var adder = require("./environment");

// get general defs
var defs = require('./defs');

// set adder internals
adder._internals = {
    version: defs.version,
    Utils: require('./utils'),
    Compiler: require('./compiler'),
    Interpreter: require('./interpreter'),
    Core: require('./core'),
    Language: require('./language/index'),
    Lexer: require('./compiler/lexer'),
    Parser: require('./compiler/parser'),
    Adder: require('./environment'),
    Console: require("./console"),
};

// if in browsers add to window object
if (typeof window !== "undefined") {
    window.AdderScript = adder;
};

// export main object
module.exports = adder;
},{"./compiler":3,"./compiler/lexer":4,"./compiler/parser":5,"./console":7,"./core":14,"./defs":23,"./environment":26,"./interpreter":31,"./language/index":61,"./utils":79}],30:[function(require,module,exports){
"use strict";

module.exports = {
    stackLimit: 256,                // stack depth limit.
    maxStatementsPerRun: 2048,      // maximum statements execution per run (set to null for unlimited).
    maxStringLen: 5000,             // maximum allowed string lengths.
    maxContainersLen: 1000,         // maximum items allowed in lists, sets and dictionaries.
    maxVarsInScope: 100,            // limit number of variables per scope.
    executionTimeLimit: null,       // time limit for execution in milliseconds.
    memoryAllocationLimit: 10000,   // memory limit, roughly estimated, in bytes.
    throwErrors: false,             // if true, will throw execution errors immediately when they occur.
    removeBuiltins: [],             // a list of builtin objects and functions you want to remove from language.
};

},{}],31:[function(require,module,exports){
module.exports = require("./interpreter");
},{"./interpreter":32}],32:[function(require,module,exports){
"use strict";

/**
* The class that loads compiled code and executes it.
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

// include the alternative console
var Console = require("./../console");

// include default flags
var defaultFlags = require("./default_flags");

// include compiler
var Compiler = require('./../compiler');

// include language components
var Language = require("./../language");

// include core stuff
var Core = require("./../core");

// misc utils
var Utils = require("./../utils");

// create constant for default null value
var nullConst = new Core.Variable(this._context, null);

// the Interpreter class - load compiled code and executes it.
var Interpreter = Class({

    // Interpreter constructor
    // @param flags - Interpreter flags to set. for more info and defaults, see file default_flags.Js.
    constructor: function(flags)
    {
        // store interpreter flags
        this._flags = flags || {};

        // set default flags
        for (var key in defaultFlags)
        {
            if (this._flags[key] === undefined)
            {
                this._flags[key] = defaultFlags[key];
            }
        }

        // show basic info
        Console.info("Created new interpreter!");
        Console.log("Interpreter flags", this._flags);

        // currently not executing code
        this._resetCurrExecutionData();

        // set root block to null
        this._rootBlock = null;

        // create context
        this._context = new Core.Context(this,
                                         this._flags.stackLimit,
                                         this._flags.maxVarsInScope);

        // get built-in stuff
        this._builtins = Language.Builtins;

        // set all builtin functions
        for (var key in this._builtins.Functions)
        {
            // if in removed builtin list skip
            if (this._flags.removeBuiltins.indexOf(key) !== -1) {
                continue;
            }

            // add builtin function
            var val = this._builtins.Functions[key];
            this._addBuiltinVar(key, val);
        }

        // some special consts - true, false, null, etc.
        for (key in Language.Defs.keywords)
        {
            // if in removed builtin list skip
            if (this._flags.removeBuiltins.indexOf(key) !== -1) {
                continue;
            }

            // add builtin keyword
            this._addBuiltinVar(Language.Defs.keywords[key], key);
        }

        // set all builtin consts
        for (var key in this._builtins.Consts)
        {
            // if in removed builtin list skip
            if (this._flags.removeBuiltins.indexOf(key) !== -1) {
                continue;
            }

            // add builtin const
            this._addBuiltinVar(key, this._builtins.Consts[key]);
        }

        // copy all the available statement types with their the corresponding keywords
        this._statementTypes = {};
        for (var key in Language.Statements)
        {
            var currStatement = Language.Statements[key];
            this._statementTypes[currStatement.getKeyword()] = currStatement;
        }

        // show all builtins
        Console.log("Interpreter builtins:", this._context.getAllIdentifiers());
    },

    // reset the data of the current execution
    _resetCurrExecutionData: function() {
        this._currExecution = {
            isDone: false,
            error: null,
            lastVal: nullConst,
            currStatement: null,
            currLine: -1,
            estimatedMemoryUsage: 0,
            maxStatementsPerRun: this._flags.maxStatementsPerRun,
            executionTimeLimit: this._flags.executionTimeLimit,
            executionStartTime: this._getCurrTimeMs(),
        }
    },

    // set builtin var
    _addBuiltinVar: function(key, val)
    {
        var readonly = true;
        var force = true;
        var variable = new Core.Variable(this._context, val);
        this._context.setVar(key, variable, readonly, force);
    },

    // include a module and export it to the scripts.
    // this is the most basic way to include / exclude functionality by specific modules.
    // @param moduleId - string, the module name.
    // @param module - (optional) module type, use it if you want to add module that is not a built-in module.
    addModule: function(moduleId, module)
    {
        // special case - if moduleId is "ALL" or "SAFE", add all modules
        if (moduleId === "ALL" || moduleId === "SAFE")
        {
            // iterate over all built-in modules
            for (var key in Language.Modules) {

                // if requested only safe modules make sure its a production-safe module
                if (moduleId === "SAFE" && !(new Language.Modules[key]()).isSafe) {
                    continue;
                }

                // add module
                this.addModule(key);
            }
            return;
        }

        Console.log("Load module: ", moduleId);

        // get module and make sure exist
        if (module === undefined)
        {
            var module = Language.Modules[moduleId];
            if (module === undefined) {throw new Errors.InterpreterError("Module '" + moduleId + "' not defined.");}
        }

        // add module to builtin vars
        this._addBuiltinVar(moduleId, new module(this._context, "Module." + moduleId));
    },

    // define a new function
    // @param name - function name.
    // @param block - function block.
    // @param arguments - list with function arguments names.
    defineFunction: function(name, block, args)
    {

        // make sure we got a valid block
        if (!block) {
            throw new Errors.SyntaxError("Missing block for function '" + name + "'!");
        }

        // create variable for this function
        var newVar = new Core.Variable(this._context, {
                                  isFunction: true,
                                  name: name,
                                  block: block,
                                  arguments: args,
                                  requiredArgs: args.length,
                                    toString: function() {
                                        return '<' + this.name + '>';
                                    },
                                    toRepr: function() {
                                        return this.toString();
                                    },
                                  });

        // add function to current scope
        this._context.setVar(name, newVar);
        return newVar;
    },

    // call a function.
    // @param func - function object or the variable containing it.
    // @param args - args to call with.
    // @param object - optional, object containing the function to call.
    // @return function ret value.
    callFunction: function(func, args, object)
    {
		// if function is string, get it from context
		if (typeof func === "string")
			func = this._context.getVar(func);
		
        // if got a var containing the function, take the function value from it
        if (func._value) {
            func = func._value;
        }

        // make sure its a function
        if (!func || !func.isFunction)
        {
            throw new Errors.RuntimeError("'" + func + "' is not a function!");
        }

        // validate number of args required
        if (func.requiredArgs !== null &&
           (args.length < func.requiredArgs || args.length > func.requiredArgs + func.optionalArgs))
        {
            throw new Errors.RuntimeError("'" + func + "' expect " + func.requiredArgs + " arguments. " + args.length + " given.");
        }

        // is it a built-in function? call it
        if (func.isBuiltinFunc)
        {
            // if this builtin function require native javascript params
            if (func.convertParamsToNativeJs) {
                if (!args.map) {args = [args];}
                args = args.map(function(x) {
                    return (x && x.toNativeJs) ? x.toNativeJs() : x;
                });
            }
            // else, convert args to Adder objects.
            else
            {
                // normalize args
                args = Core.Variable.makeAdderObjects(this._context, args)._value._list;
            }

            // make sure object is an Adder object
            if (object !== undefined && !object.__isAdderObject) {
                object = Core.Variable.makeAdderObjects(this._context, object)._value;
            }

            // call and return the function result
            var ret = func.__imp.apply(object !== undefined ? object : this, args);
            this._context.getScope().returnValue = ret;
            this.setLastValue(ret);
            return ret;
        }

        // if got here it means its a user-defined function

        // create a new scope
        this._context.stackPush("function");

        // set arguments as local vars in function's scope
        for (var i = 0; i < args.length; ++i)
        {
            this._context.setVar(func.arguments[i], args[i]);
        }

        // execute function's block
        func.block.execute();

        // when done pop stack and return value
        var ret = this._context.getScope().returnValue;
        this.setLastValue(ret);
        this._context.stackPop();
        return ret;
    },

    // return from current scope with a given value
    returnValue: function(val)
    {
        // set return value register
        var scope = this._context.getScope();
        scope.returnValue = val;
        scope.calledReturn = true;
    },

    // get current time in ms
    _getCurrTimeMs: function()
    {
        return Utils.getTime();
    },

    // return execution time of current program
    _getExecutionTime: function()
    {
        return this._getCurrTimeMs() - this._currExecution.executionStartTime;
    },

    // notify that current execution is done
    // @param error - optional exception is occured
    finishExecute: function(error)
    {
        // set done and last exception
        this._currExecution.isDone = true;
        this._currExecution.error = error;

        // if we had an error clear stack
        if (error) {
            this._context.clearStack();
        }

        // if set to throw errors outside
        if (error && this._flags.throwErrors) {
            throw error;
        }
    },

    // reset context (clear stack and remove all user-defined global vars)
    resetContext: function() {
        this._context.reset();
    },

    // re-throw execution exception, only if had one
    propagateExecutionErrors: function()
    {
        if (this._currExecution.error)
        {
            throw this._currExecution.error;
        }
    },

    // get last exception, if happened
    getLastError: function()
    {
        return this._currExecution.error;
    },

    // update current execution memory usage
    updateMemoryUsage: function(diff)
    {
        this._currExecution.estimatedMemoryUsage += diff;
        if (this._flags.memoryAllocationLimit &&
            this._currExecution.estimatedMemoryUsage > this._flags.memoryAllocationLimit) {
            throw new Errors.ExceedMemoryLimit("Exceeded memory usage limit!");
        }
    },

    // execute the currently loaded code
	// @param funcName - if provided, will call this function instead of root block.
    execute: function(funcName)
    {
        // no root block is set? exception
        if (this._rootBlock === null) {
            throw new Errors.InterpreterError("Tried to execute code without loading any code first!");
        }

        // reset execution data
        this._resetCurrExecutionData();

        // start execution
        try {
			if (funcName) {
				this.callFunction(funcName, []);
			}
			else {
				this._rootBlock.execute();
			}
            this.finishExecute();
        }
        catch(e) {
            this.finishExecute(e);
        }
    },

    // get last evaluate value
    getLastValue: function()
    {
        return this._currExecution.lastVal;
    },

    // get last statement
    getLastStatement: function()
    {
        return this._currExecution.currStatement;
    },

    // set the last evaluated value
    setLastValue: function(value)
    {
        // special case for optimizations
        if (value === undefined || value === null || value._value === null) {
            this._currExecution.lastVal = nullConst;
            return;
        }

        // make sure value is a variable
        value = Core.Variable.makeVariables(this._context, value);

        // set it
        this._currExecution.lastVal = value;
    },

    // evaluate a statement
    evalStatement: function(statement)
    {
        // reset last value
        this.setLastValue(nullConst);

        // set current line of code (for errors etc)
        this._currExecution.currLine = statement._line;
        this._currExecution.currStatement = statement;

        // check statements limit
        if (this._currExecution.maxStatementsPerRun !== null &&
            this._currExecution.maxStatementsPerRun-- <= 0) {
            throw new Errors.ExceededStatementsLimit(this._flags.maxStatementsPerRun);
        }

        // check for time limit
        if (this._currExecution.executionTimeLimit !== null) {
            if (this._getExecutionTime() > this._currExecution.executionTimeLimit) {
                throw new Errors.ExceededTimeLimit(this._flags.executionTimeLimit);
            }
        }

        try {

            // execute command
            var ret = statement.execute();
            this.setLastValue(ret);

        } catch (e) {

            // add error line number
            if (e.message && this._currExecution.currLine && e.line === undefined)
            {
                e.message += " [at line: " + this._currExecution.currLine + "]"
                e.line = true;
            }
            throw e;
        }
    },

    // evaluate a single code line
    eval: function(code)
    {
        var compiler = new Compiler(this._flags);
        var compiled = compiler.compile(code);
        this.load(compiled);
        this.execute();
    },

    // convert current ast line into a statement
    __parseStatement: function(ast, line)
    {
        // check if first token is a predefined statement (like if, print, etc..)
        var statementType = this._statementTypes[ast[0].value];

        // if statement is not defined, parse this statement as a general expression (default)
        statementType = statementType || this._statementTypes[""];

        // instantiate statement
        var currStatement = new statementType(this._context, ast, line);
        return currStatement;
    },

    // load compiled code.
    // @param compiledCode - the output of the compiler, basically a list of AST nodes.
    load: function(compiledCode)
    {
        Console.debug("Loading code..", compiledCode);

        // get context
        var context = this._context;

        // create global block and blocks queue
        var globalBlock = new Core.Block(context);
        var blocksQueue = [globalBlock];

        // current block and last statement parsed
        var currBlock = globalBlock;
        var lastStatement = {openNewBlock: false};

        // iterate over compiled code and parse statements
        for (var i = 0; i < compiledCode.length; ++i)
        {
            // get current AST and line index
            var currAst = compiledCode[i][0];
            var line = compiledCode[i][1];

            // did we just opened a new block
            var openedNewBlock = false;

            // special case - if new block
            if (currAst === "NEW_BLOCK") {

                // create new block and add it to blocks queue
                var newBlock = new Core.Block(context);
                currBlock.addBlock(newBlock);
                blocksQueue.push(newBlock);

                // mark that we just opened a new block in this statement
                openedNewBlock = true;
                continue;
            }
            // special case - if block ends
            if (currAst === "END_BLOCK") {

                // remove block from blocks list
                blocksQueue.pop();
                if (blocksQueue.length === 0) {
                    throw new Errors.InternalError("Invalid END_BLOCK token, ran out of blocks!");
                }
                continue;
            }

            // if last statement was a statement that opens a new block, make sure it did
            if (lastStatement.OpenNewBlock && !openedNewBlock)
            {
                throw new Errors.SyntaxError('Missing block indent.', line);
            }
            // now check the opposite - opened a new block without proper reason
            else if (!lastStatement.OpenNewBlock && openedNewBlock)
            {
                throw new Errors.SyntaxError('Unexpected block indent.', line);
            }

            // skip empty
            if (currAst.length === 0) {continue;}

            // parse into statement
            var statement = this.__parseStatement(currAst, line);

            // get current block
            currBlock = blocksQueue[blocksQueue.length-1];

            // get last statement in current block and set it as current statement previous statement
            var lastStatementInBlock = currBlock._lastStatement;
            statement.setPreviousStatement(lastStatementInBlock);

            // add current statement
            currBlock.addStatement(statement);

            // store current statement as last statement
            lastStatement = statement;
        }

        // set global block as our new root block
        this._rootBlock = globalBlock;
        Console.debug("Code loaded successfully!");
    },

    // return a debug representation of the blocks
    getDebugBlocksView: function() {
        return this._rootBlock.getDebugBlocksView(0);
    },

    // program output function
    output: function() {
        console.log.apply(null, arguments);
    },
});

// export the Interpreter class
module.exports = Interpreter;


},{"./../compiler":3,"./../console":7,"./../core":14,"./../dependencies/jsface":24,"./../errors":28,"./../language":61,"./../utils":79,"./default_flags":30}],33:[function(require,module,exports){
"use strict";

// general defs
var generalDefs = require("./../../defs");

// all consts
var consts = {
    '__VERSION__': generalDefs.version,
    '__ABOUT__': generalDefs.about,
    'True': true,
    'False': false,
    'None': null,
    'NaN': NaN,
};

// export
module.exports = consts;


},{"./../../defs":23}],34:[function(require,module,exports){
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


},{}],35:[function(require,module,exports){
"use strict";

/**
* Implement the all() function
*
* Author: Ronen Ness.
* Since: 2016.
*/

// include jsface for classes
var jsface = require("./../../dependencies/jsface"),
    Class  = jsface.Class,
    extend = jsface.extend;

// include errors
var Errors = require("./../../errors");

// require the core stuff
var Core = require("./../../core");

// export the function
module.exports = Core.BuiltinFunc.create(function()
    {
        for (var i = 0; i < arguments.length; ++i) {
            if (!(arguments[i]._value)) {return false;}
        }
        return true;
    },
    null, null);

},{"./../../core":14,"./../../dependencies/jsface":24,"./../../errors":28}],36:[function(require,module,exports){
"use strict";

/**
* Implement the any() function
*
* Author: Ronen Ness.
* Since: 2016.
*/

// include jsface for classes
var jsface = require("./../../dependencies/jsface"),
    Class  = jsface.Class,
    extend = jsface.extend;

// include errors
var Errors = require("./../../errors");

// require the core stuff
var Core = require("./../../core");

// built-in Any function.
var Any = Class(Core.BuiltinFunc, {

    __imp: function(args)
    {
        for (var i = 0; i < args.length; ++i)
        {
            if (args[i]._value) return true;
        }
        return false;
    },

    // accept any number of args
    requiredArgs: null,
});

// export the function
module.exports = Core.BuiltinFunc.create(function()
    {
        for (var i = 0; i < arguments.length; ++i)
        {
            if (arguments[i]._value) {return true;}
        }
        return false;
    },
    null, null);

},{"./../../core":14,"./../../dependencies/jsface":24,"./../../errors":28}],37:[function(require,module,exports){
"use strict";

/**
* Implement the bin() function
*
* Author: Ronen Ness.
* Since: 2016.
*/

// include jsface for classes
var jsface = require("./../../dependencies/jsface"),
    Class  = jsface.Class,
    extend = jsface.extend;

// include errors
var Errors = require("./../../errors");

// require the core stuff
var Core = require("./../../core");

// export the function
module.exports = Core.BuiltinFunc.create(function(val)
    {
        return (val._value >>> 0).toString(2);
    },
    1, null);

},{"./../../core":14,"./../../dependencies/jsface":24,"./../../errors":28}],38:[function(require,module,exports){
"use strict";

/**
* Implement the bool() function
*
* Author: Ronen Ness.
* Since: 2016.
*/

// include jsface for classes
var jsface = require("./../../dependencies/jsface"),
    Class  = jsface.Class,
    extend = jsface.extend;

// include errors
var Errors = require("./../../errors");

// require the core stuff
var Core = require("./../../core");

// export the function
module.exports = Core.BuiltinFunc.create(function(val)
    {
        return Boolean(val._value);
    },
    1, null);

},{"./../../core":14,"./../../dependencies/jsface":24,"./../../errors":28}],39:[function(require,module,exports){
"use strict";

/**
* Implement the callable() function
*
* Author: Ronen Ness.
* Since: 2016.
*/

// include jsface for classes
var jsface = require("./../../dependencies/jsface"),
    Class  = jsface.Class,
    extend = jsface.extend;

// include errors
var Errors = require("./../../errors");

// require the core stuff
var Core = require("./../../core");

// export the function
module.exports = Core.BuiltinFunc.create(function(val)
    {
        var val = val._value;
        return Boolean(val && val.isFunction);
    },
    1, null);

},{"./../../core":14,"./../../dependencies/jsface":24,"./../../errors":28}],40:[function(require,module,exports){
"use strict";

/**
* Implement the chr() function
*
* Author: Ronen Ness.
* Since: 2016.
*/

// include jsface for classes
var jsface = require("./../../dependencies/jsface"),
    Class  = jsface.Class,
    extend = jsface.extend;

// include errors
var Errors = require("./../../errors");

// require the core stuff
var Core = require("./../../core");

// export the function
module.exports = Core.BuiltinFunc.create(function(val)
    {
        return String.fromCharCode(val._value);
    },
    1, null);

},{"./../../core":14,"./../../dependencies/jsface":24,"./../../errors":28}],41:[function(require,module,exports){
"use strict";

/**
* Implement the cmp() function
*
* Author: Ronen Ness.
* Since: 2016.
*/

// include jsface for classes
var jsface = require("./../../dependencies/jsface"),
    Class  = jsface.Class,
    extend = jsface.extend;

// include errors
var Errors = require("./../../errors");

// require the core stuff
var Core = require("./../../core");

function getNumericVal(x){

    // if string
    if (typeof x === "string")
    {
        var ret = 0;
        for (var i = 0; i < x.length; i++) {
          ret += x.charCodeAt(i);
        }
        return ret;
    }

    // else, convert to numeric value
    return parseFloat(x);
}

// export the function
module.exports = Core.BuiltinFunc.create(function(a, b)
    {
        return getNumericVal(a._value) - getNumericVal(b._value);
    },
    2, null);

},{"./../../core":14,"./../../dependencies/jsface":24,"./../../errors":28}],42:[function(require,module,exports){
"use strict";

/**
* Implement the delete() function
*
* Author: Ronen Ness.
* Since: 2016.
*/

// include jsface for classes
var jsface = require("./../../dependencies/jsface"),
    Class  = jsface.Class,
    extend = jsface.extend;

// include errors
var Errors = require("./../../errors");

// require the core stuff
var Core = require("./../../core");

// export the function
module.exports = Core.BuiltinFunc.create(function(variable)
    {
        if (variable && variable.deleteSelf) {
            return variable.deleteSelf();
        }
        throw new Errors.RuntimeError("Invalid object to delete!");
    },
    1, 0, false);

},{"./../../core":14,"./../../dependencies/jsface":24,"./../../errors":28}],43:[function(require,module,exports){
"use strict";

/**
* Implement the dict() function
*
* Author: Ronen Ness.
* Since: 2016.
*/

// include jsface for classes
var jsface = require("./../../dependencies/jsface"),
    Class  = jsface.Class,
    extend = jsface.extend;

// include errors
var Errors = require("./../../errors");

// require the core stuff
var Core = require("./../../core");

// require misc utils
var Utils = require("./../../utils");

// export the function
module.exports = Core.BuiltinFunc.create(function()
    {
        return new Core.Dict(this._context);
    },
    0, 0, false);

},{"./../../core":14,"./../../dependencies/jsface":24,"./../../errors":28,"./../../utils":79}],44:[function(require,module,exports){
"use strict";

/**
* Implement the dir() function
*
* Author: Ronen Ness.
* Since: 2016.
*/

// include jsface for classes
var jsface = require("./../../dependencies/jsface"),
    Class  = jsface.Class,
    extend = jsface.extend;

// include errors
var Errors = require("./../../errors");

// require the core stuff
var Core = require("./../../core");

// export the function
module.exports = Core.BuiltinFunc.create(function(obj)
    {
        // if object provided
        if (obj)
        {
            var val = obj._value;
            if (val && val.api) {
                return Object.keys(val.api);
            }
            throw new Errors.RuntimeError("'" + obj.type + "' Is not a valid object type for dir().");
        }

        // if no object provided return the context variables
        return this._context.getAllIdentifiers();

    },
    0, 1, false);

},{"./../../core":14,"./../../dependencies/jsface":24,"./../../errors":28}],45:[function(require,module,exports){
"use strict";

/**
* Implement the max() function
*
* Author: Ronen Ness.
* Since: 2016.
*/

// include jsface for classes
var jsface = require("./../../dependencies/jsface"),
    Class  = jsface.Class,
    extend = jsface.extend;

// include errors
var Errors = require("./../../errors");

// require the core stuff
var Core = require("./../../core");

// export the function
module.exports = Core.BuiltinFunc.create(function(a, b)
    {
        // check equal and return
        return Core.Variable.equal(a, b);
    },
    2, null);

},{"./../../core":14,"./../../dependencies/jsface":24,"./../../errors":28}],46:[function(require,module,exports){
"use strict";

/**
* Implement the exist() function
*
* Author: Ronen Ness.
* Since: 2016.
*/

// include jsface for classes
var jsface = require("./../../dependencies/jsface"),
    Class  = jsface.Class,
    extend = jsface.extend;

// include errors
var Errors = require("./../../errors");

// require the core stuff
var Core = require("./../../core");

// export the function
module.exports = Core.BuiltinFunc.create(function(variable)
    {
        return this._context.exist(variable._value);
    },
    1, 0, false);

},{"./../../core":14,"./../../dependencies/jsface":24,"./../../errors":28}],47:[function(require,module,exports){
"use strict";

/**
* Implement the float() function
*
* Author: Ronen Ness.
* Since: 2016.
*/

// include jsface for classes
var jsface = require("./../../dependencies/jsface"),
    Class  = jsface.Class,
    extend = jsface.extend;

// include errors
var Errors = require("./../../errors");

// require the core stuff
var Core = require("./../../core");

// export the function
module.exports = Core.BuiltinFunc.create(function(val)
    {
        return parseFloat(val._value);
    },
    1, null);

},{"./../../core":14,"./../../dependencies/jsface":24,"./../../errors":28}],48:[function(require,module,exports){
"use strict";

// all functions
var functions = {
    'print': require('./print'),
    'all': require('./all'),
    'any': require('./any'),
    'bin': require('./bin'),
    'bool': require('./bool'),
    'callable': require('./callable'),
    'chr': require('./chr'),
    'cmp': require('./cmp'),
    'float': require('./float'),
    'int': require('./int'),
    'len': require('./len'),
    'ord': require('./ord'),
    'range': require('./range'),
    'str': require('./str'),
    'repr': require('./repr'),
    'type': require('./type'),
    'list': require('./list'),
    'set': require('./set'),
    'dict': require('./dict'),
    'reversed': require('./reversed'),
    'equal': require('./equal'),
    'dir': require('./dir'),
    'delete': require('./delete'),
    'exist': require('./exist'),
    '_sec_test': require('./test'),
};

// set identifier field
for (var key in functions)
{
    functions[key].identifier = "builtin.functions." + key;
}

// export
module.exports = functions;

},{"./all":35,"./any":36,"./bin":37,"./bool":38,"./callable":39,"./chr":40,"./cmp":41,"./delete":42,"./dict":43,"./dir":44,"./equal":45,"./exist":46,"./float":47,"./int":49,"./len":50,"./list":51,"./ord":52,"./print":53,"./range":54,"./repr":55,"./reversed":56,"./set":57,"./str":58,"./test":59,"./type":60}],49:[function(require,module,exports){
"use strict";

/**
* Implement the int() function
*
* Author: Ronen Ness.
* Since: 2016.
*/

// include jsface for classes
var jsface = require("./../../dependencies/jsface"),
    Class  = jsface.Class,
    extend = jsface.extend;

// include errors
var Errors = require("./../../errors");

// require the core stuff
var Core = require("./../../core");

// export the function
module.exports = Core.BuiltinFunc.create(function(val, base)
    {
        return parseInt(val._value, base ? base._value : undefined);
    },
    1, 1);

},{"./../../core":14,"./../../dependencies/jsface":24,"./../../errors":28}],50:[function(require,module,exports){
"use strict";

/**
* Implement the len() function
*
* Author: Ronen Ness.
* Since: 2016.
*/

// include jsface for classes
var jsface = require("./../../dependencies/jsface"),
    Class  = jsface.Class,
    extend = jsface.extend;

// include errors
var Errors = require("./../../errors");

// require the core stuff
var Core = require("./../../core");

// export the function
module.exports = Core.BuiltinFunc.create(function(val)
    {
        var val = val._value;
        if (val) {
            if (val.api && val.len) {return val.len();}
            if (val.length !== undefined) {return val.length;}
        }
        return null;
    },
    1, null);

},{"./../../core":14,"./../../dependencies/jsface":24,"./../../errors":28}],51:[function(require,module,exports){
"use strict";

/**
* Implement the list() function
*
* Author: Ronen Ness.
* Since: 2016.
*/

// include jsface for classes
var jsface = require("./../../dependencies/jsface"),
    Class  = jsface.Class,
    extend = jsface.extend;

// include errors
var Errors = require("./../../errors");

// require the core stuff
var Core = require("./../../core");

// require misc utils
var Utils = require("./../../utils");

// export the function
module.exports = Core.BuiltinFunc.create(function()
    {
        return new Core.List(this._context, Utils.toArray(arguments));
    },
    null, null, false);

},{"./../../core":14,"./../../dependencies/jsface":24,"./../../errors":28,"./../../utils":79}],52:[function(require,module,exports){
"use strict";

/**
* Implement the ord() function
*
* Author: Ronen Ness.
* Since: 2016.
*/

// include jsface for classes
var jsface = require("./../../dependencies/jsface"),
    Class  = jsface.Class,
    extend = jsface.extend;

// include errors
var Errors = require("./../../errors");

// require the core stuff
var Core = require("./../../core");

// export the function
module.exports = Core.BuiltinFunc.create(function(val)
    {
        // get value
        var str = val._value;

        // make sure its string
        if (typeof str !== "string") {
            throw new Errors.RuntimeError("'ord()' expect a string as parameter (called with '" + (typeof str) + "').");
        }

        // make sure length is ok
        if (str.length !== 1) {
            throw new Errors.RuntimeError("'ord()' expect string with length of 1 (called with length '" + str.length + "').");
        }

        // return result
        return str.charCodeAt(0);
    },
    1, null);

},{"./../../core":14,"./../../dependencies/jsface":24,"./../../errors":28}],53:[function(require,module,exports){
"use strict";

/**
* Implement the print function (translated to console.log)
*
* Author: Ronen Ness.
* Since: 2016.
*/

// include jsface for classes
var jsface = require("./../../dependencies/jsface"),
    Class  = jsface.Class,
    extend = jsface.extend;

// include errors
var Errors = require("./../../errors");

// require the core stuff
var Core = require("./../../core");

// require misc utils
var Utils = require("./../../utils");

// export the function
module.exports = Core.BuiltinFunc.create(function()
    {
        // convert arguments to array
        var args = Utils.toArray(arguments);

        // convert to native js objects and print
        args = args.map(function(x) {return x.toString()});
        this._context._interpreter.output.apply(this._context._interpreter, args);
    },
    0, 100);

},{"./../../core":14,"./../../dependencies/jsface":24,"./../../errors":28,"./../../utils":79}],54:[function(require,module,exports){
"use strict";

/**
* Implement the range() function
*
* Author: Ronen Ness.
* Since: 2016.
*/

// include jsface for classes
var jsface = require("./../../dependencies/jsface"),
    Class  = jsface.Class,
    extend = jsface.extend;

// include errors
var Errors = require("./../../errors");

// require the core stuff
var Core = require("./../../core");

// export the function
module.exports = Core.BuiltinFunc.create(function(start, stop, step)
    {
        // one arg - its stop step
        if (stop === undefined && step === undefined)
        {
            stop = start._value;
            start = 0;
            step = 1;
        }
        // more than one arg - start, stop, [step]
        else
        {
            start = start._value;
            stop = stop._value;
            step = step ? step._value : 1;
        }

        // check legal params
        if (typeof start !== "number" ||
            typeof stop !== "number" ||
            typeof step !== "number")
            {
                throw new Errors.RuntimeError("Illegal arguments!");
            }

        // make sure values are legal
        if (step === 0) {return new Core.List(this._context, []);}
        if (step > 0 && stop < start) {return new Core.List(this._context, []);}
        if (step < 0 && stop > start) {return new Core.List(this._context, []);}

        // get range
        var ret = [];
        var curr = start;
        while (!(isNaN(curr) ||
                (step > 0 && curr >= stop) ||
                (step < 0 && curr <= stop) ||
                ret.length >= 100000))
        {
            // push value and increase
            ret.push(curr);
            curr += step;
        }
        return new Core.List(this._context, ret);
    },
    1, 2);

},{"./../../core":14,"./../../dependencies/jsface":24,"./../../errors":28}],55:[function(require,module,exports){
"use strict";

/**
* Implement the repr() function
*
* Author: Ronen Ness.
* Since: 2016.
*/

// include jsface for classes
var jsface = require("./../../dependencies/jsface"),
    Class  = jsface.Class,
    extend = jsface.extend;

// include errors
var Errors = require("./../../errors");

// require the core stuff
var Core = require("./../../core");

// export the function
module.exports = Core.BuiltinFunc.create(function(val)
    {
        return val.toRepr();
    },
    1, null);
},{"./../../core":14,"./../../dependencies/jsface":24,"./../../errors":28}],56:[function(require,module,exports){
"use strict";

/**
* Implement the reversed function
*
* Author: Ronen Ness.
* Since: 2016.
*/

// include jsface for classes
var jsface = require("./../../dependencies/jsface"),
    Class  = jsface.Class,
    extend = jsface.extend;

// include errors
var Errors = require("./../../errors");

// require the core stuff
var Core = require("./../../core");

// export the function
module.exports = Core.BuiltinFunc.create(function(val)
    {
        if (val.type !== "list")
        {
            throw new Errors.RuntimeError("'reversed()' expecting a list as param (" + val.type + " given).");
        }
        var ret = val._value.clone();
        ret.reverse();
        return ret;
    },
    1, null);

},{"./../../core":14,"./../../dependencies/jsface":24,"./../../errors":28}],57:[function(require,module,exports){
"use strict";

/**
* Implement the set() function
*
* Author: Ronen Ness.
* Since: 2016.
*/

// include jsface for classes
var jsface = require("./../../dependencies/jsface"),
    Class  = jsface.Class,
    extend = jsface.extend;

// include errors
var Errors = require("./../../errors");

// require the core stuff
var Core = require("./../../core");

// require misc utils
var Utils = require("./../../utils");

// export the function
module.exports = Core.BuiltinFunc.create(function()
    {
        return new Core.Set(this._context, Utils.toArray(arguments));
    },
    null, null, false);

},{"./../../core":14,"./../../dependencies/jsface":24,"./../../errors":28,"./../../utils":79}],58:[function(require,module,exports){
"use strict";

/**
* Implement the str() function
*
* Author: Ronen Ness.
* Since: 2016.
*/

// include jsface for classes
var jsface = require("./../../dependencies/jsface"),
    Class  = jsface.Class,
    extend = jsface.extend;

// include errors
var Errors = require("./../../errors");

// require the core stuff
var Core = require("./../../core");

// export the function
module.exports = Core.BuiltinFunc.create(function(val)
    {
        return val.toString();
    },
    1, null);
},{"./../../core":14,"./../../dependencies/jsface":24,"./../../errors":28}],59:[function(require,module,exports){
(function (global){
"use strict";

/**
* Implement the special test function, that calls the function "window.__adder_script_test" with the arguments.
* Note: its your responsibility to impalement __adder_script_test.
*
* Author: Ronen Ness.
* Since: 2016.
*/

// include jsface for classes
var jsface = require("./../../dependencies/jsface"),
    Class  = jsface.Class,
    extend = jsface.extend;

// include errors
var Errors = require("./../../errors");

// require the core stuff
var Core = require("./../../core");

// require misc utils
var Utils = require("./../../utils");

// export the function
module.exports = Core.BuiltinFunc.create(function(args)
    {
        args = Utils.toArray(arguments);
        var _window = typeof window === "undefined" ? global : window;
        if (_window.__adder_script_test) {return _window.__adder_script_test.apply(null, args)};
        return args;
    },
    null, null);

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./../../core":14,"./../../dependencies/jsface":24,"./../../errors":28,"./../../utils":79}],60:[function(require,module,exports){
"use strict";

/**
* Implement the type() function
*
* Author: Ronen Ness.
* Since: 2016.
*/

// include jsface for classes
var jsface = require("./../../dependencies/jsface"),
    Class  = jsface.Class,
    extend = jsface.extend;

// include errors
var Errors = require("./../../errors");

// require the core stuff
var Core = require("./../../core");

// export the function
module.exports = Core.BuiltinFunc.create(function(val)
    {
        return val.getType();
    },
    1, null);

},{"./../../core":14,"./../../dependencies/jsface":24,"./../../errors":28}],61:[function(require,module,exports){
"use strict";

// basic language stuff
var language = {
    'Statements': require('./statements'),
    'Defs': require('./defs'),
    'Modules': require('./modules'),
    'Builtins': {
        'Functions': require('./functions'),
        'Consts': require('./consts'),
    }
};

// export language defs
module.exports = language;

},{"./consts":33,"./defs":34,"./functions":48,"./modules":63,"./statements":75}],62:[function(require,module,exports){
"use strict";

/**
* Module to show alert boxes
*
* Author: Ronen Ness.
* Since: 2016.
*/

// include jsface for classes
var jsface = require("./../../dependencies/jsface"),
    Class  = jsface.Class,
    extend = jsface.extend;

// include errors
var Errors = require("./../../errors");

// require the core stuff
var Core = require("./../../core");

// built-in Alert function.
var Alert = Core.BuiltinFunc.create(function(val)
    {
        // if no alert, use console instead
        if (typeof alert === "undefined") {
            return console.log(val._value);
        }

        // how alert
        return alert(val._value);
    }, 1, 0, false);

// create the module and export it
var AlertModule = Class(Core.Module, {

    // all the module builtin functions and consts (key is their name)
    api: {
        alert: Alert,
    },

    // not safe for production
    isSafe: false,

    // module identifier
    name: "Alert",

    // module version
    version: "1.0.0",
});

// export the Alert class
module.exports = AlertModule;

},{"./../../core":14,"./../../dependencies/jsface":24,"./../../errors":28}],63:[function(require,module,exports){
"use strict";

// all built-in modules
 module.exports = {
    'Math': require('./math'),
    'Input': require('./input'),
    'Alert': require('./alert'),
    'Random': require('./random'),
};


},{"./alert":62,"./input":64,"./math":65,"./random":66}],64:[function(require,module,exports){
"use strict";

/**
* Module to get input from users view alert box.
*
* Author: Ronen Ness.
* Since: 2016.
*/

// include jsface for classes
var jsface = require("./../../dependencies/jsface"),
    Class  = jsface.Class,
    extend = jsface.extend;

// include errors
var Errors = require("./../../errors");

// require the core stuff
var Core = require("./../../core");

// built-in RawInput function.
var RawInput = Core.BuiltinFunc.create(function(text, defval)
    {
        // if no prompt, raise exception
        if (typeof prompt === "undefined") {
            throw new Errors.RuntimeError("rawInput not supported on this platform!");
        }

        // show prompt and return result value
        return window.prompt(text._value, defval ? defval._value : "");
    }, 1, 1, false
);

// create the module and export it
var Input = Class(Core.Module, {

    // all the module builtin functions and consts (key is their name)
    api: {
        rawInput: RawInput,
    },

    // not safe for production
    isSafe: false,

    // module identifier
    name: "Input",

    // module version
    version: "1.0.0",
});

// export the Input class
module.exports = Input;

},{"./../../core":14,"./../../dependencies/jsface":24,"./../../errors":28}],65:[function(require,module,exports){
"use strict";

/**
* Math module contains math related functions and consts.
*
* Author: Ronen Ness.
* Since: 2016.
*/

// include jsface for classes
var jsface = require("./../../dependencies/jsface"),
    Class  = jsface.Class,
    extend = jsface.extend;

// include errors
var Errors = require("./../../errors");

// include misc utils
var Utils = require("./../../utils");

// require the core stuff
var Core = require("./../../core");

// built-in abs function.
var Abs = Core.BuiltinFunc.create(function(val)
    {
        return Math.abs(val._value);
    },1,0,true);

// built-in max function.
var Max = Core.BuiltinFunc.create(function()
    {
        var args = Core.BuiltinFunc.getArgumentsOrListContent(this._context, arguments);
        return Math.max.apply(null, Utils.toArray(args).map(function(x) {return x._value;}));
    },1, 100, true);

// built-in min function.
var Min = Core.BuiltinFunc.create(function(val)
    {
        var args = Core.BuiltinFunc.getArgumentsOrListContent(this._context, arguments);
        return Math.min.apply(null, Utils.toArray(args).map(function(x) {return x._value;}));
    },1,100,true);

// built-in Pow function.
var Pow = Core.BuiltinFunc.create(function(val, pow)
    {
        return Math.pow(val._value, pow ? pow._value : undefined);
    },1,1,true);

// built-in Round function.
var Round = Core.BuiltinFunc.create(function(val)
    {
        return Math.round(val._value);
    },1,0,true);

// built-in Floor function.
var Floor = Core.BuiltinFunc.create(function(val)
    {
        return Math.floor(val._value);
    },1,0,true);

// built-in Ceil function.
var Ceil = Core.BuiltinFunc.create(function(val)
    {
        return Math.ceil(val._value);
    },1,0,true);

// built-in cos function.
var Cos = Core.BuiltinFunc.create(function(val)
    {
        return Math.cos(val._value);
    },1,0,true
);

// built-in sin function.
var Sin = Core.BuiltinFunc.create(function(val)
    {
        return Math.sin(val._value);
    },1,0,true);

// built-in atan function.
var Atan = Core.BuiltinFunc.create(function(val)
    {
        return Math.atan(val._value);
    },1,0,true);

// built-in exp function.
var Exp = Core.BuiltinFunc.create(function(val)
    {
        return Math.exp(val._value);
    },1,0,true);

// built-in tan function.
var Tan = Core.BuiltinFunc.create(function(val)
    {
        return Math.tan(val._value);
    },1,0,true);

// built-in log function.
var Log = Core.BuiltinFunc.create(function(val)
    {
        return Math.log(val._value);
    },1,0,true);

// built-in sqrt function.
var Sqrt = Core.BuiltinFunc.create(function(val)
    {
        return Math.sqrt(val._value);
    },1,0,true);

// built-in sign function.
var Sign = Core.BuiltinFunc.create(function(val)
    {
        if (Math.sign) {
            return Math.sign(val._value);
        }
        return val._value < 0 ? -1 : val._value > 0 ? 1 : 0;
    },1,0,true);

// built-in sum function.
var Sum = Core.BuiltinFunc.create(function()
    {
        // convert to args
        var args = Core.BuiltinFunc.getArgumentsOrListContent(this._context, arguments);

        // sum and return result
        var ret = 0;
        for (var i = 0; i < args.length; ++i)
        {
            ret += parseFloat(args[i]._value);
        }
        return ret;
    },null, null, true);

// built-in mul function.
var Mul = Core.BuiltinFunc.create(function()
    {
        // convert to args
        var args = Core.BuiltinFunc.getArgumentsOrListContent(this._context, arguments);

        // sum and return result
        var ret = 1;
        for (var i = 0; i < args.length; ++i)
        {
            ret *= parseFloat(args[i]._value);
        }
        return ret;
    },null, null, true);

// some consts
var E = Math.E;
var PI = Math.PI;
var SQRT2 = Math.SQRT2;

// create the module and export it
var MathModule = Class(Core.Module, {

    // all the module builtin functions and consts (key is their name)
    api: {
        abs: Abs,
        min: Min,
        max: Max,
        pow: Pow,
        round: Round,
        floor: Floor,
        ceil: Ceil,
        cos: Cos,
        sin: Sin,
        atan: Atan,
        exp: Exp,
        tan: Tan,
        log: Log,
        sqrt: Sqrt,
        sign: Sign,
        sum: Sum,
        mul: Mul,
        E: E,
        PI: PI,
        SQRT2: SQRT2,
    },

    // safe for production
    isSafe: true,

    // module identifier
    name: "Math",

    // module version
    version: "1.0.0",
});

// export the Math class
module.exports = MathModule;

},{"./../../core":14,"./../../dependencies/jsface":24,"./../../errors":28,"./../../utils":79}],66:[function(require,module,exports){
"use strict";

/**
* Random module contains random utilities.
*
* Author: Ronen Ness.
* Since: 2016.
*/

// include jsface for classes
var jsface = require("./../../dependencies/jsface"),
    Class  = jsface.Class,
    extend = jsface.extend;

// include errors
var Errors = require("./../../errors");

// include misc utils
var Utils = require("./../../utils");

// require the core stuff
var Core = require("./../../core");

// built-in rand function.
var Rand = Core.BuiltinFunc.create(function()
    {
        return Math.random();
    },0,0,false);

// built-in rand int function.
var RandInt = Core.BuiltinFunc.create(function(min, max)
    {
        if (max === undefined){
            return Math.round(Math.random() * min._value);
        }
        return min._value + Math.round(Math.random() * (max._value - min._value));
    },1,1,false);

// built-in rand float function.
var RandFloat = Core.BuiltinFunc.create(function(min, max)
    {
        if (max === undefined){
            return (Math.random() * min._value);
        }
        return min._value + (Math.random() * (max._value - min._value));
    },1,1,false);

// built-in rand selection function
var Select = Core.BuiltinFunc.create(function(selection)
    {
        // get list to get random item from
        var list = undefined;

        // if selection is a dictionary
        if (selection.type === "dict") {
            list = Object.keys(selection._value._dict);
        }

        // if a list
        if (selection.type === "list") {
            list = selection._value._list;
        }

        // if its a set
        if (selection.type === "set") {
            list = Utils.toArray(selection._value._set);
        }

        // list is undefined? it means its unsupported object
        if (list === undefined) {
            throw new Errors.RuntimeError("Object '" + selection.type + "' does not support random selection.");
        }

        // return a random item from the list
        var val = list[Math.floor(Math.random() * list.length)];
        return val && val.getValue ? val.getValue() : val;

    },1,0,false);

// built-in function to random true or false.
var BooleanRand = Core.BuiltinFunc.create(function()
    {
        return Math.random() < 0.5 ? false : true;
    },0,0,false);

// built-in function to random 0 or 1.
var BinaryRand = Core.BuiltinFunc.create(function()
    {
        return Math.round(Math.random());
    },0,0,false);

// create the module and export it
var RandomModule = Class(Core.Module, {

    // all the module builtin functions and consts (key is their name)
    api: {
        rand: Rand,
        rand_int: RandInt,
        rand_float: RandFloat,
        select: Select,
        boolean: BooleanRand,
        binary: BinaryRand,
    },

    // safe for production
    isSafe: true,

    // module identifier
    name: "Random",

    // module version
    version: "1.0.0",
});

// export the Random class
module.exports = RandomModule;

},{"./../../core":14,"./../../dependencies/jsface":24,"./../../errors":28,"./../../utils":79}],67:[function(require,module,exports){
"use strict";

/**
* Implement 'break' statement.
*
* Author: Ronen Ness.
* Since: 2016.
*/

// include jsface for classes
var jsface = require("./../../dependencies/jsface"),
    Class  = jsface.Class,
    extend = jsface.extend;

// include errors
var Errors = require("./../../errors");

// require the executable class
var Core = require("./../../core");

// require language defs
var LanguageDefs = require("./../defs");

// get builtin keywords
var keywords = LanguageDefs.keywords;

// 'break' statement
var Break = Class(Core.Statement, {

    // statement constructor
    // @param context - context of program currently executed.
    // @param ast - parsed AST - the output of the parser
    // @param line - current line, for debug purposes
    constructor: function(context, ast, line)
    {
        // call base class ctor
        Break.$super.call(this, context, line);

        // wrong tree length
        if (ast.length !== 1) {throw new Errors.SyntaxError("Illegal expression after 'break' statement!", line);}
    },

    // this command does nothing..
    execute: function()
    {
        var blockType = this._context.getCurrBlockType();
        if (blockType !== "loop") {
            throw new Errors.RuntimeError("'break' outside loop!");
        }
        var scope = this._context.getScope();
        scope.calledContinue = true;
        scope.calledBreak = true;
    },

    $static: {
        // get this statement keyword
        getKeyword: function()
        {
            return keywords["break"];
        },
    },

    // does not open a new block
    openNewBlock: false,
});

// export the Break class
module.exports = Break;

},{"./../../core":14,"./../../dependencies/jsface":24,"./../../errors":28,"./../defs":34}],68:[function(require,module,exports){
"use strict";

/**
* Implement 'continue' statement.
*
* Author: Ronen Ness.
* Since: 2016.
*/

// include jsface for classes
var jsface = require("./../../dependencies/jsface"),
    Class  = jsface.Class,
    extend = jsface.extend;

// include errors
var Errors = require("./../../errors");

// require the executable class
var Core = require("./../../core");

// require language defs
var LanguageDefs = require("./../defs");

// get builtin keywords
var keywords = LanguageDefs.keywords;

// 'continue' statement
var Continue = Class(Core.Statement, {

    // statement constructor
    // @param context - context of program currently executed.
    // @param ast - parsed AST - the output of the parser
    // @param line - current line, for debug purposes
    constructor: function(context, ast, line)
    {
        // call base class ctor
        Continue.$super.call(this, context, line);

        // wrong tree length
        if (ast.length !== 1) {throw new Errors.SyntaxError("Illegal expression after 'continue' statement!", line);}
    },

    // this command does nothing..
    execute: function()
    {
        if (this._context.getCurrBlockType() !== "loop") {
            throw new Errors.RuntimeError("'continue' outside loop!");
        }
        this._context.getScope().calledContinue = true;
    },

    $static: {
        // get this statement keyword
        getKeyword: function()
        {
            return keywords["continue"];
        },
    },

    // does not open a new block
    openNewBlock: false,
});

// export the Continue class
module.exports = Continue;


},{"./../../core":14,"./../../dependencies/jsface":24,"./../../errors":28,"./../defs":34}],69:[function(require,module,exports){
"use strict";

/**
* Implement the 'def' statement, that creates new function.
*
* Author: Ronen Ness.
* Since: 2016.
*/

// include jsface for classes
var jsface = require("./../../dependencies/jsface"),
    Class  = jsface.Class,
    extend = jsface.extend;

// include errors
var Errors = require("./../../errors");

// require the executable class
var Core = require("./../../core");

// require language defs
var LanguageDefs = require("./../defs");

// get builtin keywords
var keywords = LanguageDefs.keywords;

// function def statement
//
// a typical Def statement get AST that looks like that:
// [{"type":"identifier","value":"def"},
//  {"type":"call", "args":[{"type":"identifier","value":"a"}, {"type":"identifier","value":"b"}], "name":"test"},
//  {"type":"blockopen","value":":"}]"
var Def = Class(Core.Statement, {

    // statement constructor
    // @param context - context of program currently executed.
    // @param ast - parsed AST - the output of the parser
    // @param line - current line, for debug purposes
    constructor: function(context, ast, line)
    {
        // call base class ctor
        Def.$super.call(this, context, line);

        // wrong tree length
        if (ast.length < 3) {throw new Errors.SyntaxError("Incomplete function def line", line);}

        // validate def ast
        if (ast[1].type !== "call") {throw new Errors.SyntaxError("Expecting parenthesis and arguments list after function name.", line);}
        if (ast[2].type !== "blockopen") {throw new Errors.SyntaxError("Expecting colon after function arguments list.", line);}

        // get function data
        var funcData = ast[1];

        // parse function def arguments
        this._name = funcData.name;
        this._args = [];
        for (var i = 0; i < funcData.args.length; ++i)
        {
            var argData = funcData.args[i];
            if (argData.type !== "identifier") {
                throw new Errors.SyntaxError("Unexpected token '" + argData.value + "' in function arguments list.", line);
            }
            this._args.push(argData.value);
        }
    },

    $static: {
        // get this statement keyword
        getKeyword: function()
        {
            return keywords["def"];
        },
    },

    // define the new function.
    // note: execute of 'def' is not calling the func, its creating it.
    execute: function()
    {
        return this._context._interpreter.defineFunction(  this._name,
                                                           this._followingBlock,
                                                           this._args );
    },

    // this statement opens a new block
    openNewBlock: true,

    // skip following block on execution
    skipFollowingBlock: true,
});

// export the Def class
module.exports = Def;


},{"./../../core":14,"./../../dependencies/jsface":24,"./../../errors":28,"./../defs":34}],70:[function(require,module,exports){
"use strict";

/**
* Implement the 'elif' statement.
*
* Author: Ronen Ness.
* Since: 2016.
*/

// include jsface for classes
var jsface = require("./../../dependencies/jsface"),
    Class  = jsface.Class,
    extend = jsface.extend;

// include errors
var Errors = require("./../../errors");

// require the executable class
var Core = require("./../../core");

// require language defs
var LanguageDefs = require("./../defs");

// get builtin keywords
var keywords = LanguageDefs.keywords;

// conditional else statement
var Elif = Class(Core.Statement, {

    // statement constructor
    // @param context - context of program currently executed.
    // @param ast - parsed AST - the output of the parser
    // @param line - current line, for debug purposes
    constructor: function(context, ast, line)
    {
        // call base class ctor
        Elif.$super.call(this, context, line);

        // validate 'if' ast
        if (ast.length < 3) {throw new Errors.SyntaxError("Incomplete 'elif' statement!", line)}
        if (ast[2].value !== ":") {throw new Errors.SyntaxError("Missing colon after 'elif' statement!", line)}

        // get the expression to iterate inside
        this._condition = new Core.Expression(this._context, ast[1]);
    },

    $static: {
        // get this statement keyword
        getKeyword: function()
        {
            return keywords["elif"];
        },
    },

    // set the statement before this one in this block
    setPreviousStatement: function(statement) {

        // make sure previous statement is if
        if (!statement || !statement.isIfStatement) {
            throw new Errors.SyntaxError("'elif' statement not after 'if'!")
        }

        // store previous statement
        this._prevStatement = statement;
    },

    // check if condition and execute block
    execute: function()
    {
        // make sure last 'if' statement was false
        if (this._prevStatement._conditionMet || this._prevStatement._lastIfWasTrue) {
            this._lastIfWasTrue = true;
            return;
        }

        // last 'if' statement was not true
        this._lastIfWasTrue = false;

        // evaluate condition
        this._conditionMet = Boolean(this._condition.eval());

        // condition is false? don't execute block
        if (!this._conditionMet) {
            return;
        }

        // call block
        if (this._followingBlock) {
            this._followingBlock.execute();
        }
    },

    // this is a type of if statement
    isIfStatement: true,

    // this statement opens a new block
    openNewBlock: true,

    // skip following block on execution
    skipFollowingBlock: true,
});

// export the Elif class
module.exports = Elif;

},{"./../../core":14,"./../../dependencies/jsface":24,"./../../errors":28,"./../defs":34}],71:[function(require,module,exports){
"use strict";

/**
* Implement the 'if' statement.
*
* Author: Ronen Ness.
* Since: 2016.
*/

// include jsface for classes
var jsface = require("./../../dependencies/jsface"),
    Class  = jsface.Class,
    extend = jsface.extend;

// include errors
var Errors = require("./../../errors");

// require the executable class
var Core = require("./../../core");

// require language defs
var LanguageDefs = require("./../defs");

// get builtin keywords
var keywords = LanguageDefs.keywords;

// conditional else statement
var Else = Class(Core.Statement, {

    // statement constructor
    // @param context - context of program currently executed.
    // @param ast - parsed AST - the output of the parser
    // @param line - current line, for debug purposes
    constructor: function(context, ast, line)
    {
        // call base class ctor
        Else.$super.call(this, context, line);

        // validate 'else' ast
        if (ast[1].value !== ":") {throw new Errors.SyntaxError("Missing colon after 'else' statement!", line)}
    },

    $static: {
        // get this statement keyword
        getKeyword: function()
        {
            return keywords["else"];
        },
    },

    // set the statement before this one in this block
    setPreviousStatement: function(statement) {

        // make sure previous statement is if
        if (!statement || !statement.isIfStatement) {
            throw new Errors.SyntaxError("'else' statement not after 'if'!")
        }

        // store previous statement
        this._prevStatement = statement;
    },

    // check if condition and execute block
    execute: function()
    {
        // make sure last if statement was false
        if (this._prevStatement._conditionMet) {
            return;
        }

        // call block
        if (this._followingBlock) {
            this._followingBlock.execute();
        }
    },

    // this statement opens a new block
    openNewBlock: true,

    // skip following block on execution
    skipFollowingBlock: true,
});

// export the Else class
module.exports = Else;

},{"./../../core":14,"./../../dependencies/jsface":24,"./../../errors":28,"./../defs":34}],72:[function(require,module,exports){
"use strict";

/**
* This statement is trying to evaluate the entire line as an expression or function call.
*
* We use this statement as a fallback when no other statement match the line, and it allow us to invoke
* functions and evaluate values without assigning them.
*
* Author: Ronen Ness.
* Since: 2016.
*/

// include jsface for classes
var jsface = require("./../../dependencies/jsface"),
    Class  = jsface.Class,
    extend = jsface.extend;

// include errors
var Errors = require("./../../errors");

// require the executable class
var Core = require("./../../core");

// evaluate expression statement
var EvaluateExpression = Class(Core.Statement, {


    // statement constructor
    // @param context - context of program currently executed.
    // @param ast - parsed AST - the output of the parser
    // @param line - current line, for debug purposes
    constructor: function(context, ast, line)
    {
        // call base class ctor
        EvaluateExpression.$super.call(this, context, line);
        if (ast.length != 1) { throw new Errors.SyntaxError("Invalid expression!", line);}
        this._expression = ast[0];
    },

    $static: {
        // get this statement keyword
        getKeyword: function()
        {
            return "";
        },
    },

    // get statement representation
    getRepr: function() {
        return "exp " + (this._expression._ast ? this._expression._ast.type : this._expression.type);
    },

    // execute expression
    execute: function()
    {
        // if not expression instance convert to it
        if (this._expression.constructor !== Core.Expression)
        {
            this._expression = new Core.Expression(this._context, this._expression);
        }

        // evaluate and return
        return this._expression.eval();
    },

    // does not open a new block
    openNewBlock: false,
});

// export the EvaluateExpression class
module.exports = EvaluateExpression;


},{"./../../core":14,"./../../dependencies/jsface":24,"./../../errors":28}],73:[function(require,module,exports){
"use strict";

/**
* Implement the 'for' statement.
*
* Author: Ronen Ness.
* Since: 2016.
*/

// include jsface for classes
var jsface = require("./../../dependencies/jsface"),
    Class  = jsface.Class,
    extend = jsface.extend;

// include errors
var Errors = require("./../../errors");

// require the executable class
var Core = require("./../../core");

// require language defs
var LanguageDefs = require("./../defs");

// get builtin keywords
var keywords = LanguageDefs.keywords;

// "for x in y" statement
var For = Class(Core.Statement, {

    // statement constructor
    // @param context - context of program currently executed.
    // @param ast - parsed AST - the output of the parser
    // @param line - current line, for debug purposes
    constructor: function(context, ast, line)
    {
        // call base class ctor
        For.$super.call(this, context, line);

        // validate for ast
        if (!ast[1] || ast[1].type !== "in") {throw new Errors.SyntaxError("Expecting 'in' operator after for identifier.", line);}
        if (!ast[1] || ast[1].left.type !== "identifier") {throw new Errors.SyntaxError("Expecting variable name after 'for' statement.", line);}
        if (ast.length < 3) {throw new Errors.SyntaxError("Incomplete 'for' statement!", line)}
        if (ast[ast.length-1].value !== ":") {throw new Errors.SyntaxError("Missing colon after 'for' statement!", line)}

        // get the expression to iterate inside
        this._target = new Core.Expression(this._context, ast[1].right);

        // get identifier name
        this.identifier = ast[1].left.value;
    },

    $static: {
        // get this statement keyword
        getKeyword: function()
        {
            return keywords["for"];
        },
    },

    // return from current scope
    execute: function()
    {
        // evaluate target to iterate on
        var target = this._target.eval();

        // check if unsupported
        if (!target || (!target.forEach && target.length === undefined)) {
            throw new Errors.RuntimeError("Object type '" + (typeof target) + "' does not support iteration!");
        }

        // create scope for the loop block
        this._context.stackPush("loop");

        // execute blocks in the loop
        try {

            // if got 'forEach' use it
            if (target.forEach)
            {
                target.forEach(this._execBlock, this);
            }
            else
            {
                // if don't have 'forEach' use length (used for strings for example)
                for (var i = 0; i < target.length; ++i) {

                    if (this._execBlock(target[i]) === false) {
                        break;
                    }
                }
            }
        }
        catch (e) {

            // pop stack
            this._context.stackPop();

            // rethrow exception
            throw e;
        }

        // pop stack
        this._context.stackPop();
    },

    // execute block one time per value in iteration
    _execBlock: function(val) {

        // get scope
        var scope = this._context.getScope();

        // if called break stop here and return false. returning false in iteration supposed to stop it
        if (scope.calledBreak || scope.calledReturn) {
            return false;
        }

        // set variable
        this._context.setVar(this.identifier, val);

        // call block
        if (this._followingBlock) {
            this._followingBlock.execute();
        }

        // remove the 'continue' flag
        scope.calledContinue = false;

        // to continue loop
        return true;
    },

    // this statement opens a new block
    openNewBlock: true,

    // skip following block on execution
    skipFollowingBlock: true,
});

// export the For class
module.exports = For;

},{"./../../core":14,"./../../dependencies/jsface":24,"./../../errors":28,"./../defs":34}],74:[function(require,module,exports){
"use strict";

/**
* Implement the 'if' statement.
*
* Author: Ronen Ness.
* Since: 2016.
*/

// include jsface for classes
var jsface = require("./../../dependencies/jsface"),
    Class  = jsface.Class,
    extend = jsface.extend;

// include errors
var Errors = require("./../../errors");

// require the executable class
var Core = require("./../../core");

// require language defs
var LanguageDefs = require("./../defs");

// get builtin keywords
var keywords = LanguageDefs.keywords;

// conditional if statement
var If = Class(Core.Statement, {

    // statement constructor
    // @param context - context of program currently executed.
    // @param ast - parsed AST - the output of the parser
    // @param line - current line, for debug purposes
    constructor: function(context, ast, line)
    {
        // call base class ctor
        If.$super.call(this, context, line);

        // validate 'if' ast
        if (ast.length < 3) {throw new Errors.SyntaxError("Incomplete 'if' statement!", line)}
        if (ast[2].value !== ":") {throw new Errors.SyntaxError("Missing colon after 'if' statement!", line)}

        // get the expression to iterate inside
        this._condition = new Core.Expression(this._context, ast[1]);
    },

    $static: {
        // get this statement keyword
        getKeyword: function()
        {
            return keywords["if"];
        },
    },

    // check if condition and execute block
    execute: function()
    {
        // evaluate condition
        this._conditionMet = Boolean(this._condition.eval());

        // condition is false? don't execute block
        if (!this._conditionMet) {
            return;
        }

        // call block
        if (this._followingBlock) {
            this._followingBlock.execute();
        }
    },

    // this is a type of if statement
    isIfStatement: true,

    // this statement opens a new block
    openNewBlock: true,

    // skip following block on execution
    skipFollowingBlock: true,
});

// export the If class
module.exports = If;

},{"./../../core":14,"./../../dependencies/jsface":24,"./../../errors":28,"./../defs":34}],75:[function(require,module,exports){
"use strict";

// all statements
 var statements = {
    'pass': require('./pass'),
    'def': require('./def'),
    'return': require('./return'),
    'for': require('./for'),
    'while': require('./while'),
    'continue': require('./continue'),
    'break': require('./break'),
    'if': require('./if'),
    'else': require('./else'),
    'elif': require('./elif'),
    '!@#$%^&*()_default': require('./evaluate_expression'),
};

// set identifier field
for (var key in statements)
{
    statements[key].prototype.identifier = "builtin.statements." + key;
}

// export
module.exports = statements;

},{"./break":67,"./continue":68,"./def":69,"./elif":70,"./else":71,"./evaluate_expression":72,"./for":73,"./if":74,"./pass":76,"./return":77,"./while":78}],76:[function(require,module,exports){
"use strict";

/**
* Implement 'pass' statement, which is either an empty line or the word 'pass', and it basically do nothing.
*
* Author: Ronen Ness.
* Since: 2016.
*/

// include jsface for classes
var jsface = require("./../../dependencies/jsface"),
    Class  = jsface.Class,
    extend = jsface.extend;

// include errors
var Errors = require("./../../errors");

// require the executable class
var Core = require("./../../core");

// require language defs
var LanguageDefs = require("./../defs");

// get builtin keywords
var keywords = LanguageDefs.keywords;

// 'pass' statement
var Pass = Class(Core.Statement, {

    // statement constructor
    // @param context - context of program currently executed.
    // @param ast - parsed AST - the output of the parser
    // @param line - current line, for debug purposes
    constructor: function(context, ast, line)
    {
        // call base class ctor
        Pass.$super.call(this, context, line);

        // wrong tree length
        if (ast.length !== 1) {throw new Errors.SyntaxError("Illegal expression after pass statement!", line);}
    },

    // this command does nothing..
    execute: function()
    {
        return null;
    },

    $static: {
        // get this statement keyword
        getKeyword: function()
        {
            return keywords["pass"];
        },
    },

    // does not open a new block
    openNewBlock: false,
});

// export the Pass class
module.exports = Pass;


},{"./../../core":14,"./../../dependencies/jsface":24,"./../../errors":28,"./../defs":34}],77:[function(require,module,exports){
"use strict";

/**
* Implement the 'return' statement.
*
* Author: Ronen Ness.
* Since: 2016.
*/

// include jsface for classes
var jsface = require("./../../dependencies/jsface"),
    Class  = jsface.Class,
    extend = jsface.extend;

// include errors
var Errors = require("./../../errors");

// require the executable class
var Core = require("./../../core");

// require language defs
var LanguageDefs = require("./../defs");

// get builtin keywords
var keywords = LanguageDefs.keywords;

// return statement
var Return = Class(Core.Statement, {

    // statement constructor
    // @param context - context of program currently executed.
    // @param ast - parsed AST - the output of the parser
    // @param line - current line, for debug purposes
    constructor: function(context, ast, line)
    {
        // call base class ctor
        Return.$super.call(this, context, line);

        // get return expression
        this._retExpression = ast[1];

        // wrong tree length
        if (ast.length > 2) {throw new Errors.SyntaxError("Illegal return expression!", line);}
    },

    $static: {
        // get this statement keyword
        getKeyword: function()
        {
            return keywords["return"];
        },
    },

    // return from current scope
    execute: function()
    {
        // return value (default to null)
        var retVal = null;

        // if got expression to evaluate as return value eval it
        if (this._retExpression)
        {
            // if not expression instance convert to it and store for future calls
            if (this._retExpression.constructor !== Core.Expression)
            {
                this._retExpression = new Core.Expression(this._context, this._retExpression);
            }

            // evaluate return expression and set as return value
            retVal = this._retExpression.eval();
        }

        // do return statement
        this._context._interpreter.returnValue(retVal);
        return retVal;
    },

    // this statement does not open a new block
    openNewBlock: false,
});

// export the Return class
module.exports = Return;


},{"./../../core":14,"./../../dependencies/jsface":24,"./../../errors":28,"./../defs":34}],78:[function(require,module,exports){
"use strict";

/**
* Implement the 'while' statement.
*
* Author: Ronen Ness.
* Since: 2016.
*/

// include jsface for classes
var jsface = require("./../../dependencies/jsface"),
    Class  = jsface.Class,
    extend = jsface.extend;

// include errors
var Errors = require("./../../errors");

// require the executable class
var Core = require("./../../core");

// require language defs
var LanguageDefs = require("./../defs");

// get builtin keywords
var keywords = LanguageDefs.keywords;

// "while x" statement
var While = Class(Core.Statement, {

    // statement constructor
    // @param context - context of program currently executed.
    // @param ast - parsed AST - the output of the parser
    // @param line - current line, for debug purposes
    constructor: function(context, ast, line)
    {
        // call base class ctor
        While.$super.call(this, context, line);

        // validate for ast
        if (ast.length !== 3) {throw new Errors.SyntaxError("Invalid 'while' statement!", line)}
        if (ast[ast.length-1].value !== ":") {throw new Errors.SyntaxError("Missing colon after 'while' statement!", line)}

        // get while condition
        this._condition = new Core.Expression(this._context, ast[1]);
    },

    $static: {
        // get this statement keyword
        getKeyword: function()
        {
            return keywords["while"];
        },
    },

    // return from current scope
    execute: function()
    {
        // evaluate condition
        var conditionResult = this._condition.eval();

        // condition is false? don't execute block
        if (!conditionResult || !(this._followingBlock)) {
            return;
        }

        // just in case...
        var maxAttemptsLeft = 10000000;

        // create scope for the loop block
        this._context.stackPush("loop");

        // execute blocks in the loop
        try {

            while (maxAttemptsLeft--) {

                // call block
                this._followingBlock.execute();

                // get current scope
                var scope = this._context.getScope();

                // was break / return called?
                if (scope.calledBreak || scope.calledReturn) {
                    break;
                }

                // remove the 'continue' flag
                scope.calledContinue = false;

                // check condition again and break if false
                if (!this._condition.eval()) {
                    break;
                }
            }

        }
        catch (e) {

            // pop stack
            this._context.stackPop();

            // rethrow exception
            throw e;
        }

        // pop stack
        this._context.stackPop();
    },

    // execute block one time per value in iteration
    _execBlock: function(val) {

        // if called break stop here and return false. returning false in iteration supposed to stop it
        if (this._context.getScope().calledBreak) {
            return false;
        }

        // set variable
        this._context.setVar(this.identifier, val);

        // call block
        if (this._followingBlock) {
            this._followingBlock.execute();
        }

        // remove the 'continue' flag
        this._context.getScope().calledContinue = false;

        // to continue loop
        return true;
    },

    // this statement opens a new block
    openNewBlock: true,

    // skip following block on execution
    skipFollowingBlock: true,
});

// export the While class
module.exports = While;

},{"./../../core":14,"./../../dependencies/jsface":24,"./../../errors":28,"./../defs":34}],79:[function(require,module,exports){
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
},{"./errors":28}]},{},[29])(29)
});