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
