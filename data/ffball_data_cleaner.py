import csv
from collections import defaultdict

mode = "2-Flex-PPR"
players = []
with open(mode +'/adp.csv', 'r') as f:
    players = [{k: v for k, v in row.items()}
        for row in csv.DictReader(f, skipinitialspace=True)]

for player in players:
	player['ADP'] = float(player['ADP'])
	if mode ==  "2-Flex-PPR" and player['POS'] == 'QB':
		player['ADP'] += 10.0
	player['RK'] = int(player['RK'])
	player['name'] = player['name'].replace(".", "")
	if "xca" in player['name']:
		player['INJ'] = True
	else:
		player['INJ'] = False

players = sorted(players, key=lambda p : p['ADP'])

players_by_name = {}

print(len(players))

for player in players:
	players_by_name[player['name']] = player

tiers = {}
position_tiers = {}
tier_num = 0
rows = []
latest_player = {}
with open(mode +'/tiers.txt', 'r') as f:
	rows = f.read().splitlines();
for val in rows:
	if val in ['QB', 'RB', 'WR', 'TE', 'DST', 'K']:
		tiers[val] = {}
		position_tiers = tiers[val]
	elif val.startswith('Tier'):
		tier_num = int(val.split(" ")[1])
		position_tiers[tier_num] = {}
	elif "/" in val:
		continue
	elif val[0].isdigit():
		continue
	elif val in ['Show more', 'Show less']:
		continue
	elif val == "INJ":
		latest_player["INJ"] = True
		continue
	else:
		# It is a name.
		name = val.split(" (")[0]
		name = name.replace(".", "")
		if name == "":
			continue

		if name == "Washington":
			name = "Washington Football Team"
		if name == "LA Chargers":
			name = "Los Angeles Chargers"

		orig_name = name
		while name not in players_by_name and len(name)>2:
			name = name[:-1]

		if name not in players_by_name:
			if orig_name + " Jr" in players_by_name:
				name = orig_name + " Jr"
			else:
				#print('Missing: ' + orig_name)
				continue
		players_by_name[name]['tier'] = tier_num
		position_tiers[tier_num][name] = players_by_name[name]
		latest_player = players_by_name[name]


print(len(players))

data = {}
data = {"adp_rank": players, "by_name": players_by_name, "tiers": tiers}
import json
with open(mode +'/data.json', 'w') as f:
    json.dump(data, f)
