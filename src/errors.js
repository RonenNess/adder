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

