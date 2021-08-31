mode = "PPR"

with open(mode + '/players_for_projections.txt', 'r') as f:
	rows = f.read().splitlines();

projections = {}
players = []
for row in rows:
	if len(row) > 6:
		if row.replace(".", "") in players:
			print(row.replace(".", ""))
		players.append(row.replace(".", ""))

with open(mode + '/projections.txt', 'r') as f:
	projs = f.read().splitlines();

for i in range(len(projs)):
	projections[players[i]] = float(projs[i])

print(projections['Jamison Crowder'] == 161.7)
print(projections['Matt Prater'] == 131.4)
print(projections['Javonte Williams'] == 173.8)
print(projections['Darius Slayton'] == 93.2)

import json
with open(mode + '/projections.json', 'w') as f:
    json.dump(projections, f)