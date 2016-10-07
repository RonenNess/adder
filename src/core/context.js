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

