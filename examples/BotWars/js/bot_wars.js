/*
* Basic utilities to control GUI, animations, and game data.
* Author: Ronen Ness.
* Since: 2016.
*/

// write message console (for user debug)
function write_to_console() {
    var text = Array.prototype.slice.call(arguments).join(" ");
    var msg = $("<p style='line-height:0.7em;'></p>");
    msg.text("> " + text);
    $("#console").append(msg);
    msg.delay(6500).fadeOut(1000);
}

// clear console
function clear_console() {
    $("#console").empty();
}

// set player gui bar
// player should either be 1 or 2
function _gui_set_hp(type, player, amount) {

    // get element
    var elem = $("#p" + player + "-" + type);

    // if amount is not 0, set image
    if (amount) {elem.attr("src", "imgs/" + type + amount + ".png");}

    // set bar visibility weather or not the amount is 0
    if (amount > 0) {elem.show();} else {elem.hide();}
}

// set player hp bar
// player should either be 1 or 2
function gui_set_hp(player, amount) {
    _gui_set_hp("hp", player, amount);
}

// set player shield bar
// player should either be 1 or 2
function gui_set_shield(player, amount) {
    _gui_set_hp("sh", player, amount);
}

// set player ammo bar
// player should either be 1 or 2
function gui_set_ammo(player, amount) {
    _gui_set_hp("am", player, amount);
}

// set the player action icon
function gui_set_action_icon(player, action) {
    $("#p" + player + "-action").attr("src", "imgs/" + action + "_icon.png");
}

// update all gui for all players
function gui_update() {

    // set players stuff
    for (var i = 1; i <= 2; ++i) {
        var player = player_data(i);
        gui_set_hp(i,       player.hp);
        gui_set_shield(i,   player.shield);
        gui_set_ammo(i,     player.ammo);
        gui_set_action_icon(i, player.action);
    }

    // set round
    $("#rounds-show").text("Round: " + game_data.round + "/" + ROUNDS_PER_GAME);
}

// set current sprite of a player
function set_player_sprite_index(player, step) {
    $("#p" + player + "-img").css("left", (-step * PLAYER_SPRITE_SIZE) + "px");
}

// current animation step
var animation_step = 0;

// animate mechas
function animate_players() {

    // increase animation step
    animation_step += 0.075;

    // iterate over players
    for (var i = 1; i <= 2; ++i) {

        // get player data
        var player = player_data(i);

        // get current player step
        if (player.action === "idle") {
            var step = Math.floor(i + animation_step) % 2;
            set_player_sprite_index(i, step);
        }
    }
};

// show actions
function set_action_graphics(player_index, action) {

    // get player data
    var player = player_data(player_index);

    // set action and sprite
    player.action = action;

    // set player sprite
    var sprites = {
        "idle": PLAYER_SPRITE_STAND0_POS,
        "fire": PLAYER_SPRITE_FIRE_POS,
        "shield": PLAYER_SPRITE_SHIELD_POS,
        "dead": PLAYER_SPRITE_DEATH_POS,
        "reload": PLAYER_SPRITE_RELOAD_POS,
        "heal": PLAYER_SPRITE_HEAL_POS,
    };
    set_player_sprite_index(player_index, sprites[action]);

    // add timer to return to idle
    if (action !== "idle" && action !== "dead") {
        (function(player_index) {
            setTimeout(function() {
                if (player_data(player_index).action !== "dead") {
                    set_action_graphics(player_index, "idle");
                }
            }, DELAY_BETWEEN_ROUNDS - 2000);
        })(player_index);
    }

    // update action icon
    gui_set_action_icon(player_index, player.action);
}

// animate players
setInterval(animate_players, 50);

// some consts
var MAX_HP = 10;
var MAX_SHIELD = 7;
var MAX_AMMO = 5;
var PLAYER_SPRITE_STAND0_POS = 0;
var PLAYER_SPRITE_STAND1_POS = 1;
var PLAYER_SPRITE_FIRE_POS = 2;
var PLAYER_SPRITE_SHIELD_POS = 3;
var PLAYER_SPRITE_RELOAD_POS = 4;
var PLAYER_SPRITE_HEAL_POS = 5;
var PLAYER_SPRITE_DEATH_POS = 6;
var PLAYER_SPRITE_SIZE = 300;
var EXPLOSION_SIZE = 50;
var ROUNDS_PER_GAME = 25;
var DELAY_BETWEEN_ROUNDS = 4000;

// will contain current game data
var game_data = null;

// reset game and players data
function reset_game_date() {

    // function to return player data
    function create_player_data() {
        return {
            hp: MAX_HP,
            shield: MAX_SHIELD,
            ammo: 0,
            action: "idle",
            is_dead: false,
        }
    }

    // set game starting data
    game_data = {
        round: 0,
        was_stopped: false,
        player1: create_player_data(),
        player2: create_player_data(),
    }

    // this change based on which program we execute
    game_data.playerself = game_data.player1;
    game_data.playerenemy = game_data.player2;

    // update gui
    gui_update();
    $("#rounds-show").text("");
}

// get player data
function player_data(player) {
    return game_data["player" + player];
}

// validate that a player can do a specific action
function validate_player_action(player_index, action) {

    // get player data
    var player = player_data(player_index);

    // check if dead
    if (player.hp <= 0) {
        return "dead"
    }

    // check if can't do this action
    switch (action) {
        case "fire":
            if (player.ammo <= 0) {
                show_player_text(player_index, "No Ammo!");
                return "idle";
            }
            break;
        case "shield":
            if (player.shield <= 0) {
                show_player_text(player_index, "No Shields Left!");
                return "idle";
            }
            break;
    }

    // action is legal, return it
    return action;
}

// validate player properties (no negatives and not above max
function validate_player_status(player_index) {

    // get player data
    var player = player_data(player_index);

    // check upper limit
    if (player.ammo > MAX_AMMO) player.ammo = MAX_AMMO;
    if (player.hp > MAX_HP) player.hp = MAX_HP;
    if (player.shield > MAX_SHIELD) player.shield = MAX_SHIELD;

    // check lower limit
    if (player.ammo < 0) player.ammo = 0;
    if (player.hp < 0) player.hp = 0;
    if (player.shield < 0) player.shield = 0;
}

// create explosion effect on player
function create_explosion(player_index) {

    // create the explosion
    var exp = $("<img class='explosion' src='imgs/explosion.png'>");

    // create explosion container and set position
    var container = $("<div class='explosion-container'></div>");
    container.append(exp);
    var half_bot_size = PLAYER_SPRITE_SIZE * 0.5;
    var bot_rand_range = PLAYER_SPRITE_SIZE * 0.35;
    container.css("left", Math.round(half_bot_size + Math.random() * bot_rand_range - Math.random() * bot_rand_range) + "px");
    container.css("top", Math.round(half_bot_size + Math.random() * bot_rand_range - Math.random() * bot_rand_range) + "px");

    // append to div
    $("#p" + player_index + "-graphics").append(container);

    // add animation
    (function(exp) {
        var index = 0;
        function anim() {

            var new_pos = -Math.round(EXPLOSION_SIZE * index++);
            exp.css("left", new_pos + "px");
            if (index >= 8) {
                exp.parent().remove();
            } else {
                setTimeout(anim, 100);
            }
        }
        anim();
    })(exp);
}

// create smoke effect on player
function create_smoke(player_index) {

    // get container
    var container = $("#p" + player_index + "-graphics");

    // create the smoke particle
    var smoke = $("<img class='smoke' src='imgs/smoke.png'>");
    var half_bot_size = PLAYER_SPRITE_SIZE * 0.5;
    var bot_rand_range = PLAYER_SPRITE_SIZE * 0.25;
    var center_x = container.offset().left + half_bot_size;
    var center_y = container.offset().top + half_bot_size;
    var left = (Math.round(center_x + (Math.random() * bot_rand_range) - (Math.random() * bot_rand_range))) + "px";
    var top = (Math.round(center_y + (Math.random() * bot_rand_range) - (Math.random() * bot_rand_range))) + "px";
    smoke.css("left", left);
    smoke.css("top", top);

    // append to div
    container.append(smoke);

    // add animation
    smoke.animate({top:"0px", left:left, opacity:"0.0", height:"200px", width:"200px", "margin-left":"-100px"}, 2500, function(){
        $(this).remove();
    })
}

// do smoke effects
setInterval(function() {
    for (var i = 1; i <= 2; ++i) {
        if (player_data(i).hp <= 8) {
            if (Math.random() < 0.025) create_smoke(i);
        }
        if (player_data(i).hp <= 6) {
            if (Math.random() < 0.075) create_smoke(i);
        }
        if (player_data(i).hp <= 4) {
            if (Math.random() < 0.25) create_smoke(i);
        }
        if (player_data(i).hp <= 2) {
            if (Math.random() < 0.5) create_smoke(i);
            if (Math.random() < 0.25) create_smoke(i);
        }
    }
}, 250);

// play a single turn
function play_turn(player1_action, player2_action) {

    // validate players actions and cancel action if don't have enough ammo etc.
    player1_action = validate_player_action(1, player1_action);
    player2_action = validate_player_action(2, player2_action);

    // play players turn
    play_player_turn(1, player1_action, player2_action);
    play_player_turn(2, player2_action, player1_action);

    // validate status
    validate_player_status(1);
    validate_player_status(2);

    // increase rounds count
    game_data.round++;

    // update gui
    gui_update();
}

// add a floating text above player
function show_player_text(player_index, msg) {

    // create the msg text
    var text = $("<p style='width:100%; text-align:center;'></p>");
    text.text(msg);

    // append to div
    $("#p" + player_index + "-text").append(text);

    // animate text float
    text.animate({top: "-100px"}, 3500, "swing", function() {
        $(this).remove();
    });
}

// add shake effect to element
function shake_elem(elem) {
    var l = 20;
    for( var i = 0; i < 10; i++ )
     $(elem).animate( {
         'margin-left': "+=" + ( l = -l ) + 'px',
         'margin-right': "-=" + l + 'px'
      }, 50);
 }

// play turn for a single player
function play_player_turn(player_index, action, enemy_action) {

    // get player data
    var player = player_data(player_index);

    // set action graphics
    set_action_graphics(player_index, action);

    // if shield, decrease shield
    if (action === "shield") {

        show_player_text(player_index, "Shield!");

        // decrease shields left
        player.shield--;
        return;
    }

    // if reload, add ammo
    if (action === "reload") {

        show_player_text(player_index, "Reload!");

        // add ammo
        player.ammo++;
        return;
    }

    // if heal, add hp
    if (action === "heal") {

        show_player_text(player_index, "Healing!");

        // add hp
        player.hp += 1;
        return;
    }

    // if its firing weapon
    if (action === "fire") {

        show_player_text(player_index, "Fire!");

        // decrease ammo
        player.ammo--;

        // get enemy data
        var enemy_index = player_index === 1 ? 2 : 1;
        enemy = player_data(enemy_index);

        // set damage
        var damage = 2;

        // adjust damage based on enemy action
        switch (enemy_action) {

            // if enemy shields don't damage him
            case "shield":
                damage = 0;
                break;

            // if enemy heals do double damage
            case "heal":
                damage = (damage * 2) + 1; // + 1 to cancel the healing effect
                break;
        }

        // damage enemy!
        if (damage) {

            // decrease enemy hp and add explosion effect
            enemy.hp -= damage;
            create_explosion(enemy_index);

            // if double damage more explosions
            if (damage > 2) {
                create_explosion(enemy_index);
                create_explosion(enemy_index);
            }

            // add shaking effect
            shake_elem($("#p" + enemy_index + "-graphics"));

            // if enemy died add multiple explosions
            if (enemy.hp <= 0) {

                // set enemy to dead
                enemy.is_dead = true;

                // do graphic effects etc.
                (function(enemy_index) {

                    // create explosions effects
                    for (var i = 0; i < 35; ++i) {
                        setTimeout(function () {
                            create_explosion(enemy_index);
                        }, i * 175);
                    }

                    // change enemy action to death (but after a delay so if they both attack at the same time it would be fair..
                    setTimeout(function() {
                        set_action_graphics(enemy_index, "dead");
                    }, 100);

                })(enemy_index);
            }
        }
        return;
    }
}

// starting data
reset_game_date();