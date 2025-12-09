
import React, { useState, useEffect, useRef } from 'react';
import { HashRouter as Router, Routes, Route, Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import { getTrendingManga, getTopManga, getManhwa, searchJikan, getMangaById, findMangaDexId, getMangaDexChapters, getChapterImages } from './services/api';
import { getUser, saveUser, toggleFavorite, addToHistory, addLocalComment, getLocalComments, loginUser, signupUser, googleLogin, logoutUser } from './services/store';
import { JikanManga, MangaDexChapter, User, Comment } from './types';
import confetti from 'canvas-confetti';

// --- SHARED COMPONENTS ---

const Spinner = () => (
  <div className="flex justify-center items-center p-8">
    <div className="relative">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-500"></div>
      <div className="absolute inset-0 rounded-full h-12 w-12 border-b-2 border-brand-500 blur-md animate-spin"></div>
    </div>
  </div>
);

// New Top Header: Logo Left, Search Right
const TopHeader = ({ onSearch, user }: { onSearch: (q: string) => void, user: User }) => {
  const [q, setQ] = useState('');
  const [scrolled, setScrolled] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (q.trim()) {
      onSearch(q);
      navigate('/search');
      setQ('');
    }
  };

  return (
    <header className={`fixed top-0 left-0 w-full z-50 transition-all duration-500 px-6 py-4 flex justify-between items-center ${scrolled ? 'bg-black/80 backdrop-blur-md border-b border-white/5' : 'bg-transparent'}`}>
       {/* Logo */}
       <Link to="/" className="flex items-center gap-3 group">
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center shadow-[0_0_15px_rgba(139,92,246,0.6)]">
            <i className="fas fa-bolt text-white text-sm"></i>
          </div>
          <span className="text-xl font-bold tracking-tight text-white">
            Flash<span className="text-brand-500">Mangas</span>
          </span>
        </Link>

        {/* Search Input */}
        <div className="flex items-center gap-4">
           <form onSubmit={handleSearch} className="relative group">
              <div className="absolute inset-0 bg-brand-500/20 rounded-full blur-md opacity-0 group-focus-within:opacity-100 transition-opacity"></div>
              <input 
                type="text" 
                placeholder="Search..." 
                className="relative z-10 w-32 md:w-64 bg-white/10 border border-white/10 rounded-full py-2 pl-4 pr-10 text-sm focus:outline-none focus:bg-black/90 focus:border-brand-500 transition-all text-white placeholder-gray-400"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <button type="submit" className="absolute right-3 top-2.5 text-gray-400 z-20">
                <i className="fas fa-search text-xs"></i>
              </button>
           </form>
           
           <Link to="/profile" className="hidden md:block">
              <img src={user.avatar} className="w-9 h-9 rounded-full border border-white/20 bg-white/5 object-cover" alt="Profile" />
           </Link>
        </div>
    </header>
  );
};

// New Bottom Dock Navigation
const BottomDock = ({ activeTab }: { activeTab: string }) => {
  return (
    <div className="fixed bottom-6 left-0 w-full z-50 flex justify-center px-4 pointer-events-none">
      <div className="pointer-events-auto bg-[#1a1a1a]/90 backdrop-blur-xl border border-white/10 rounded-2xl p-2 flex items-center gap-2 shadow-2xl shadow-black/50">
        
        <DockItem to="/" icon="fa-home" active={activeTab === '/'} />
        <DockItem to="/search" icon="fa-search" active={activeTab === '/search'} />
        <div className="w-px h-6 bg-white/10 mx-1"></div>
        <DockItem to="/profile" icon="fa-user" active={activeTab === '/profile'} />

      </div>
    </div>
  );
};

const DockItem = ({ to, icon, active }: { to: string, icon: string, active: boolean }) => (
  <Link 
    to={to} 
    className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 group relative ${active ? 'bg-brand-600 text-white shadow-[0_0_15px_#8b5cf6]' : 'text-gray-400 hover:bg-white/10 hover:text-white'}`}
  >
    <i className={`fas ${icon} text-lg transform group-hover:scale-110 transition-transform`}></i>
    {active && <div className="absolute -bottom-1 w-1 h-1 bg-white rounded-full"></div>}
  </Link>
);

const MangaCard = ({ manga, rank }: { manga: JikanManga, rank?: number }) => {
  const isFinished = manga.status === 'Finished';
  
  return (
    <Link to={`/manga/${manga.mal_id}`} className="group relative block aspect-[3/4] overflow-hidden rounded-xl bg-dark-card transition-all duration-300 hover:scale-105 z-0 hover:z-10">
      <img 
        src={manga.images.jpg.large_image_url} 
        alt={manga.title} 
        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" 
        loading="lazy"
      />
      
      {/* Dark Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-80" />
      
      {/* Rank Badge */}
      {rank && (
        <div className="absolute top-2 left-2 bg-yellow-500/90 text-black font-black text-xs px-2 py-1 rounded shadow-lg backdrop-blur-sm flex items-center gap-1">
           <i className="fas fa-arrow-trend-up text-[10px]"></i> #{rank}
        </div>
      )}

      {/* Status Badge */}
      <div className={`absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider backdrop-blur-md shadow-lg border border-white/10 ${isFinished ? 'bg-red-500/80 text-white' : 'bg-green-500/80 text-black'}`}>
        {isFinished ? 'Finished' : 'Publishing'}
      </div>

      <div className="absolute bottom-0 p-3 w-full">
        <h3 className="text-white font-bold text-sm truncate leading-tight mb-1 group-hover:text-brand-400 transition-colors">{manga.title}</h3>
        <div className="flex justify-between items-center text-xs text-gray-400">
           <span>{manga.type}</span>
           <span className="flex items-center text-yellow-400 gap-1"><i className="fas fa-star text-[10px]"></i> {manga.score}</span>
        </div>
      </div>
    </Link>
  );
};

const HorizontalList = ({ title, items }: { title: string, items: JikanManga[] }) => (
  <section className="py-8 relative">
    <div className="container mx-auto">
      <div className="flex items-center gap-3 px-6 mb-6">
         <i className="fas fa-bolt text-yellow-400"></i>
         <h2 className="text-xl font-bold text-white">{title}</h2>
      </div>
      <div className="overflow-x-auto hide-scrollbar flex gap-4 px-6 pb-4 snap-x">
        {items.map((item, idx) => (
          <div key={item.mal_id} className="min-w-[140px] md:min-w-[180px] w-[140px] md:w-[180px] snap-start">
            <MangaCard manga={item} rank={idx + 1} />
          </div>
        ))}
      </div>
    </div>
  </section>
);

// --- AUTH & PROFILE COMPONENTS ---

const AuthModal = ({ onClose }: { onClose?: () => void }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        await loginUser(email);
      } else {
        await signupUser(email, username);
      }
      // Redirect or reload is handled by App listener
    } catch (e) {
      alert("Auth failed");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    await googleLogin();
    setGoogleLoading(false);
  };

  return (
    <div className="w-full max-w-md mx-auto p-8 bg-[#111] rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-brand-500/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-blue-500/20 rounded-full blur-3xl"></div>

        <div className="relative z-10">
          <h2 className="text-3xl font-black text-center mb-2 text-white">{isLogin ? 'Welcome Back' : 'Join FlashMangas'}</h2>
          <p className="text-center text-gray-400 mb-8 text-sm">{isLogin ? 'Enter your credentials to access your account' : 'Start your manga journey today'}</p>

          <form onSubmit={handleSubmit} className="space-y-4">
             {!isLogin && (
               <div>
                 <label className="text-xs font-bold text-gray-500 uppercase ml-1">Username</label>
                 <input 
                   type="text" 
                   value={username}
                   onChange={e => setUsername(e.target.value)}
                   className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-500 focus:bg-white/10 transition-all"
                   placeholder="OtakuKing99"
                   required
                 />
               </div>
             )}
             
             <div>
                <label className="text-xs font-bold text-gray-500 uppercase ml-1">Email</label>
                <input 
                  type="email" 
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-500 focus:bg-white/10 transition-all"
                  placeholder="name@example.com"
                  required
                />
             </div>
             
             <div>
                <label className="text-xs font-bold text-gray-500 uppercase ml-1">Password</label>
                <input 
                  type="password" 
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-500 focus:bg-white/10 transition-all"
                  placeholder="••••••••"
                  required
                />
             </div>

             <button 
               type="submit" 
               disabled={loading}
               className="w-full bg-brand-600 hover:bg-brand-500 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-brand-500/20 transition-all transform active:scale-95 disabled:opacity-50 flex justify-center items-center"
             >
                {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : (isLogin ? 'Sign In' : 'Create Account')}
             </button>
          </form>

          <div className="relative my-8 text-center">
             <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10"></div></div>
             <span className="relative bg-[#111] px-4 text-xs text-gray-500 uppercase">Or continue with</span>
          </div>

          <button 
             onClick={handleGoogle}
             disabled={googleLoading}
             className="w-full bg-white text-black font-bold py-3.5 rounded-xl hover:bg-gray-100 transition-all flex items-center justify-center gap-3"
          >
             {googleLoading ? (
                <div className="w-5 h-5 border-2 border-gray-300 border-t-black rounded-full animate-spin"></div>
             ) : (
               <>
                 <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5" alt="Google" />
                 Sign in with Google
               </>
             )}
          </button>

          <p className="text-center mt-6 text-sm text-gray-400">
             {isLogin ? "Don't have an account? " : "Already have an account? "}
             <button onClick={() => setIsLogin(!isLogin)} className="text-brand-400 font-bold hover:underline">
               {isLogin ? 'Sign up' : 'Log in'}
             </button>
          </p>
        </div>
    </div>
  );
};

const EditProfileModal = ({ user, onClose }: { user: User, onClose: () => void }) => {
  const [name, setName] = useState(user.username);
  const [desc, setDesc] = useState(user.description);
  const [avatar, setAvatar] = useState(user.avatar);
  const [customAvatar, setCustomAvatar] = useState('');

  const seeds = ['Felix', 'Aneka', 'Zack', 'Molly', 'Caleb', 'Tinker'];
  
  const handleSave = () => {
    const updated = { ...user, username: name, description: desc, avatar: customAvatar || avatar };
    saveUser(updated);
    onClose();
    confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
       <div className="bg-[#151515] w-full max-w-lg rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
          <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
             <h3 className="font-bold text-white">Edit Profile</h3>
             <button onClick={onClose} className="text-gray-400 hover:text-white"><i className="fas fa-times"></i></button>
          </div>
          
          <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
             {/* Avatar Section */}
             <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-3">Choose Avatar</label>
                <div className="flex gap-3 overflow-x-auto pb-2 hide-scrollbar">
                   {seeds.map(seed => {
                      const url = `https://api.dicebear.com/7.x/adventurer/svg?seed=${seed}`;
                      return (
                        <button 
                          key={seed} 
                          onClick={() => { setAvatar(url); setCustomAvatar(''); }}
                          className={`min-w-[60px] h-[60px] rounded-full border-2 p-1 transition-all ${avatar === url ? 'border-brand-500 bg-brand-500/20' : 'border-transparent hover:bg-white/5'}`}
                        >
                           <img src={url} className="w-full h-full rounded-full" />
                        </button>
                      )
                   })}
                </div>
                <div className="mt-2">
                   <input 
                     type="text" 
                     placeholder="Or paste image URL..." 
                     value={customAvatar}
                     onChange={(e) => setCustomAvatar(e.target.value)}
                     className="w-full text-xs bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-brand-500 focus:outline-none"
                   />
                </div>
             </div>

             {/* Inputs */}
             <div className="space-y-4">
                <div>
                   <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Display Name</label>
                   <input 
                      value={name}
                      onChange={e => setName(e.target.value)}
                      className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-500"
                   />
                </div>
                <div>
                   <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Bio / Description</label>
                   <textarea 
                      value={desc}
                      onChange={e => setDesc(e.target.value)}
                      rows={3}
                      className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-500 resize-none"
                   />
                </div>
             </div>
          </div>

          <div className="p-4 border-t border-white/10 bg-white/5 flex justify-end gap-3">
             <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white font-medium">Cancel</button>
             <button onClick={handleSave} className="px-6 py-2 text-sm bg-brand-600 hover:bg-brand-500 text-white rounded-lg font-bold shadow-lg shadow-brand-500/20">Save Changes</button>
          </div>
       </div>
    </div>
  );
};

// --- PAGES ---

const HomePage = ({ trending, top, manhwa }: { trending: JikanManga[], top: JikanManga[], manhwa: JikanManga[] }) => {
  const heroItem = top.length > 0 ? top[0] : trending[0];

  return (
    <div className="animate-fade-in pb-32">
      {/* Redesigned Hero Section */}
      {heroItem && (
        <div className="relative h-[85vh] w-full overflow-hidden">
          {/* Background */}
          <div className="absolute inset-0">
             <img 
               src={heroItem.images.jpg.large_image_url} 
               className="w-full h-full object-cover object-top" 
               alt="Hero" 
             />
             <div className="absolute inset-0 bg-gradient-to-r from-black via-black/60 to-transparent"></div>
             <div className="absolute inset-0 bg-gradient-to-t from-[#020202] via-transparent to-transparent"></div>
          </div>

          {/* Content */}
          <div className="absolute inset-0 container mx-auto px-6 md:px-12 flex items-center">
            <div className="max-w-2xl pt-20 animate-slide-up">
               {/* Badges */}
               <div className="flex items-center gap-3 mb-6">
                  <span className="bg-[#6d28d9] text-white text-xs font-bold px-4 py-1.5 rounded-full flex items-center gap-2 shadow-[0_0_15px_rgba(109,40,217,0.5)]">
                    <i className="fas fa-sparkles text-[10px]"></i> TOP RATED #1
                  </span>
                  <span className="bg-white/10 backdrop-blur-md border border-white/10 text-gray-200 text-xs font-medium px-4 py-1.5 rounded-full">
                    {heroItem.type}
                  </span>
               </div>

               <h1 className="text-6xl md:text-8xl font-bold text-white leading-tight mb-6 tracking-tight">
                 {heroItem.title}
               </h1>

               <p className="text-gray-300 text-base md:text-lg line-clamp-3 mb-8 max-w-lg leading-relaxed font-light">
                 {heroItem.synopsis}
               </p>

               <Link 
                 to={`/manga/${heroItem.mal_id}`} 
                 className="bg-white text-black px-8 py-3.5 rounded-full font-bold inline-flex items-center gap-3 hover:scale-105 transition-transform shadow-[0_0_20px_rgba(255,255,255,0.3)]"
               >
                 Start Reading <i className="fas fa-arrow-right"></i>
               </Link>
            </div>
          </div>
        </div>
      )}

      {/* Lists */}
      <div className="-mt-24 relative z-10 space-y-4">
        <HorizontalList title="Trending Now" items={trending} />
        <HorizontalList title="Top Rated Classics" items={top.slice(1)} /> 
        <HorizontalList title="Popular Manhwa" items={manhwa} />
      </div>
    </div>
  );
};

const SearchPage = ({ results, loading }: { results: JikanManga[], loading: boolean }) => {
  return (
    <div className="min-h-screen pt-24 px-4 container mx-auto animate-fade-in max-w-7xl pb-32">
      <h2 className="text-3xl font-bold mb-8 text-white">Search Results</h2>
      
      {loading ? (
         <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {[...Array(10)].map((_, i) => (
               <div key={i} className="aspect-[3/4] bg-white/5 rounded-xl animate-pulse"></div>
            ))}
         </div>
      ) : results.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-gray-500">
          <i className="fas fa-search text-4xl mb-4 opacity-30"></i>
          <p>No results found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {results.map(m => <MangaCard key={m.mal_id} manga={m} />)}
        </div>
      )}
    </div>
  );
};

const MangaDetails = () => {
  const { id } = useParams();
  const [manga, setManga] = useState<JikanManga | null>(null);
  const [chapters, setChapters] = useState<MangaDexChapter[]>([]);
  const [mangaDexId, setMangaDexId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isFav, setIsFav] = useState(false);
  
  const user = getUser();
  
  useEffect(() => {
    const fetchDetails = async () => {
      if(!id) return;
      try {
        setLoading(true);
        const data = await getMangaById(Number(id));
        setManga(data);
        setIsFav(user.favorites.includes(data.mal_id));
        setComments(getLocalComments(data.mal_id));
        
        const mdId = await findMangaDexId(data.title);
        setMangaDexId(mdId);
        
        if (mdId) {
          const { chapters: chaps } = await getMangaDexChapters(mdId, 500, 0);
          setChapters(chaps);
        }
      } catch (err) {
        setError('Failed to load details.');
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, [id]);

  const handleFav = () => {
    if (!manga) return;
    toggleFavorite(manga.mal_id);
    setIsFav(!isFav);
  };

  const postComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !manga) return;
    const updated = addLocalComment(manga.mal_id, newComment);
    setComments(updated);
    setNewComment('');
  };

  if (loading) return <div className="h-screen flex items-center justify-center"><Spinner /></div>;
  if (error || !manga) return <div className="text-center p-20 text-red-400 mt-20">{error}</div>;

  return (
    <div className="pb-32 animate-fade-in bg-dark-bg">
      <div className="relative h-[60vh] w-full">
        <div className="absolute inset-0">
          <img src={manga.images.jpg.large_image_url} className="w-full h-full object-cover opacity-40 blur-sm" />
          <div className="absolute inset-0 bg-gradient-to-t from-dark-bg to-transparent" />
        </div>
        
        <div className="container mx-auto px-6 h-full flex flex-col justify-end pb-12 relative z-10 max-w-5xl">
           <div className="flex flex-col md:flex-row gap-8 items-end">
              <img src={manga.images.jpg.image_url} className="w-48 rounded-lg shadow-2xl border border-white/10 mx-auto md:mx-0" />
              
              <div className="flex-1 text-center md:text-left space-y-4">
                <h1 className="text-4xl md:text-6xl font-black text-white leading-none">{manga.title}</h1>
                <div className="flex flex-wrap justify-center md:justify-start gap-2">
                  {manga.genres.map(g => (
                    <span key={g.name} className="px-3 py-1 bg-white/10 rounded-full text-xs text-gray-300">{g.name}</span>
                  ))}
                </div>
                <div className="flex justify-center md:justify-start gap-4 pt-2">
                  <button onClick={handleFav} className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${isFav ? 'bg-red-500 text-white' : 'bg-white/10 text-white'}`}>
                    <i className="fas fa-heart"></i>
                  </button>
                  <a href="#chapters" className="px-8 py-3 rounded-full font-bold bg-brand-600 text-white hover:bg-brand-500 transition-all flex items-center gap-2">
                    Start Reading
                  </a>
                </div>
              </div>
           </div>
        </div>
      </div>

      <div className="container mx-auto px-6 grid md:grid-cols-3 gap-10 mt-8 max-w-6xl">
        <div className="md:col-span-1 space-y-6">
           <div>
             <h3 className="text-white font-bold mb-2">Synopsis</h3>
             <p className="text-gray-400 text-sm leading-relaxed">{manga.synopsis}</p>
           </div>
           <div className="bg-white/5 p-4 rounded-xl border border-white/5 space-y-2 text-sm">
             <div className="flex justify-between text-gray-400"><span>Score</span> <span className="text-white">{manga.score}</span></div>
             <div className="flex justify-between text-gray-400"><span>Status</span> <span className="text-white">{manga.status}</span></div>
             <div className="flex justify-between text-gray-400"><span>Published</span> <span className="text-white">{manga.year}</span></div>
           </div>
        </div>

        <div className="md:col-span-2 space-y-8" id="chapters">
           <div className="bg-[#0f0f0f] border border-white/5 rounded-2xl overflow-hidden">
             <div className="p-4 border-b border-white/5 flex justify-between items-center bg-white/5">
                <span className="font-bold text-white">Chapters</span>
                <span className="text-xs text-gray-500">{chapters.length} available</span>
             </div>
             <div className="max-h-[600px] overflow-y-auto custom-scrollbar p-2">
                {chapters.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    {mangaDexId ? "No readable chapters found." : "Manga not found on MangaDex."}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2">
                    {chapters.map((chap) => (
                      <Link 
                        key={chap.id}
                        to={`/read/${manga.mal_id}/${chap.id}/${encodeURIComponent(manga.title)}/${chap.attributes.chapter}`}
                        className="flex justify-between items-center p-3 rounded-lg hover:bg-white/5 transition-colors group"
                      >
                        <div className="flex items-center gap-3">
                           <span className="text-gray-500 text-sm group-hover:text-brand-400 w-16">#{chap.attributes.chapter}</span>
                           <span className="text-gray-300 text-sm truncate max-w-[200px] md:max-w-xs">{chap.attributes.title || `Chapter ${chap.attributes.chapter}`}</span>
                        </div>
                        <div className="flex items-center gap-3">
                           {chap.attributes.translatedLanguage && (
                             <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase ${chap.attributes.translatedLanguage === 'pt-br' ? 'bg-green-900/50 text-green-400' : 'bg-blue-900/50 text-blue-400'}`}>
                                {chap.attributes.translatedLanguage}
                             </span>
                           )}
                           <i className="fas fa-chevron-right text-xs text-gray-600 group-hover:text-white"></i>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
             </div>
           </div>
           
           <div>
              <h3 className="text-white font-bold mb-4">Comments</h3>
              <form onSubmit={postComment} className="flex gap-3 mb-6">
                <input 
                   className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 text-sm text-white focus:outline-none focus:border-brand-500" 
                   placeholder="Add a comment..."
                   value={newComment}
                   onChange={(e) => setNewComment(e.target.value)}
                />
                <button type="submit" className="bg-brand-600 text-white w-10 h-10 rounded-lg flex items-center justify-center"><i className="fas fa-paper-plane text-xs"></i></button>
              </form>
              <div className="space-y-4">
                 {comments.map(c => (
                   <div key={c.id} className="flex gap-3">
                      <img src={c.avatar} className="w-8 h-8 rounded-full object-cover" />
                      <div>
                        <div className="flex items-center gap-2">
                           <span className="text-sm font-bold text-gray-300">{c.username}</span>
                           <span className="text-xs text-gray-600">{new Date(c.timestamp).toLocaleDateString()}</span>
                        </div>
                        <p className="text-sm text-gray-400">{c.text}</p>
                      </div>
                   </div>
                 ))}
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

const Reader = () => {
  const { malId, chapterId, title, chapterNum } = useParams();
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHeader, setShowHeader] = useState(true);
  const lastScrollY = useRef(0);
  
  useEffect(() => {
    const loadImages = async () => {
      if (!chapterId) return;
      setLoading(true);
      const imgs = await getChapterImages(chapterId);
      setImages(imgs);
      if (malId && title && chapterNum) {
        addToHistory(Number(malId), chapterId, title, chapterNum);
      }
      setLoading(false);
    };
    loadImages();

    const handleScroll = () => {
       const current = window.scrollY;
       if (current > lastScrollY.current && current > 50) {
         setShowHeader(false);
       } else {
         setShowHeader(true);
       }
       lastScrollY.current = current;
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [chapterId]);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center">
      <div className={`fixed top-0 left-0 w-full z-50 transition-transform duration-300 ${showHeader ? 'translate-y-0' : '-translate-y-full'}`}>
         <div className="bg-black/80 backdrop-blur-xl border-b border-white/10 px-6 py-4 flex justify-between items-center">
            <button onClick={() => window.history.back()} className="text-white hover:text-brand-400"><i className="fas fa-arrow-left"></i></button>
            <div className="text-center">
               <h2 className="text-xs text-gray-500 font-bold uppercase tracking-widest">{title}</h2>
               <p className="font-bold text-white">Chapter {chapterNum}</p>
            </div>
            <div className="w-8"></div>
         </div>
      </div>

      <div className="w-full max-w-3xl min-h-screen bg-[#050505]">
        {loading ? (
           <div className="h-screen flex items-center justify-center">
             <div className="w-12 h-12 border-2 border-brand-600 border-t-transparent rounded-full animate-spin"></div>
           </div>
        ) : (
          <div className="flex flex-col pt-16">
            {images.length > 0 ? (
                <>
                {images.map((img, idx) => (
                  <img key={idx} src={img} className="w-full h-auto" loading="lazy" alt={`Page ${idx + 1}`} />
                ))}
                <div className="py-20 flex justify-center gap-6">
                  <button className="px-8 py-3 rounded-full bg-white/10 text-white font-bold" onClick={() => window.history.back()}>Close</button>
                </div>
                </>
            ) : (
                <div className="h-64 flex flex-col items-center justify-center text-gray-400">
                    <p>Failed to load images.</p>
                    <p className="text-xs mt-2">This chapter might be external or restricted.</p>
                </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const ProfilePage = () => {
  const [user, setUser] = useState(getUser());
  const [isEditing, setIsEditing] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handleUpdate = () => setUser(getUser());
    window.addEventListener('user-update', handleUpdate);
    return () => window.removeEventListener('user-update', handleUpdate);
  }, []);

  if (!user.isLoggedIn) {
     return (
       <div className="min-h-screen flex items-center justify-center bg-[#020202] px-4 pb-20 pt-20">
         <AuthModal />
       </div>
     )
  }

  const goPremium = () => {
      const updated = { ...user, isPremium: true };
      saveUser(updated);
      confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
  };
  
  const handleLogout = () => {
    logoutUser();
    navigate('/');
  };

  return (
    <div className="min-h-screen pt-24 px-4 container mx-auto pb-32 max-w-4xl animate-fade-in">
       {/* Profile Header */}
       <div className="bg-[#111] border border-white/5 rounded-3xl p-6 md:p-10 mb-8 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-brand-500/20 transition-all duration-700"></div>
          
          <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start gap-8">
             <div className="relative">
                <img src={user.avatar} className="w-32 h-32 rounded-full border-4 border-[#1a1a1a] shadow-2xl object-cover bg-white/5" />
                {user.isPremium && (
                  <div className="absolute bottom-0 right-0 bg-yellow-400 text-black text-xs font-bold px-2 py-1 rounded-full shadow-lg border border-white/20">
                    PRO
                  </div>
                )}
             </div>
             
             <div className="flex-1 text-center md:text-left space-y-3">
                <div className="flex flex-col md:flex-row items-center gap-4">
                  <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">{user.username}</h1>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${user.isPremium ? 'bg-brand-600 text-white' : 'bg-white/10 text-gray-400'}`}>
                    {user.isPremium ? 'Premium Member' : 'Free Plan'}
                  </span>
                </div>
                <p className="text-gray-400 max-w-lg leading-relaxed">{user.description || "No bio yet."}</p>
                
                <div className="flex flex-wrap gap-3 justify-center md:justify-start pt-2">
                   <button 
                     onClick={() => setIsEditing(true)}
                     className="px-6 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white font-bold text-sm transition-all flex items-center gap-2"
                   >
                     <i className="fas fa-pen"></i> Edit Profile
                   </button>
                   {!user.isPremium && (
                     <button onClick={goPremium} className="px-6 py-2 rounded-full bg-gradient-to-r from-brand-600 to-purple-600 hover:scale-105 text-white font-bold text-sm transition-all shadow-lg shadow-brand-500/20">
                       <i className="fas fa-crown"></i> Go Premium
                     </button>
                   )}
                   <button onClick={handleLogout} className="px-6 py-2 rounded-full border border-red-500/30 text-red-400 hover:bg-red-500/10 font-bold text-sm transition-all">
                     Log Out
                   </button>
                </div>
             </div>
          </div>
       </div>

       {/* Edit Modal */}
       {isEditing && <EditProfileModal user={user} onClose={() => setIsEditing(false)} />}

       {/* Stats Grid */}
       <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-[#111] p-6 rounded-2xl border border-white/5 text-center">
             <div className="text-3xl font-black text-white mb-1">{user.favorites.length}</div>
             <div className="text-xs text-gray-500 uppercase font-bold">Favorites</div>
          </div>
          <div className="bg-[#111] p-6 rounded-2xl border border-white/5 text-center">
             <div className="text-3xl font-black text-white mb-1">{user.history.length}</div>
             <div className="text-xs text-gray-500 uppercase font-bold">Chapters Read</div>
          </div>
       </div>

       <div className="space-y-8">
          <div>
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
               <i className="fas fa-history text-brand-500"></i> Continue Reading
            </h2>
            <div className="space-y-3">
               {user.history.length === 0 ? (
                 <div className="text-center p-8 text-gray-500 bg-[#111] rounded-2xl border border-white/5">No reading history yet.</div>
               ) : (
                 user.history.map((h, i) => (
                   <Link to={`/read/${h.mal_id}/${h.chapterId}/${h.title}/${h.chapterNum}`} key={i} className="flex justify-between items-center p-4 bg-[#111] hover:bg-white/5 rounded-xl border border-white/5 transition-all group">
                      <div className="flex items-center gap-4">
                         <div className="w-10 h-10 rounded-full bg-brand-900/30 flex items-center justify-center text-brand-400 font-bold text-xs">
                           {i + 1}
                         </div>
                         <div>
                           <div className="text-white font-bold group-hover:text-brand-400 transition-colors">{h.title}</div>
                           <div className="text-xs text-gray-500">Chapter {h.chapterNum}</div>
                         </div>
                      </div>
                      <span className="text-xs text-gray-600 font-mono">{new Date(h.timestamp).toLocaleDateString()}</span>
                   </Link>
                 ))
               )}
            </div>
          </div>
       </div>
    </div>
  );
};

// --- APP LAYOUT ---

export default function App() {
  const [trending, setTrending] = useState<JikanManga[]>([]);
  const [top, setTop] = useState<JikanManga[]>([]);
  const [manhwa, setManhwa] = useState<JikanManga[]>([]);
  const [searchResults, setSearchResults] = useState<JikanManga[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [user, setUser] = useState(getUser());

  useEffect(() => {
    const handleUserUpdate = () => setUser(getUser());
    window.addEventListener('user-update', handleUserUpdate);

    const fetchData = async () => {
      try {
        const [t, tp, m] = await Promise.all([
          getTrendingManga(),
          getTopManga(),
          getManhwa()
        ]);
        setTrending(t);
        setTop(tp);
        setManhwa(m);
      } catch (e) {
        console.error("Initialization error", e);
      }
    };
    fetchData();

    return () => window.removeEventListener('user-update', handleUserUpdate);
  }, []);

  const executeSearch = async (query: string) => {
    setLoadingSearch(true);
    try {
      const res = await searchJikan(query);
      setSearchResults(res);
    } catch (e) { console.error(e); } 
    finally { setLoadingSearch(false); }
  };

  return (
    <Router>
      <div className="min-h-screen flex flex-col bg-[#020202] text-gray-100 font-sans selection:bg-brand-500 selection:text-white overflow-x-hidden">
        <AppContent 
          user={user} 
          trending={trending} 
          top={top} 
          manhwa={manhwa} 
          searchResults={searchResults} 
          loadingSearch={loadingSearch} 
          onSearch={executeSearch} 
        />
      </div>
    </Router>
  );
}

function AppContent({ user, trending, top, manhwa, searchResults, loadingSearch, onSearch }: any) {
  const location = useLocation();
  const isReader = location.pathname.includes('/read/');

  return (
    <>
      {!isReader && <TopHeader onSearch={onSearch} user={user} />}
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<HomePage trending={trending} top={top} manhwa={manhwa} />} />
          <Route path="/search" element={<SearchPage results={searchResults} loading={loadingSearch} />} />
          <Route path="/manga/:id" element={<MangaDetails />} />
          <Route path="/read/:malId/:chapterId/:title/:chapterNum" element={<Reader />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Routes>
      </main>
      {!isReader && <BottomDock activeTab={location.pathname} />}
    </>
  );
}
