
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
    externalUrl?: string | null;
    translatedLanguage?: string;
  };
  relationships: {
    id: string;
    type: string;
  }[];
}

export interface User {
  username: string;
  description: string;
  email?: string;
  isLoggedIn: boolean;
  joinedAt?: string;
  provider?: 'google' | 'email';
  isPremium: boolean;
  avatar: string;
  nsfwEnabled: boolean;
  dataSaver: boolean;
  notifications: boolean;
  favorites: number[];
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

export interface SearchFilters {
  genres: number[];
  status?: string;
  nsfw: boolean;
}
