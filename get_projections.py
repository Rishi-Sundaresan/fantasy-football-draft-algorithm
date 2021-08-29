with open('players_for_projections.txt', 'r') as f:
	rows = f.read().splitlines();

projections = {}
players = []
for row in rows:
	if len(row) > 6:
		if row.replace(".", "") in players:
			print(row.replace(".", ""))
		players.append(row.replace(".", ""))

with open('projections.txt', 'r') as f:
	projs = f.read().splitlines();

for i in range(len(projs)):
	projections[players[i]] = float(projs[i])

print(projections['Jamison Crowder'] == 129.3)
print(projections['Matt Prater'] == 131.4)
print(projections['Javonte Williams'] == 159.1)
print(projections['Justice Hill'] == 26.1)

import json
with open('projections.json', 'w') as f:
    json.dump(projections, f)