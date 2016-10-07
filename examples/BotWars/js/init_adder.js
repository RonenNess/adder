/*
* Init AdderScript environment.
* Author: Ronen Ness.
* Since: 2016.
*/

// alias
var AdderScript = window.AdderScript;

// init environment
AdderScript.init({
    flags: {
        stackLimit: 256,
        maxStatementsPerRun: 2048,
        maxStringLen: 1024,
        maxContainersLen: 1024,
        maxVarsInScope: 2048,
        executionTimeLimit: 750,
        memoryAllocationLimit: 10000,
        throwErrors: true,
    },
    modules: ["SAFE"],
    outputFunc: write_to_console,
    showDebugConsole: false,
});

// special exception used to perform action (fire, shield, etc).
function DoAction(action) {
    this.name = "DoAction";
    this.message = "Do action: " + action;
    this.action = action;
}
DoAction.prototype = Error.prototype;
DoAction.prototype.constructor = DoAction;

//

// create a dictionary with bot's api
function create_bot_api(id){
    return (function(id){
        return {

            // get current ammo
            "get_ammo": { func: function() {
                    return player_data(id).ammo;
                }, requiredParams: 0, optionalParams: 0},

            // get current hp
            "get_hp": { func: function() {
                    return player_data(id).hp;
                }, requiredParams: 0, optionalParams: 0},

            // get shields left
            "get_shields_left": { func: function() {
                    return player_data(id).shield;
                }, requiredParams: 0, optionalParams: 0},

            // get max ammo
            "get_max_ammo": { func: function() {
                    return MAX_AMMO;
                }, requiredParams: 0, optionalParams: 0},

            // get current hp
            "get_max_hp": { func: function() {
                    return MAX_HP;
                }, requiredParams: 0, optionalParams: 0},

            // get shields left
            "get_max_shields": { func: function() {
                    return MAX_SHIELD;
                }, requiredParams: 0, optionalParams: 0},

            // fire! (note: this will stop current code execution)
            "fire": id === "self" ? { func: function() {
                    throw new DoAction("fire");
                }, requiredParams: 0, optionalParams: 0} : undefined,

            // use shield! (note: this will stop current code execution)
            "shield": id === "self" ? { func: function() {
                    throw new DoAction("shield");
                }, requiredParams: 0, optionalParams: 0} : undefined,

            // reload! (note: this will stop current code execution)
            "reload": id === "self" ? { func: function() {
                    throw new DoAction("reload");
                }, requiredParams: 0, optionalParams: 0} : undefined,

            // heal! (note: this will stop current code execution)
            "heal": id === "self" ? { func: function() {
                    throw new DoAction("heal");
                }, requiredParams: 0, optionalParams: 0} : undefined,
        }
    })(id);
}

// add builtin module: Self (provide api and data about self player)
AdderScript.addBuiltinModule("Self", create_bot_api("self"));
AdderScript.addBuiltinModule("Enemy", create_bot_api("enemy"));

// add builtin module: match data
AdderScript.addBuiltinModule("Match", {
    "get_round_number": { func: function() {
            return game_data.round;
        }, requiredParams: 0, optionalParams: 0},

    "get_rounds_left": { func: function() {
            return ROUNDS_PER_GAME - game_data.round;
        }, requiredParams: 0, optionalParams: 0},
});

// create and return a new program from code
function create_adder_program(code) {

    // compile
    var compiled = AdderScript.compile(code);

    // create and return a new program
    return AdderScript.newProgram(compiled);
}