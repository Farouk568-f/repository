import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Hls from 'hls.js';
import { Movie, Episode, SubtitleTrack, SubtitleSettings, StreamLink } from '../types';
import { useProfile } from '../contexts/ProfileContext';
import { useTranslation } from '../contexts/LanguageContext';
import { fetchStreamUrl } from '../services/apiService';
import * as Icons from './Icons';
import { IMAGE_BASE_URL, BACKDROP_SIZE_MEDIUM } from '../contexts/constants';
import { translateSrtViaGoogle } from '../services/translationService';

interface PlayerProps {
    item: Movie;
    itemType: 'movie' | 'tv';
    initialSeason: number | undefined;
    initialEpisode: Episode | null;
    initialTime?: number;
    initialStreamUrl?: string | null;
    onEnterPip: (streamUrl: string, currentTime: number, isPlaying: boolean, dimensions: DOMRect) => void;
    selectedProvider: string | null;
    onProviderSelected: (provider: string) => void;
    onStreamFetchStateChange: (isFetching: boolean) => void;
    setVideoNode?: (node: HTMLVideoElement | null) => void;
    serverPreferences: string[];
    episodes: Episode[];
    onEpisodeSelect: (episode: Episode) => void;
    isOffline?: boolean;
    downloadId?: string;
}

const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const date = new Date(seconds * 1000);
    const hh = date.getUTCHours();
    const mm = date.getUTCMinutes().toString().padStart(2, '0');
    const ss = date.getUTCSeconds().toString().padStart(2, '0');
    if (hh > 0) return `${hh.toString().padStart(2, '0')}:${mm}:${ss}`;
    return `${mm}:${ss}`;
};

const adjustSrtTime = (time: string, offset: number): string => {
    const match = time.match(/(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/);
    if (!match) return "00:00:00.000";

    const [, hh, mm, ss, ms] = match.map(Number);
    
    let totalMs = (hh * 3600 + mm * 60 + ss) * 1000 + ms;
    totalMs += offset * 1000;
    
    if (totalMs < 0) totalMs = 0;
    
    const newMs = totalMs % 1000;
    let totalSeconds = Math.floor(totalMs / 1000);
    const newSs = totalSeconds % 60;
    totalSeconds = Math.floor(totalSeconds / 60);
    const newMm = totalSeconds % 60;
    const newHh = Math.floor(totalSeconds / 60);
    
    return `${String(newHh).padStart(2, '0')}:${String(newMm).padStart(2, '0')}:${String(newSs).padStart(2, '0')}.${String(newMs).padStart(3, '0')}`;
};

const VideoPlayer: React.FC<PlayerProps> = ({ item, itemType, initialSeason, initialEpisode, initialTime, initialStreamUrl, onProviderSelected, onStreamFetchStateChange, setVideoNode, serverPreferences, episodes, onEpisodeSelect, selectedProvider }) => {
    const navigate = useNavigate();
    const { setToast, getScreenSpecificData, setScreenSpecificData } = useProfile();
    const { t, language: userLanguage } = useTranslation();

    const videoRef = useRef<HTMLVideoElement>(null);
    const playerContainerRef = useRef<HTMLDivElement>(null);
    const progressBarRef = useRef<HTMLDivElement>(null);
    const hlsRef = useRef<Hls.default | null>(null);
    const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastTap = useRef(0);
    const fetchIdRef = useRef(0);
    const timeOnSwitchRef = useRef(0);

    const [streamLinks, setStreamLinks] = useState<StreamLink[]>([]);
    const [activeStreamUrl, setActiveStreamUrl] = useState<string | null>(initialStreamUrl || null);
    const [activeQuality, setActiveQuality] = useState<string | null>(null);
    
    const [isPlaying, setIsPlaying] = useState(false);
    const [isBuffering, setIsBuffering] = useState(true);
    const [showControls, setShowControls] = useState(true);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [currentTime, setCurrentTime] = useState(initialTime || 0);
    const [duration, setDuration] = useState(0);
    const [activePopover, setActivePopover] = useState<'episodes' | 'subtitles' | 'settings' | null>(null);
    const [subtitles, setSubtitles] = useState<SubtitleTrack[]>([]);
    const [vttTracks, setVttTracks] = useState<{ lang: string; url: string; label: string }[]>([]);
    const [activeSubtitleLang, setActiveSubtitleLang] = useState<string | null>(null);
    const [selectedDubLang, setSelectedDubLang] = useState<'ar' | 'fr' | null>(null);
    const [isTranslating, setIsTranslating] = useState(false);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const defaultSubtitleSettings: SubtitleSettings = { fontSize: 100, backgroundOpacity: 0, edgeStyle: 'outline', verticalPosition: 10, timeOffset: 0 };
    const [subtitleSettings, setSubtitleSettings] = useState<SubtitleSettings>(() => getScreenSpecificData('subtitleSettings', defaultSubtitleSettings));
    const [activeCues, setActiveCues] = useState<VTTCue[]>([]);
    
    const combinedRef = useCallback((node: HTMLVideoElement | null) => {
        (videoRef as React.MutableRefObject<HTMLVideoElement | null>).current = node;
        if (setVideoNode) setVideoNode(node);
    }, [setVideoNode]);

    const isPopoverOpen = activePopover !== null;
    const isPopoverOpenRef = useRef(isPopoverOpen);
    isPopoverOpenRef.current = isPopoverOpen;

    const hideControls = useCallback(() => { if (!videoRef.current?.paused && !isPopoverOpenRef.current) { setShowControls(false); setActivePopover(null); } }, []);
    const resetControlsTimeout = useCallback(() => { if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current); setShowControls(true); controlsTimeoutRef.current = setTimeout(hideControls, 5000); }, [hideControls]);

    // Effect 1: Fetch the stream URL and subtitles info
    useEffect(() => {
        if (initialStreamUrl) {
            setActiveStreamUrl(initialStreamUrl);
            return;
        }
        const fetchUrl = async () => {
            const fetchId = ++fetchIdRef.current;
            onStreamFetchStateChange(true);
            setIsBuffering(true);
            setActiveStreamUrl(null);
            setSubtitles([]);
            setVttTracks([]);
            
            try {
                const data = await fetchStreamUrl(item, itemType, initialSeason, initialEpisode?.episode_number, selectedProvider || undefined, serverPreferences, selectedDubLang);
                if (fetchIdRef.current !== fetchId) return;

                if (data.links && data.links.length > 0) {
                    setStreamLinks(data.links);
                    const initialLink = data.links[0];
                    setActiveStreamUrl(initialLink.url);
                    setActiveQuality(initialLink.quality);

                    if (data.subtitles) setSubtitles(data.subtitles);
                    onProviderSelected(data.provider);
                } else {
                    throw new Error(t('noStreamLinks'));
                }
            } catch (error: any) {
                if (fetchIdRef.current === fetchId) {
                    setToast({ message: error.message, type: 'error' });
                }
            } finally {
                if (fetchIdRef.current === fetchId) {
                    onStreamFetchStateChange(false);
                }
            }
        };

        fetchUrl();
    }, [item.id, initialEpisode?.id, selectedProvider, selectedDubLang, serverPreferences.join()]);

    // Effect 2: Play the video as soon as the URL is available
    useEffect(() => {
        const video = videoRef.current;
        if (!video || !activeStreamUrl) {
            setIsBuffering(true);
            return;
        }

        if (hlsRef.current) hlsRef.current.destroy();
        
        video.pause();
        video.removeAttribute('src');
        video.load();

        const savedTime = timeOnSwitchRef.current > 0 ? timeOnSwitchRef.current : (initialTime || 0);
        timeOnSwitchRef.current = 0;

        if (activeStreamUrl.includes('.m3u8')) {
            if (Hls.default.isSupported()) {
                const hls = new Hls.default();
                hlsRef.current = hls;
                hls.loadSource(activeStreamUrl);
                hls.attachMedia(video);
                hls.on(Hls.default.Events.MANIFEST_PARSED, () => {
                    video.currentTime = savedTime;
                    video.play().catch(() => {});
                });
            }
        } else {
            video.src = activeStreamUrl;
            const handleReadyToPlay = () => {
                video.currentTime = savedTime;
                video.play().catch(error => console.warn("Autoplay was prevented.", error));
            };
            video.addEventListener('loadeddata', handleReadyToPlay, { once: true });
        }

        return () => {
            if (hlsRef.current) hlsRef.current.destroy();
            if (video) {
                video.pause();
                video.removeAttribute('src');
                video.load();
            }
        };
    }, [activeStreamUrl]);
    
    // Effect 3: Process subtitles in the background
    useEffect(() => {
        let active = true;
        let createdUrls: string[] = [];
        const processSubtitles = async () => {
            const srtTimestampLineRegex = /(\d{2}:\d{2}:\d{2}[,.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,.]\d{3})/g;
            const processSrtToVtt = (srtText: string) => {
                let vttContent = "WEBVTT\n\n";
                vttContent += srtText.replace(/\r/g, '').replace(srtTimestampLineRegex, (_, s, e) => `${adjustSrtTime(s, 0)} --> ${adjustSrtTime(e, 0)}`);
                const blob = new Blob([vttContent], { type: 'text/vtt' });
                const vttUrl = URL.createObjectURL(blob);
                createdUrls.push(vttUrl);
                return vttUrl;
            };
            const newTracks: { lang: string; url: string; label: string }[] = [];
            for (const sub of subtitles) {
                try {
                    const res = await fetch(sub.url);
                    if (!res.ok || !active) continue;
                    const srtText = await res.text();
                    const vttUrl = processSrtToVtt(srtText);
                    newTracks.push({ lang: sub.language, url: vttUrl, label: sub.display });
                } catch (e) {
                    console.error(`Failed to process subtitle: ${sub.display}`, e);
                }
            }
            if (active) setVttTracks(newTracks);
        };
        if (subtitles.length > 0) processSubtitles(); else setVttTracks([]);
        return () => {
            active = false;
            createdUrls.forEach(url => URL.revokeObjectURL(url));
        }
    }, [subtitles]);

     useEffect(() => {
        const video = videoRef.current;
        if (!video || !video.textTracks) return;

        let activeTrack: TextTrack | null = null;
        const onCueChange = () => {
            if (activeTrack && activeTrack.activeCues) {
                // FIX: Correctly convert TextTrackCueList to VTTCue[]
                setActiveCues(Array.from(activeTrack.activeCues) as VTTCue[]);
            } else {
                setActiveCues([]);
            }
        };

        for (let i = 0; i < video.textTracks.length; i++) {
            const track = video.textTracks[i];
            track.mode = 'hidden'; // Disable native rendering for all tracks
            if (track.language === activeSubtitleLang) {
                activeTrack = track;
            }
        }

        if (activeTrack) {
            onCueChange(); // Get initial cues
            activeTrack.addEventListener('cuechange', onCueChange);
        } else {
            setActiveCues([]);
        }

        return () => {
            if (activeTrack) {
                activeTrack.removeEventListener('cuechange', onCueChange);
            }
        };
    }, [activeSubtitleLang, vttTracks]);

    useEffect(() => {
        if (userLanguage === 'ar' && vttTracks.length > 0) {
            const arabicTrack = vttTracks.find(track => track.lang === 'ar');
            setActiveSubtitleLang(arabicTrack ? 'ar' : null);
        }
    }, [vttTracks, userLanguage]);
    
    // Effect 4: Handle video events to update UI state
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;
        const onPlay = () => setIsPlaying(true);
        const onPause = () => setIsPlaying(false);
        const onTimeUpdate = () => setCurrentTime(video.currentTime);
        const onDurationChange = () => setDuration(video.duration || 0);
        const onWaiting = () => setIsBuffering(true);
        const onPlaying = () => { setIsBuffering(false); resetControlsTimeout(); };
        const onVolumeChange = () => { if (video) { setIsMuted(video.muted); setVolume(video.volume); } };
        const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        video.addEventListener('play', onPlay); video.addEventListener('pause', onPause);
        video.addEventListener('timeupdate', onTimeUpdate); video.addEventListener('durationchange', onDurationChange);
        video.addEventListener('waiting', onWaiting); video.addEventListener('playing', onPlaying);
        video.addEventListener('volumechange', onVolumeChange);
        
        setIsPlaying(!video.paused);
        setCurrentTime(video.currentTime);
        setDuration(video.duration || 0);
        setIsBuffering(video.readyState < 3 && !video.paused);
        
        return () => {
            video.removeEventListener('play', onPlay); video.removeEventListener('pause', onPause);
            video.removeEventListener('timeupdate', onTimeUpdate); video.removeEventListener('durationchange', onDurationChange);
            video.removeEventListener('waiting', onWaiting); video.removeEventListener('playing', onPlaying);
            video.removeEventListener('volumechange', onVolumeChange);
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
        };
    }, [resetControlsTimeout]);

    const togglePlay = useCallback(() => {
        const video = videoRef.current;
        if (!video) return;
        if (video.paused) {
             video.play().catch(e => setToast({ message: t('failedToLoadVideo'), type: "error" }));
        }
        else {
             video.pause();
        }
        resetControlsTimeout();
    }, [resetControlsTimeout, setToast, t]);

    const handleContainerClick = useCallback((e: React.MouseEvent) => {
        const target = e.target as HTMLElement;
        if (target.closest('.controls-bar') || target.closest('.popover-content')) {
            resetControlsTimeout(); return;
        };
        setShowControls(s => !s);
        if(showControls) {
           if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
        } else {
            resetControlsTimeout();
        }
    }, [resetControlsTimeout, showControls]);

    const handleSeek = (forward: boolean) => {
        const video = videoRef.current;
        if (video) video.currentTime += forward ? 10 : -10;
        resetControlsTimeout();
    };

    const handleDoubleTap = (e: React.TouchEvent) => {
        const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
        const tapX = e.touches[0].clientX - rect.left;
        const width = rect.width;
        const now = new Date().getTime();
        if ((now - lastTap.current) < 400) {
            e.preventDefault();
            if (tapX < width / 3) handleSeek(false);
            else if (tapX > (width * 2) / 3) handleSeek(true);
            else togglePlay();
        }
        lastTap.current = now;
    };
    
    const toggleFullscreen = useCallback(() => {
        const elem = playerContainerRef.current;
        if (!elem) return;
        if (!document.fullscreenElement) {
             elem.requestFullscreen().catch(err => console.error(`Fullscreen error: ${err.message}`));
        } else {
             document.exitFullscreen();
        }
        resetControlsTimeout();
    }, [resetControlsTimeout]);

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const video = videoRef.current;
        if (video) {
            const newVolume = parseFloat(e.target.value);
            video.volume = newVolume;
            if (newVolume > 0 && video.muted) video.muted = false;
        }
    };
    
    const toggleMute = useCallback(() => {
        const video = videoRef.current;
        if (video) video.muted = !video.muted;
        resetControlsTimeout();
    }, [resetControlsTimeout]);

    const nextEpisode = useMemo(() => {
        if (!initialEpisode || !episodes || episodes.length === 0) return null;
        const currentIndex = episodes.findIndex(ep => ep.id === initialEpisode.id);
        if (currentIndex > -1 && currentIndex < episodes.length - 1) return episodes[currentIndex + 1];
        return null;
    }, [initialEpisode, episodes]);
    const handlePlayNext = useCallback(() => { if (nextEpisode) onEpisodeSelect(nextEpisode); }, [nextEpisode, onEpisodeSelect]);
    const handleDubLangChange = (lang: 'ar' | 'fr' | null) => { if (lang !== selectedDubLang) { setActiveSubtitleLang(null); setSelectedDubLang(lang); } };
    
    const handleQualityChange = (link: StreamLink) => {
        if (videoRef.current && activeStreamUrl !== link.url) {
            timeOnSwitchRef.current = videoRef.current.currentTime;
            setActiveStreamUrl(link.url);
            setActiveQuality(link.quality);
        }
        setActivePopover(null);
    };

    return (
        <div ref={playerContainerRef} className="player-container-scope relative w-full h-full bg-black flex items-center justify-center overflow-hidden cursor-none" onMouseMove={resetControlsTimeout}>
            <video ref={combinedRef} className="w-full h-full object-contain" playsInline autoPlay preload="metadata" onClick={handleContainerClick} onTouchStart={handleDoubleTap}>
             {vttTracks.map(track => (
                    <track key={track.lang} kind="subtitles" srcLang={track.lang} src={track.url} label={track.label} default={activeSubtitleLang === track.lang} />
                ))}
            </video>
            
            <div 
                className="absolute left-1/2 -translate-x-1/2 w-full max-w-4xl px-4 text-center pointer-events-none z-10 transition-all duration-200"
                style={{
                    bottom: `${subtitleSettings.verticalPosition + (showControls ? 12 : 5)}%`,
                    fontSize: `${subtitleSettings.fontSize / 100 * 1.5}rem`,
                    lineHeight: '1.4',
                }}
            >
                {activeCues.map((cue, i) => (
                    <span
                        key={i}
                        className="py-1 px-3 rounded whitespace-pre-line"
                        style={{
                            color: 'white',
                            backgroundColor: `rgba(0, 0, 0, ${subtitleSettings.backgroundOpacity / 100})`,
                            textShadow: subtitleSettings.edgeStyle === 'drop-shadow' ? '2px 2px 3px rgba(0,0,0,0.8)' : 
                                        subtitleSettings.edgeStyle === 'outline' ? 'rgb(0, 0, 0) 1px 1px 2px, rgb(0, 0, 0) -1px -1px 2px, rgb(0, 0, 0) -1px 1px 2px, rgb(0, 0, 0) 1px -1px 2px' : 'none',
                        }}
                    >
                        {cue.text}
                    </span>
                ))}
            </div>

            {isBuffering && (
                 <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                    <div className="w-16 h-16 border-4 border-zinc-600 border-t-white rounded-full animate-spin"></div>
                </div>
            )}
            
            <Controls
                showControls={showControls} isPlaying={isPlaying} currentTime={currentTime} duration={duration}
                isFullscreen={isFullscreen} togglePlay={togglePlay} handleSeek={handleSeek} toggleFullscreen={toggleFullscreen}
                activePopover={activePopover} setActivePopover={setActivePopover} navigate={navigate} t={t} item={item}
                episode={initialEpisode} season={initialSeason} progressBarRef={progressBarRef} 
                nextEpisode={nextEpisode} handlePlayNext={handlePlayNext} vttTracks={vttTracks} 
                activeSubtitleLang={activeSubtitleLang} handleSubtitleChange={(lang: string | null) => { setActiveSubtitleLang(lang); setActivePopover(null); }}
                isTranslating={isTranslating} episodes={episodes} onEpisodeSelect={onEpisodeSelect} volume={volume} isMuted={isMuted} 
                onVolumeChange={handleVolumeChange} onToggleMute={toggleMute} subtitleSettings={subtitleSettings}
                onUpdateSubtitleSettings={(updater) => { setSubtitleSettings(prev => { const next = updater(prev); setScreenSpecificData('subtitleSettings', next); return next; }); }}
                selectedDubLang={selectedDubLang} handleDubLangChange={handleDubLangChange}
                streamLinks={streamLinks} activeQuality={activeQuality} handleQualityChange={handleQualityChange}
            />
        </div>
    );
};

const Controls: React.FC<any> = ({
    showControls, isPlaying, currentTime, duration, isFullscreen,
    togglePlay, handleSeek, toggleFullscreen,
    activePopover, setActivePopover, navigate, t, item, episode, season, progressBarRef,
    nextEpisode, handlePlayNext,
    vttTracks, activeSubtitleLang, handleSubtitleChange, isTranslating,
    episodes, onEpisodeSelect,
    volume, isMuted, onVolumeChange, onToggleMute,
    subtitleSettings, onUpdateSubtitleSettings,
    selectedDubLang, handleDubLangChange,
    streamLinks, activeQuality, handleQualityChange
}) => {
    
    const handleProgressInteraction = (e: React.MouseEvent | React.TouchEvent) => {
        if (!progressBarRef.current || duration === 0) return;
        const event = 'touches' in e ? e.touches[0] : e;
        const rect = progressBarRef.current.getBoundingClientRect();
        const clickX = event.clientX - rect.left;
        const width = rect.width;
        let newTime = (clickX / width) * duration;
        newTime = Math.max(0, Math.min(newTime, duration));
        
        const video = (progressBarRef.current.closest('.player-container-scope')?.querySelector('video'));
        if(video) video.currentTime = newTime;
    };

    const handleProgressClick = (e: React.MouseEvent) => { handleProgressInteraction(e); };
    const handleProgressDrag = (e: React.MouseEvent) => { if (e.buttons !== 1) return; handleProgressInteraction(e); };
    const handlePopoverToggle = (popoverName: 'episodes' | 'subtitles' | 'settings') => { setActivePopover((p: any) => p === popoverName ? null : popoverName); };

    const episodeTitle = episode ? `S${season}:E${episode.episode_number} ${episode.name}` : '';
    const remainingTime = duration > 0 ? duration - currentTime : 0;

    return (
        <div className={`controls-bar absolute inset-0 text-white transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/50"></div>
            <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center pointer-events-auto">
                <button onClick={() => navigate(-1)} className="w-10 h-10 text-xl"><i className="fas fa-arrow-left text-2xl"></i></button>
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-4 lg:p-6 pointer-events-auto flex flex-col gap-1">
                 <div className="flex items-center gap-x-3 text-sm font-mono">
                     <div ref={progressBarRef} onClick={handleProgressClick} onMouseMove={handleProgressDrag} className="w-full flex items-center cursor-pointer group h-5">
                        <div className="relative w-full bg-white/20 rounded-full transition-all duration-200 h-1.5 group-hover:h-2.5">
                            <div className="absolute h-full bg-[var(--primary)] rounded-full" style={{ width: `${(currentTime / duration) * 100}%` }} />
                            <div className="absolute top-1/2 -translate-y-1/2 bg-[var(--primary)] rounded-full -translate-x-1/2 transition-transform duration-200 z-10 w-3.5 h-3.5 scale-100 group-hover:scale-125" style={{ left: `${(currentTime / duration) * 100}%` }} />
                        </div>
                    </div>
                    <span className="text-sm w-20 text-center">-{formatTime(remainingTime)}</span>
                 </div>
                 <div className="flex items-center justify-between gap-x-2">
                    <div className="flex items-center gap-x-2 md:gap-x-4">
                        <button onClick={togglePlay} className="text-4xl w-14 h-14 flex items-center justify-center"><i className={`fas ${isPlaying ? 'fa-pause' : 'fa-play'}`}></i></button>
                        <button onClick={() => handleSeek(false)} className="text-xl w-8 h-8 flex items-center justify-center"><Icons.RewindIcon className="w-8 h-8" /></button>
                        <button onClick={() => handleSeek(true)} className="text-xl w-8 h-8 flex items-center justify-center"><Icons.ForwardIcon className="w-8 h-8" /></button>
                        <div className="relative group flex items-center">
                            <button onClick={onToggleMute} className="text-2xl w-10 h-10 flex items-center justify-center">
                                {isMuted || volume === 0 ? <Icons.VolumeMuteIcon className="w-8 h-8" /> : <Icons.VolumeHighIcon className="w-8 h-8" />}
                            </button>
                            <div className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 w-8 h-32 p-2 bg-black/60 rounded-lg flex-col items-center justify-center hidden group-hover:flex backdrop-blur-sm">
                                <input type="range" min="0" max="1" step="0.05" value={isMuted ? 0 : volume} onChange={onVolumeChange} className="w-24 h-1 appearance-none cursor-pointer [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-white/30 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white" style={{ writingMode: 'vertical-lr', WebkitAppearance: 'slider-vertical' }} />
                            </div>
                        </div>
                        <div className="text-lg text-zinc-100 font-bold ml-4 hidden md:block truncate max-w-sm lg:max-w-lg">{item.title || item.name}{episodeTitle && `: ${episodeTitle}`}</div>
                    </div>
                    <div className="flex items-center gap-x-3 md:gap-x-4 text-2xl">
                        {nextEpisode && <button onClick={handlePlayNext} title={t('nextEpisode')}><i className="fas fa-forward-step"></i></button>}
                        {item.media_type === 'tv' && <button onClick={() => handlePopoverToggle('episodes')} title={t('episodes')}><i className="fas fa-layer-group"></i></button>}
                        <button onClick={() => handlePopoverToggle('subtitles')} title={t('subtitles')}><i className="far fa-closed-captioning"></i></button>
                        <button onClick={() => handlePopoverToggle('settings')} title={t('settings')}><Icons.SettingsIcon className="w-9 h-9" /></button>
                        <button onClick={toggleFullscreen}>
                            {isFullscreen ? <Icons.ExitFullscreenIcon className="w-7 h-7" /> : <Icons.EnterFullscreenIcon className="w-7 h-7" />}
                        </button>
                    </div>
                </div>
            </div>
            {activePopover === 'episodes' && (
                <SideSheet onClose={() => setActivePopover(null)} title={t('episodes')}>
                    <div className="flex flex-col gap-4">
                        {episodes.map((ep: Episode) => (
                          <div key={ep.id} className={`flex items-start gap-4 p-2 rounded-lg cursor-pointer ${episode && ep.id === episode.id ? 'bg-zinc-700' : 'hover:bg-zinc-800'}`} onClick={() => onEpisodeSelect(ep)}>
                            <span className="text-xl text-zinc-400 font-bold w-8 text-center">{ep.episode_number}</span>
                            <div className="relative flex-shrink-0 w-36 h-20 overflow-hidden rounded-md">
                               <img src={ep.still_path ? `${IMAGE_BASE_URL}w300${ep.still_path}` : `${IMAGE_BASE_URL}${BACKDROP_SIZE_MEDIUM}${item.backdrop_path}`} alt={ep.name} className="object-cover w-full h-full" />
                            </div>
                            <div className="flex-1">
                              <h4 className="font-semibold text-sm leading-tight">{ep.name}</h4>
                              <p className="text-xs text-zinc-400 line-clamp-2 mt-1">{ep.overview}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                </SideSheet>
            )}
            {activePopover === 'subtitles' && (
                <SideSheet onClose={() => setActivePopover(null)} title={t('subtitles')}>
                    <div className="space-y-2">
                        <h4 className="text-sm font-semibold opacity-80">{t('subtitles')}</h4>
                        <div className="flex flex-col gap-1">
                            <button onClick={() => handleSubtitleChange(null)} className={`text-left px-3 py-2 rounded-md ${!activeSubtitleLang ? 'bg-white/10' : 'hover:bg-white/5'}`}>{t('off')}</button>
                            {vttTracks.map((sub: any) => (
                                <button key={sub.lang} onClick={() => handleSubtitleChange(sub.lang)} className={`text-left px-3 py-2 rounded-md ${activeSubtitleLang === sub.lang ? 'bg-white/10' : 'hover:bg-white/5'}`}>{sub.label}</button>
                            ))}
                            {isTranslating && <div className="text-center text-xs p-2 text-gray-300 animate-pulse">{t('translating')}</div>}
                        </div>
                    </div>
                     <div className="mt-4 space-y-2 pt-4 border-t border-white/10">
                        <h4 className="text-sm font-semibold opacity-80">{t('dubbing')}</h4>
                        <div className="flex flex-col gap-1">
                            <button onClick={() => handleDubLangChange(null)} className={`text-left px-3 py-2 rounded-md ${!selectedDubLang ? 'bg-white/10' : 'hover:bg-white/5'}`}>{t('originalAudio')}</button>
                            <button onClick={() => handleDubLangChange('ar')} className={`text-left px-3 py-2 rounded-md ${selectedDubLang === 'ar' ? 'bg-white/10' : 'hover:bg-white/5'}`}>{t('arabic')}</button>
                        </div>
                    </div>
                    <div className="mt-6 space-y-3 pt-4 border-t border-white/10">
                        <h4 className="text-sm font-semibold opacity-80 mb-2">{t('subtitleSettings')}</h4>
                        
                        <div className="flex items-center justify-between">
                            <span className="text-sm opacity-90">{t('fontSize')}</span>
                            <div className="flex items-center gap-3">
                                <button onClick={() => onUpdateSubtitleSettings((prev: any) => ({ ...prev, fontSize: Math.max(50, prev.fontSize - 10) }))} className="w-11 h-9 flex items-center justify-center bg-white/10 rounded-md text-2xl font-bold btn-press" aria-label={`Decrease ${t('fontSize')}` }>-</button>
                                <span className="w-16 text-center font-semibold text-base tabular-nums">{subtitleSettings.fontSize}%</span>
                                <button onClick={() => onUpdateSubtitleSettings((prev: any) => ({ ...prev, fontSize: Math.min(200, prev.fontSize + 10) }))} className="w-11 h-9 flex items-center justify-center bg-white/10 rounded-md text-2xl font-bold btn-press" aria-label={`Increase ${t('fontSize')}` }>+</button>
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <span className="text-sm opacity-90">{t('backgroundOpacity')}</span>
                            <div className="flex items-center gap-3">
                                <button onClick={() => onUpdateSubtitleSettings((prev: any) => ({ ...prev, backgroundOpacity: Math.max(0, prev.backgroundOpacity - 10) }))} className="w-11 h-9 flex items-center justify-center bg-white/10 rounded-md text-2xl font-bold btn-press" aria-label={`Decrease ${t('backgroundOpacity')}` }>-</button>
                                <span className="w-16 text-center font-semibold text-base tabular-nums">{subtitleSettings.backgroundOpacity}%</span>
                                <button onClick={() => onUpdateSubtitleSettings((prev: any) => ({ ...prev, backgroundOpacity: Math.min(100, prev.backgroundOpacity + 10) }))} className="w-11 h-9 flex items-center justify-center bg-white/10 rounded-md text-2xl font-bold btn-press" aria-label={`Increase ${t('backgroundOpacity')}` }>+</button>
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <span className="text-sm opacity-90">{t('verticalPosition')}</span>
                            <div className="flex items-center gap-3">
                                <button onClick={() => onUpdateSubtitleSettings((prev: any) => ({ ...prev, verticalPosition: Math.max(2, prev.verticalPosition - 5) }))} className="w-11 h-9 flex items-center justify-center bg-white/10 rounded-md text-2xl font-bold btn-press" aria-label={`Decrease ${t('verticalPosition')}` }>-</button>
                                <span className="w-16 text-center font-semibold text-base tabular-nums">{subtitleSettings.verticalPosition}%</span>
                                <button onClick={() => onUpdateSubtitleSettings((prev: any) => ({ ...prev, verticalPosition: Math.min(85, prev.verticalPosition + 5) }))} className="w-11 h-9 flex items-center justify-center bg-white/10 rounded-md text-2xl font-bold btn-press" aria-label={`Increase ${t('verticalPosition')}` }>+</button>
                            </div>
                        </div>
                    </div>
                </SideSheet>
            )}
             {activePopover === 'settings' && (
                <SideSheet onClose={() => setActivePopover(null)} title={t('settings')}>
                    {streamLinks && streamLinks.length > 1 && (
                        <div className="space-y-2">
                            <h4 className="text-sm font-semibold opacity-80">{t('quality')}</h4>
                            <div className="flex flex-col gap-1">
                                {streamLinks.map((link: StreamLink) => (
                                    <button
                                        key={link.quality}
                                        onClick={() => handleQualityChange(link)}
                                        className={`text-left px-3 py-2 rounded-md ${activeQuality === link.quality ? 'bg-white/10' : 'hover:bg-white/5'}`}
                                    >
                                        {link.quality}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </SideSheet>
            )}
        </div>
    );
}

const SideSheet: React.FC<{ onClose: () => void, title: string, children: React.ReactNode }> = ({ onClose, title, children }) => {
    const [closing, setClosing] = React.useState(false);
    const requestClose = () => {
        if (closing) return;
        setClosing(true);
        setTimeout(() => onClose(), 400);
    };
    return (
        <div className="fixed inset-0 z-50 pointer-events-auto">
            <div className="absolute inset-0 bg-black/50" onClick={requestClose}></div>
            <div className={`absolute right-0 top-0 h-full w-full max-w-sm bg-[var(--background)] shadow-2xl ${closing ? 'animate-slide-out-right' : 'animate-slide-in-from-right'}`}>
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                    <h3 className="font-semibold">{title}</h3>
                    <button onClick={requestClose} className="text-xl"><i className="fa-solid fa-xmark"></i></button>
                </div>
                <div className="p-4 overflow-y-auto h-[calc(100%-52px)] no-scrollbar">
                    {children}
                </div>
            </div>
        </div>
    );
};

export default VideoPlayer;
