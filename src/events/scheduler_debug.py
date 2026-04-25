from math import ceil


def get_game_duration(game, duration_multiplier):
    base = game.get('game_data', {}).get('maxPlaytime', 60)
    return ceil(base * duration_multiplier)


def can_cover_with_groups(total_players, groups, min_players, max_players):
    for k in range(1, groups + 1):
        if total_players >= k * min_players and total_players <= k * max_players:
            return True
    return False


def generate_partitions(total_players, num_groups, min_players, max_players):
    partitions = []

    def backtrack(remaining, groups_so_far, current):
        if groups_so_far == num_groups:
            if remaining == 0:
                partitions.append(list(current))
            return

        group_min = max(min_players, remaining - (num_groups - groups_so_far - 1) * max_players)
        group_max = min(max_players, remaining - (num_groups - groups_so_far - 1) * min_players)

        for size in range(group_min, group_max + 1):
            current.append(size)
            backtrack(remaining - size, groups_so_far + 1, current)
            current.pop()

    backtrack(total_players, 0, [])
    return partitions


def build_scored_participants(unassigned, game_id, pref_map, player_game_count):
    scored = []
    for p in unassigned:
        pref = pref_map.get(p['id'], {}).get(game_id)
        if pref == 'really_want':
            score = 10
        elif pref == 'want':
            score = 5
        elif pref == 'neutral':
            score = 1
        elif pref == 'dont_want':
            score = -8
        else:
            score = 1
        plays_least = player_game_count.get(p['id'], 0)
        scored.append({'p': p, 'gameScore': score, 'playsLeast': plays_least})
    scored.sort(key=lambda x: (-x['gameScore'], x['playsLeast']))
    return scored


def score_game(game, participants, preferences, played_games, params):
    score = 0
    game_id = game['game_id']
    for p in participants:
        pref = preferences.get(p['id'], {}).get(game_id)
        if pref == 'really_want':
            score += 10
        elif pref == 'want':
            score += 5
        elif pref == 'neutral':
            score += 1
        elif pref == 'dont_want':
            score -= 8
    times_played = played_games.get(game_id, 0)
    if times_played > 0:
        score -= 20 * times_played
    score *= params.get('prioritizePreferences', 1)
    return score


def find_best_game_for_group(group_size, unassigned_subset, games, used_game_ids, pref_map, played_games, duration_multiplier, remaining_minutes, prioritize_preferences):
    best_game = None
    best_score = float('-inf')
    best_group = None

    for game in games:
        if game['game_id'] in used_game_ids:
            continue
        game_data = game.get('game_data', {})
        max_players = game_data.get('maxPlayers', 6)
        min_players = game_data.get('minPlayers', 2)
        duration = get_game_duration(game, duration_multiplier)

        if duration > remaining_minutes or group_size < min_players or group_size > max_players:
            continue

        scored = build_scored_participants(unassigned_subset, game['game_id'], pref_map, {})
        group = [s['p'] for s in scored[:group_size]]
        game_score = score_game(game, group, pref_map, played_games, {'prioritizePreferences': prioritize_preferences})
        if game_score > best_score:
            best_score = game_score
            best_game = game
            best_group = group

    return best_game, best_group, best_score


def reproduce_case():
    participants = [
        {'id': '10d60d71-38a7-4733-a76e-237971475cd6', 'name': 'Jelle'},
        {'id': '49a20965-0c62-4be1-b137-87b3ba6d4a94', 'name': 'Kristof'},
        {'id': '5a17074e-5131-42cb-a413-cd0e99180016', 'name': 'Tom'},
    ]
    games = [
        {'game_id': 278292, 'game_name': 'Anachrony', 'game_data': {'minPlayers': 1, 'maxPlayers': 4, 'maxPlaytime': 120}},
        {'game_id': 5404, 'game_name': 'Amun-Re', 'game_data': {'minPlayers': 3, 'maxPlayers': 5, 'maxPlaytime': 90}},
        {'game_id': 68448, 'game_name': '7 Wonders', 'game_data': {'minPlayers': 2, 'maxPlayers': 7, 'maxPlaytime': 30}},
        {'game_id': 9446, 'game_name': 'Blue Moon', 'game_data': {'minPlayers': 2, 'maxPlayers': 2, 'maxPlaytime': 30}},
    ]
    pref_map = {
        '10d60d71-38a7-4733-a76e-237971475cd6': {5404: 'dont_want', 9446: 'want', 68448: 'dont_want', 278292: 'want'},
        '49a20965-0c62-4be1-b137-87b3ba6d4a94': {5404: 'really_want', 9446: 'really_want', 68448: 'dont_want', 278292: 'neutral'},
        '5a17074e-5131-42cb-a413-cd0e99180016': {5404: 'really_want', 9446: 'really_want', 68448: 'really_want', 278292: 'really_want'},
    }

    min_players_per_game = 2
    max_parallel_games = 2
    remaining_minutes = 240
    used_game_ids = set()
    played_games = {}

    available_now = participants
    assigned_in_slot = set()

    print('available_now length', len(available_now))

    iteration = 0
    while remaining_minutes > 30 and iteration < 20:
        iteration += 1
        unassigned = [p for p in available_now if p['id'] not in assigned_in_slot]
        print('iteration', iteration, 'unassigned', len(unassigned))
        if len(unassigned) == 0:
            break
        if len(unassigned) < min_players_per_game:
            print('break: fewer than min players')
            break

        remaining_groups = max_parallel_games - 0
        print('remaining_groups', remaining_groups)
        if not can_cover_with_groups(len(unassigned), remaining_groups, min_players_per_game, max(6, max(g['game_data']['maxPlayers'] for g in games))):
            print('break: cannot cover with groups')
            break

        feasible_group_counts = [g for g in range(1, remaining_groups + 1) if can_cover_with_groups(len(unassigned), g, min_players_per_game, max(g['game_data']['maxPlayers'] for g in games))]
        print('feasible_group_counts', feasible_group_counts)
        if not feasible_group_counts:
            break

        best_partition_score = float('-inf')
        best_partition_assignments = None

        for groups in feasible_group_counts:
            partitions = generate_partitions(len(unassigned), groups, min_players_per_game, max(g['game_data']['maxPlayers'] for g in games))
            print('groups', groups, 'partitions', partitions)
            for partition in partitions:
                assignments = []
                partition_valid = True
                used_in_partition = set(used_game_ids)
                print('  partition', partition)
                for i in range(len(partition)):
                    group_size = partition[i]
                    group_start = sum(partition[:i])
                    unassigned_subset = unassigned[group_start:group_start + group_size]
                    game, group, score = find_best_game_for_group(group_size, unassigned_subset, games, used_in_partition, pref_map, played_games, 1, remaining_minutes, 1)
                    print('    group_size', group_size, 'game', game['game_name'] if game else None, 'score', score)
                    if not game:
                        partition_valid = False
                        break
                    assignments.append({'game': game, 'group': group, 'score': score})
                    used_in_partition.add(game['game_id'])
                if not partition_valid:
                    print('    invalid partition')
                    continue
                partition_score = sum(a['score'] for a in assignments)
                print('    partition_score', partition_score)
                if partition_score > best_partition_score:
                    best_partition_score = partition_score
                    best_partition_assignments = assignments
        print('best_partition_assignments', best_partition_assignments)
        if not best_partition_assignments:
            break
        for assignment in best_partition_assignments:
            print('committing', assignment['game']['game_name'], [p['name'] for p in assignment['group']])
        break

if __name__ == '__main__':
    reproduce_case()
