import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchFromTMDB } from '../services/apiService';
import { Movie, YTPlayer } from '../types';
import { useProfile } from '../contexts/ProfileContext';
import { useTranslation } from '../contexts/LanguageContext';
import Layout from '../components/Layout';
import { CustomSelect } from '../components/common';
import { IMAGE_BASE_URL, BACKDROP_SIZE, BACKDROP_SIZE_MEDIUM, POSTER_SIZE } from '../contexts/constants';

const Hero: React.FC = () => {
    const heroImage = "https://blog.xcvgsystems.com/wp-content/uploads/2024/04/fallout_promo.jpg"; // Fallout
    return (
        <div className="relative w-full h-[70vh] min-h-[300px] text-white overflow-hidden rounded-xl">
            <img src={heroImage} alt="Fallout" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-[var(--background)]/80 via-transparent to-transparent"></div>
            <div className="absolute inset-0 bg-gradient-to-r from-black to-transparent"></div>
            <div className="absolute inset-0 bg-gradient-to-l from-[var(--background)]/50 to-transparent"></div>
            <div className="relative z-10 flex flex-col justify-end h-full px-4 md:px-10 pb-20">
                <div className="max-w-xl animate-hero-content-in">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="text-xl font-black text-red-600" style={{ fontFamily: "'Anton', sans-serif" }}>N</span>
                        <span className="text-sm font-semibold tracking-[0.2em] text-zinc-200 uppercase">SERIES</span>
                    </div>
                    <img src="https://i.ibb.co/N2z8HGjh/pngimg-com-fallout-PNG34.png" alt="Fallout Title" className="w-full max-w-sm md:max-w-md drop-shadow-lg mb-4" />
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-base text-zinc-200" style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.7)' }}>
                        <span>Series</span><span>•</span><span>Sci-Fi</span><span>•</span><span>2024</span><span>•</span><span>1 Season</span><span>•</span><span className="px-2 py-0.5 border border-zinc-400 text-sm rounded">TV-MA</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

const PosterCard: React.FC<{ movie: Movie; onCardClick: (movie: Movie) => void; isNetflixOriginal?: boolean }> = ({ movie, onCardClick, isNetflixOriginal }) => {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { isYtApiReady } = useProfile();
    const type = 'tv';

    const [showVideo, setShowVideo] = useState(false);
    const [isMuted, setIsMuted] = useState(true);
    const playerRef = useRef<YTPlayer | null>(null);
    const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const playerContainerId = useMemo(() => `poster-player-${movie.id}-${Math.random().toString(36).substring(2)}`, [movie.id]);

    const handleGlow = useCallback(() => {
        if (movie.backdrop_path) {
            const imageUrl = `${IMAGE_BASE_URL}${BACKDROP_SIZE_MEDIUM}${movie.backdrop_path}`;
            document.body.style.setProperty('--dynamic-bg-image', `url(${imageUrl})`);
            document.body.classList.add('has-dynamic-bg');
        }
    }, [movie.backdrop_path]);

    const handleMouseEnter = useCallback(() => {
        handleGlow();
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = setTimeout(() => {
            if (document.querySelector(`.interactive-card-container[data-movie-id='${movie.id}']:hover`)) {
               setShowVideo(true);
            }
        }, 7000);
    }, [movie.id, handleGlow]);

    const handleMouseLeave = useCallback(() => {
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
        setShowVideo(false);
    }, []);

    useEffect(() => {
        if (!showVideo || !isYtApiReady) {
            if (playerRef.current) {
                playerRef.current.destroy();
                playerRef.current = null;
            }
            return;
        }

        const initPlayer = (videoId: string) => {
          if (document.getElementById(playerContainerId) && !playerRef.current) {
            playerRef.current = new window.YT.Player(playerContainerId, {
              videoId: videoId,
              playerVars: { autoplay: 1, controls: 0, rel: 0, loop: 1, playlist: videoId, playsinline: 1, modestbranding: 1, iv_load_policy: 3, fs: 0, start: 5 },
              events: { onReady: (event) => { playerRef.current = event.target; event.target.mute(); setIsMuted(true); event.target.playVideo(); } }
            });
          }
        };

        const fetchTrailerAndInit = async () => {
          try {
            const videos = await fetchFromTMDB(`/${type}/${movie.id}/videos`);
            const trailer = videos.results.find((v: any) => v.type === 'Trailer' && v.site === 'YouTube');
            initPlayer(trailer ? trailer.key : 'mF428AFx9gY');
          } catch { initPlayer('mF428AFx9gY'); }
        };

        fetchTrailerAndInit();
        return () => { if (playerRef.current) { playerRef.current.destroy(); playerRef.current = null; } };
    }, [showVideo, movie.id, type, playerContainerId, isYtApiReady]);

    const toggleMute = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        const player = playerRef.current;
        if (!player?.isMuted) return;
        if (player.isMuted()) { player.unMute(); setIsMuted(false); } else { player.mute(); setIsMuted(true); }
    }, []);
  
    if (!movie.backdrop_path) return null;
    const imageUrl = `${IMAGE_BASE_URL}${BACKDROP_SIZE_MEDIUM}${movie.backdrop_path}`;

    return (
        <div 
            className="interactive-card-container relative flex-shrink-0 w-[24vw] min-w-[220px] max-w-[320px] cursor-pointer glow-card-container focusable"
            onMouseEnter={handleMouseEnter} 
            onMouseLeave={handleMouseLeave} 
            data-movie-id={movie.id}
            onClick={() => onCardClick(movie)}
            onFocus={handleGlow}
            tabIndex={0}
            style={{ '--glow-image-url': `url(${imageUrl})` } as React.CSSProperties}
        >
            <div className="relative overflow-hidden transition-all duration-300 ease-in-out transform rounded-lg shadow-lg bg-[var(--surface)] interactive-card">
                {isNetflixOriginal && ( <span style={{ fontFamily: "'Anton', sans-serif", textShadow: '1px 1px 3px rgba(0,0,0,0.5)' }} className="absolute top-2 left-2 z-10 text-3xl font-black text-[var(--primary)] pointer-events-none">N</span> )}
                <div className="relative w-full aspect-video bg-black" onClick={() => onCardClick(movie)}>
                    <img src={`${IMAGE_BASE_URL}${BACKDROP_SIZE_MEDIUM}${movie.backdrop_path}`} alt={movie.title || movie.name} className={`object-cover w-full h-full absolute inset-0 transition-opacity duration-700 ${showVideo ? 'opacity-0' : 'opacity-100'}`} loading="lazy" />
                    <div className={`absolute inset-0 w-full h-full transition-opacity duration-700 ${showVideo ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                         <div id={playerContainerId} className="w-full h-full pointer-events-none" />
                         <div className="absolute inset-0" />
                         {showVideo && ( <div className="absolute bottom-2 right-2 z-10"><button onClick={toggleMute} className="w-8 h-8 border-2 border-white/50 rounded-full text-white/80 hover:border-white hover:text-white transition-colors text-sm flex items-center justify-center bg-black/50"><i className={`fa-solid ${isMuted ? 'fa-volume-xmark' : 'fa-volume-high'}`}></i></button></div> )}
                    </div>
                </div>
                <div className="quick-view bg-[var(--surface)] px-3">
                   <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button onClick={() => navigate('/player', { state: { item: movie, type } })} className="w-9 h-9 flex items-center justify-center text-black bg-white rounded-full text-lg btn-press"><i className="fas fa-play"></i></button>
                        <button className="w-9 h-9 flex items-center justify-center text-white border-2 border-zinc-500 rounded-full text-lg btn-press hover:border-white"><i className="fas fa-plus"></i></button>
                      </div>
                      <button onClick={() => onCardClick(movie)} className="w-9 h-9 flex items-center justify-center text-white border-2 border-zinc-500 rounded-full text-lg btn-press hover:border-white"><i className="fas fa-chevron-down"></i></button>
                   </div>
                   <div className="flex items-center flex-wrap gap-2 text-xs mt-3 text-zinc-300">
                      <span className="font-bold text-green-500">{(movie.vote_average * 10).toFixed(0)}% {t('match')}</span>
                      <span className='px-1.5 py-0.5 border border-white/40 text-[10px] rounded'>HD</span>
                   </div>
                </div>
            </div>
        </div>
    );
};

const ContentRow: React.FC<{ title: string; movies: Movie[]; onCardClick: (movie: Movie) => void; zIndex?: number, isNetflixRow?: boolean }> = ({ title, movies, onCardClick, zIndex, isNetflixRow }) => {
    if (!movies || movies.length === 0) return null;
    const handleMouseLeaveList = useCallback(() => {
        document.body.classList.remove('has-dynamic-bg');
    }, []);
    return (
        <div className="my-6 md:my-8" style={{ zIndex }} onMouseLeave={handleMouseLeaveList}>
            <h2 className="text-lg md:text-xl font-bold text-white mb-3">{title}</h2>
            {/* FIX: The PosterCard component expects an `isNetflixOriginal` prop, not `isNetflixRow`. */}
            <div className="overflow-x-auto no-scrollbar py-32 -my-32"><div className="flex flex-nowrap gap-x-6 px-6">{movies.map(movie => <PosterCard key={movie.id} movie={movie} onCardClick={onCardClick} isNetflixOriginal={isNetflixRow} />)}</div></div>
        </div>
    );
};

const FilterBar: React.FC<{
    genres: { id: number; name: string }[];
    selectedGenre: string;
    onGenreChange: (genreId: string) => void;
    selectedYear: string;
    onYearChange: (year: string) => void;
}> = ({ genres, selectedGenre, onGenreChange, selectedYear, onYearChange }) => {
    const { t } = useTranslation();
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 30 }, (_, i) => currentYear - i);
    const genreOptions = genres.map(g => ({ value: String(g.id), label: g.name }));
    const yearOptions = years.map(y => ({ value: String(y), label: String(y) }));

    return (
        <div className="flex items-center gap-3 my-6 px-4 md:px-10">
            <CustomSelect
                value={selectedGenre}
                onChange={onGenreChange}
                options={genreOptions}
                placeholder={t('allGenres')}
                className="w-48"
            />
            <CustomSelect
                value={selectedYear}
                onChange={onYearChange}
                options={yearOptions}
                placeholder={t('byYear')}
                className="w-32"
            />
        </div>
    );
};

const FilteredItemCard: React.FC<{ item: Movie, index: number }> = ({ item, index }) => {
    const { setModalItem } = useProfile();
    if (!item.backdrop_path) return null;
    
    const imageUrl = `${IMAGE_BASE_URL}${BACKDROP_SIZE_MEDIUM}${item.backdrop_path}`;

    const handleGlow = useCallback(() => {
        document.body.style.setProperty('--dynamic-bg-image', `url(${imageUrl})`);
        document.body.classList.add('has-dynamic-bg');
    }, [imageUrl]);

    return (
        <div 
            className="w-full animate-grid-item cursor-pointer glow-card-container focusable relative" 
            style={{ '--glow-image-url': `url(${imageUrl})`, animationDelay: `${index * 30}ms` } as React.CSSProperties}
            onClick={() => setModalItem({ ...item, media_type: 'tv' })}
            onMouseEnter={handleGlow}
            onFocus={handleGlow}
            tabIndex={0}
        >
            <div className="relative overflow-hidden transition-all duration-300 ease-in-out rounded-lg shadow-lg bg-[var(--surface)] interactive-card">
                 <img
                    src={`${IMAGE_BASE_URL}${BACKDROP_SIZE_MEDIUM}${item.backdrop_path}`}
                    alt={item.title || item.name}
                    className="object-cover w-full aspect-video"
                    loading="lazy"
                />
            </div>
        </div>
    );
};

const SkeletonLoader: React.FC = () => (
    <div className="px-4 md:px-10">
        <div className="relative w-full h-[70vh] min-h-[500px] bg-[var(--surface)] skeleton rounded-xl" />
        <div className="relative z-10 space-y-8 mt-8">
            {[...Array(7)].map((_, rowIndex) => (
                <div key={rowIndex}>
                    <div className="w-1/3 h-8 mb-4 bg-zinc-800/50 rounded-lg skeleton"></div>
                    <div className="flex gap-x-2">{[...Array(7)].map((_, i) => ( <div key={i} className="flex-shrink-0 w-[24vw] min-w-[220px] max-w-[320px]"><div className="w-full aspect-video bg-zinc-800/50 rounded-lg skeleton"></div></div> ))}</div>
                </div>
            ))}
        </div>
    </div>
);

const TvShowsPage: React.FC = () => {
    const [data, setData] = useState<Record<string, Movie[]>>({});
    const [genres, setGenres] = useState<{ id: number; name: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const { setModalItem } = useProfile();
    const { t } = useTranslation();

    const [selectedGenre, setSelectedGenre] = useState('');
    const [selectedYear, setSelectedYear] = useState('');
    const [filteredTvShows, setFilteredTvShows] = useState<Movie[]>([]);
    const [isFilterLoading, setIsFilterLoading] = useState(false);

    const isFiltering = !!(selectedGenre || selectedYear);

    useEffect(() => {
        const fetchFilteredData = async () => {
            if (!isFiltering) {
                setFilteredTvShows([]);
                return;
            }

            setIsFilterLoading(true);
            try {
                const params: Record<string, string | number> = { sort_by: 'popularity.desc' };
                if (selectedGenre) params.with_genres = selectedGenre;
                if (selectedYear) params.first_air_date_year = selectedYear;

                const res = await fetchFromTMDB('/discover/tv', params);
                setFilteredTvShows(res.results.filter((m: Movie) => m.backdrop_path) || []);
            } catch (error) {
                console.error("Failed to fetch filtered tv shows:", error);
            } finally {
                setIsFilterLoading(false);
            }
        };

        fetchFilteredData();
    }, [selectedGenre, selectedYear, isFiltering]);

    const handleOpenModal = (item: Movie) => setModalItem({ ...item, media_type: 'tv' });

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const filterWithBackdrop = (results: any[]) => (results || []).filter((item: Movie) => item.backdrop_path);
                
                const [genresRes, trendingRes, topRatedRes, popularRes, netflixRes, airingTodayRes, animationRes, dramaRes] = await Promise.all([
                    fetchFromTMDB('/genre/tv/list'),
                    fetchFromTMDB('/trending/tv/week'),
                    fetchFromTMDB('/tv/top_rated'),
                    fetchFromTMDB('/tv/popular'),
                    fetchFromTMDB('/discover/tv', { with_networks: '213' }),
                    fetchFromTMDB('/tv/airing_today'),
                    fetchFromTMDB('/discover/tv', { with_genres: 16 }),
                    fetchFromTMDB('/discover/tv', { with_genres: 18 }),
                ]);

                setGenres(genresRes.genres || []);
                setData({
                    trendingTvShows: filterWithBackdrop(trendingRes.results),
                    topRated: filterWithBackdrop(topRatedRes.results),
                    popularSeries: filterWithBackdrop(popularRes.results),
                    netflixOriginals: filterWithBackdrop(netflixRes.results),
                    airingToday: filterWithBackdrop(airingTodayRes.results),
                    animation: filterWithBackdrop(animationRes.results),
                    tvDramas: filterWithBackdrop(dramaRes.results),
                });

            } catch (error) {
                console.error("Failed to fetch TV shows page data:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const contentRows = useMemo(() => [
        { title: t('trendingTvShows'), data: data.trendingTvShows },
        { title: t('popularSeries'), data: data.popularSeries },
        { title: t('netflixOriginals'), data: data.netflixOriginals, isNetflixRow: true },
        { title: t('topRated'), data: data.topRated },
        { title: t('airingToday'), data: data.airingToday },
        { title: t('animation'), data: data.animation },
        { title: t('tvDramas'), data: data.tvDramas },
    ], [data, t]);
    
    const renderContent = () => {
        const handleGridMouseLeave = useCallback(() => {
            document.body.classList.remove('has-dynamic-bg');
        }, []);

        if (isFiltering) {
            if (isFilterLoading) {
                return (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {Array.from({ length: 18 }).map((_, i) => (
                            <div key={i} className="w-full animate-pulse aspect-video bg-[var(--surface)] rounded-lg"></div>
                        ))}
                    </div>
                );
            }
            if (filteredTvShows.length === 0) {
                return <p className="text-center text-gray-400 py-10">{t('noItemsFound', { title: '' })}</p>;
            }
            return (
                <div onMouseLeave={handleGridMouseLeave} className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {filteredTvShows.map((show, index) => (
                        <FilteredItemCard key={show.id} item={show} index={index} />
                    ))}
                </div>
            );
        }
        return (
            <>
                {contentRows.map((row, index) => (
                    <ContentRow key={row.title} title={row.title} movies={row.data} onCardClick={handleOpenModal} zIndex={10 - index} isNetflixRow={row.isNetflixRow} />
                ))}
            </>
        );
    };

    return (
        <Layout>
            {loading ? (
                <SkeletonLoader />
            ) : (
                <div>
                    <div className="pt-24 px-4 md:px-10">
                        <Hero />
                    </div>
                    <FilterBar
                        genres={genres}
                        selectedGenre={selectedGenre}
                        onGenreChange={setSelectedGenre}
                        selectedYear={selectedYear}
                        onYearChange={setSelectedYear}
                    />
                    <div className="px-4 md:px-10">
                        {renderContent()}
                    </div>
                </div>
            )}
        </Layout>
    );
};

export default TvShowsPage;
