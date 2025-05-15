export interface PlayerFrontmatter {
  id: number;
  slug: string;
  firstName: string;
  lastName?: string;
  image?: string;
  knownAs?: string;
  wins: number;
  bubbles: number;
  gamesPlayed: number;
}
