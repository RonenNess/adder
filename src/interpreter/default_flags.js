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
