var socket = io();
var clicked_row = -1
var num_teams = 10;
var user_team = 1;
setUserTeamOptions()
function highlight_row() {
    var table = document.getElementById('players');
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
                rowsNotSelected[row].classList.remove('selected');
            }
            var rowSelected = table.getElementsByTagName('tr')[rowId];
            rowSelected.className += " selected";
            clicked_row = rowId
        }
    }
    cells[0].click()

}



socket.on('player-list', function(player_list) {
    document.getElementById('player-data').innerHTML = "";
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
    highlight_row()
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
});

socket.on('roster', function(roster_info) {
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


