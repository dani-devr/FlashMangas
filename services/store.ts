import { User } from '../types';

const USER_KEY = 'flash_mangas_user';
const COMMENTS_KEY = 'flash_mangas_comments';

const defaultUser: User = {
  username: 'Guest',
  isPremium: false,
  avatar: 'https://picsum.photos/200',
  favorites: [],
  history: []
};

export const getUser = (): User => {
  const stored = localStorage.getItem(USER_KEY);
  return stored ? JSON.parse(stored) : defaultUser;
};

export const saveUser = (user: User) => {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  // Dispatch event for reactive updates across components
  window.dispatchEvent(new Event('user-update'));
};

export const toggleFavorite = (mal_id: number) => {
  const user = getUser();
  if (user.favorites.includes(mal_id)) {
    user.favorites = user.favorites.filter(id => id !== mal_id);
  } else {
    user.favorites.push(mal_id);
  }
  saveUser(user);
};

export const addToHistory = (mal_id: number, chapterId: string, title: string, chapterNum: string) => {
  const user = getUser();
  const existingIndex = user.history.findIndex(h => h.mal_id === mal_id);
  
  const historyItem = {
    mal_id,
    chapterId,
    timestamp: Date.now(),
    title,
    chapterNum
  };

  if (existingIndex > -1) {
    user.history.splice(existingIndex, 1);
  }
  
  user.history.unshift(historyItem);
  user.history = user.history.slice(0, 20); // Keep last 20
  saveUser(user);
};

export const getLocalComments = (mangaId: number) => {
  const stored = localStorage.getItem(`${COMMENTS_KEY}_${mangaId}`);
  return stored ? JSON.parse(stored) : [];
};

export const addLocalComment = (mangaId: number, text: string) => {
  const comments = getLocalComments(mangaId);
  const user = getUser();
  const newComment = {
    id: Date.now().toString(),
    username: user.username,
    avatar: user.avatar,
    text,
    timestamp: new Date().toISOString(),
    likes: 0
  };
  comments.unshift(newComment);
  localStorage.setItem(`${COMMENTS_KEY}_${mangaId}`, JSON.stringify(comments));
  return comments;
};