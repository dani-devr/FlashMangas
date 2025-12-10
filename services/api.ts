
import { JikanManga, Chapter, SearchFilters } from '../types';

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
  
  // Fallback to direct fetch (Comick might allow direct sometimes)
  return fetch(url);
}

// --- JIKAN API (Catalog) ---
const JIKAN_BASE = 'https://api.jikan.moe/v4';
let jikanQueue = Promise.resolve();

const isSafeContent = (manga: any, allowNsfw: boolean = false): boolean => {
  if (allowNsfw) return true;
  if (manga.rating && (manga.rating.includes('Rx') || manga.rating.includes('Hentai'))) return false;
  if (manga.genres) {
    const prohibited = ['Hentai', 'Erotica', 'Doujinshi'];
    const hasProhibitedGenre = manga.genres.some((g: any) => prohibited.includes(g.name));
    if (hasProhibitedGenre) return false;
  }
  return true;
};

async function fetchJikan(endpoint: string, allowNsfw: boolean = false): Promise<any> {
  return new Promise((resolve, reject) => {
    jikanQueue = jikanQueue.then(async () => {
      try {
        await new Promise(r => setTimeout(r, 1000));
        const response = await fetch(`${JIKAN_BASE}${endpoint}`);
        
        if (response.status === 429) {
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
        const safeData = Array.isArray(data.data) 
             ? data.data.filter((item: any) => isSafeContent(item, allowNsfw)) 
             : (isSafeContent(data.data, allowNsfw) ? data.data : null);

        resolve(safeData);
      } catch (e) {
        reject(e);
      }
    }).catch(e => reject(e));
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
  if (filters?.genres && filters.genres.length > 0) url += `&genres=${filters.genres.join(',')}`;
  if (filters?.status && filters.status !== 'any') url += `&status=${filters.status}`;
  
  const allowNsfw = filters?.nsfw ?? false;
  if (!allowNsfw) url += '&sfw=true&genres_exclude=12,49,28';
  
  return fetchJikan(url, allowNsfw);
};

export const getMangaById = async (id: number): Promise<JikanManga> => {
  return fetchJikan(`/manga/${id}`, true);
};


// --- COMICK API (Single Source for Chapters) ---
const COMICK_BASE = 'https://api.comick.io';

export const findComickId = async (title: string): Promise<string | null> => {
    // Check Cache first
    const cacheKey = `comick_id_${title.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) return cached;

    try {
        const url = `${COMICK_BASE}/v1.0/search?q=${encodeURIComponent(title)}&limit=1`;
        const response = await fetchWithProxy(url);
        const data = await response.json();
        
        if (data.length > 0) {
            localStorage.setItem(cacheKey, data[0].hid);
            return data[0].hid;
        }
        return null;
    } catch (e) {
        console.error("Comick Search Error", e);
        return null;
    }
};

export const getChapters = async (title: string): Promise<Chapter[]> => {
   const hid = await findComickId(title);
   if (!hid) return [];

   try {
       // Requesting a huge limit to get ALL chapters (One Piece has 1100+)
       // We request both pt-br and en
       const url = `${COMICK_BASE}/comic/${hid}/chapters?lang=pt-br,en&limit=99999`;
       const response = await fetchWithProxy(url);
       const data = await response.json();
       
       if (!data.chapters) return [];

       const rawChapters = data.chapters;
       const chapterMap = new Map<string, Chapter>();

       // Processing strategy:
       // 1. Iterate through all chapters
       // 2. Prefer PT-BR.
       // 3. If a chapter number already exists in map, overwrite ONLY IF the new one is PT-BR and the old one was EN.
       
       for (const ch of rawChapters) {
           if (!ch.chap) continue;
           
           const chapNum = ch.chap;
           const isPT = ch.lang === 'pt-br';
           
           const newChapter: Chapter = {
               id: ch.hid,
               volume: ch.vol,
               chapter: ch.chap,
               title: ch.title,
               publishAt: ch.created_at,
               lang: ch.lang
           };

           if (chapterMap.has(chapNum)) {
               const existing = chapterMap.get(chapNum)!;
               // If existing is EN and new is PT, overwrite
               if (existing.lang !== 'pt-br' && isPT) {
                   chapterMap.set(chapNum, newChapter);
               }
               // If existing is PT, do nothing (keep PT)
           } else {
               chapterMap.set(chapNum, newChapter);
           }
       }

       // Convert map to array and sort desc
       return Array.from(chapterMap.values()).sort((a, b) => parseFloat(b.chapter) - parseFloat(a.chapter));

   } catch (e) {
       console.error("Comick Feed Error", e);
       return [];
   }
};

export const getChapterImages = async (chapterHid: string): Promise<string[]> => {
    try {
        const url = `${COMICK_BASE}/chapter/${chapterHid}`;
        const response = await fetchWithProxy(url);
        const data = await response.json();
        
        if (data.chapter && data.chapter.images) {
            return data.chapter.images.map((img: any) => {
                if (img.url) return img.url;
                if (img.b2key) return `https://meo.comick.pictures/${img.b2key}`;
                return '';
            }).filter((url: string) => url !== '');
        }
        return [];
    } catch (e) {
        console.error("Comick Image Error", e);
        return [];
    }
};
