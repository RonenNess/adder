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

