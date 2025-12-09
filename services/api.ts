
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


// --- UNIFIED MANGA API (MangaDex + Comick) ---

const MANGADEX_BASE = 'https://api.mangadex.org';
const COMICK_BASE = 'https://api.comick.io';

// 1. MangaDex Functions
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

export const getMangaDexChapters = async (mangaDexId: string, lang: string): Promise<MangaDexChapter[]> => {
  try {
    const url = `${MANGADEX_BASE}/manga/${mangaDexId}/feed?translatedLanguage[]=${lang}&order[chapter]=desc&limit=500&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&contentRating[]=pornographic&includeFutureUpdates=0`;
    const response = await fetchWithProxy(url);
    const data = await response.json();
    
    if (!data.data) return [];

    const rawChapters = data.data;

    // Process: Filter external, deduplicate, format
    const valid = rawChapters.filter((ch: any) => {
      const attr = ch.attributes;
      return (attr.pages > 0) && !attr.externalUrl && attr.chapter; 
    });

    const seen = new Set();
    const unique: MangaDexChapter[] = [];

    for (const ch of valid) {
        const num = ch.attributes.chapter;
        if (!seen.has(num)) {
            seen.add(num);
            unique.push({
              id: ch.id,
              provider: 'mangadex',
              attributes: {
                volume: ch.attributes.volume,
                chapter: ch.attributes.chapter,
                title: ch.attributes.title,
                publishAt: ch.attributes.publishAt,
                pages: ch.attributes.pages,
                translatedLanguage: ch.attributes.translatedLanguage,
                externalUrl: ch.attributes.externalUrl
              }
            });
        }
    }
    
    return unique.sort((a, b) => parseFloat(b.attributes.chapter) - parseFloat(a.attributes.chapter));
  } catch (error) {
    console.error("MangaDex Feed Error", error);
    return [];
  }
};

// 2. Comick Functions
export const findComickId = async (title: string): Promise<string | null> => {
    try {
        const url = `${COMICK_BASE}/v1.0/search?q=${encodeURIComponent(title)}&limit=1`;
        const response = await fetchWithProxy(url);
        const data = await response.json();
        return data.length > 0 ? data[0].hid : null;
    } catch (e) {
        console.error("Comick Search Error", e);
        return null;
    }
};

export const getComickChapters = async (comickId: string, lang: string): Promise<MangaDexChapter[]> => {
    try {
        const url = `${COMICK_BASE}/comic/${comickId}/chapters?lang=${lang}&limit=1000`;
        const response = await fetchWithProxy(url);
        const data = await response.json();
        
        if (!data.chapters) return [];
        
        const raw = data.chapters;
        
        const unique: MangaDexChapter[] = [];
        const seen = new Set();
        
        // Comick structure is different, map to unified format
        for (const ch of raw) {
            if (!ch.chap) continue;
            if (seen.has(ch.chap)) continue;
            seen.add(ch.chap);
            
            unique.push({
                id: ch.hid, // Comick Chapter HID
                provider: 'comick',
                attributes: {
                    volume: ch.vol,
                    chapter: ch.chap,
                    title: ch.title,
                    publishAt: ch.created_at,
                    pages: 10, // Comick doesn't give page count in list, dummy value
                    translatedLanguage: lang,
                    externalUrl: null
                }
            });
        }
        
        return unique.sort((a, b) => parseFloat(b.attributes.chapter) - parseFloat(a.attributes.chapter));
    } catch (e) {
        console.error("Comick Feed Error", e);
        return [];
    }
};

// 3. UNIFIED STRATEGY
export const getUnifiedChapters = async (title: string): Promise<MangaDexChapter[]> => {
   // Strategy:
   // 1. Try MD (PT-BR)
   // 2. Try Comick (PT-BR)
   // 3. Try MD (EN)
   // 4. Try Comick (EN)
   
   // Parallel search for IDs to save time
   const [mdId, comickId] = await Promise.all([
       findMangaDexId(title),
       findComickId(title)
   ]);

   console.log(`Found IDs for ${title}: MD=${mdId}, Comick=${comickId}`);

   // 1. Try PT-BR on MangaDex
   if (mdId) {
       const chapters = await getMangaDexChapters(mdId, 'pt-br');
       if (chapters.length > 0) return chapters;
   }

   // 2. Try PT-BR on Comick
   if (comickId) {
       const chapters = await getComickChapters(comickId, 'pt-br');
       if (chapters.length > 0) return chapters;
   }

   // 3. Try EN on MangaDex
   if (mdId) {
       const chapters = await getMangaDexChapters(mdId, 'en');
       if (chapters.length > 0) return chapters;
   }

   // 4. Try EN on Comick
   if (comickId) {
       const chapters = await getComickChapters(comickId, 'en');
       if (chapters.length > 0) return chapters;
   }

   return [];
};

// 4. Image Fetching
export const getChapterImages = async (chapterId: string): Promise<string[]> => {
  // Determine provider by ID format
  // MangaDex = UUID (8-4-4-4-12 hex)
  // Comick = Alphanumeric Short ID
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(chapterId);

  if (isUUID) {
      // MangaDex
      try {
        const url = `${MANGADEX_BASE}/at-home/server/${chapterId}`;
        const response = await fetchWithProxy(url);
        const data = await response.json();
        
        if (data.baseUrl && data.chapter && data.chapter.data) {
            const baseUrl = data.baseUrl;
            const hash = data.chapter.hash;
            return data.chapter.data.map((file: string) => `${baseUrl}/data/${hash}/${file}`);
        }
      } catch (error) {
        console.error("MangaDex Image Error", error);
      }
  } else {
      // Comick
      try {
          const url = `${COMICK_BASE}/chapter/${chapterId}`;
          const response = await fetchWithProxy(url);
          const data = await response.json();
          
          if (data.chapter && data.chapter.images) {
              return data.chapter.images.map((img: any) => img.url);
          }
      } catch (e) {
          console.error("Comick Image Error", e);
      }
  }

  return [];
};
