/*
* Wrapper to actually run the game rounds and execute the Adder codes.
* Author: Ronen Ness.
* Since: 2016.
*/

var next_round_timeout = null;

// end game
function show_end_of_fight_screen() {

    // make sure we won't have a next timeout
    if (next_round_timeout) {
        clearTimeout(next_round_timeout);
    }

    // remove round number
    if (game_data.round > ROUNDS_PER_GAME) game_data.round = ROUNDS_PER_GAME;
    gui_update();

    // remove the stop fight button
    $("#stop-fight-button").hide();

    // show game end screen
    $("#end-game-menu").delay(2000).fadeIn(1000);

    // get players hp
    var p1_hp = player_data(1).hp;
    var p2_hp = player_data(2).hp;

    // battle stopped by user
    if (game_data.was_stopped) {
        $("#fight-result").text("BATTLE CANCELLED!");
        $("#fight-end-reason").text("You clicked on stop battle. No one wins.");
    }
    // is tie?
    else if (p1_hp === p2_hp) {
        $("#fight-result").text("ITS A TIE!");
        if (p1_hp) {
            $("#fight-end-reason").text("Rounds ended with both bots still alive and equally injured.");
        } else {
            $("#fight-end-reason").text("Both bots died at the same time.");
        }
    }
    // player 1 wins
    else if (p1_hp > p2_hp) {
        $("#fight-result").text("YOU WIN!");
        if (p2_hp) {
            $("#fight-end-reason").text("Rounds ended with you having more HP.");
        } else {
            $("#fight-end-reason").text("You managed to eliminate the enemy!");
        }
    }
    // player 2 wins
    else {
        $("#fight-result").text("YOU LOSE!");
        if (p1_hp) {
            $("#fight-end-reason").text("Rounds ended with you having less HP.");
        } else {
            $("#fight-end-reason").text("The enemy managed to eliminate you!");
        }
    }
}

// start a new game
function start_game() {

    // reset game data
    reset_game_date();

    // show the button to stop fight in the middle
    $("#stop-fight-button").fadeIn(1000);

    // create enemy program
    var enemy = create_adder_program($("#enemy-code").val());

    // create player program
    var player;
    try {
        player = create_adder_program(window.user_code.getValue());
    } catch (e) {
        show_msg_box("Error in code!", "An error occurred while compiling your code: " + e + ".");
        return;
    }

    // if was error on user's code test
    var was_error = false;

    // execute player code once to make sure its valid
    try {
        player.execute();
    }
    // on errors:
    catch (e) {

        // reset console and show error message
        if (e.constructor !== DoAction) {
            show_msg_box("Error in code!", "An error occurred while testing your code: " + e + ".");
            was_error = true;
        }
    }

    // reset console and user context
    player.resetContext();
    clear_console();

    // if was error stop here
    if (was_error) {
        return;
    }

    // update gui and show the huge "FIGHT!" text
    gui_update();
    var fight_text = $("<h1 style='text-align:center; color:white; position:fixed; z-index:100000; top: 220px; left:0px; width:100%'>FIGHT!</h1>");
    $(document.body).append(fight_text);
    fight_text.animate({"font-size": "500px", "opacity": "0.0"}, 1200, function() {
        $(this).remove();
    });

    // play one game round
    function play_game_round() {

        // set enemy and self for enemy
        game_data.playerenemy = game_data.player1;
        game_data.playerself = game_data.player2;

        // run enemy code to get his action
        var enemy_action = "idle";
        try {
            enemy.execute();
        }
        catch (e) {
            if (e.constructor === DoAction) {
                enemy_action = e.action;
            } else {throw e;}
        }

        // set enemy and self for player
        game_data.playerenemy = game_data.player2;
        game_data.playerself = game_data.player1;

        // run player code to get his action
        var player_action = "idle";
        try {
            player.execute();
        }
        catch (e) {
            if (e.constructor === DoAction) {
                player_action = e.action;
            } else {throw e;}
        }

        // play turn
        play_turn(player_action, enemy_action)

        // is game over?
        if (game_data.was_stopped ||
            game_data.round > ROUNDS_PER_GAME ||
            player_data(1).is_dead || player_data(2).is_dead) {
                show_end_of_fight_screen();
                return;
        }

        // call next round
        next_round_timeout = setTimeout(play_game_round, DELAY_BETWEEN_ROUNDS);
    }

    // hide all menus
    hide_all_menus();

    // call first round
    next_round_timeout = setTimeout(play_game_round, DELAY_BETWEEN_ROUNDS * 0.7);
}