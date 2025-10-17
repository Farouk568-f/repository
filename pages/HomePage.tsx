

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchFromTMDB } from '../services/apiService';
import { Movie, YTPlayer, HistoryItem } from '../types';
import { useProfile } from '../contexts/ProfileContext';
import { useTranslation } from '../contexts/LanguageContext';
import Layout from '../components/Layout';
import { IMAGE_BASE_URL, BACKDROP_SIZE, BACKDROP_SIZE_MEDIUM, POSTER_SIZE } from '../contexts/constants';

const Hero: React.FC<{ movie: Movie | null; isKids: boolean; }> = ({ movie, isKids }) => {
    if (isKids) {
        const heroImage = "https://theithacan.org/wp-content/uploads/2024/03/Kung-Fu-Pnda-4.jpg";
        return (
            <div className="relative w-full h-[90vh] min-h-[400px] text-white overflow-hidden rounded-xl">
                <img
                    src={heroImage}
                    alt={'Kung Fu Panda 4'}
                    className="absolute inset-0 w-full h-full object-cover"
                />
                {/* Gradients for readability and cinematic effect */}
                <div className="absolute inset-0 bg-gradient-to-t from-[var(--background)]/80 via-transparent to-transparent"></div>
                <div className="absolute inset-0 bg-gradient-to-r from-black to-transparent"></div>
                <div className="absolute inset-0 bg-gradient-to-l from-[var(--background)]/50 to-transparent"></div>
                
                <div className="relative z-10 flex flex-col justify-end h-full px-4 md:px-10 pb-20">
                    <div className="max-w-xl animate-hero-content-in">
                        <div className="flex items-center gap-2 mb-3">
                            <span className="text-xl font-black text-blue-500" style={{fontFamily: "'Anton', sans-serif"}}>N</span>
                            <span className="text-sm font-semibold tracking-[0.2em] text-zinc-200 uppercase">MOVIE</span>
                        </div>
                        <img src="https://i.ibb.co/q36NtJNT/sad.png" alt="Kung Fu Panda 4 Title" className="w-full max-w-sm md:max-w-md drop-shadow-lg mb-4" />
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-base text-zinc-200" style={{textShadow: '1px 1px 2px rgba(0,0,0,0.7)'}}>
                            <span>Movie</span>
                            <span>•</span>
                            <span>Animation</span>
                            <span>•</span>
                            <span>2024</span>
                            <span>•</span>
                            <span>1h 34m</span>
                            <span>•</span>
                            <span className="px-2 py-0.5 border border-zinc-400 text-sm rounded">PG</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
    
    // This component now always shows the Squid Game banner for visual consistency,
    // regardless of the API call result. The `movie` prop is used for alt text if available.
    const heroImage = "https://images.squarespace-cdn.com/content/v1/56a1633ac21b86f80ddeacb4/106a6346-2ebd-4353-8bb4-b8a5e32320b2/squid+game+2+banner.jpg"; // Stable Squid Game banner URL

    return (
        <div className="relative w-full h-[90vh] min-h-[400px] text-white overflow-hidden rounded-xl">
            <img
                src={heroImage}
                alt={movie?.title || movie?.name || 'Squid Game'}
                className="absolute inset-0 w-full h-full object-cover"
            />
            {/* Gradients for readability and cinematic effect */}
            <div className="absolute inset-0 bg-gradient-to-t from-[var(--background)]/80 via-transparent to-transparent"></div>
            <div className="absolute inset-0 bg-gradient-to-r from-black to-transparent"></div>
            <div className="absolute inset-0 bg-gradient-to-l from-[var(--background)]/50 to-transparent"></div>
            
            <div className="relative z-10 flex flex-col justify-end h-full px-4 md:px-10 pb-20">
                <div className="max-w-xl animate-hero-content-in">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="text-xl font-black text-red-600" style={{fontFamily: "'Anton', sans-serif"}}>N</span>
                        <span className="text-sm font-semibold tracking-[0.2em] text-zinc-200 uppercase">SERIES</span>
                    </div>
                    <img src="https://i.ibb.co/B5PW9wnh/pngimg-com-squid-game-PNG35-1.png" alt="Squid Game Title" className="w-full max-w-sm md:max-w-md drop-shadow-lg mb-4" />
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-base text-zinc-200" style={{textShadow: '1px 1px 2px rgba(0,0,0,0.7)'}}>
                        <span>Show</span>
                        <span>•</span>
                        <span>Thriller</span>
                        <span>•</span>
                        <span>2025</span>
                        <span>•</span>
                        <span>3 seasons</span>
                        <span>•</span>
                        <span className="px-2 py-0.5 border border-zinc-400 text-sm rounded">TV-MA</span>
                    </div>
                </div>
            </div>

            <div className="absolute bottom-10 right-10 z-10">
                <div className="flex items-center gap-2 bg-black/50 px-3 py-2 rounded-md text-sm font-semibold backdrop-blur-sm">
                    <i className="far fa-calendar-alt"></i>
                    <span>Coming June 27</span>
                </div>
            </div>
        </div>
    );
};


const PosterCard: React.FC<{ movie: Movie, onCardClick: (movie: Movie) => void, isNetflixOriginal?: boolean, isRecentlyAdded?: boolean, onCardFocus: (element: HTMLElement) => void, index: number, isContinueWatching?: boolean }> = ({ movie, onCardClick, isNetflixOriginal, isRecentlyAdded, onCardFocus, index, isContinueWatching = false }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { isYtApiReady } = useProfile();
  const type = movie.media_type || (movie.title ? 'movie' : 'tv');

  const [showVideo, setShowVideo] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const playerRef = useRef<YTPlayer | null>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playerContainerId = useMemo(() => `poster-player-${movie.id}-${Math.random().toString(36).substring(2)}`, [movie.id]);
  
  const [isFocused, setIsFocused] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    if (cardRef.current) {
      onCardFocus(cardRef.current);
    }
  }, [onCardFocus]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
  }, []);

  if (isContinueWatching) {
    const progressPercent = (movie.duration && movie.currentTime && movie.duration > 0) ? (movie.currentTime / movie.duration) * 100 : 0;
    
    const { mainTitle, secondaryText } = useMemo(() => {
        const title = movie.title || movie.name || '';
        const titleParts = title.split(': S');
        if (titleParts.length > 1) { // It's a series
            const main = titleParts[0];
            const seasonEpisodePart = 'S' + titleParts[1];
            const seasonMatch = seasonEpisodePart.match(/S(\d+)/);
            const episodeMatch = seasonEpisodePart.match(/E(\d+)/);
            if (seasonMatch && episodeMatch) {
                const secondary = `S${seasonMatch[1]} Ep ${episodeMatch[1]} • Resume`;
                return { mainTitle: main, secondaryText: secondary };
            }
        }
        // It's a movie, or parsing failed
        return { mainTitle: title.split(': S')[0], secondaryText: 'Resume on Netflix' }; 
    }, [movie.title, movie.name]);

    if (!movie.backdrop_path) return null;

    return (
        <div
            ref={cardRef}
            className="flex-shrink-0 w-[24vw] min-w-[220px] max-w-[320px] cursor-pointer focusable continue-watching-card-wrapper"
            tabIndex={0}
            onClick={() => onCardClick(movie)}
            onKeyDown={(e) => e.key === 'Enter' && onCardClick(movie)}
            onFocus={handleFocus}
            onBlur={handleBlur}
            style={{ animationDelay: `${index * 50}ms` }}
        >
            <div className="relative overflow-hidden transition-all duration-300 ease-in-out transform rounded-lg shadow-lg bg-[var(--surface)] group hover:scale-105 hover:shadow-2xl">
                <div className="relative w-full aspect-video bg-black">
                    <img
                        src={`${IMAGE_BASE_URL}${BACKDROP_SIZE_MEDIUM}${movie.backdrop_path}`}
                        alt={mainTitle}
                        className={`object-cover w-full h-full`}
                        loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none"></div>
                    
                    <div className="absolute bottom-0 left-0 right-0 px-3 pb-1.5 pointer-events-none">
                        <div className="h-1.5 bg-zinc-600/80 rounded-full">
                            <div className="h-full bg-white rounded-full" style={{ width: `${progressPercent}%` }}></div>
                        </div>
                    </div>
                    
                    <div className="absolute bottom-4 left-3 text-white text-xs font-medium uppercase tracking-wider drop-shadow-md pointer-events-none">
                        {t('resume')}
                    </div>
                </div>
            </div>
            <div className="mt-3 text-left min-h-[2.5rem]">
                <p className={`text-sm font-semibold text-white truncate drop-shadow-lg transition-all duration-200 ease-in-out overflow-hidden ${isFocused ? 'max-h-6 opacity-100' : 'max-h-0 opacity-0'}`}>
                    {mainTitle}
                </p>
                <p className={`text-xs text-zinc-400 truncate`}>
                    {secondaryText}
                </p>
            </div>
        </div>
    );
  }


  const handleMouseEnter = useCallback(() => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
        // A simple querySelector check to ensure the element is still hovered by the user
        // when the timeout fires, preventing the video from playing if the user quickly hovers away.
        if (document.querySelector(`.interactive-card-container[data-movie-id='${movie.id}']:hover`)) {
           setShowVideo(true);
        }
    }, 7000); // 7-second delay as requested
  }, [movie.id]);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setShowVideo(false);
  }, []);

  useEffect(() => {
    // If we shouldn't show the video, or the YouTube API isn't ready,
    // ensure any existing player is destroyed and exit early.
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
          playerVars: {
            autoplay: 1, controls: 0, rel: 0, loop: 1, playlist: videoId,
            playsinline: 1, modestbranding: 1, iv_load_policy: 3, fs: 0, start: 5,
          },
          events: {
            onReady: (event) => {
              playerRef.current = event.target;
              event.target.mute();
              setIsMuted(true);
              event.target.playVideo();
            }
          }
        });
      }
    };

    const fetchTrailerAndInit = async () => {
      try {
        const videos = await fetchFromTMDB(`/${type}/${movie.id}/videos`);
        const trailer = videos.results.find((v: any) => v.type === 'Trailer' && v.site === 'YouTube');
        initPlayer(trailer ? trailer.key : 'mF428AFx9gY'); // Fallback video
      } catch {
        initPlayer('mF428AFx9gY'); // Fallback video
      }
    };

    fetchTrailerAndInit();

    // Cleanup function: this is crucial to remove the player when the component
    // is unhovered or unmounts, preventing memory leaks.
    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, [showVideo, movie.id, type, playerContainerId, isYtApiReady]);

  const toggleMute = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const player = playerRef.current;
    if (!player?.isMuted) return;

    if (player.isMuted()) {
      player.unMute();
      setIsMuted(false);
    } else {
      player.mute();
      setIsMuted(true);
    }
  }, []);
  
  if (!movie.backdrop_path) return null;

  return (
    <div 
        ref={cardRef}
        className="interactive-card-container relative flex-shrink-0 w-[24vw] min-w-[220px] max-w-[320px] cursor-pointer focusable"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        data-movie-id={movie.id}
        tabIndex={0}
        onClick={() => onCardClick(movie)}
        onKeyDown={(e) => e.key === 'Enter' && onCardClick(movie)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="relative overflow-hidden transition-all duration-300 ease-in-out transform rounded-lg shadow-lg bg-[var(--surface)] interactive-card">
        {isNetflixOriginal && (
            <span style={{ fontFamily: "'Anton', sans-serif", textShadow: '1px 1px 3px rgba(0,0,0,0.5)' }} className="absolute top-2 left-2 z-10 text-3xl font-black text-[var(--primary)] pointer-events-none">N</span>
        )}
        <div className="relative w-full aspect-video bg-black">
            <img
              src={`${IMAGE_BASE_URL}${BACKDROP_SIZE_MEDIUM}${movie.backdrop_path}`}
              alt={movie.title || movie.name}
              className={`object-cover w-full h-full absolute inset-0 transition-opacity duration-700 ${showVideo ? 'opacity-0' : 'opacity-100'}`}
              loading="lazy"
            />
            <div className={`absolute inset-0 w-full h-full transition-opacity duration-700 ${showVideo ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                 <div id={playerContainerId} className="w-full h-full pointer-events-none" />
                 {/* Transparent overlay to intercept clicks and prevent interaction with the YouTube player UI */}
                 <div className="absolute inset-0" />
                 {showVideo && (
                    <div className="absolute bottom-2 right-2 z-10">
                         <button onClick={toggleMute} className="w-8 h-8 border-2 border-white/50 rounded-full text-white/80 hover:border-white hover:text-white transition-colors text-sm flex items-center justify-center bg-black/50">
                            <i className={`fa-solid ${isMuted ? 'fa-volume-xmark' : 'fa-volume-high'}`}></i>
                        </button>
                    </div>
                 )}
            </div>
        </div>
        <div className="quick-view bg-[var(--surface)] px-3">
           <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button onClick={() => navigate('/player', { state: { item: movie, type } })} className="w-9 h-9 flex items-center justify-center text-black bg-white rounded-full text-lg btn-press"><i className="fas fa-play"></i></button>
                <button className="w-9 h-9 flex items-center justify-center text-white border-2 border-zinc-500 rounded-full text-lg btn-press hover:border-white"><i className="fas fa-plus"></i></button>
                <button className="w-9 h-9 flex items-center justify-center text-white border-2 border-zinc-500 rounded-full text-lg btn-press hover:border-white"><i className="far fa-thumbs-up"></i></button>
              </div>
              <button onClick={() => onCardClick(movie)} className="w-9 h-9 flex items-center justify-center text-white border-2 border-zinc-500 rounded-full text-lg btn-press hover:border-white"><i className="fas fa-chevron-down"></i></button>
           </div>
           <div className="flex items-center flex-wrap gap-2 text-xs mt-3 text-zinc-300">
              <span className="font-bold text-green-500">{(movie.vote_average * 10).toFixed(0)}% {t('match')}</span>
              <span className='px-1.5 py-0.5 border border-white/40 text-[10px] rounded'>U/A 16+</span>
              <span className="whitespace-nowrap">{type === 'tv' ? '4 Seasons' : '2h 15m'}</span>
              <span className='px-1.5 py-0.5 border border-white/40 text-[10px] rounded'>HD</span>
           </div>
            <div className="flex items-center gap-2 text-xs mt-2 text-zinc-200">
                <span>Sci-Fi TV</span>
                <span className="text-zinc-600 text-[6px]">&#9679;</span>
                <span>Teen TV Shows</span>
                <span className="text-zinc-600 text-[6px]">&#9679;</span>
                <span>Horror</span>
            </div>
        </div>
        {isRecentlyAdded && (
            <div className="absolute top-2 right-2">
                <span className="px-2 py-1 text-xs font-bold text-white bg-red-600 rounded-sm shadow-md whitespace-nowrap">
                    {t('recentlyAdded')}
                </span>
            </div>
        )}
      </div>
      <div className={`absolute -bottom-10 left-2 right-2 text-left transition-all duration-300 ease-in-out ${isFocused ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <p className="text-sm font-semibold text-white truncate drop-shadow-lg">
              {movie.title || movie.name}
          </p>
      </div>
    </div>
  );
};


const ContentRow: React.FC<{ title: string; movies: Movie[]; onCardClick: (movie: Movie) => void; category?: string, isNetflixRow?: boolean, isRecentlyAddedRow?: boolean, zIndex?: number, isContinueWatchingRow?: boolean }> = ({ title, movies, onCardClick, category, isNetflixRow = false, isRecentlyAddedRow = false, zIndex, isContinueWatchingRow = false }) => {
    if (!movies || movies.length === 0) return null;
    
    const [isRowActive, setIsRowActive] = useState(false);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const rowContentRef = useRef<HTMLDivElement>(null);

    const rowRef = useRef<HTMLDivElement>(null);
    const [isInView, setIsInView] = useState(false);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsInView(true);
                    observer.unobserve(entry.target);
                }
            },
            {
                root: null,
                rootMargin: '0px',
                threshold: 0.1
            }
        );

        const currentRef = rowRef.current;
        if (currentRef) {
            observer.observe(currentRef);
        }

        return () => {
            if (currentRef) {
                observer.unobserve(currentRef);
            }
        };
    }, []);

    const handleCardFocus = useCallback((cardElement: HTMLElement) => {
        if (!scrollContainerRef.current || !rowContentRef.current) return;

        const containerWidth = scrollContainerRef.current.clientWidth;
        const contentWidth = rowContentRef.current.scrollWidth;
        const padding = 24; // from px-6

        let targetScroll = cardElement.offsetLeft - padding;

        const maxScroll = contentWidth - containerWidth;
        if (targetScroll > maxScroll) {
            targetScroll = maxScroll;
        }

        if (targetScroll < 0) {
            targetScroll = 0;
        }

        if (rowContentRef.current) {
            rowContentRef.current.style.transform = `translateX(${-targetScroll}px)`;
        }
    }, []);


    return (
        <div 
            ref={rowRef}
            className={`content-row ${isInView ? 'is-in-view' : ''}`}
            style={{ zIndex }}
            onFocus={() => setIsRowActive(true)}
            onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setIsRowActive(false);
                }
            }}
        >
            <div className="flex items-baseline justify-between mb-3 px-6">
                 <h2 className={`text-lg md:text-xl font-bold text-white transition-all duration-300 ease-out origin-left ${isRowActive ? 'scale-100' : 'scale-90 text-zinc-400'}`}>{title}</h2>
            </div>
            <div ref={scrollContainerRef} className="overflow-x-hidden no-scrollbar py-32 -my-32">
                <div
                    ref={rowContentRef}
                    className="flex flex-nowrap gap-x-6 px-6"
                    style={{
                        transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                        willChange: 'transform'
                    }}
                >
                    {movies.map((movie, index) => <PosterCard key={`${category || 'carousel'}-${movie.id}`} movie={movie} onCardClick={onCardClick} isNetflixOriginal={isNetflixRow} isRecentlyAdded={isRecentlyAddedRow} onCardFocus={handleCardFocus} index={index} isContinueWatching={isContinueWatchingRow} />)}
                </div>
            </div>
        </div>
    );
};

const SimpleBackdropCard: React.FC<{ movie: Movie; onCardClick: (movie: Movie) => void; }> = ({ movie, onCardClick }) => {
    if (!movie.backdrop_path) return null;
    return (
        <div 
            className="flex-shrink-0 w-[24vw] sm:w-[18vw] min-w-[200px] max-w-[280px] cursor-pointer group focusable"
            onClick={() => onCardClick(movie)}
            onKeyDown={(e) => e.key === 'Enter' && onCardClick(movie)}
            tabIndex={0}
        >
            <div className="relative overflow-hidden transition-all duration-300 ease-in-out transform rounded-md shadow-lg bg-[var(--surface)] group-hover:scale-105 group-hover:shadow-2xl">
                <img
                  src={`${IMAGE_BASE_URL}${BACKDROP_SIZE_MEDIUM}${movie.backdrop_path}`}
                  alt={movie.title || movie.name}
                  className="object-cover w-full aspect-video"
                  loading="lazy"
                />
                 <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <i className="fas fa-play text-white text-3xl drop-shadow-lg"></i>
                </div>
            </div>
        </div>
    );
};

const SimpleContentRow: React.FC<{ movies: Movie[]; onCardClick: (movie: Movie) => void; }> = ({ movies, onCardClick }) => {
    if (!movies || movies.length === 0) return null;
    return (
        <div className="overflow-x-auto no-scrollbar">
            <div className="flex flex-nowrap gap-x-6">
                {movies.map(movie => <SimpleBackdropCard key={`simple-${movie.id}`} movie={movie} onCardClick={onCardClick} />)}
            </div>
        </div>
    );
};


const TopTenCard: React.FC<{ movie: Movie; rank: number; onCardClick: (movie: Movie) => void; index: number; }> = ({ movie, rank, onCardClick, index }) => {
  if (!movie.poster_path) return null;

  return (
    <div
      className="flex-shrink-0 w-52 flex items-center group cursor-pointer"
      onClick={() => onCardClick(movie)}
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <span
        className="text-[12rem] font-black text-[#262626] -mr-8 transition-colors duration-300 group-hover:text-zinc-700"
        style={{ fontFamily: "'Anton', sans-serif", lineHeight: 1, textShadow: '0 0 1px #000, 0 0 1px #000, 0 0 1px #000, 0 0 1px #000' }}
      >
        {rank}
      </span>
      <div 
        className="w-36 flex-shrink-0 relative transition-transform duration-300 transform focusable top-ten-card-focusable"
        onClick={(e) => { e.stopPropagation(); onCardClick(movie); }}
        onKeyDown={(e) => e.key === 'Enter' && onCardClick(movie)}
        tabIndex={0}
      >
        <img
          src={`${IMAGE_BASE_URL}${POSTER_SIZE}${movie.poster_path}`}
          alt={movie.title || movie.name}
          className="w-full aspect-[2/3] object-cover rounded-lg shadow-lg"
          loading="lazy"
        />
      </div>
    </div>
  );
};

const TopTenRow: React.FC<{ title: string; movies: Movie[]; onCardClick: (movie: Movie) => void; zIndex?: number }> = ({ title, movies, onCardClick, zIndex }) => {
    if (!movies || movies.length === 0) return null;

    const rowRef = useRef<HTMLDivElement>(null);
    const [isInView, setIsInView] = useState(false);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsInView(true);
                    observer.unobserve(entry.target);
                }
            },
            {
                root: null,
                rootMargin: '0px',
                threshold: 0.1
            }
        );

        const currentRef = rowRef.current;
        if (currentRef) {
            observer.observe(currentRef);
        }

        return () => {
            if (currentRef) {
                observer.unobserve(currentRef);
            }
        };
    }, []);

    return (
        <div ref={rowRef} className={`top-ten-row ${isInView ? 'is-in-view' : ''}`} style={{ zIndex }}>
            <div className="flex items-baseline justify-between mb-3">
                <h2 className="text-lg md:text-xl font-bold text-white">{title}</h2>
            </div>
            <div className="overflow-x-auto no-scrollbar py-2">
                <div className="flex flex-nowrap items-center gap-x-6">
                    {movies.map((movie, index) => (
                        <TopTenCard key={`top10-${movie.id}`} movie={movie} rank={index + 1} onCardClick={onCardClick} index={index} />
                    ))}
                </div>
            </div>
        </div>
    );
};


const SkeletonLoader: React.FC = () => (
    <div className="px-4 md:px-10">
        <div className="relative w-full h-[70vh] min-h-[500px] bg-[var(--surface)] skeleton rounded-xl" />
        <div className="relative z-10 space-y-8 mt-8">
            {[...Array(9)].map((_, rowIndex) => (
                <div key={rowIndex}>
                    <div className="w-1/3 h-8 mb-4 bg-zinc-800/50 rounded-lg skeleton"></div>
                    <div className="flex gap-x-2">
                        {[...Array(7)].map((_, i) => (
                            <div key={i} className="flex-shrink-0 w-[24vw] min-w-[220px] max-w-[320px]">
                                <div className="w-full aspect-video bg-zinc-800/50 rounded-lg skeleton"></div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    </div>
);

const HomePage: React.FC = () => {
    const [data, setData] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const { isKidsMode, activeProfile, setModalItem, getScreenSpecificData } = useProfile();
  const { t } = useTranslation();

  const handleOpenModal = (item: Movie) => {
    setModalItem(item);
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const filterWithBackdrop = (results: any[]) => (results || []).filter((item: Movie) => item.backdrop_path);
        
        let fetchedData;

        if (isKidsMode) {
            // Fetch kid-friendly content
            const heroMovieId = 1022789; // The Super Mario Bros. Movie
            const [
                heroRes,
                kidsFavoritesRes,
                animatedAdventuresRes,
                familyMoviesRes,
                disneyMagicRes,
            ] = await Promise.all([
                fetchFromTMDB(`/movie/${heroMovieId}`),
                fetchFromTMDB('/discover/movie', { sort_by: 'popularity.desc', with_genres: '10751,16', 'certification_country': 'US', 'certification.lte': 'PG' }),
                fetchFromTMDB('/discover/tv', { with_genres: '16', sort_by: 'popularity.desc' }),
                fetchFromTMDB('/discover/movie', { with_genres: '10751', sort_by: 'popularity.desc' }),
                fetchFromTMDB('/discover/movie', { with_companies: '2', sort_by: 'popularity.desc' }), // Disney
            ]);
            
            fetchedData = {
                hero: heroRes,
                kidsFavorites: filterWithBackdrop(kidsFavoritesRes.results),
                animatedAdventures: filterWithBackdrop(animatedAdventuresRes.results),
                familyMovies: filterWithBackdrop(familyMoviesRes.results),
                disneyMagic: filterWithBackdrop(disneyMagicRes.results),
            };

        } else {
            // Fetch regular content
            const heroMovieId = 93405; // Squid Game series ID
            const [
                heroRes,
                trendingRes,
                topRatedMoviesRes,
                popularMoviesRes,
                upcomingMoviesRes,
                popularTvRes,
                netflixOriginalsRes,
                watchTogetherKidsRes,
                tvDramasRes,
                topTenRes,
            ] = await Promise.all([
              fetchFromTMDB(`/tv/${heroMovieId}`),
              fetchFromTMDB('/trending/all/week'),
              fetchFromTMDB('/movie/top_rated'),
              fetchFromTMDB('/movie/popular'),
              fetchFromTMDB('/movie/upcoming'),
              fetchFromTMDB('/tv/popular'),
              fetchFromTMDB('/discover/tv', { with_networks: '213' }),
              fetchFromTMDB('/discover/movie', { with_genres: '10751', 'certification_country': 'US', 'certification.lte': 'PG-13', sort_by: 'popularity.desc' }),
              fetchFromTMDB('/discover/tv', { with_genres: '18', sort_by: 'popularity.desc' }),
              fetchFromTMDB('/trending/all/day'),
            ]);

            fetchedData = {
                hero: heroRes,
                trending: filterWithBackdrop(trendingRes.results),
                topRatedMovies: filterWithBackdrop(topRatedMoviesRes.results),
                popularMovies: filterWithBackdrop(popularMoviesRes.results),
                upcomingMovies: filterWithBackdrop(upcomingMoviesRes.results),
                popularTv: filterWithBackdrop(popularTvRes.results),
                netflixOriginals: filterWithBackdrop(netflixOriginalsRes.results),
                watchTogetherKids: filterWithBackdrop(watchTogetherKidsRes.results),
                tvDramas: filterWithBackdrop(tvDramasRes.results),
                topTen: (topTenRes.results || []).filter((item: Movie) => item.poster_path).slice(0, 10),
            };
        }

        const history = getScreenSpecificData('history', []);
        const continueWatchingItems = history.map((h: HistoryItem) => ({
            id: h.id, media_type: h.type, title: h.title, name: h.title,
            backdrop_path: h.itemImage.replace(`${IMAGE_BASE_URL}${BACKDROP_SIZE_MEDIUM}`, ''),
            poster_path: '', overview: '', vote_average: 0, vote_count: 0,
            currentTime: h.currentTime, duration: h.duration,
        }));
        
        setData({
          ...fetchedData,
          continueWatching: continueWatchingItems,
        });
        
      } catch (error) {
        console.error("Failed to fetch home page data:", error);
      } finally {
        setLoading(false);
      }
    };

    if (activeProfile) {
        fetchData();
    }
  }, [isKidsMode, activeProfile, getScreenSpecificData]);
  
  return (
    <Layout>
      {loading ? (
        <SkeletonLoader />
      ) : (
        <div className="px-4 md:px-10 pt-24">
          {isKidsMode ? (
            <>
                <Hero movie={data.hero} isKids={isKidsMode} />
                <div className="relative z-10 mt-8">
                  <ContentRow title={t('kidsFavorites')} movies={data.kidsFavorites} onCardClick={handleOpenModal} zIndex={12} />
                  {data.continueWatching?.length > 0 && <ContentRow title={t('continueWatching')} movies={data.continueWatching} onCardClick={handleOpenModal} isContinueWatchingRow={true} zIndex={10} />}
                  <ContentRow title={t('animatedAdventures')} movies={data.animatedAdventures} onCardClick={handleOpenModal} zIndex={11} />
                  <ContentRow title={t('familyMovies')} movies={data.familyMovies} onCardClick={handleOpenModal} zIndex={9} />
                  <ContentRow title={t('disneyMagic')} movies={data.disneyMagic} onCardClick={handleOpenModal} zIndex={8} />
                </div>
            </>
          ) : (  
            <>
                <Hero movie={data.hero} isKids={isKidsMode} />
                <div className="relative z-10 mt-12 space-y-20">
                  <ContentRow title={t('yourNextWatch')} movies={(data.watchTogetherKids || []).slice(0, 10)} onCardClick={handleOpenModal} category="your_next_watch" />
                  <ContentRow title={t('tvDramas')} movies={data.tvDramas} onCardClick={handleOpenModal} category="tv_dramas" zIndex={11} />
                  {data.continueWatching?.length > 0 && <ContentRow title={t('continueWatching')} movies={data.continueWatching} onCardClick={handleOpenModal} category="continue_watching" isContinueWatchingRow={true} zIndex={10} />}
                  <TopTenRow title={t('top10Today')} movies={data.topTen} onCardClick={handleOpenModal} zIndex={9} />
                  <ContentRow title={t('trendingThisWeek')} movies={data.trending} onCardClick={handleOpenModal} category="trending" zIndex={8} />
                  <ContentRow title={t('netflixOriginals')} movies={data.netflixOriginals} onCardClick={handleOpenModal} category="netflix_originals" isNetflixRow zIndex={7} />
                  <ContentRow title={t('popularMovies')} movies={data.popularMovies} onCardClick={handleOpenModal} category="popular_movies" zIndex={6} />
                  <ContentRow title={t('topRated')} movies={data.topRatedMovies} onCardClick={handleOpenModal} category="top_rated_movies" zIndex={5} />
                  <ContentRow title={t('recentlyAdded')} movies={data.upcomingMovies} onCardClick={handleOpenModal} category="upcoming_movies" isRecentlyAddedRow zIndex={4} />
                  <ContentRow title={t('popularSeries')} movies={data.popularTv} onCardClick={handleOpenModal} category="popular_tv" zIndex={3} />
                </div>
            </>
          )}
        </div>
      )}
    </Layout>
  );
};

export default HomePage;
