import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfile } from '../contexts/ProfileContext';
import { useTranslation } from '../contexts/LanguageContext';
import { HistoryItem, FavoriteItem, DownloadItem, Movie } from '../types';
import Layout from '../components/Layout';
import { fetchFromTMDB } from '../services/apiService';

const ProfileHeader: React.FC<{ profile: any; onSearch: () => void; onSettings: () => void }> = ({ profile, onSearch, onSettings }) => {
    const { t } = useTranslation();
    return (
        <header className="flex items-start justify-between">
            <div className="flex items-center gap-4">
                <img src={profile.avatar} alt="Profile Avatar" className="w-16 h-16 rounded-full border-2 border-zinc-700" />
                <div>
                    <h1 className="text-2xl font-bold text-white">{profile.name}</h1>
                    <p className="text-sm text-gray-400">@{profile.name.toLowerCase().replace(/\s/g, '')} • <span className="text-blue-400 cursor-pointer hover:underline">{t('viewChannel')}</span></p>
                </div>
            </div>
            <div className="flex items-center gap-2">
                 <button onClick={onSearch} aria-label={t('search')} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-zinc-700 transition-colors btn-press">
                    <i className="fa-solid fa-magnifying-glass text-lg text-white"></i>
                </button>
                <button onClick={onSettings} aria-label={t('settings')} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-zinc-700 transition-colors btn-press">
                    <i className="fa-solid fa-cog text-lg text-white"></i>
                </button>
            </div>
        </header>
    );
};

const ActionButton: React.FC<{ icon: string; text: string; onClick: () => void; }> = ({ icon, text, onClick }) => {
    return (
        <button onClick={onClick} className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-zinc-800 rounded-full hover:bg-zinc-700 transition-colors btn-press">
            <i className={`${icon} text-white`}></i>
            <span className="text-sm font-semibold text-white">{text}</span>
        </button>
    );
};

const SectionHeader: React.FC<{ title: string; onClick?: () => void }> = ({ title, onClick }) => {
    const { t } = useTranslation();
    return (
        <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">{title}</h2>
            {onClick && (
                <button onClick={onClick} className="px-3 py-1.5 text-sm font-semibold text-blue-400 hover:bg-blue-400/10 rounded-full transition-colors">
                    {t('viewAll')}
                </button>
            )}
        </div>
    );
};

const ResumeCard: React.FC<{ item: HistoryItem }> = ({ item }) => {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const progress = (item.currentTime / item.duration) * 100;
    
    const handleResume = (e: React.MouseEvent) => {
        e.stopPropagation();
        const movieItem: Movie = {
          id: item.id,
          title: item.title,
          name: item.title,
          poster_path: null,
          backdrop_path: item.itemImage.replace('https://image.tmdb.org/t/p/w780', ''),
          overview: '',
          vote_average: 0,
          vote_count: 0
        };
        navigate('/player', { 
            state: { 
                item: movieItem,
                type: item.type,
                currentTime: item.currentTime,
                episode: item.episodeId ? { id: item.episodeId } : null
            } 
        });
    };

    const handleDetails = () => {
        navigate(`/details/${item.type}/${item.id}`);
    }

    return (
        <div onClick={handleDetails} className="relative w-full overflow-hidden cursor-pointer group rounded-xl bg-zinc-800 shadow-xl interactive-card">
            <img src={item.itemImage} alt={item.title} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent"></div>
            <div className="absolute inset-0 p-4 flex flex-col justify-end">
                <p className="text-sm font-bold text-red-400 drop-shadow">{t('continueWatching')}</p>
                <h3 className="text-xl font-bold text-white drop-shadow-lg mt-1">{item.title}</h3>
                <div className="w-full h-1 mt-3 bg-white/20 rounded-full overflow-hidden">
                    <div className="h-full bg-red-600" style={{ width: `${progress}%` }}></div>
                </div>
                <div className="mt-4 flex items-center gap-3">
                    <button onClick={handleResume} className="px-5 py-2 text-sm font-bold text-black bg-white rounded-full flex items-center gap-2 btn-press">
                        <i className="fa-solid fa-play"></i>
                        <span>{t('resume')}</span>
                    </button>
                    <button onClick={handleDetails} className="w-10 h-10 text-white bg-white/20 rounded-full flex items-center justify-center transition-colors hover:bg-white/30 btn-press">
                        <i className="fa-solid fa-circle-info"></i>
                    </button>
                </div>
            </div>
        </div>
    );
};


const HistoryCard: React.FC<{ item: HistoryItem, index: number }> = ({ item, index }) => {
    const navigate = useNavigate();
    const handleClick = () => navigate(`/details/${item.type}/${item.id}`);
    const progress = (item.currentTime / item.duration) * 100;

    const views = (Math.random() * 100).toFixed(0) + 'K';
    const timeAgo = `${index + 2} hour${index > 0 ? 's' : ''} ago`;

    const imageUrl = item.itemImage;
    const handleGlow = useCallback(() => {
        document.body.style.setProperty('--dynamic-bg-image', `url(${imageUrl})`);
        document.body.classList.add('has-dynamic-bg');
    }, [imageUrl]);

    return (
        <div 
            onClick={handleClick} 
            className="flex-shrink-0 w-64 cursor-pointer group interactive-card glow-card-container focusable"
            onMouseEnter={handleGlow}
            onFocus={handleGlow}
            tabIndex={0}
            style={{ '--glow-image-url': `url(${imageUrl})` } as React.CSSProperties}
        >
            <div className="relative overflow-hidden rounded-xl bg-zinc-800 shadow-lg">
                <img src={item.itemImage} alt={item.title} className="w-full aspect-video object-cover" loading="lazy" />
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-zinc-600/50">
                    <div className="h-full bg-red-600" style={{ width: `${progress}%` }}></div>
                </div>
                 <span className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded">
                    {new Date(item.duration * 1000).toISOString().substr(14, 5)}
                 </span>
            </div>
            <div className="flex items-start gap-3 pt-3">
                <div className="flex-1">
                    <h3 className="font-semibold text-white line-clamp-2 leading-tight">{item.title}</h3>
                    <p className="text-xs text-gray-400 mt-1">{`CineStream • ${views} views • ${timeAgo}`}</p>
                </div>
                <button onClick={(e) => e.stopPropagation()} className="p-1 text-gray-400 hover:text-white">
                    <i className="fa-solid fa-ellipsis-vertical"></i>
                </button>
            </div>
        </div>
    );
};

const PlaylistCard: React.FC<{ title: string; subtitle: string; icon: string; coverImage: string | null; onClick: () => void; }> = ({ title, subtitle, icon, coverImage, onClick }) => {
    const { t } = useTranslation();
    const countText = subtitle.split('•')[1]?.trim() || t('videosCountText', {count: 0});
    const handleGlow = useCallback(() => {
        if (coverImage) {
            document.body.style.setProperty('--dynamic-bg-image', `url(${coverImage})`);
            document.body.classList.add('has-dynamic-bg');
        }
    }, [coverImage]);

    return (
        <div 
            onClick={onClick} 
            className="flex-shrink-0 w-48 cursor-pointer group interactive-card-sm glow-card-container focusable"
            onMouseEnter={handleGlow}
            onFocus={handleGlow}
            tabIndex={0}
            style={{ '--glow-image-url': coverImage ? `url(${coverImage})` : 'none' } as React.CSSProperties}
        >
            <div className="relative overflow-hidden rounded-xl bg-zinc-800 shadow-lg aspect-video">
                {coverImage ? (
                    <>
                        <img src={coverImage} alt={title} className="w-full h-full object-cover" loading="lazy" />
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-end p-3">
                            <div className="flex flex-col items-center text-white">
                                <i className={`${icon} text-2xl`}></i>
                                <span className="text-xs font-bold mt-1">{countText}</span>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900">
                        <i className={`${icon} text-4xl text-zinc-400`}></i>
                        <p className="text-sm font-semibold text-zinc-400 mt-2">{countText}</p>
                    </div>
                )}
            </div>
             <div className="pt-2">
                <h3 className="font-semibold text-white truncate">{title}</h3>
                <p className="text-xs text-gray-400">{subtitle.split('•')[0]?.trim()}</p>
            </div>
        </div>
    );
};

const ActionLinkRow: React.FC<{ icon: string; text: string; onClick?: () => void }> = ({ icon, text, onClick }) => (
  <button onClick={onClick} className="flex items-center gap-4 w-full p-2.5 rounded-lg hover:bg-zinc-800 transition-colors btn-press">
    <i className={`${icon} w-6 text-center text-xl text-gray-300`}></i>
    <span className="font-medium text-white">{text}</span>
    <i className="fa-solid fa-chevron-right text-gray-500 ms-auto"></i>
  </button>
);


const FollowedActorsCarousel: React.FC = () => {
    const { activeProfile } = useProfile();
    const [movies, setMovies] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const { t } = useTranslation();
    const navigate = useNavigate();

    useEffect(() => {
        const fetchContent = async () => {
            const followedActorIds = activeProfile?.followedActors || [];
            if (followedActorIds.length > 0) {
                setLoading(true);
                try {
                    const promises = followedActorIds.slice(0, 5).map(id => fetchFromTMDB(`/person/${id}/movie_credits`));
                    const results = await Promise.all(promises);
                    const allMovies = results
                        .flatMap(res => res.cast || [])
                        .filter((m: any) => m.poster_path)
                        .sort((a,b) => b.popularity - a.popularity);
                    
                    const uniqueMovies = Array.from(new Map(allMovies.map(m => [m.id, m])).values()).slice(0, 10);
                    setMovies(uniqueMovies);
                } catch (err) {
                    console.error("Failed to fetch followed actors content", err);
                } finally {
                    setLoading(false);
                }
            } else {
                setLoading(false);
            }
        };
        fetchContent();
    }, [activeProfile?.followedActors]);

    if (movies.length === 0) return null;

    return (
        <section>
            <SectionHeader title={t('fromActorsYouFollow')} />
             {loading ? (
                <div className="h-48 flex items-center justify-center"><div className="w-8 h-8 border-2 border-t-transparent border-zinc-500 rounded-full animate-spin"></div></div>
             ) : (
                <div className="overflow-x-auto no-scrollbar -mx-4 pt-3">
                    <div className="flex gap-4 px-4">
                        {movies.map((movie) => {
                            const imageUrl = `https://image.tmdb.org/t/p/w500${movie.poster_path}`;
                            const handleGlow = () => {
                                document.body.style.setProperty('--dynamic-bg-image', `url(${imageUrl})`);
                                document.body.classList.add('has-dynamic-bg');
                            };
                             return (
                             <div 
                                key={movie.id} 
                                onClick={() => navigate(`/details/movie/${movie.id}`)} 
                                className="flex-shrink-0 w-32 cursor-pointer group interactive-card-sm glow-card-container focusable"
                                onMouseEnter={handleGlow}
                                onFocus={handleGlow}
                                tabIndex={0}
                                style={{ '--glow-image-url': `url(${imageUrl})` } as React.CSSProperties}
                             >
                                <div className="relative overflow-hidden rounded-xl bg-zinc-800 shadow-lg">
                                    <img src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`} alt={movie.title} className="w-full aspect-[3/4] object-cover" loading="lazy" />
                                </div>
                                <h3 className="mt-2 text-xs font-semibold text-white truncate">{movie.title}</h3>
                             </div>
                        )})}
                    </div>
                </div>
            )}
        </section>
    );
}

const YouPage: React.FC = () => {
    const { activeProfile, switchProfile, getScreenSpecificData } = useProfile();
    const navigate = useNavigate();
    const { t } = useTranslation();

    if (!activeProfile) {
        navigate('/', { replace: true });
        return null;
    }

    const handleMouseLeaveList = useCallback(() => {
        document.body.classList.remove('has-dynamic-bg');
    }, []);
    
    const history = getScreenSpecificData('history', []);
    const favorites = getScreenSpecificData('favorites', []);
    const downloads = getScreenSpecificData('downloads', []);
    
    const lastWatched = history.length > 0 ? history[0] : null;
    const historyRest = history.length > 1 ? history.slice(1) : [];

    const getCoverImage = (items: (FavoriteItem | DownloadItem)[]) => {
        if (items.length > 0) {
            const item = items[0];
            if ('poster' in item && item.poster) return item.poster;
        }
        return null;
    };

    return (
        <Layout>
            <div className="bg-transparent text-white min-h-screen pb-10">
                <div className="p-4 pt-24 space-y-8">
                    <div className="animate-fade-in-up" style={{ animationDelay: '100ms' }}>
                        <ProfileHeader 
                            profile={activeProfile} 
                            onSearch={() => navigate('/search')}
                            onSettings={() => navigate('/settings')}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
                        <ActionButton icon="fa-solid fa-users" text={t('switchAccount')} onClick={switchProfile} />
                        <ActionButton icon="fa-solid fa-person-circle-question" text={t('helpAndFeedback')} onClick={() => {}} />
                    </div>

                    {lastWatched && (
                        <div className="animate-fade-in-up" style={{ animationDelay: '300ms' }}>
                            <ResumeCard item={lastWatched} />
                        </div>
                    )}
                    
                    {historyRest.length > 0 && (
                        <section className="animate-fade-in-up" style={{ animationDelay: '400ms' }} onMouseLeave={handleMouseLeaveList}>
                            <SectionHeader title={t('history')} onClick={() => { /* Navigate to full history page */ }} />
                            <div className="overflow-x-auto no-scrollbar -mx-4 pt-3">
                                <div className="flex gap-4 px-4">
                                    {historyRest.map((item, index) => <HistoryCard key={item.timestamp} item={item} index={index}/>)}
                                </div>
                            </div>
                        </section>
                    )}

                    <section className="animate-fade-in-up" style={{ animationDelay: '500ms' }} onMouseLeave={handleMouseLeaveList}>
                        <SectionHeader title={t('playlists')} onClick={() => { /* Navigate to full playlists page */ }} />
                        <div className="overflow-x-auto no-scrollbar -mx-4 pt-3">
                            <div className="flex gap-4 px-4">
                               <PlaylistCard 
                                    title={t('likedVideos')} 
                                    subtitle={`Playlist • ${t('videosCountText', {count: favorites.length})}`}
                                    icon="fa-solid fa-thumbs-up"
                                    coverImage={getCoverImage(favorites)}
                                    onClick={() => navigate('/favorites')}
                                />
                                <PlaylistCard 
                                    title={t('downloads')}
                                    subtitle={`Playlist • ${t('videosCountText', {count: downloads.length})}`}
                                    icon="fa-solid fa-download"
                                    coverImage={getCoverImage(downloads)}
                                    onClick={() => navigate('/downloads')}
                                />
                                <PlaylistCard 
                                    title={t('watchLater')} 
                                    subtitle={`Playlist • ${t('videosCountText', {count: 0})}`}
                                    icon="fa-solid fa-clock"
                                    coverImage={'https://images.unsplash.com/photo-1505330622279-bf7d7fc918f4?q=80&w=2940&auto=format&fit=crop'}
                                    onClick={() => {}}
                                />
                            </div>
                        </div> 
                    </section>

                    <div className="animate-fade-in-up" style={{ animationDelay: '600ms' }} onMouseLeave={handleMouseLeaveList}>
                        <FollowedActorsCarousel />
                    </div>
                    
                     <section className="border-t border-zinc-800 pt-6 space-y-1 animate-fade-in-up" style={{ animationDelay: '700ms' }}>
                        <ActionLinkRow icon="fa-solid fa-sliders" text={t('settings')} onClick={() => navigate('/settings')} />
                     </section>
                </div>
            </div>
        </Layout>
    );
};

export default YouPage;
