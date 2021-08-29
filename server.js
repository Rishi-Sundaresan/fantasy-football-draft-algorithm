/* SERVER IMPLEMENTATION. This file contains server implementation. */
// ASSUMES SNAKE DRAFT.
var express = require('express');
var http = require('http');
var path = require('path');
var fs = require('fs');
var socketIO = require('socket.io');
var app = express();
var server = http.Server(app);
var io = socketIO(server, {
  pingInterval: 15000,
  pingTimeout: 30000,
});

// Setting up the server.
app.set('port', 5000);
app.use('/views/', express.static(__dirname + '/views/'));// Routing
app.get('/', function(request, response) {
  response.sendFile(path.join(__dirname, 'views/index.html'));
});
// Starts the server.
server.listen(process.env.PORT || 5000, function() {
  console.log('Starting server on port 5000');
});

var players_sampled_for_tier_difference = 5;
var num_teams = 10;
var num_rounds = 17;
var user_team = 1;


var current_pick = 1
var current_team = 1


let data = JSON.parse(fs.readFileSync('data.json'));
let projections = JSON.parse(fs.readFileSync('projections.json'));
players_to_delete = []

for (var i = 0; i < data.adp_rank.length; i++) {
	player = data.adp_rank[i]
	let split_name = player.name.split(" ")
	alternate_defense_name = split_name[split_name.length - 1] + " D/ST"

	if (player.name == 'JK Dobbins') {
		players_to_delete.push(player)
	} 

	if (player.name in projections) {
		player.projection = projections[player.name]

	} else if (alternate_defense_name in projections){
		player.projection = projections[alternate_defense_name]

	} else if (player.name  == 'Washington Football Team') {
		player.projection = projections['Washington D/ST']
	} else if (player.name  == 'Will Fuller V') {
		player.projection = projections['William Fuller V']
	} else {
		players_to_delete.push(player)
	}
}

for (var i = 0; i < players_to_delete.length; i++) {
	deletePlayerFromDraft(players_to_delete[i])
}
// Bench size of 7
let roster = ['QB', 'QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'FLEX', 'DST', 'K', "Bench-RB", "Bench-WR", "Bench-QB", "Bench", "Bench", "Bench", "Bench"]

rosters = []
for (var i = 1; i <= num_teams; i++) {
	rosters[i] = [false, false, false, false, false, false, false, false, false, false, 
				  false, false, false, false, false, false]
}

tier_diff_distribution = []
proj_diff_distribution = []


function getAvgTierAndProjectionFromNextPick(position, next_pick) {
  let players_to_compare = []
  for (var i = 0; i < data.adp_rank.length; i++) {
  	player = data.adp_rank[i]
  	if (players_to_compare.length == players_sampled_for_tier_difference) {
  		break;
  	}
  	if (!(matches_position(player, position))) {
  		continue;
  	}
  	if (player.ADP < next_pick) {
  		continue;
  	}
   	if (player.projection == 0) {
  		continue;
  	}
    if (!('tier' in player)) {
  		continue;
  	}
  	players_to_compare.push(player)
	if (player.ADP - next_pick > num_teams) {
		break;
		// We are pretty certain that this player will be available at next pick. 
	}
  }
  if (!(players_to_compare.length)) {
  	return {'avg_tier': -1, 'avg_projection': -1, 'players_to_compare': []}
  }
  avg_tier = players_to_compare.reduce((p1, p2) => p1 + p2.tier, 0)/players_to_compare.length
  avg_projection = players_to_compare.reduce((p1, p2) => p1 + p2.projection, 0)/players_to_compare.length
  return {'avg_tier': avg_tier, 'avg_projection': avg_projection, 'players_to_compare': players_to_compare}
}


function matches_position(player, position) {
	return player.POS == position || 
		   (position == 'FLEX' && ['RB', 'WR', 'TE'].includes(player.POS)) ||
		   (position == "Bench-RB" && player.POS == 'RB') || 
		   (position == "Bench-WR" && player.POS == 'WR') || 
		   (position == "Bench-QB" && player.POS == 'QB') ||
		   (position == "Bench" && player.POS != 'QB')
}

function isBench(position) {
	return position.startsWith("Bench")
}

function createBestOptionsForPosition(position, pick, roster_index, num_options_to_consider=2, options_dict={}) {
	let players_to_pick = []
	let best_options = []
	for (var i = 0; i < data.adp_rank.length; i++) {
		player = data.adp_rank[i]
		if (!(matches_position(player, position))) {
			continue;
		}
		players_to_pick.push(player)
		if (players_to_pick.length >= num_options_to_consider)
			break;
	}
	let next_pick = getNextPick(pick);
	let next_pick_info = getAvgTierAndProjectionFromNextPick(position, next_pick)

	if (players_to_pick.length == 0) {
		throw Error
	}
	for (var i = 0; i < players_to_pick.length; i++) {
		player_to_pick = players_to_pick[i]
		if (player_to_pick.name in options_dict) {
			//repeat player in position
			continue;
		}
		option = {'player': player_to_pick, 
					'roster_index': roster_index,
					'position': position,
					'next_pick_tier_diff': next_pick_info.avg_tier - player_to_pick.tier ,
					'next_pick_projection_diff': player_to_pick.projection - next_pick_info.avg_projection,
					'next_pick_options': next_pick_info.players_to_compare}
		options_dict[player_to_pick.name] = true
		option.score = score(option)
		tier_diff_distribution.push(option.next_pick_tier_diff)
		proj_diff_distribution.push(option.next_pick_projection_diff)
		best_options.push(option)
	}
	if (position == "RB") {
		console.log(best_options)
	}
	return best_options

}

function findOptions(current_pick, rostered_players) {
	let options = []
	var options_dict = {}
	for (var i = 0; i < roster.length; i++) {
		if (rostered_players[i]) {
			continue;
		}
		let position = roster[i] 
		// already analyzed position.
		let new_options = createBestOptionsForPosition(position, current_pick, i, position == "K" || position == "D/ST" ? 1 : 5, options_dict);
		options.push(...new_options);
	}
	return options
}


function pickPlayer(player, rostered_players, roster_index) {
	rostered_players[roster_index] = player
	deletePlayerFromDraft(player)
}

function deletePlayerFromDraft(player) {
	delete data.by_name[player.name]
	delete data.tiers[player.POS][player.tier][player.name]
	for (let i = 0; i < data.adp_rank.length; i++) {
		if (data.adp_rank[i].name == player.name) {
			data.adp_rank.splice(i, 1)
		}
	}
}



function getNextPick(pick) {
	let base = Math.floor(pick / num_teams) * num_teams;
	let round_pick = pick - base
	if (round_pick == 0) 
		round_pick = 2*num_teams
	return 2*num_teams+1 - round_pick + base
}

function score(option) {
	k = 0.25
	adp_weight = 0.65
	bench_weight = 0.65
	flex_weight = 0.9
	//make sure score between 0 and 1.
	proj_diff_score = (option.next_pick_projection_diff - (-25.0))/100.0
	proj_diff_score = Math.max(Math.min(proj_diff_score, 1), 0)
	tier_diff_score = (option.next_pick_tier_diff - (0.5))/2.5
	tier_diff_score = Math.max(Math.min(tier_diff_score, 1), 0)

	raw_score = k*proj_diff_score + (1-k-adp_weight)*tier_diff_score + adp_weight*(Math.max(100-option.player.ADP, 0)/100.0)
	if(isBench(option.position)) {
		return bench_weight*raw_score*100 //out of 100.
	}
	if (option.position == "FLEX") {
		return flex_weight*raw_score*100
	}

	return raw_score*100 //out of 100.
}


function positionInOptions(position, options) {
	for (var i = 0; pick < options.length; i++) {
		if (options[i].position == position) {
			return true
		}
	}
	return false
}

function GetFirstOptionByPositionInOptions(position, options) {
	for (var i = 0; pick < options.length; i++) {
		if (options[i].position == position) {
			return options[i]
		}
	}
	return false
}

function makeBestSelection(current_pick, rostered_players, team_number, pick_player=true) {
	let options = findOptions(current_pick, rostered_players)
	options.sort((a,b) => {return b.score - a.score})

	let best_option = options[0]

	if (best_option.player.POS in options && best_option.player.POS != best_pos) {
		best_option.roster_index = options[best_option.player.POS].roster_index
		best_option.position = best_option.player.POS
	} else if ((best_option.position == 'Bench-RB' || best_option.position == 'Bench-WR') && positionInOptions("FLEX", options)) {
		flex_option = GetFirstOptionByPositionInOptions("FLEX", options)
		best_option.roster_index = flex_option.roster_index
		best_option.position = 'FLEX'
		flex_option.score = -100
	}
	if (pick_player) {
		pickPlayer(best_option.player, rostered_players, best_option.roster_index)
	}
	return [best_option.player, options]
}


function run_draft(rounds) {
	let draft = Array.from(Array(num_teams*num_rounds + 1).keys())
	for (var pick = 1; pick <= num_teams; pick++) {
		draft[pick] = pick
	}

	for (var pick = 1; pick <= Math.min(num_teams*num_rounds, rounds); pick++) {
		let team_number = draft[pick]
		let [player, options] = makeBestSelection(pick, rosters[team_number], team_number)
		let player_name = player.name
		console.log("Pick " + pick.toString() + ": Team " + team_number.toString() + " picks " + player_name)
		if (getNextPick(pick) < draft.length) {
			draft[getNextPick(pick)] = team_number
		}

	}
}


let draft = Array(num_teams*num_rounds+1).fill(0)
for (var i = 1; i <= num_teams; i++) {
	let team_number = i
	draft[i] = team_number
	pick = i
	while (getNextPick(pick) < draft.length) {
		draft[getNextPick(pick)] = team_number
		pick = getNextPick(pick)
	}
}

function incrementDraft(draft, socket) {
	if (current_pick == draft.length - 1) {
		console.log("DRAFT DONE")
		return
	}
	current_pick += 1
	current_team = draft[current_pick]
	emit_draft_state(socket)
}

function emit_draft_state(socket) {
	socket.emit("player-list", data.adp_rank)
	let [player, options] = makeBestSelection(current_pick, rosters[current_team], current_team, false);
	socket.emit('best-choice', {"player": player, "options": options})
	socket.emit('roster', {"team_number": current_team, "roster": rosters[current_team], "roster_positions": roster})
	socket.emit('my-roster', {"team_number": user_team, "roster": rosters[user_team], "roster_positions": roster})

}

io.on('connection', function(socket) {

	emit_draft_state(socket)
	socket.on('draft-player', function(index) {
		let player = data.adp_rank[index]
		 // Find most restrictive position that matches player.
		for (var i = 0; i < roster.length; i++) {
			let position = roster[i]
			if (matches_position(player, position) && !rosters[current_team][i]) {
				console.log("Player Picked: " + player.name)
				pickPlayer(data.adp_rank[index], rosters[current_team], i)
				incrementDraft(draft, socket)
				return
			}
		}
		socket.emit(`No Available Spots for player ${player.name}`)
	});
});



