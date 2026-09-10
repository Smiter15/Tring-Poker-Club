# Season data gap analysis

Initial live audit: 10 September 2026, 08:28 UTC. Corrections applied and verified on 10 September 2026.

## Correction status

All twelve database corrections were applied successfully through the signed-in Supabase dashboard as one transaction. The executed transaction is in `season-data-corrections.sql`, with the exact inverse in `season-data-corrections-rollback.sql`. The correction script is an execution record, not a migration to run again.

An independent paginated API read confirmed exactly the twelve intended changes and no other changes to the five audited tables. All 89 games and 1,014 game result rows remain; season standings increased from 121 to 122 by adding Jack's zero-point Season 4 entry. All audited winner, season-tag, player-count and season-total inconsistencies are resolved.

Both season-page components now calculate their cumulative series from database game results. All six CSV files and their application import have been removed locally. The database changes are live; the code changes still require deployment before the public website uses the new chart source.

Verification completed: the full build generated 145 pages; Astro reported zero errors, warnings or hints; three automated calculation tests passed; all 122 final chart totals matched the corrected live standings. Browser checks confirmed that Season 4 renders a chart and 28 leaderboard participants, including Jack, and that replaying Game 1 shows Joe on 40 and Bar Matt on 35 points without console errors. The correction plan and its inverse were also checked against a copy of the original snapshot before live execution.

### Basis for corrections

Preserve the recorded per-game finishing positions and scores as the historical source. The differing CSV values produce conflicting awards within individual games: for example, Season 1 Game 1 would give both Coach and Lewis 10 points, and the shifted Oli 2 scores in Season 3 would duplicate other players' position scores. In Season 4 Game 1, the database awards the agreed 40 points for seventh and 35 for eighth; the CSV awards 50 and 40 instead.

Chart data now comes from those recorded game results. No players were moved between games and no finishing positions or per-game points were changed to reproduce the CSV errors.

The database transaction corrected one winner, three season tags, four player counts and three season totals, and added Jack's missing zero-point season standing. Coach's Season 1 total is now 52; Joe's Season 4 total is 685; Bar Matt's Season 4 total is 125. Their existing ranks remain valid. Phil is now the recorded winner of Season 3 Game 12, and Bar Matt remains last.

## Original audit findings

The original live comparison found 29 differing player/game scores across Seasons 1, 3 and 4. Seasons 2, 5 and 6 matched, including their stored season totals. All 89 games were already present in the database, so no wholesale CSV import was needed. The tables below preserve the before-correction evidence; they do not describe unresolved work.

The initial audit was read-only. The later authorized corrections and CSV removal are described above.

## Access and evidence

The user confirmed the project had been paused and restored it. The existing configured connection now works. All queries in this review were read-only. Paginated reads fetched 6 seasons, 39 players, 89 games, 1,014 game results and 121 season results. Returned row counts were checked against exact database counts so the 1,000-row API limit could not truncate the game-result comparison.

The earlier local static build comparison, from pages last modified on 26 August 2026, found the same 29 score differences. This report now uses direct database reads and additionally checks result season IDs, stored season totals and game winners, which could not all be checked from that build.

Sources:

- Original CSV files: `src/data/season/season-1.csv` through `season-6.csv` (removed from the working tree; retained in Git history).
- Live database tables: `players`, `seasons`, `games`, `game_results`, `season_results`.
- Query provenance: `src/pages/games/[slug].astro` and `src/pages/seasons/[slug].astro`.

## Method

Compared every CSV player/date score to the live result row for the corresponding game and player ID. Dates were normalized from UK date strings. CSV player names were trimmed and case-normalized and each matched exactly one database player's display name. All 89 CSV dates matched database game dates, and game numbers also matched.

A CSV zero with no corresponding result row contributes zero to a points chart, so those cells are counted as numerical matches. This does not prove attendance: a missing result and a recorded zero-point finish are different facts. Recorded zero-point results were retained in the comparison, and players present only in the database results were checked separately.

Results were assigned to seasons through their parent game's `season_id`. The redundant `game_results.season_id` was checked separately: three rows are tagged incorrectly. Filtering only by that redundant field would incorrectly suggest missing results. Also checked player counts, duplicate player results, sequential finishing positions, winner consistency and stored season totals. Historical point values were compared as stored, without applying Season 7's scoring rules retroactively.

## Previous CSV dependencies

The removed CSV import was in `src/pages/seasons/[slug].astro`. Its cumulative datasets fed two components, both now using database data:

- `SeasonReplayLeaderboard`: the “Replay the season” leaderboard and its changing points.
- `SeasonProgressLineChart`: the cumulative-points chart.

Previously, the replay combined CSV points with database-backed final ranks, game counts, averages and medal metadata, allowing conflicting sources in the same section. The CSV input is now gone.

The homepage, game pages, player pages, season game lists, stored season totals and season-review page read database data. The season-review animation already calculates its series from database results. These public pages are generated at build time; database-backed does not mean they refresh without a rebuild.

## Coverage and score comparison

| Season | Games in both sources | CSV score cells | Matching cells | Differing cells | CSV points | Database game points |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 15 | 180 | 156 | 24 | 733 | 733 |
| 2 | 14 | 112 | 112 | 0 | 8,880 | 8,880 |
| 3 | 15 | 360 | 357 | 3 | 13,200 | 13,200 |
| 4 | 15 | 405 | 403 | 2 | 7,065 | 7,050 |
| 5 | 15 | 390 | 390 | 0 | 7,050 | 7,050 |
| 6 | 15 | 360 | 360 | 0 | 7,050 | 7,050 |
| Total | 89 | 1,807 | 1,778 | 29 | 43,978 | 43,963 |

The database contains 1,014 result rows. Equal aggregate game-point totals in Seasons 1 and 3 conceal differences in which games were credited with points.

## Exact score differences

“No row” means the player has no database result for that game. It is not a recorded zero-point finish.

| Season | Game | Date | Player | CSV points | Database points |
| --- | ---: | --- | --- | ---: | ---: |
| 1 | 1 | 10/04/2024 | Coach | 10 | No row |
| 1 | 2 | 17/04/2024 | Coach | 2 | 10 |
| 1 | 3 | 24/04/2024 | Coach | 7 | 2 |
| 1 | 4 | 01/05/2024 | Coach | 6 | 7 |
| 1 | 5 | 08/05/2024 | Coach | 3 | 6 |
| 1 | 6 | 15/05/2024 | Coach | 6 | 3 |
| 1 | 7 | 22/05/2024 | Coach | 3 | 6 |
| 1 | 8 | 29/05/2024 | Coach | 0 | 3 |
| 1 | 9 | 05/06/2024 | Jayne | 9 | 7 |
| 1 | 9 | 05/06/2024 | Derek | 6 | 9 |
| 1 | 9 | 05/06/2024 | Ben | 4 | No row |
| 1 | 9 | 05/06/2024 | Lewis | 3 | 10 |
| 1 | 9 | 05/06/2024 | Phil | 7 | No row |
| 1 | 9 | 05/06/2024 | Rory | 5 | 8 |
| 1 | 9 | 05/06/2024 | Aarron | 10 | No row |
| 1 | 10 | 12/06/2024 | Jayne | 7 | 9 |
| 1 | 10 | 12/06/2024 | Derek | 9 | 6 |
| 1 | 10 | 12/06/2024 | Ben | 0 | 4 |
| 1 | 10 | 12/06/2024 | Lewis | 10 | 3 |
| 1 | 10 | 12/06/2024 | Phil | 0 | 7 |
| 1 | 10 | 12/06/2024 | Rory | 8 | 5 |
| 1 | 10 | 12/06/2024 | Aarron | 0 | 10 |
| 1 | 12 | 26/06/2024 | Coach | 7 | No row |
| 1 | 13 | 03/07/2024 | Coach | 0 | 7 |
| 3 | 5 | 19/02/2025 | Oli 2 | 0 | 80 |
| 3 | 6 | 26/02/2025 | Oli 2 | 80 | 40 |
| 3 | 7 | 05/03/2025 | Oli 2 | 40 | No row |
| 4 | 1 | 14/05/2025 | Joe | 50 | 40 |
| 4 | 1 | 14/05/2025 | Bar Matt | 40 | 35 |

Patterns for review, not confirmed corrections:

- Season 1: seven players' scores appear exchanged between Games 9 and 10. Coach's scores appear shifted between several games.
- Season 3: Oli 2's 80 and 40 points appear one game earlier in the database results than in the CSV.
- Season 4: Joe and Bar Matt have 15 fewer combined points in the database results for Game 1.

These differences were resolved by using the internally consistent per-game database results, as explained under “Basis for corrections.”

## Other differences

Season 4 includes Jack in one database game result with zero points; Jack has no row in either the Season 4 CSV or `season_results`. Database-driven charts should include genuine participants even if their season total is zero.

Four games have a mismatch between the declared player count in `games` and the number of result rows associated with that game:

| Season | Game | Declared players | Result rows |
| --- | ---: | ---: | ---: |
| 1 | 5 | 8 | 9 |
| 3 | 2 | 11 | 12 |
| 3 | 3 | 14 | 16 |
| 3 | 7 | 15 | 13 |

No duplicate players or gaps in finishing positions were found when results are grouped by game ID.

## Additional live database inconsistencies

### Incorrect season tags on game results

| Player | Game ID | Actual season / game | Result season ID | Points |
| --- | ---: | --- | ---: | ---: |
| Lewis | 4 | Season 1, Game 4 | -1 | 5 |
| Joe | 43 | Season 3, Game 14 | -1 | 85 |
| Stanley | 43 | Season 3, Game 14 | 1 | 0 |

All three result rows exist. Their game IDs point to the expected games, but their season tags disagree with their parent games. Existing code that filters `game_results` by season omits Lewis's 5 points from Season 1 and Joe's 85 points from Season 3, and attributes Stanley's attendance to Season 1. This affects season-filtered counts and calculations even though the individual game pages can show the rows.

### Stored season totals disagree with game totals

Totals below assign results through their parent game, avoiding the incorrect season tags above.

| Season | Player | Sum of game points | Stored season points | CSV total |
| --- | --- | ---: | ---: | ---: |
| 1 | Coach | 52 | 61 | 52 |
| 4 | Joe | 685 | 695 | 695 |
| 4 | Bar Matt | 125 | 130 | 130 |

All other existing season-result point totals agree with their parent-game sums. Jack's zero-point Season 4 standing is missing, as described above. This check verifies points, not any unrecorded historical tie-break rules.

### Winner disagrees with first place

Before correction, Season 3, Game 12, played 9 April 2025 (game ID 41), stored Bar Matt as the winner. Its result table recorded Phil first with 150 points and Bar Matt seventeenth with zero points. The owner confirmed Bar Matt was last; the winner has now been corrected to Phil.

### New season status

Only Seasons 1–6 exist in the live database. Season 6 remains active. There is no Season 7 record or game yet in this database.

## Next steps

1. Deploy the local chart-source change so the public website uses the corrected database history throughout.
2. Set up Season 7 and the agreed entry workflow. No season or game was created during the historical correction work.

## Agreed requirements for the later entry feature

- Knockout order determines finishing order.
- Season 7 points: 100, 80, 65, 55, 50, 45, 40 and 35 for places 1–8; zero for every later place.
- No season tie-break rule has been agreed.
- Use a shared admin password, without individual accounts for now. The password belongs in server-side configuration and is intentionally excluded from this report and source code.
- Successful saves, edits and undo operations should trigger a website rebuild.
