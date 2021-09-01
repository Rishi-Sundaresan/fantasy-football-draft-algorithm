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

var modes = {'2-QB-Half-PPR': ['QB', 'QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'FLEX', 'DST', 'K', "Bench-RB", "Bench-WR", "Bench-QB"], 'PPR': ['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'FLEX', 'DST', 'K', "Bench-RB", "Bench-WR", "Bench-QB"]}

var all_drafts = {}

var state_history = {}

var locks = {};

io.on('connection', function(socket) {
	var id_ = Math.random().toString(36).slice(2);
	while (id_ in all_drafts) {
		id_ = Math.random().toString(36).slice(2);
	}
	var draft_ = new Draft(id_, socket, '2-QB-Half-PPR', 7, 10, 1);
	all_drafts[id_] = draft_
	draft_.emit_draft_state()

	socket.on('draft-player', function(index) {
		draft_.pickPlayerAndIncrementDraft(index)
	});

	socket.on('set-mode', function(mode) {
		draft_.setMode(mode);
	});

	socket.on('set-num-teams', function(num_teams) {
		draft_.setNumTeams(num_teams);
	});

	socket.on('set-num-bench', function(num_bench) {
		draft_.setNumBench(num_bench);
	});

	socket.on('set-user-team', function(user_team) {
		draft_.setUserTeam(user_team);
	});

	socket.on('undo', function() {
		if (state_history[id_].length > 0) {
			draft_.setDraftToPreviousState();
		}
		
	});
});


class Draft {

	constructor(id, socket, mode, num_bench, num_teams, user_team_pick) {
		this.socket = socket
		this.id = id;
		this.mode = mode
		this.num_bench = num_bench
		this.num_teams = num_teams
		this.user_team_pick = user_team_pick
		this.data = {}

		this.setUpDraft()
	}
	setUpDraft() {
		locks[this.id] = false
		this.locked = locks[this.id]

		this.current_team = 1
		this.current_pick = 1
		this.rosters = Array(this.num_teams+1).fill([])
		this.data = JSON.parse(fs.readFileSync('data/' + this.mode + "/data.json"));
		let projections = JSON.parse(fs.readFileSync('data/' + this.mode + "/projections.json"));
		this.roster_template = modes[this.mode].slice()
		for (let i = 0; i < this.num_bench-3; i++) {
			this.roster_template.push("Bench")
		}

		this.num_rounds = this.roster_template.length
		for (var i = 1; i <= this.num_teams; i++) {
			this.rosters[i] = Array(this.roster_template.length).fill(false)

		}

		let players_to_delete = []

		for (var i = 0; i < this.data.adp_rank.length; i++) {
			let player = this.data.adp_rank[i]
			let split_name = player.name.split(" ")
			let alternate_defense_name = split_name[split_name.length - 1] + " D/ST"

			if (player.name == 'JK Dobbins') {
				players_to_delete.push(player)
			} 
			if (player.name == 'Deshaun Watson') {
				players_to_delete.push(player)
			} 
			if (player.name == 'Wil Lutz') {
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
		// console.log(players_to_delete.length)
		// for (var i = 0; i < players_to_delete.length; i++) {
		// 	console.log(players_to_delete[i].name)
		// }
		for (var i = 0; i < players_to_delete.length; i++) {
			this.deletePlayerFromDraft(players_to_delete[i])
		}
		this.tier_diff_distribution = []
		this.proj_diff_distribution = []

		this.draft_order = Array(this.num_teams*this.num_rounds+1).fill(0)
		for (var i = 1; i <= this.num_teams; i++) {
			let team_number = i
			this.draft_order[i] = team_number
			let pick = i
			while (this.getNextPick(pick) < this.draft_order.length) {
				this.draft_order[this.getNextPick(pick)] = team_number
				pick = this.getNextPick(pick)
			}
		}
		state_history[this.id] = [this.getStateCopy()]

		this.emit_draft_state()

	}

	getStateCopy() {
		return {"data": JSON.parse(JSON.stringify(this.data)), "draft_order": this.draft_order, 
				"roster_template": this.roster_template, "rosters": JSON.parse(JSON.stringify({"temp": this.rosters})).temp, 
				"current_pick": this.current_pick, "current_team": this.current_team}
	}

	setMode(mode) {
		this.mode = mode
		this.setUpDraft()
	}
	setNumTeams(num_teams) {
		this.num_teams = num_teams
		this.setUpDraft()
	}
	setNumBench(num_bench) {
		this.num_bench = num_bench
		this.setUpDraft()
	}
	setUserTeam(user_team) {
		this.user_team_pick = user_team
		this.setUpDraft()
	}

	getAvgTierAndProjectionFromNextPick(position, next_pick) {
	  let players_to_compare = []
	  for (var i = 0; i < this.data.adp_rank.length; i++) {
	  	let player = this.data.adp_rank[i]
	  	if (players_to_compare.length == players_sampled_for_tier_difference) {
	  		break;
	  	}
	  	if (!(this.matches_position(player, position))) {
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
		if (player.ADP - next_pick > this.num_teams) {
			break;
			// We are pretty certain that this player will be available at next pick. 
		}
	  }
	  if (!(players_to_compare.length)) {
	  	return {'avg_tier': -1, 'avg_projection': -1, 'players_to_compare': []}
	  }
	  let avg_tier = players_to_compare.reduce((p1, p2) => p1 + p2.tier, 0)/players_to_compare.length
	  let avg_projection = players_to_compare.reduce((p1, p2) => p1 + p2.projection, 0)/players_to_compare.length
	  return {'avg_tier': avg_tier, 'avg_projection': avg_projection, 'players_to_compare': players_to_compare}
	}


	matches_position(player, position) {
		return player.POS == position || 
			   (position == 'FLEX' && ['RB', 'WR', 'TE'].includes(player.POS)) ||
			   (position == "Bench-RB" && player.POS == 'RB') || 
			   (position == "Bench-WR" && player.POS == 'WR') || 
			   (position == "Bench-QB" && player.POS == 'QB') ||
			   (position == "Bench" && player.POS != 'QB')
	}

	isBench(position) {
		return position.startsWith("Bench")
	}

	createBestOptionsForPosition(position, pick, roster_index, num_options_to_consider=2, options_dict={}) {
		let players_to_pick = []
		let best_options = []
		for (var i = 0; i < this.data.adp_rank.length; i++) {
			let player = this.data.adp_rank[i]
			if (!(this.matches_position(player, position))) {
				continue;
			}
			players_to_pick.push(player)
			if (players_to_pick.length >= num_options_to_consider)
				break;
		}
		let next_pick = this.getNextPick(pick);
		let next_pick_info = this.getAvgTierAndProjectionFromNextPick(position, next_pick)

		if (players_to_pick.length == 0) {
			throw Error
		}
		for (var i = 0; i < players_to_pick.length; i++) {
			let player_to_pick = players_to_pick[i]
			if (player_to_pick.name in options_dict) {
				//repeat player in position
				continue;
			}
			let option = {'player': player_to_pick, 
						'roster_index': roster_index,
						'position': position,
						'next_pick_tier_diff': next_pick_info.avg_tier - player_to_pick.tier ,
						'next_pick_projection_diff': player_to_pick.projection - next_pick_info.avg_projection,
						'next_pick_options': next_pick_info.players_to_compare}
			options_dict[player_to_pick.name] = true
			option.score = this.score(option)
			this.tier_diff_distribution.push(option.next_pick_tier_diff)
			this.proj_diff_distribution.push(option.next_pick_projection_diff)
			best_options.push(option)
		}
		return best_options

	}

	findOptions(current_pick, rostered_players) {
		let options = []
		var options_dict = {}
		for (var i = 0; i < this.roster_template.length; i++) {
			if (rostered_players[i]) {
				continue;
			}
			let position = this.roster_template[i] 
			// already analyzed position.
			let new_options = this.createBestOptionsForPosition(position, current_pick, i, position == "K" || position == "D/ST" ? 1 : 5, options_dict);
			options.push(...new_options);
		}
		return options
	}


	pickPlayer(player, rostered_players, roster_index) {
		rostered_players[roster_index] = player
		this.deletePlayerFromDraft(player)
	}

	deletePlayerFromDraft(player) {
		delete this.data.by_name[player.name]
		if ("tier" in player) {
			delete this.data.tiers[player.POS][player.tier][player.name]
		}

		for (let i = 0; i < this.data.adp_rank.length; i++) {
			if (this.data.adp_rank[i].name == player.name) {
				this.data.adp_rank.splice(i, 1)
			}
		}
	}



	getNextPick(pick) {
		let base = Math.floor(pick / this.num_teams) * this.num_teams;
		let round_pick = pick - base
		if (round_pick == 0) 
			round_pick = 2*this.num_teams
		return 2*this.num_teams+1 - round_pick + base
	}

	score(option) {
		let k = 0.25
		let adp_weight = 0.65
		let bench_weight = 0.65
		let flex_weight = 0.9
		//make sure score between 0 and 1.
		let proj_diff_score = (option.next_pick_projection_diff - (-25.0))/100.0
		proj_diff_score = Math.max(Math.min(proj_diff_score, 1), 0)
		let tier_diff_score = (option.next_pick_tier_diff - (0.5))/2.5
		tier_diff_score = Math.max(Math.min(tier_diff_score, 1), 0)

		let raw_score = k*proj_diff_score + (1-k-adp_weight)*tier_diff_score + adp_weight*(Math.max(100-option.player.ADP, 0)/100.0)
		if(this.isBench(option.position)) {
			return bench_weight*raw_score*100 //out of 100.
		}
		if (option.position == "FLEX") {
			return flex_weight*raw_score*100
		}

		return raw_score*100 //out of 100.
	}


	positionInOptions(position, options) {
		for (var i = 0; i < options.length; i++) {
			if (options[i].position == position) {
				return true
			}
		}
		return false
	}

	GetFirstOptionByPositionInOptions(position, options) {
		for (var i = 0; i < options.length; i++) {
			if (options[i].position == position) {
				return options[i]
			}
		}
		return false
	}

	makeBestSelection(current_pick, rostered_players, team_number, pick_player=true) {
		let options = this.findOptions(current_pick, rostered_players)
		options.sort((a,b) => {return b.score - a.score})

		let best_option = options[0]

		if (best_option.player.POS in options && best_option.player.POS != best_pos) {
			best_option.roster_index = options[best_option.player.POS].roster_index
			best_option.position = best_option.player.POS
		} else if ((best_option.position == 'Bench-RB' || best_option.position == 'Bench-WR') && this.positionInOptions("FLEX", options)) {
			flex_option = this.GetFirstOptionByPositionInOptions("FLEX", options)
			best_option.roster_index = flex_option.roster_index
			best_option.position = 'FLEX'
			flex_option.score = -100
		}
		if (pick_player) {
			console.log("Picking player")
			this.pickPlayer(best_option.player, rostered_players, best_option.roster_index)
		}
		return [best_option.player, options]
	}


	// run_draft(rounds) {
	// 	let draft = Array.from(Array(this.num_teams*this.num_rounds + 1).keys())
	// 	for (var pick = 1; pick <= this.num_teams; pick++) {
	// 		draft[pick] = pick
	// 	}

	// 	for (var pick = 1; pick <= Math.min(this.num_teams*this.num_rounds, rounds); pick++) {
	// 		let team_number = draft[pick]
	// 		let [player, options] = this.makeBestSelection(pick, this.rosters[team_number], team_number)
	// 		let player_name = player.name
	// 		console.log("Pick " + pick.toString() + ": Team " + team_number.toString() + " picks " + player_name)
	// 		if (this.getNextPick(pick) < draft.length) {
	// 			draft[this.getNextPick(pick)] = team_number
	// 		}

	// 	}
	// }

	incrementDraft() {
		if (this.current_pick == this.draft_order.length - 1) {
			this.emit_draft_state()
			return;
		}
		this.current_pick += 1
		this.current_team = this.draft_order[this.current_pick]
		this.emit_draft_state()
	}

	pickPlayerAndIncrementDraft(index) {
		if (this.locked) {return;}
		this.locked = true
		state_history[this.id].push(this.getStateCopy())
		let player = this.data.adp_rank[index]
		 // Find most restrictive position that matches player.
		for (var i = 0; i < this.roster_template.length; i++) {
			let position = this.roster_template[i]
			if (this.matches_position(player, position) && !this.rosters[this.current_team][i]) {
				console.log(`Draft ${this.id} ==> Player Picked: ${player.name}` )
				this.pickPlayer(this.data.adp_rank[index], this.rosters[this.current_team], i)
				this.incrementDraft()
				this.locked = false
				return
			}
		}
		this.socket.emit(`No Available Spots for player ${player.name}`)
		this.locked = false
	}

	setDraftToPreviousState() {
		if (this.locked) {return;}
		this.locked = true
		let last_state = state_history[this.id].pop()
		this.data = last_state.data
		this.draft_order = last_state.draft_order
		this.rosters = last_state.rosters
		this.roster_template = last_state.roster_template
		this.current_pick = last_state.current_pick
		this.current_team = last_state.current_team
		this.emit_draft_state()
		this.locked = false
	}

	emit_draft_state() {
		this.socket.emit("player-list", this.data.adp_rank)
		if (this.current_pick == this.draft_order.length - 1) {
			let [player, options] = this.makeBestSelection(this.current_pick, this.rosters[this.current_team], this.current_team, false);
			this.socket.emit('best-choice', {"player": player, "options": options})
		}
		this.socket.emit('roster', {"team_number": this.current_team, "roster": this.rosters[this.current_team], "roster_positions": this.roster_template})
		this.socket.emit('my-roster', {"team_number": this.user_team_pick, "roster": this.rosters[this.user_team_pick], "roster_positions": this.roster_template})
	}

}



