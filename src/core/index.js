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

