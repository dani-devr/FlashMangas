
import { JikanManga, MangaDexManga, MangaDexChapter, SearchFilters } from '../types';

// --- CORS PROXY ROTATION ---
const CORS_PROXIES = [
  'https://corsproxy.io/?',
  'https://api.allorigins.win/raw?url=',
];

let proxyIndex = 0;

async function fetchWithProxy(url: string): Promise<Response> {
  const targetUrl = encodeURIComponent(url);
  
  for (let i = 0; i < CORS_PROXIES.length; i++) {
    const proxy = CORS_PROXIES[(proxyIndex + i) % CORS_PROXIES.length];
    try {
        let finalUrl = '';
        if (proxy.includes('allorigins')) {
             finalUrl = `${proxy}${targetUrl}`;
        } else {
             finalUrl = `${proxy}${url}`;
        }

      const response = await fetch(finalUrl);
      if (response.ok) return response;
      if (response.status === 429) {
        await new Promise(r => setTimeout(r, 1000));
        throw new Error('Rate Limited');
      }
    } catch (e) {
      // Continue to next proxy
    }
  }
  
  // Fallback to direct fetch
  return fetch(url);
}

// --- JIKAN API (Catalog) ---
// Implemented as a Queue to preventing 429 Rate Limits
const JIKAN_BASE = 'https://api.jikan.moe/v4';
let jikanQueue = Promise.resolve();

// Helper to check if manga is safe
const isSafeContent = (manga: any, allowNsfw: boolean = false): boolean => {
  if (allowNsfw) return true; // Bypass checks if NSFW is allowed

  // Check rating
  if (manga.rating && (manga.rating.includes('Rx') || manga.rating.includes('Hentai'))) return false;
  
  // Check genres
  if (manga.genres) {
    const prohibited = ['Hentai', 'Erotica', 'Doujinshi'];
    const hasProhibitedGenre = manga.genres.some((g: any) => prohibited.includes(g.name));
    if (hasProhibitedGenre) return false;
  }
  return true;
};

async function fetchJikan(endpoint: string, allowNsfw: boolean = false): Promise<any> {
  // Return a promise that resolves when it's this request's turn in the queue
  return new Promise((resolve, reject) => {
    jikanQueue = jikanQueue.then(async () => {
      try {
        // Wait 1 second between requests (Jikan limit is strict ~3/sec, but 1/sec is safer for client-side)
        await new Promise(r => setTimeout(r, 1000));
        
        const response = await fetch(`${JIKAN_BASE}${endpoint}`);
        
        if (response.status === 429) {
           // If we still get hit, wait longer and retry once
           await new Promise(r => setTimeout(r, 2000));
           const retryResponse = await fetch(`${JIKAN_BASE}${endpoint}`);
           if (!retryResponse.ok) throw new Error(`Jikan API Error: ${retryResponse.status}`);
           const data = await retryResponse.json();
           const safeData = Array.isArray(data.data) 
             ? data.data.filter((item: any) => isSafeContent(item, allowNsfw)) 
             : (isSafeContent(data.data, allowNsfw) ? data.data : null);
           resolve(safeData);
           return;
        }

        if (!response.ok) throw new Error(`Jikan API Error: ${response.status}`);
        const data = await response.json();
        
        // Client-side filtering for safety
        const safeData = Array.isArray(data.data) 
             ? data.data.filter((item: any) => isSafeContent(item, allowNsfw)) 
             : (isSafeContent(data.data, allowNsfw) ? data.data : null);

        resolve(safeData);
      } catch (e) {
        reject(e);
      }
    }).catch(e => {
        // Catch queue errors so the queue doesn't stall for future requests
        reject(e);
    });
  });
}

export const getTrendingManga = async (): Promise<JikanManga[]> => {
  return fetchJikan('/top/manga?filter=publishing&limit=25&sfw=true');
};

export const getTopManga = async (): Promise<JikanManga[]> => {
  return fetchJikan('/top/manga?filter=bypopularity&limit=25&sfw=true');
};

export const getManhwa = async (): Promise<JikanManga[]> => {
  return fetchJikan('/manga?type=manhwa&order_by=popularity&sort=desc&limit=25&sfw=true');
};

export const searchJikan = async (query: string, filters?: SearchFilters): Promise<JikanManga[]> => {
  let url = `/manga?q=${query}&limit=25`;
  
  // Genres
  if (filters?.genres && filters.genres.length > 0) {
    url += `&genres=${filters.genres.join(',')}`;
  }

  // Status
  if (filters?.status && filters.status !== 'any') {
    url += `&status=${filters.status}`;
  }

  // NSFW Logic
  const allowNsfw = filters?.nsfw ?? false;
  if (!allowNsfw) {
    url += '&sfw=true&genres_exclude=12,49,28';
  }
  
  return fetchJikan(url, allowNsfw);
};

export const getMangaById = async (id: number): Promise<JikanManga> => {
  return fetchJikan(`/manga/${id}`, true); // Always allow details view if link is known
};


// --- MANGADEX API (Reading) ---

const MANGADEX_BASE = 'https://api.mangadex.org';

export const findMangaDexId = async (title: string): Promise<string | null> => {
  try {
    const url = `${MANGADEX_BASE}/manga?title=${encodeURIComponent(title)}&order[followedCount]=desc&limit=1&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&contentRating[]=pornographic`; 
    const response = await fetchWithProxy(url);
    const data = await response.json();
    return data.data && data.data.length > 0 ? data.data[0].id : null;
  } catch (error) {
    console.error("MangaDex Search Error", error);
    return null;
  }
};

// Process chapters: Filter external, deduplicate, and sort
const processChapters = (rawChapters: any[]): MangaDexChapter[] => {
  // 1. Filter out external links (pages = 0 or externalUrl exists) or null chapters
  const valid = rawChapters.filter(ch => {
      const attr = ch.attributes;
      return (attr.pages > 0) && !attr.externalUrl && attr.chapter; 
  });

  // 2. Deduplicate by chapter number
  // Using a map to keep the first occurrence (since we sort by desc, this usually keeps the latest upload)
  const seen = new Set();
  const unique: MangaDexChapter[] = [];
  
  for (const ch of valid) {
      const num = ch.attributes.chapter;
      if (!seen.has(num)) {
          seen.add(num);
          unique.push(ch);
      }
  }
  
  // 3. Sort numerically descending
  return unique.sort((a, b) => parseFloat(b.attributes.chapter) - parseFloat(a.attributes.chapter));
};

export const getMangaDexChapters = async (mangaDexId: string, limit = 500, offset = 0): Promise<{ chapters: MangaDexChapter[], total: number }> => {
  try {
    const fetchLang = async (lang: string) => {
        // limit 500 is the max for feed often allowed
        const url = `${MANGADEX_BASE}/manga/${mangaDexId}/feed?translatedLanguage[]=${lang}&order[chapter]=desc&limit=${limit}&offset=${offset}&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&contentRating[]=pornographic&includeFutureUpdates=0`;
        const response = await fetchWithProxy(url);
        return await response.json();
    };

    // Try PT-BR first
    let data = await fetchLang('pt-br');
    
    // Fallback to EN if empty (and if it's the first page/load)
    if ((!data.data || data.data.length === 0) && offset === 0) {
        data = await fetchLang('en');
    }

    const raw = data.data || [];
    const uniqueChapters = processChapters(raw);

    return {
      chapters: uniqueChapters,
      // We return the count of unique valid chapters. 
      // Note: This effectively disables "server-side" pagination logic in the UI for simplicity, 
      // but ensures the user sees a clean list of up to 500 unique chapters.
      total: uniqueChapters.length 
    };
  } catch (error) {
    console.error("MangaDex Feed Error", error);
    return { chapters: [], total: 0 };
  }
};

export const getChapterImages = async (chapterId: string): Promise<string[]> => {
  try {
    const url = `${MANGADEX_BASE}/at-home/server/${chapterId}`;
    const response = await fetchWithProxy(url);
    const data = await response.json();
    
    if (data.baseUrl && data.chapter && data.chapter.data) {
        const baseUrl = data.baseUrl;
        const hash = data.chapter.hash;
        return data.chapter.data.map((file: string) => `${baseUrl}/data/${hash}/${file}`);
    }
    return [];
  } catch (error) {
    console.error("MangaDex Image Error", error);
    return [];
  }
};
