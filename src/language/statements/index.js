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
