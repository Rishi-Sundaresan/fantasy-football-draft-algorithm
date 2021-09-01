var socket = io();
var clicked_row = -1
var clicked_option = -1
var num_teams = 10;
var user_team = 1;
var latest_best_choice = {}
var latest_player_list = []
setUserTeamOptions()
function highlight_row(table_name) {
    var table = document.getElementById(table_name);
    var cells = table.getElementsByTagName('td');

    for (var i = 0; i < cells.length; i++) {
        // Take each cell
        var cell = cells[i];
        // do something on onclick event for cell
        cell.onclick = function () {
            // Get the row id where the cell exists
            var rowId = this.parentNode.rowIndex;

            var rowsNotSelected = table.getElementsByTagName('tr');
            for (var row = 0; row < rowsNotSelected.length; row++) {
                rowsNotSelected[row].style.backgroundColor = "";
                table_name == "players" ? rowsNotSelected[row].classList.remove('selected') : rowsNotSelected[row].classList.remove('option-selected');
            }
            var rowSelected = table.getElementsByTagName('tr')[rowId];
            if (table_name == "players") {
                clicked_row = rowId
                rowSelected.className += " selected"
            } else if (table_name == "recommendations") {
                clicked_option = rowId
                rowSelected.className += " option-selected"
                displayOptionBreakdown()
                //match player list with option
                let player_cells = document.getElementById('players').getElementsByTagName('td')
                for (var i = 0; i < player_cells.length; i++) {
                    if (player_cells[i].innerHTML == latest_best_choice.options[clicked_option-1].player.name) {
                        player_cells[i].click()
                        break;
                    }
                }
            }
            
        }
    }
    cells[0].click()
}



socket.on('player-list', function(player_list) {
    document.getElementById('player-data').innerHTML = "";
    latest_player_list = player_list
    for (var i = 0; i < player_list.length; i++) {
        let player = player_list[i]
        document.getElementById('player-data').innerHTML += 
        `<tr>\
                            <td>${player.RK}</td>\
                            <td>${player.name}</td>\
                            <td>${player.POS}</td>\
                            <td>${player.TEAM}</td>\
                            <td>${player.ADP}</td>\
        </tr>`
     }
    highlight_row('players')
});


socket.on('best-choice', function(best_choice) {
    document.getElementById('recommendation-data').innerHTML = "";
    let max_recs = 10;
    for (var i = 0; i < Math.min(best_choice.options.length, max_recs); i++) {
        let option = best_choice.options[i]
        let score = " &nbsp;&nbsp; " + option.score.toString().slice(0,5) 
        document.getElementById('recommendation-data').innerHTML += 
        `<tr>\
                            <td class='border'>${option.position}</td>\
                            <td>${option.player.name}</td>\
                            <td>${option.player.TEAM}</td>\
                            <td>${option.player.ADP}</td>\
                            <td class='score'> ${score}</td>\
        </tr>`
     }
     latest_best_choice = best_choice
     highlight_row('recommendations')
});

socket.on('roster', function(roster_info) {
    document.getElementById('recommendations-title').innerHTML = `Recommendations for Team ${roster_info.team_number}`
    document.getElementById('roster-title').innerHTML = `Team ${roster_info.team_number} Roster`;

    document.getElementById('roster-data').innerHTML = "";
    for (var i = 0; i < roster_info.roster_positions.length; i++) {
        let position = roster_info.roster_positions[i]
        if (position.startsWith('Bench')) {
            position = "Bnch"
        }
        let player = roster_info.roster[i];
        if (!player) {
            document.getElementById('roster-data').innerHTML += 
            `<tr>\
                                <td>${position}</td>\
                                <td> </td>\
                                <td></td>\
            </tr>`
        } else {
        document.getElementById('roster-data').innerHTML += 
        `<tr>\
                            <td>${position}</td>\
                            <td>${player.name}</td>\
                            <td>  &nbsp;&nbsp; ${player.projection}</td>\
        </tr>`
        }
     }
});

socket.on('my-roster', function(my_roster_info) {

    document.getElementById('my-roster-data').innerHTML = "";
    for (var i = 0; i < my_roster_info.roster_positions.length; i++) {
        let position = my_roster_info.roster_positions[i]
        if (position.startsWith('Bench')) {
            position = "Bnch"
        }
        let player = my_roster_info.roster[i];
        if (!player) {
            document.getElementById('my-roster-data').innerHTML += 
            `<tr>\
                                <td>${position}</td>\
                                <td> </td>\
                                <td></td>\
            </tr>`
        } else {
        document.getElementById('my-roster-data').innerHTML += 
        `<tr>\
                            <td>${position}</td>\
                            <td>${player.name}</td>\
                            <td>  &nbsp;&nbsp; ${player.projection}</td>\
        </tr>`
        }
     }
});

document.getElementById('draft-player').addEventListener("click", function() {
    //Index to draft
    socket.emit('draft-player', clicked_row-1)
    let button = this
    button.disabled = true

    setTimeout(function(){
        button.disabled = false
    }, 800)//ms
})

document.getElementById('undo').addEventListener("click", function() {
    socket.emit('undo')
    console.log("UNDO")
})

function setUserTeamOptions() {
    document.getElementById("user-team-select").innerHTML = ""
    for (var i = 1; i <= num_teams; i++) {
        if (user_team == i) {
            document.getElementById("user-team-select").innerHTML += `<option class="select" value="${i}" selected>${i}</option>`
        } else {
            document.getElementById("user-team-select").innerHTML += `<option class="select" value="${i}">${i}</option>`
        }
    }
}


function displayOptionBreakdown() {
    let option = latest_best_choice.options[clicked_option-1]

    document.getElementById('option-title').innerHTML = `Grade Breakdown for ${option.player.name}`
    var html = `<div class='info'> ${option.player.name} is a <span class="imp">tier ${option.player.tier} ${option.player.POS} </span>, projected for <span class="imp"> ${option.player.projection} points </span>. If you wait until the next round(s) to pick a ${option.position}, your pick will\
    be probably at least about ${option.next_pick_tier_diff.toFixed(1)} tiers lower, with a corresponding drop of ${option.next_pick_projection_diff.toFixed(1)} projected points </div>`;
    document.getElementById('grade-breakdown').innerHTML = html;



    document.getElementById('grade-breakdown').innerHTML += `<div class="next-round">Probable Next Round Options</div> <div class="next-options"><table id=option-table class="table-layout small">
                    <thead>
                        <th>Name</th>
                        <th>Team</th>
                        <th>Tier</th>
                        <th>Projection</th>
                        <th>ADP</th>
                    </thead>
                    <tbody id='option-table-data'>
                    </tbody>
                </table></div>`

    for (var i = 0; i < option.next_pick_options.length; i++) {
        let player = option.next_pick_options[i]
        document.getElementById('option-table-data').innerHTML += 
        `<tr>\
                            <td>${player.name}</td>\
                            <td>${player.TEAM}</td>\
                            <td>${player.tier}</td>\
                            <td>${player.projection}</td>\
                            <td>${player.ADP}</td>\
        </tr>`
    }

}


document.getElementById('mode-select').addEventListener('change', (event) => {
  socket.emit('set-mode', event.target.value)
});
document.getElementById('teams-select').addEventListener('change', (event) => {
  socket.emit('set-num-teams', parseInt(event.target.value))
  num_teams = parseInt(event.target.value)
  setUserTeamOptions()
});
document.getElementById('bench-select').addEventListener('change', (event) => {
  socket.emit('set-num-bench', parseInt(event.target.value))
});
document.getElementById('user-team-select').addEventListener('change', (event) => {
  socket.emit('set-user-team', parseInt(event.target.value))
  user_team = parseInt(event.target.value)
});


