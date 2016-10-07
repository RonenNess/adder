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

    // execute the currently code
    execute: function()
    {
        // no root block is set? exception
        if (this._rootBlock === null) {
            throw new Errors.InterpreterError("Tried to execute code without loading any code first!");
        }

        // reset execution data
        this._resetCurrExecutionData();

        // start execution
        try {
            this._rootBlock.execute();
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

