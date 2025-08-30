import React, { useEffect, useState, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useProfile } from '../contexts/ProfileContext';
import { fetchFromTMDB } from '../services/apiService';
import { Movie, Episode, Season } from '../types';
import { useTranslation } from '../contexts/LanguageContext';
import { IMAGE_BASE_URL, BACKDROP_SIZE, BACKDROP_SIZE_MEDIUM } from '../contexts/constants';

export const ToastContainer: React.FC = () => {
  const { toast, setToast } = useProfile();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (toast) {
      setShow(true);
      const timer = setTimeout(() => {
        setShow(false);
        // Allow animation to finish before clearing toast data
        setTimeout(() => setToast(null), 300);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [toast, setToast]);

  if (!toast) {
    return null;
  }

  const baseStyle = "fixed bottom-20 md:top-20 md:bottom-auto left-1/2 -translate-x-1/2 px-6 py-3 rounded-full text-white text-sm font-semibold shadow-lg z-50 transition-all duration-300 ease-out flex items-center gap-2";
  const typeStyles = {
    success: "bg-green-500",
    error: "bg-red-500",
    info: "bg-blue-500",
  };
  const visibilityStyle = show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10';

  return (
    <div className={`${baseStyle} ${typeStyles[toast.type]} ${visibilityStyle} glassmorphic-panel !bg-opacity-100`}>
      <i className={`fa-solid ${toast.type === 'success' ? 'fa-check-circle' : (toast.type === 'error' ? 'fa-exclamation-triangle' : 'fa-info-circle')}`}></i>
      {toast.message}
    </div>
  );
};

export const useToast = () => {
    const { setToast } = useProfile();
    return setToast;
}

const RecommendationCard: React.FC<{ item: Movie }> = ({ item }) => {
    const { setModalItem } = useProfile();
    const { t } = useTranslation();
    const { toggleFavorite } = useProfile();

    const handleCardClick = () => {
        setModalItem(item);
    };
    
    const handleAddToList = (e: React.MouseEvent) => {
        e.stopPropagation();
        toggleFavorite(item);
    }

    if (!item.backdrop_path) return null;

    return (
        <div className="bg-[var(--surface)] rounded-sm overflow-hidden cursor-pointer group shadow-lg" onClick={handleCardClick}>
            <div className="relative">
                <img
                    src={`${IMAGE_BASE_URL}${BACKDROP_SIZE_MEDIUM}${item.backdrop_path}`}
                    alt={item.title || item.name}
                    className="w-full aspect-video object-cover"
                    loading="lazy"
                />
                 <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <i className="fas fa-play text-white text-3xl drop-shadow-lg"></i>
                </div>
            </div>
            <div className="p-4">
                <div className="flex justify-between items-start">
                    <div>
                        <div className="flex items-center gap-2 text-xs mb-1">
                            <span className="font-bold text-green-500">{(item.vote_average * 10).toFixed(0)}% {t('match')}</span>
                            <span className="text-zinc-400">{item.release_date?.substring(0, 4) || item.first_air_date?.substring(0, 4)}</span>
                        </div>
                        <span className='px-1.5 py-0.5 border border-white/50 text-[10px] rounded'>HD</span>
                    </div>
                    <button onClick={handleAddToList} className="w-9 h-9 flex-shrink-0 flex items-center justify-center text-white border-2 border-zinc-500 rounded-full text-sm btn-press hover:border-white"><i className="fas fa-plus"></i></button>
                </div>
                <p className="text-xs text-zinc-300 mt-3 line-clamp-3 leading-relaxed">{item.overview}</p>
            </div>
        </div>
    );
};

export const DetailsModal: React.FC<{ item: Movie, onClose: () => void }> = ({ item, onClose }) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { isFavorite, toggleFavorite, setToast } = useProfile();
    const [details, setDetails] = useState<Movie | null>(null);
    const [loading, setLoading] = useState(true);
    const [episodes, setEpisodes] = useState<Episode[]>([]);
    const [selectedSeason, setSelectedSeason] = useState<number>(1);
    const [animationState, setAnimationState] = useState<'entering' | 'exiting' | 'visible'>('entering');
    const [isExpanded, setIsExpanded] = useState(false);

    const type = item.media_type || (item.title ? 'movie' : 'tv');

    useEffect(() => {
        document.body.classList.add('modal-open');
        return () => {
            document.body.classList.remove('modal-open');
        };
    }, []);

    const handleClose = useCallback(() => {
        setAnimationState('exiting');
    }, []);

    const handleAnimationEnd = () => {
        if (animationState === 'exiting') {
            onClose();
        }
    };

    useEffect(() => {
        const fetchDetails = async () => {
            setLoading(true);
            try {
                const data = await fetchFromTMDB(`/${type}/${item.id}`, {
                    append_to_response: 'videos,credits,recommendations,content_ratings',
                });
                setDetails(data);
                if (type === 'tv' && data.seasons && data.seasons.length > 0) {
                    const firstValidSeason = data.seasons.find((s: Season) => s.season_number > 0 && s.episode_count > 0);
                    if (firstValidSeason) {
                        setSelectedSeason(firstValidSeason.season_number);
                        fetchEpisodes(item.id, firstValidSeason.season_number);
                    }
                }
            } catch (error) {
                console.error("Failed to fetch modal details", error);
                setToast({ message: t('failedToLoadDetails'), type: 'error' });
                handleClose();
            } finally {
                setLoading(false);
            }
        };

        fetchDetails();
    }, [item.id, type, t, setToast, handleClose]);

    const fetchEpisodes = async (tvId: number, seasonNumber: number) => {
        try {
            const data = await fetchFromTMDB(`/tv/${tvId}/season/${seasonNumber}`);
            setEpisodes(data.episodes);
            setSelectedSeason(seasonNumber);
        } catch (error) {
            console.error(`Failed to fetch episodes for season ${seasonNumber}`, error);
            setToast({ message: t('failedToLoadEpisodes'), type: 'error' });
        }
    };

    const handlePlay = () => {
        onClose();
        navigate('/player', { state: { item: details, type, season: selectedSeason, episode: null } });
    };

    const handleEpisodePlay = (episode: Episode) => {
        onClose();
        navigate('/player', { state: { item: details, type, season: selectedSeason, episode } });
    };

    const isFav = details ? isFavorite(details.id) : false;

    return ReactDOM.createPortal(
        <div className={`details-modal-backdrop ${animationState === 'exiting' ? 'exiting' : ''}`} onClick={handleClose}>
            <div
                className={`details-modal-content ${isExpanded ? 'expanded' : ''} ${animationState === 'exiting' ? 'exiting' : ''}`}
                onClick={(e) => e.stopPropagation()}
                onAnimationEnd={handleAnimationEnd}
            >
                {loading || !details ? (
                    <div className="flex items-center justify-center h-full bg-[var(--background)]">
                        <div className="w-16 h-16 border-4 border-t-transparent border-[var(--primary)] rounded-full animate-spin"></div>
                    </div>
                ) : (
                    <>
                        <div className="absolute top-4 right-4 z-20 flex gap-2">
                           <button onClick={() => setIsExpanded(!isExpanded)} className="w-9 h-9 flex items-center justify-center bg-black/60 rounded-full text-white text-lg btn-press">
                                <i className={`fas ${isExpanded ? 'fa-compress' : 'fa-expand'}`}></i>
                            </button>
                            <button onClick={handleClose} className="w-9 h-9 flex items-center justify-center bg-black/60 rounded-full text-white text-xl btn-press">
                                <i className="fas fa-times"></i>
                            </button>
                        </div>
                        <div className="w-full h-full overflow-y-auto no-scrollbar">
                            <div className="relative w-full h-[56.25%] min-h-[250px] md:min-h-[400px]">
                                <img
                                    src={`${IMAGE_BASE_URL}${BACKDROP_SIZE}${details.backdrop_path}`}
                                    alt={details.title || details.name}
                                    className="absolute inset-0 object-cover w-full h-full"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-[var(--background)] via-[var(--background)]/70 to-transparent"></div>
                                <div className="absolute bottom-8 left-8 z-10">
                                    <h1 className="text-4xl font-black text-white" style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.7)' }}>{details.title || details.name}</h1>
                                    <div className="flex items-center gap-3 mt-4">
                                        <button onClick={handlePlay} className="px-6 py-2 text-lg font-bold text-black bg-white rounded-md hover:bg-opacity-80 flex items-center justify-center gap-2 btn-press">
                                            <i className="fas fa-play"></i><span>{t('play')}</span>
                                        </button>
                                        <button onClick={() => toggleFavorite(details)} className={`w-11 h-11 flex items-center justify-center rounded-full border-2 border-zinc-400 text-white text-xl btn-press hover:border-white`}>
                                            <i className={`fas ${isFav ? 'fa-check' : 'fa-plus'}`}></i>
                                        </button>
                                        <button className="w-11 h-11 flex items-center justify-center rounded-full border-2 border-zinc-400 text-white text-xl btn-press hover:border-white">
                                            <i className="far fa-thumbs-up"></i>
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <div className="p-8">
                                <div className="grid grid-cols-3 gap-8">
                                    <div className="col-span-2">
                                        <div className="flex items-center gap-2 text-sm">
                                            <span className="font-bold text-green-500">{(details.vote_average * 10).toFixed(0)}% {t('match')}</span>
                                            <span className="text-zinc-400">{details.release_date?.substring(0, 4) || details.first_air_date?.substring(0, 4)}</span>
                                            {details.runtime && <span className="text-zinc-400">{Math.floor(details.runtime/60)}{t('hoursShort')} {details.runtime%60}{t('minutesShort')}</span>}
                                            <span className="px-1.5 py-0.5 border border-white/50 text-xs rounded">HD</span>
                                        </div>
                                        <p className="mt-4 text-sm text-white leading-relaxed">{details.overview}</p>
                                    </div>
                                    <div className="text-xs space-y-2">
                                        <p><span className="text-zinc-500">{t('cast')}: </span>{details.credits?.cast.slice(0, 3).map(c => c.name).join(', ')}, ...</p>
                                        <p><span className="text-zinc-500">{t('genres')}: </span>{details.genres?.map(g => g.name).join(', ')}</p>
                                    </div>
                                </div>
                                
                                {type === 'tv' && details.seasons && details.seasons.filter(s => s.season_number > 0).length > 0 && (
                                    <div className="mt-8">
                                        <div className="flex items-center justify-between mb-4">
                                            <h2 className="text-2xl font-bold">{t('episodes')}</h2>
                                            <select 
                                                value={selectedSeason}
                                                onChange={(e) => fetchEpisodes(details.id, parseInt(e.target.value))}
                                                className="px-4 py-2 text-white bg-zinc-800 border border-zinc-700 rounded-md appearance-none text-sm focus:outline-none focus:ring-1 focus:ring-white"
                                            >
                                            {details.seasons?.filter(s => s.season_number > 0 && s.episode_count > 0).map(season => (
                                                <option key={season.id} value={season.season_number}>
                                                    {t('season')} {season.season_number}
                                                </option>
                                            ))}
                                            </select>
                                        </div>
                                        <div className="flex flex-col gap-4 max-h-80 overflow-y-auto pr-2">
                                        {episodes.map((episode) => (
                                            <div key={episode.id} className="flex items-center gap-4 p-2 rounded-md cursor-pointer hover:bg-zinc-800" onClick={() => handleEpisodePlay(episode)}>
                                            <span className="text-xl text-zinc-400 font-bold">{episode.episode_number}</span>
                                            <div className="relative flex-shrink-0 w-36 h-20 overflow-hidden rounded-sm">
                                                <img src={episode.still_path ? `${IMAGE_BASE_URL}w300${episode.still_path}` : `${IMAGE_BASE_URL}${BACKDROP_SIZE_MEDIUM}${details.backdrop_path}`} alt={episode.name} className="object-cover w-full h-full" />
                                            </div>
                                            <div className="flex-1">
                                                <h4 className="font-semibold text-sm">{episode.name}</h4>
                                                <p className="text-xs text-zinc-400 line-clamp-2 mt-1">{episode.overview}</p>
                                            </div>
                                            </div>
                                        ))}
                                        </div>
                                    </div>
                                )}

                                {details.recommendations?.results && details.recommendations.results.length > 0 && (
                                    <div className="mt-10">
                                        <h2 className="text-2xl font-bold mb-4">{t('similar')}</h2>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                            {details.recommendations.results.filter(r => r.backdrop_path).slice(0, 9).map(rec => (
                                                <RecommendationCard key={rec.id} item={rec} />
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>,
        document.body
    );
};

// New component for TV remote control cursor
export const TVCursor: React.FC<{
  position: { x: number; y: number };
  visible: boolean;
  clickEffect: boolean;
}> = ({ position, visible, clickEffect }) => {
  if (!visible) {
    return null;
  }

  const cursorStyle: React.CSSProperties = {
    position: 'fixed',
    left: `${position.x}px`,
    top: `${position.y}px`,
    width: '32px',
    height: '32px',
    border: '3px solid white',
    borderRadius: '50%',
    transform: 'translate(-50%, -50%)',
    pointerEvents: 'none',
    zIndex: 99999,
    mixBlendMode: 'difference',
    transition: 'transform 0.05s linear, border-color 0.2s',
  };
  
  const rippleStyle: React.CSSProperties = {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: '100%',
    height: '100%',
    border: '3px solid white',
    borderRadius: '50%',
    transform: 'translate(-50%, -50%) scale(0)',
    opacity: 0.5,
  };
  
  return (
    <div style={cursorStyle}>
        {clickEffect && <div style={rippleStyle} className="animate-ripple"></div>}
    </div>
  );
};

export const CustomSelect: React.FC<{
    options: { value: string; label: string }[];
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    className?: string;
}> = ({ options, value, onChange, placeholder, className = '' }) => {
    const [isOpen, setIsOpen] = useState(false);
    const selectRef = useRef<HTMLDivElement>(null);
    const selectedLabel = options.find(opt => opt.value === value)?.label || placeholder;

    const handleSelect = (newValue: string) => {
        onChange(newValue);
        setIsOpen(false);
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className={`relative ${className}`} ref={selectRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="bg-[var(--surface)] border border-[var(--border)] text-white text-sm rounded-md focus:ring-[var(--primary)] focus:border-[var(--primary)] w-full p-2.5 flex justify-between items-center"
            >
                <span>{selectedLabel}</span>
                <i className={`fas fa-chevron-down transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}></i>
            </button>
            {isOpen && (
                <div className="absolute z-10 top-full mt-1 w-full bg-[var(--surface)] border border-[var(--border)] rounded-md shadow-lg max-h-60 overflow-y-auto">
                    <ul>
                        <li
                            className={`p-2.5 text-sm cursor-pointer hover:bg-[var(--primary)] ${!value ? 'bg-[var(--primary)]/50' : ''}`}
                            onClick={() => handleSelect('')}
                        >
                            {placeholder}
                        </li>
                        {options.map(option => (
                            <li
                                key={option.value}
                                onClick={() => handleSelect(option.value)}
                                className={`p-2.5 text-sm cursor-pointer hover:bg-[var(--primary)] ${value === option.value ? 'bg-[var(--primary)]/50' : ''}`}
                            >
                                {option.label}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};
