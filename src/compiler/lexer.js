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
                // if its a regular block and line break was'nt ';'
                else if (lastC !== ';')
                {
                    // get spaces needed for block indent
                    var spacesForIndent = this._flags.spacesNeededForBlockIndent;

                    // check if spaces are not multiply indent spaces, but only if last token wasn't ';' (inline break)
                    if ((spacesInRow % spacesForIndent) !== 0) {
                        throw new Errors.SyntaxError("Bad block indent (spaces not multiply of " +
                                                       this._flags.spacesNeededForBlockIndent + ")", this.lineIndex);
                    }

                    // calc current block
                    var blockIndent = spacesInRow / spacesForIndent;
                    if (blockIndent !== lastBlockIndent) {
                        ret.push(this.makeToken(TokenTypes.cblock, blockIndent));
                        lastBlockIndent = blockIndent;
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
                this.lineIndex++;
                if (skipNextLineBreak) {
                    skipNextLineBreak = false;
                } else {
                    lastC = c;
                    wasLineBreak = true;
                    ret.push(this.makeToken(TokenTypes.lbreak, c));
                }
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