
import { User } from '../types';

const USER_KEY = 'flash_mangas_user';
const COMMENTS_KEY = 'flash_mangas_comments';

// Default Guest User
const defaultUser: User = {
  username: 'Guest',
  description: 'Just a manga enthusiast exploring the world of Flash Mangas.',
  isLoggedIn: false,
  isPremium: false,
  avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Guest',
  nsfwEnabled: false,
  favorites: [],
  history: []
};

export const getUser = (): User => {
  const stored = localStorage.getItem(USER_KEY);
  if (stored) {
    const parsed = JSON.parse(stored);
    // Merge with default to ensure new fields exist for old users
    return { ...defaultUser, ...parsed };
  }
  return defaultUser;
};

export const saveUser = (user: User) => {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  window.dispatchEvent(new Event('user-update'));
};

// --- AUTH SIMULATION ---

export const loginUser = async (email: string): Promise<User> => {
    // Simulate API delay
    await new Promise(r => setTimeout(r, 1500));
    
    const currentUser = getUser();
    const updatedUser: User = {
        ...currentUser,
        username: email.split('@')[0],
        email: email,
        isLoggedIn: true,
        provider: 'email',
        joinedAt: new Date().toISOString(),
        avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=${email}`
    };
    saveUser(updatedUser);
    return updatedUser;
};

export const signupUser = async (email: string, username: string): Promise<User> => {
    await new Promise(r => setTimeout(r, 1500));
    
    const currentUser = getUser();
    const updatedUser: User = {
        ...currentUser,
        username: username,
        email: email,
        isLoggedIn: true,
        provider: 'email',
        joinedAt: new Date().toISOString(),
        avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=${username}`
    };
    saveUser(updatedUser);
    return updatedUser;
};

export const googleLogin = async (): Promise<User> => {
    await new Promise(r => setTimeout(r, 2000)); // Google usually takes a bit
    
    const currentUser = getUser();
    const updatedUser: User = {
        ...currentUser,
        username: 'Google User',
        email: 'user@gmail.com',
        isLoggedIn: true,
        provider: 'google',
        joinedAt: new Date().toISOString(),
        avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=GoogleUser`,
        isPremium: false 
    };
    saveUser(updatedUser);
    return updatedUser;
};

export const logoutUser = () => {
    localStorage.removeItem(USER_KEY);
    window.dispatchEvent(new Event('user-update'));
};

// --- DATA HELPERS ---

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
  // Filter out duplicates based on chapterId or just move to top
  const existingIndex = user.history.findIndex(h => h.chapterId === chapterId);
  
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
  user.history = user.history.slice(0, 50); // Keep last 50
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
