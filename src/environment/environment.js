"use strict";

/**
* The main API class that spawn programs and load code.
* This is the main class you need to use.
*
* Author: Ronen Ness.
* Since: 2016
*/

// include jsface for classes
var jsface = require("./../dependencies/jsface"),
    Class  = jsface.Class,
    extend = jsface.extend;

// include the alternative console
var Console = require("./../console");

// include the program class
var Program = require("./program");

// include the compiler class
var Compiler = require("./../compiler");

// include core objects
var Core = require("./../core");

// include errors
var Errors = require("./../errors");

// include utils
var Utils = require("./../utils");

// include language stuff
var Language = require("./../language");

var uniqueObjectName = 0;

// the environment class.
var Environment = Class({

    // the environment is a singleton class
    $singleton: true,

    // add access to errors and utils
    Errors: Errors,
    Utils: Utils,

    // Environment constructor.
    // @param params is a dictionary with all environment params. contains:
    //      flags - compiler and interpreter flags.
    //      modules - a list of modules to load by default. Can also be ['ALL'] to load all builtin modules.
    //      outputFunc - a function to handle output from script execution (print calls).
    //      showDebugConsole - if true, will output debug prints to console.
    init: function(params)
    {
        // default params
        params = params || {};

        // store interpreter flags
        this._flags = params.flags || {};
        this._modules = params.modules || ["SAFE"];
        this._outputFunc = params.outputFunc || null;

        // all custom modules
        this._customModules = {};

        // set debug console
        if (params.showDebugConsole) {
            Console.bindToNativeConsole();
        }

        // show basic info
        Console.info("Created a new environment!", this._flags, this._modules);

        // create the compiler instance
        this._compiler = new Compiler(this._flags);
    },

    // compile code and return the compiled code
    compile: function(code) {
        return this._compiler.compile(code);
    },

    // spawn a program from compiled code
    newProgram: function(compiledCode) {

        // create and return the new program
        var program = new Program(compiledCode, this._modules, this._flags, this._outputFunc);

        // add custom modules
        for (var key in this._customModules) {
            program.addModule(key, this._customModules[key]);
        }

        // return the newly created program
        return program;
    },

    // convert data dictionary to a builtin function or an object
    __toBuiltin: function(data, key, containerName) {

        // if its a function convert to a function instance and return
        if (typeof data === "object" && data.func) {
            data = Core.BuiltinFunc.create(data.func, data.requiredParams, data.optionalParams, data.deterministic || false);
            data.identifier = containerName + ".functions." + key;
            data.convertParamsToNativeJs = true;
            return data;
        }

        // else just return the object
        return data;
    },

    // add a built-in function to Adder. This will only affect future programs, not already existing ones.
    // @param data is a dictionary with the following keys:
    //      name:           builtin function name.
    //      func:           function to register.
    //      requiredParams: minimum amount of required params. set null any number of params.
    //      optionalParams: number of optional params. default to 0.
    //      deterministic:  if for input X output will always be Y, eg the function is deterministic and predictable,
    //                      set this to true. this will allow Adder to cache results and greatly optimize using this function.
    //                      note: default to false.
    addBuiltinFunction: function(data) {

        // add to builtin functions dictionary
        Language.Builtins.Functions[data.name] = this.__toBuiltin(data, data.name, "custom.builtin");
    },

    // remove a built-in function
    removeBuiltinFunction: function(name) {
        delete Language.Builtins.Functions[name];
    },

    // create and add a builtin module.
    // @param name - module name.
    // @param moduleApi - a dictionary with module's API.
    //                      to add a const value just add key value.
    //                      to add a function add a dictionary with 'func', 'requiredParams', and 'optionalParams'.
    //                      see addBuiltinFunction() for options.
    //
    // Usage example:
    // AdderScript.addBuiltinModule("Test", {
    //                                "foo": {
    //                                    func: function(x) {alert(x)},
    //                                    requiredParams: 1,
    //                                    optionalParams: 0
    //                                 },
    //                                 "bar": 5,
    //                              });
    addBuiltinModule: function(name, moduleApi) {

        // iterate over module api and convert to items
        for (var key in moduleApi) {

            // get current item and convert to builtin object
            var curr = moduleApi[key];
            curr = this.__toBuiltin(curr, key, name);

            // set back into api
            moduleApi[key] = curr;
        }

        // create the module and add it
        var CustomModule = Class(Core.Module, {
            api: moduleApi,
            name: name,
            version: "1.0.0",
        });
        this._customModules[name] = CustomModule;
    },

    // remove a built-in module
    removeBuiltinModule: function(name) {
        delete this._customModules[name];
    },

    // define a built-in object (like list, dict, set..) you can return and use in your modules and builtin functions.
    // @param name - object type name (for example when doing type(obj) this string will be returned).
    // @param api - a dictionary with object's API.
    //                      to add a const value just add key -> value pair.
    //                      to add a function add a dictionary with 'func', 'requiredParams', and 'optionalParams'.
    //                      see addBuiltinFunction() for options.
    //
    // Usage example:
    // createFunc = AdderScript.defineBuiltinObject("Person", {
    //                                "say_hello": {
    //                                    func: function() {alert("Hello World!")},
    //                                    requiredParams: 0,
    //                                    optionalParams: 0
    //                                 },
    //                                 "race": "human",
    //                              });
    //
    // to create a new object instance:
    //      var newInstance = createFunc(this);
    //
    // Where 'this' is an interpreter instance.
    //
    // Note: by default users won't be able to create instances of this object on their own, you'll need to provide a function to generate it.
    //
    defineBuiltinObject: function(name, api) {

        // iterate over module api and convert to items
        for (var key in api) {

            // get current item and convert to builtin object
            var curr = api[key];
            curr = this.__toBuiltin(curr, key, name);

            // set back into api
            api[key] = curr;
        }

        // create the object type and return the function to create new instance
        var ret = (function() {

            // create the object type
            var _ObjType = Class(Core.Object, {

                // set api
                api: api,

                // convert to string
                toString: function()
                {
                    return this.type;
                },

                // convert to repr
                toRepr: function()
                {
                    return "<" + this.type + ">";
                },

                // convert to a native javascript object
                toNativeJs: function()
                {
                    return this;
                },

                // object identifier
                name: name,
                type: name,
            });

            // create the function to return the object instance
            return function(parent) {
                var context = parent._context || parent._interpreter._context;
                if (!context) throw "Invalid parent param, must be interpreter or program!";
                return new _ObjType(context);
            }
        })();

        // return the new object creation function
        return ret;
    },

    // Convert a JavaScript object into a simple Adder object.
    // You can use this to return complex objects without having to define them as builtins first. For example:
    //
    //   function someFunc() {
    //        return AdderScript.toAdderObject("Target", {type: "car", hp: 5, isEnemy: true});
    //   }
    //
    // and later Adder script can simple use this object's API, ie:
    //
    //      if target.type == "car":
    //          print ("its a car!")
    //
    // @param name - object type name (for example when doing type(obj) this string will be returned).
    // @param api - a dictionary with object's API.
    //                      to add a const value just add key value.
    //                      to add a function add a dictionary with 'func', 'requiredParams', and 'optionalParams'.
    //                      see addBuiltinFunction() for options.
    //
    // Usage example:
    // var retObj = AdderScript.toAdderObject("Person", {
    //                                "say_hello": {
    //                                    func: function() {alert("Hello World!")},
    //                                    requiredParams: 0,
    //                                    optionalParams: 0
    //                                 },
    //                                 "race": "human",
    //                              });
    //
    // Note: calls defineBuiltinObject() internally.
    //
    toAdderObject: function(name, api, program) {

        var ret = new Core.Object(program._context || program._interpreter._context, true);
        for (var key in api) {
            ret.setAttr(key, api[key]);
        }
        return ret;
    },

});

// export the Environment class
module.exports = Environment;
