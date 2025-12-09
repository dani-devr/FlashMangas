export interface JikanManga {
  mal_id: number;
  title: string;
  images: {
    jpg: {
      image_url: string;
      large_image_url: string;
    };
  };
  synopsis: string;
  score: number;
  scored_by: number;
  popularity: number;
  year: number;
  status: string;
  genres: { name: string }[];
  type: string;
}

export interface MangaDexManga {
  id: string;
  attributes: {
    title: { en: string };
    description: { en: string };
  };
}

export interface MangaDexChapter {
  id: string;
  attributes: {
    volume: string | null;
    chapter: string;
    title: string | null;
    publishAt: string;
    pages: number;
  };
  relationships: {
    id: string;
    type: string;
  }[];
}

export interface User {
  username: string;
  isPremium: boolean;
  avatar: string;
  favorites: number[]; // stored by mal_id
  history: {
    mal_id: number;
    chapterId: string;
    timestamp: number;
    title: string;
    chapterNum: string;
  }[];
}

export interface Comment {
  id: string;
  username: string;
  avatar: string;
  text: string;
  timestamp: string;
  likes: number;
}