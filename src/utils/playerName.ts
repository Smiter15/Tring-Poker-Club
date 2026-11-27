type PlayerName = {
  first_name: string;
  last_name?: string | null;
  nickname?: string | null;
  prefer_nickname?: boolean | null;
};

export function playerName(player: PlayerName) {
  if (player.prefer_nickname && player.nickname) return player.nickname;
  return [player.first_name, player.last_name].filter(Boolean).join(' ');
}
