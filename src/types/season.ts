export interface SeasonFrontmatter {
  id: number;
  slug: string;
  name: string;
  numberOfPlayers: number;
  numberOfGames: number;
  winnerSlug: string;
  winnerFirstName: string;
  winnerImage?: string;
}
