import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import VideoPlayer from '../components/Player';
import { Movie, Episode, Season, HistoryItem } from '../types';
import { fetchFromTMDB } from '../services/apiService';
import { useProfile } from '../contexts/ProfileContext';
import { useTranslation } from '../contexts/LanguageContext';
import { usePlayer, PipData } from '../contexts/PlayerContext';
import { IMAGE_BASE_URL, BACKDROP_SIZE_MEDIUM } from '../contexts/constants';

const PlayerPage: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { item: initialItem, type, season: initialSeason, episode: initialEpisode, currentTime, streamUrl } = location.state || {};
    const { setToast, updateHistory, getScreenSpecificData } = useProfile();
    const { t } = useTranslation();
    const { setPipData, setPipAnchor } = usePlayer();

    const [item, setItem] = useState<Movie | null>(initialItem);
    const [currentSeason, setCurrentSeason] = useState<number | undefined>(initialSeason);
    const [currentEpisode, setCurrentEpisode] = useState<Episode | null>(initialEpisode);
    const [episodes, setEpisodes] = useState<Episode[]>([]);
    const [loading, setLoading] = useState(true);
    
    const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
    const [isFetchingStream, setIsFetchingStream] = useState(true);

    const [videoNode, setVideoNode] = useState<HTMLVideoElement | null>(null);

    const handleProviderSelected = useCallback((providerName: string) => {
        if (!selectedProvider) {
            setSelectedProvider(providerName);
        }
    }, [selectedProvider]);

    const handleStreamFetchStateChange = useCallback((isFetching: boolean) => {
        setIsFetchingStream(isFetching);
    }, []);

    useEffect(() => {
        setPipData(null); // Clear any existing PiP when the main player opens

        if (!initialItem) {
            navigate('/home', { replace: true });
            return;
        }

        const fetchAllData = async () => {
            setLoading(true);
            try {
                // Fetch full details if not already passed (e.g., from a minimal card click)
                const data = streamUrl ? initialItem : await fetchFromTMDB(`/${type}/${initialItem.id}`, { append_to_response: 'seasons' });
                setItem(data);
                
                if (type === 'tv') {
                    // When a new item is loaded, use its initialSeason prop, not the previous item's state.
                    const seasonToFetch = initialSeason || (data.seasons?.find((s: Season) => s.season_number > 0 && s.episode_count > 0)?.season_number ?? 1);
                    setCurrentSeason(seasonToFetch);
                    if (data.id && seasonToFetch) {
                        const seasonData = await fetchFromTMDB(`/tv/${data.id}/season/${seasonToFetch}`);
                        setEpisodes(seasonData.episodes);
                        // Similarly, use initialEpisode prop. If it's not present (e.g. clicking on a series card), default to first episode.
                        if (!initialEpisode) {
                           const firstEpisode = seasonData.episodes.find((ep: Episode) => ep.episode_number > 0) || seasonData.episodes[0];
                           setCurrentEpisode(firstEpisode);
                        } else {
                           setCurrentEpisode(initialEpisode);
                        }
                    }
                } else {
                    // When loading a movie, ensure any TV show state is cleared.
                    setCurrentSeason(undefined);
                    setCurrentEpisode(null);
                    setEpisodes([]);
                }
            } catch (error) {
                console.error("Failed to fetch player page data:", error);
                setToast({ message: t('failedToLoadDetails'), type: 'error' });
            } finally {
                setLoading(false);
            }
        };

        fetchAllData();

    }, [initialItem?.id, type, initialSeason, initialEpisode, streamUrl, navigate, setPipData, setToast, t]);
    
     useEffect(() => {
        const video = videoNode;
        return () => {
            if (video && item && video.duration > 0 && video.currentTime > 0) {
                const progress = (video.currentTime / video.duration) * 100;
                if (progress > 5 && progress < 95) { // Only save meaningful progress
                    const historyItem: HistoryItem = {
                        id: item.id,
                        type: type as 'movie' | 'tv',
                        title: currentEpisode ? `${item.name}: S${currentSeason}E${currentEpisode.episode_number}` : (item.name || item.title) as string,
                        itemImage: item.backdrop_path ? `${IMAGE_BASE_URL}${BACKDROP_SIZE_MEDIUM}${item.backdrop_path}` : '',
                        currentTime: video.currentTime,
                        duration: video.duration,
                        timestamp: Date.now(),
                        episodeId: currentEpisode?.id,
                    };
                    updateHistory(historyItem);
                }
            }
        };
    }, [videoNode, item, type, currentSeason, currentEpisode, updateHistory]);

    const handleEpisodeSelect = (episode: Episode) => {
        setCurrentEpisode(episode);
    };
    
    const handleEnterPip = (url: string, time: number, playing: boolean, dimensions: DOMRect) => {
        if (!item) return;
        const pipState: PipData = {
            item,
            type: type as 'movie' | 'tv',
            season: currentSeason,
            episode: currentEpisode ?? undefined,
            currentTime: time,
            isPlaying: playing,
            streamUrl: url,
        };
        setPipAnchor({
            top: dimensions.top,
            left: dimensions.left,
            width: dimensions.width,
            height: dimensions.height,
        });
        setPipData(pipState);
        navigate(-1);
    };
    
    if (loading || !item) {
        return <div className="flex items-center justify-center h-screen w-screen bg-black"><div className="w-16 h-16 border-4 border-t-transparent border-[var(--primary)] rounded-full animate-spin"></div></div>;
    }
    
    return (
        <div className="w-screen h-dvh bg-black">
            <VideoPlayer
                key={item.id + (currentEpisode ? `_${currentEpisode.id}` : '')}
                item={item}
                itemType={type as 'movie' | 'tv'}
                initialSeason={currentSeason}
                initialEpisode={currentEpisode}
                initialTime={currentTime}
                initialStreamUrl={streamUrl}
                onEnterPip={handleEnterPip}
                selectedProvider={selectedProvider}
                onProviderSelected={handleProviderSelected}
                onStreamFetchStateChange={handleStreamFetchStateChange}
                setVideoNode={setVideoNode}
                serverPreferences={getScreenSpecificData('serverPreferences', [])}
                episodes={episodes}
                onEpisodeSelect={handleEpisodeSelect}
            />
        </div>
    );
};

export default PlayerPage;