export interface SeasonFrontmatter {
  id: number;
  slug: string;
  name: string;
  numberOfPlayers: number;
  numberOfGames: number;
  winnerSlug: string;
  winnerFirstName: string;
  winnerImage?: string;
  results: {
    place: string;
    name: string;
    playerSlug: string;
    playerImage?: string;
    points: number;
  }[];
}
