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
