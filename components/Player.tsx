import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Hls from 'hls.js';
import { Movie, Episode, SubtitleTrack, SubtitleSettings, StreamLink } from '../types';
import { useProfile } from '../contexts/ProfileContext';
import { useTranslation } from '../contexts/LanguageContext';
import { fetchStreamUrl, fetchFromTMDB } from '../services/apiService';
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

const SidePanel: React.FC<{
    title: string;
    onClose: () => void;
    children: React.ReactNode;
    show: boolean;
}> = ({ title, onClose, children, show }) => {
    const panelRef = useRef<HTMLDivElement>(null);
    const [isRendered, setIsRendered] = useState(false);
    const [isAnimatingOut, setIsAnimatingOut] = useState(false);
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;

    useEffect(() => {
        if (show) {
            setIsRendered(true);
            setIsAnimatingOut(false);
        } else if (isRendered) {
            setIsAnimatingOut(true);
            const timer = setTimeout(() => {
                setIsRendered(false);
                setIsAnimatingOut(false);
            }, 300); // Animation duration
            return () => clearTimeout(timer);
        }
    }, [show, isRendered]);

    // Focus trapping and keyboard navigation handling
    useEffect(() => {
        if (isRendered && !isAnimatingOut) {
            const panelNode = panelRef.current;
            if (!panelNode) return;

            const focusTimer = setTimeout(() => {
                const focusableElements = Array.from(
                    panelNode.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
                ).filter(el => !(el as HTMLElement).hasAttribute('disabled')) as HTMLElement[];
                
                if (focusableElements.length > 0) {
                    focusableElements[0].focus();
                }
            }, 100);

            const handleKeyDown = (e: KeyboardEvent) => {
                e.stopPropagation(); 

                const focusableElements = Array.from(
                    panelNode.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
                ).filter(el => !(el as HTMLElement).hasAttribute('disabled')) as HTMLElement[];
                
                if (focusableElements.length === 0) return;

                const firstElement = focusableElements[0];
                const lastElement = focusableElements[focusableElements.length - 1];
                const currentElement = document.activeElement as HTMLElement;
                const currentIndex = focusableElements.indexOf(currentElement);

                if (e.key === 'Escape') {
                    onCloseRef.current();
                } else if (e.key === 'Tab') {
                    if (e.shiftKey) {
                        if (document.activeElement === firstElement) {
                            e.preventDefault();
                            lastElement.focus();
                        }
                    } else {
                        if (document.activeElement === lastElement) {
                            e.preventDefault();
                            firstElement.focus();
                        }
                    }
                } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                    e.preventDefault();
                    if (currentIndex === -1) { 
                        firstElement.focus();
                        return;
                    }
                    if (e.key === 'ArrowDown') {
                        const nextIndex = (currentIndex + 1) % focusableElements.length;
                        focusableElements[nextIndex]?.focus();
                    } else if (e.key === 'ArrowUp') {
                        const prevIndex = (currentIndex - 1 + focusableElements.length) % focusableElements.length;
                        focusableElements[prevIndex]?.focus();
                    }
                }
            };

            document.addEventListener('keydown', handleKeyDown);

            return () => {
                clearTimeout(focusTimer);
                document.removeEventListener('keydown', handleKeyDown);
            }
        }
    }, [isRendered, isAnimatingOut]);
    
    if (!isRendered) return null;

    const animationClass = isAnimatingOut ? 'animate-slide-out-right' : 'animate-slide-in-right';

    return (
        <div
            ref={panelRef}
            className={`fixed top-0 right-0 h-full w-full max-w-md bg-black/80 backdrop-blur-lg z-30 p-4 flex flex-col ${animationClass}`}
            onClick={(e) => e.stopPropagation()}
        >
            <header className="flex items-center justify-between mb-4 flex-shrink-0">
                <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors">
                    <i className="fa-solid fa-arrow-left text-lg"></i>
                </button>
                <h2 className="text-xl font-bold">{title}</h2>
                <div className="w-10 h-10"></div> {/* Spacer */}
            </header>
            <div className="flex-1 overflow-y-auto no-scrollbar">
                {children}
            </div>
        </div>
    );
};

const SubtitlesPanel: React.FC<{
    tracks: { lang: string; url: string; label: string }[],
    activeLang: string | null,
    onSelect: (lang: string | null) => void,
    onClose: () => void,
    triggerRef: React.RefObject<HTMLElement>,
    show: boolean,
}> = ({ tracks, activeLang, onSelect, onClose, triggerRef, show }) => {

    // Return focus on close
    useEffect(() => {
        if (!show) {
            triggerRef.current?.focus();
        }
    }, [show, triggerRef]);

    return (
        <SidePanel title="Subtitles" onClose={onClose} show={show}>
            <div className="flex flex-col gap-2">
                <button onClick={() => { onSelect(null); onClose(); }} className={`player-panel-button ${!activeLang ? 'active' : ''}`}>Off</button>
                {tracks.map(track => (
                    <button key={track.lang} onClick={() => { onSelect(track.lang); onClose(); }} className={`player-panel-button ${activeLang === track.lang ? 'active' : ''}`}>{track.label}</button>
                ))}
            </div>
        </SidePanel>
    );
};

const SettingsPanel: React.FC<{
    onClose: () => void,
    triggerRef: React.RefObject<HTMLElement>,
    playbackRate: number,
    onRateChange: (rate: number) => void,
    qualities: string[],
    activeQuality: string | null,
    onQualityChange: (quality: string) => void,
    show: boolean,
    subtitleSettings: SubtitleSettings;
    onSubtitleSettingsChange: (settings: Partial<SubtitleSettings>) => void;
}> = ({ onClose, triggerRef, playbackRate, onRateChange, qualities, activeQuality, onQualityChange, show, subtitleSettings, onSubtitleSettingsChange }) => {
    const [view, setView] = useState<'main' | 'speed' | 'quality' | 'subtitleSettings'>('main');
    const { t } = useTranslation();
    
    useEffect(() => {
        if (!show) {
            triggerRef.current?.focus();
            setTimeout(() => setView('main'), 300); 
        }
    }, [show, triggerRef]);

    const renderMain = () => (
        <div className="flex flex-col gap-2">
            <button onClick={() => setView('speed')} className="player-panel-button justify-between">
                <span>{t('playbackSpeed')}</span>
                <span className="text-zinc-400">{playbackRate === 1 ? t('auto') : `${playbackRate}x`} <i className="fa-solid fa-chevron-right text-xs"></i></span>
            </button>
            <button onClick={() => setView('quality')} className="player-panel-button justify-between">
                <span>{t('quality')}</span>
                <span className="text-zinc-400">{activeQuality || t('auto')} <i className="fa-solid fa-chevron-right text-xs"></i></span>
            </button>
            <button onClick={() => setView('subtitleSettings')} className="player-panel-button justify-between">
                <span>{t('subtitleSettings')}</span>
                <span><i className="fa-solid fa-chevron-right text-xs"></i></span>
            </button>
        </div>
    );
    
    const playbackRates = [0.5, 0.75, 1, 1.25, 1.5, 2];

    const renderSpeed = () => (
        <div className="flex flex-col gap-2">
            {playbackRates.map(rate => (
                <button key={rate} onClick={() => { onRateChange(rate); setView('main'); }} className={`player-panel-button ${playbackRate === rate ? 'active' : ''}`}>
                    {rate === 1 ? t('auto') : `${rate}x`}
                </button>
            ))}
        </div>
    );

    const renderQuality = () => (
        <div className="flex flex-col gap-2">
            {qualities.map(q => (
                <button key={q} onClick={() => { onQualityChange(q); setView('main'); }} className={`player-panel-button ${activeQuality === q ? 'active' : ''}`}>
                    {q}
                </button>
            ))}
        </div>
    );
    
    const renderSubtitleSettings = () => (
        <div className="flex flex-col gap-4">
            {/* Font Size */}
            <div className="mb-2">
                <h4 className="text-sm font-semibold text-zinc-400 mb-2">{t('fontSize')}</h4>
                <div className="flex flex-wrap gap-2">
                    {[75, 100, 125, 150, 175, 200].map(size => (
                        <button key={size} onClick={() => onSubtitleSettingsChange({ fontSize: size })} className={`px-4 py-2 text-sm font-medium rounded-md hover:bg-white/10 transition-colors flex-1 text-center ${subtitleSettings.fontSize === size ? 'bg-white text-black' : 'bg-white/5'}`}>
                            {size}%
                        </button>
                    ))}
                </div>
            </div>

            {/* Background Opacity */}
            <div className="mb-2">
                <h4 className="text-sm font-semibold text-zinc-400 mb-2">{t('backgroundOpacity')}</h4>
                <div className="flex flex-wrap gap-2">
                     {[0, 25, 50, 75, 100].map(opacity => (
                        <button key={opacity} onClick={() => onSubtitleSettingsChange({ backgroundOpacity: opacity })} className={`px-4 py-2 text-sm font-medium rounded-md hover:bg-white/10 transition-colors flex-1 text-center ${subtitleSettings.backgroundOpacity === opacity ? 'bg-white text-black' : 'bg-white/5'}`}>
                            {opacity}%
                        </button>
                    ))}
                </div>
            </div>

            {/* Edge Style */}
            <div className="mb-2">
                <h4 className="text-sm font-semibold text-zinc-400 mb-2">{t('edgeStyle')}</h4>
                <div className="flex flex-wrap gap-2">
                    {(['none', 'drop-shadow', 'outline'] as const).map(style => (
                        <button key={style} onClick={() => onSubtitleSettingsChange({ edgeStyle: style })} className={`px-4 py-2 text-sm font-medium rounded-md hover:bg-white/10 transition-colors flex-1 text-center ${subtitleSettings.edgeStyle === style ? 'bg-white text-black' : 'bg-white/5'}`}>
                            {t(style as any)}
                        </button>
                    ))}
                </div>
            </div>

            {/* Vertical Position */}
            <div className="mb-2">
                <h4 className="text-sm font-semibold text-zinc-400 mb-2">{t('verticalPosition')}</h4>
                <input 
                    type="range" 
                    min="5" 
                    max="50" 
                    value={subtitleSettings.verticalPosition}
                    onChange={e => onSubtitleSettingsChange({ verticalPosition: parseInt(e.target.value, 10) })}
                    className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-[var(--primary)]"
                />
            </div>
        </div>
    );

    const titles = {
        main: t('settings'),
        speed: t('playbackSpeed'),
        quality: t('quality'),
        subtitleSettings: t('subtitleSettings')
    };

    return (
        <SidePanel title={titles[view]} onClose={() => view === 'main' ? onClose() : setView('main')} show={show}>
            {view === 'main' && renderMain()}
            {view === 'speed' && renderSpeed()}
            {view === 'quality' && renderQuality()}
            {view === 'subtitleSettings' && renderSubtitleSettings()}
        </SidePanel>
    );
};

const VideoPlayer: React.FC<PlayerProps> = ({ item, itemType, initialSeason, initialEpisode, initialTime, initialStreamUrl, onProviderSelected, onStreamFetchStateChange, setVideoNode, serverPreferences, episodes, onEpisodeSelect, selectedProvider }) => {
    const navigate = useNavigate();
    const { setToast, getScreenSpecificData, setScreenSpecificData } = useProfile();
    const { t, language: userLanguage } = useTranslation();

    const videoRef = useRef<HTMLVideoElement>(null);
    const playerContainerRef = useRef<HTMLDivElement>(null);
    const fetchIdRef = useRef(0);
    const timeOnSwitchRef = useRef(0);
    
    const infoPanelRef = useRef<HTMLDivElement>(null);
    const controlsPanelRef = useRef<HTMLDivElement>(null);
    const progressBarRef = useRef<HTMLDivElement>(null);
    const recsPanelRef = useRef<HTMLDivElement>(null);
    const settingsButtonRef = useRef<HTMLButtonElement>(null);
    const subtitlesButtonRef = useRef<HTMLButtonElement>(null);


    const [streamLinks, setStreamLinks] = useState<StreamLink[]>([]);
    const [activeStreamUrl, setActiveStreamUrl] = useState<string | null>(initialStreamUrl || null);
    const [activeQuality, setActiveQuality] = useState<string | null>(null);
    const [recommendations, setRecommendations] = useState<Movie[]>([]);
    
    const [isPlaying, setIsPlaying] = useState(false);
    const [isBuffering, setIsBuffering] = useState(true);
    const [isOverlayVisible, setIsOverlayVisible] = useState(true);
    const [isRecsFocused, setIsRecsFocused] = useState(false);
    const [currentTime, setCurrentTime] = useState(initialTime || 0);
    const [duration, setDuration] = useState(0);
    const [subtitles, setSubtitles] = useState<SubtitleTrack[]>([]);
    const [vttTracks, setVttTracks] = useState<{ lang: string; url: string; label: string }[]>([]);
    const [activeSubtitleLang, setActiveSubtitleLang] = useState<string | null>(null);
    const [activeCues, setActiveCues] = useState<VTTCue[]>([]);
    const defaultSubtitleSettings: SubtitleSettings = { fontSize: 100, backgroundOpacity: 0, edgeStyle: 'outline', verticalPosition: 10 };
    const [subtitleSettings, setSubtitleSettings] = useState<SubtitleSettings>(() => getScreenSpecificData('subtitleSettings', defaultSubtitleSettings));
    
    const [showSettingsPanel, setShowSettingsPanel] = useState(false);
    const [showSubtitlesPanel, setShowSubtitlesPanel] = useState(false);
    const [playbackRate, setPlaybackRate] = useState(1);

    const handleSubtitleSettingsChange = (newSettings: Partial<SubtitleSettings>) => {
        setSubtitleSettings(prev => {
            const updated = { ...prev, ...newSettings };
            setScreenSpecificData('subtitleSettings', updated);
            return updated;
        });
    };

    const combinedRef = useCallback((node: HTMLVideoElement | null) => {
        (videoRef as React.MutableRefObject<HTMLVideoElement | null>).current = node;
        if (setVideoNode) setVideoNode(node);
    }, [setVideoNode]);

    // Effect to handle initial and subsequent focusing when controls become visible
    useEffect(() => {
        if (isOverlayVisible && !showSettingsPanel && !showSubtitlesPanel) {
            const focusTimer = setTimeout(() => {
                const playerContainer = playerContainerRef.current;
                if (!playerContainer) return;

                const activeElement = document.activeElement;
                const isFocusOutsidePlayer = !activeElement || activeElement === document.body || !playerContainer.contains(activeElement);

                if (isFocusOutsidePlayer) {
                    const titleElement = infoPanelRef.current?.querySelector<HTMLElement>('.focusable');
                    titleElement?.focus();
                }
            }, 150);
            return () => clearTimeout(focusTimer);
        }
    }, [isOverlayVisible, showSettingsPanel, showSubtitlesPanel]);

    useEffect(() => {
        if(videoRef.current) {
            videoRef.current.playbackRate = playbackRate;
        }
    }, [playbackRate]);

    // Effect 1: Fetch the stream URL and other data
    useEffect(() => {
        if (initialStreamUrl) {
            setActiveStreamUrl(initialStreamUrl);
        }
        const fetchData = async () => {
            const fetchId = ++fetchIdRef.current;
            onStreamFetchStateChange(true);
            setIsBuffering(true);
            if (!initialStreamUrl) setActiveStreamUrl(null);
            setSubtitles([]);
            setVttTracks([]);
            
            try {
                // Fetch recommendations
                const recsData = await fetchFromTMDB(`/${itemType}/${item.id}/recommendations`);
                setRecommendations(recsData.results.filter((m: Movie) => m.backdrop_path));

                // Fetch stream
                 if (!initialStreamUrl) {
                    const data = await fetchStreamUrl(item, itemType, initialSeason, initialEpisode?.episode_number, selectedProvider || undefined, serverPreferences);
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

        fetchData();
    }, [item.id, initialEpisode?.id, selectedProvider, serverPreferences.join()]);

    // Effect 2: Play the video
    useEffect(() => {
        const video = videoRef.current;
        if (!video || !activeStreamUrl) {
            setIsBuffering(true);
            return;
        }

        const hls = new Hls.default();
        const savedTime = timeOnSwitchRef.current > 0 ? timeOnSwitchRef.current : (initialTime || 0);
        timeOnSwitchRef.current = 0;

        if (activeStreamUrl.includes('.m3u8') && Hls.default.isSupported()) {
            hls.loadSource(activeStreamUrl);
            hls.attachMedia(video);
            hls.on(Hls.default.Events.MANIFEST_PARSED, () => {
                video.currentTime = savedTime;
                video.play().catch(() => {});
            });
        } else {
            video.src = activeStreamUrl;
            video.addEventListener('loadeddata', () => {
                video.currentTime = savedTime;
                video.play().catch(error => console.warn("Autoplay was prevented.", error));
            }, { once: true });
        }

        return () => hls.destroy();
    }, [activeStreamUrl]);

    // Effect for handling quality changes
    useEffect(() => {
        // Do nothing if quality is not selected, video isn't ready, or there are no links
        if (!activeQuality || !videoRef.current || streamLinks.length === 0) return;

        const newLink = streamLinks.find(link => link.quality === activeQuality);

        // Check if a new link is found and it's different from the current one
        if (newLink && newLink.url !== activeStreamUrl) {
            console.log(`Changing quality to: ${activeQuality}`);
            // Save current time to resume playback smoothly
            timeOnSwitchRef.current = videoRef.current.currentTime;
            // Set the new stream URL, which will trigger the playback effect
            setActiveStreamUrl(newLink.url);
        }
    }, [activeQuality, streamLinks, activeStreamUrl]);
    
    // Effect 3: Process subtitles
    useEffect(() => {
        let active = true;
        let createdUrls: string[] = [];
        const processSubtitles = async () => {
            const srtTimestampLineRegex = /(\d{2}:\d{2}:\d{2}[,.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,.]\d{3})/g;
            const processSrtToVtt = (srtText: string) => {
                let vttContent = "WEBVTT\n\n";
                vttContent += srtText.replace(/\r/g, '').replace(srtTimestampLineRegex, (_, s, e) => `${s.replace(',', '.')} --> ${e.replace(',', '.')}`);
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
                } catch (e) { console.error(`Failed to process subtitle: ${sub.display}`, e); }
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
                setActiveCues(Array.from(activeTrack.activeCues) as VTTCue[]);
            } else { setActiveCues([]); }
        };

        for (let i = 0; i < video.textTracks.length; i++) {
            const track = video.textTracks[i];
            track.mode = 'hidden';
            if (track.language === activeSubtitleLang) activeTrack = track;
        }

        if (activeTrack) {
            onCueChange();
            activeTrack.addEventListener('cuechange', onCueChange);
        } else { setActiveCues([]); }

        return () => { if (activeTrack) activeTrack.removeEventListener('cuechange', onCueChange); };
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
        const onPlaying = () => { setIsBuffering(false); };
        video.addEventListener('play', onPlay); video.addEventListener('pause', onPause);
        video.addEventListener('timeupdate', onTimeUpdate); video.addEventListener('durationchange', onDurationChange);
        video.addEventListener('waiting', onWaiting); video.addEventListener('playing', onPlaying);
        
        setIsPlaying(!video.paused);
        setCurrentTime(video.currentTime);
        setDuration(video.duration || 0);
        setIsBuffering(video.readyState < 3 && !video.paused);
        
        return () => {
            video.removeEventListener('play', onPlay); video.removeEventListener('pause', onPause);
            video.removeEventListener('timeupdate', onTimeUpdate); video.removeEventListener('durationchange', onDurationChange);
            video.removeEventListener('waiting', onWaiting); video.removeEventListener('playing', onPlaying);
        };
    }, []);

    const togglePlay = useCallback(() => {
        if (showSettingsPanel || showSubtitlesPanel) return;
        const video = videoRef.current;
        if (!video) return;
    
        if (video.paused) {
            video.play().catch(e => setToast({ message: t('failedToLoadVideo'), type: "error" }));
        } else {
            video.pause();
        }
    }, [setToast, t, showSettingsPanel, showSubtitlesPanel]);

    // Keyboard navigation and visibility control
     useEffect(() => {
        if (showSettingsPanel || showSubtitlesPanel) {
            return;
        }

        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOverlayVisible) {
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsOverlayVisible(true);
                } else if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    togglePlay();
                }
                return;
            }
            
            const arrowKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', ' '];
             if (!arrowKeys.includes(e.key) || (document.activeElement?.tagName === 'INPUT')) return;
             
            e.stopPropagation();

            const active = document.activeElement as HTMLElement;

            const infoFocusables = Array.from(infoPanelRef.current?.querySelectorAll('.focusable') || []) as HTMLElement[];
            const progressFocusable = progressBarRef.current;
            const controlsFocusables = Array.from(controlsPanelRef.current?.querySelectorAll('.focusable') || []) as HTMLElement[];
            const recsFocusables = Array.from(recsPanelRef.current?.querySelectorAll('.focusable') || []) as HTMLElement[];

            if (e.key === 'ArrowUp' && (infoFocusables.includes(active) || controlsFocusables.includes(active))) {
                e.preventDefault();
                setIsOverlayVisible(false);
                if (document.activeElement instanceof HTMLElement) {
                    document.activeElement.blur();
                }
                return;
            }

            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                e.preventDefault();
            }

            const seek = (offset: number) => {
                const video = videoRef.current;
                if (video) {
                    video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + offset));
                }
            };

            switch (e.key) {
                case 'ArrowUp':
                    if (recsFocusables.includes(active)) {
                        progressFocusable?.focus();
                        setIsRecsFocused(false);
                    } else if (active === progressFocusable) {
                        infoFocusables[0]?.focus();
                    }
                    break;
                case 'ArrowDown':
                    if (infoFocusables.includes(active) || controlsFocusables.includes(active)) {
                        progressFocusable?.focus();
                        setIsRecsFocused(false);
                    } else if (active === progressFocusable) {
                        recsFocusables[0]?.focus();
                        setIsRecsFocused(true);
                    }
                    break;
                case 'ArrowRight':
                    if (infoFocusables.includes(active)) {
                        controlsFocusables[0]?.focus();
                    } else if (controlsFocusables.includes(active)) {
                        const currentIndex = controlsFocusables.indexOf(active);
                        if (currentIndex < controlsFocusables.length - 1) {
                            controlsFocusables[currentIndex + 1].focus();
                        }
                    } else if (active === progressFocusable) {
                        seek(5);
                    } else if (recsFocusables.includes(active)) {
                        const currentIndex = recsFocusables.indexOf(active);
                        if (currentIndex < recsFocusables.length - 1) {
                            recsFocusables[currentIndex + 1].focus();
                        }
                    }
                    break;
                case 'ArrowLeft':
                    if (controlsFocusables.includes(active)) {
                        const currentIndex = controlsFocusables.indexOf(active);
                        if (currentIndex > 0) {
                            controlsFocusables[currentIndex - 1].focus();
                        } else {
                            infoFocusables[0]?.focus();
                        }
                    } else if (active === progressFocusable) {
                        seek(-5);
                    } else if (recsFocusables.includes(active)) {
                        const currentIndex = recsFocusables.indexOf(active);
                        if (currentIndex > 0) {
                            recsFocusables[currentIndex - 1].focus();
                        }
                    }
                    break;
            }
        };
        
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOverlayVisible, showSettingsPanel, showSubtitlesPanel, togglePlay]);

    const handleRecommendationPlay = (recItem: Movie) => {
        const mediaType = recItem.media_type || (recItem.title ? 'movie' : 'tv');
        navigate('/player', { 
            state: { 
                item: recItem, 
                type: mediaType, 
                season: null,
                episode: null,
            },
            replace: true 
        });
    };

    return (
        <div ref={playerContainerRef} className="player-container-scope relative w-full h-full bg-black flex items-center justify-center overflow-hidden" onClick={togglePlay}>
            <video ref={combinedRef} className="w-full h-full object-contain" playsInline autoPlay preload="metadata">
             {vttTracks.map(track => (
                    <track key={track.lang} kind="subtitles" srcLang={track.lang} src={track.url} label={track.label} default={activeSubtitleLang === track.lang} />
                ))}
            </video>
            
            <div 
                className="absolute left-1/2 -translate-x-1/2 w-full max-w-4xl px-4 text-center pointer-events-none z-10 transition-all duration-200"
                style={{
                    bottom: `${subtitleSettings.verticalPosition + (isOverlayVisible ? 20 : 5)}%`,
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
                showControls={isOverlayVisible} isPlaying={isPlaying} currentTime={currentTime} duration={duration}
                togglePlay={togglePlay}
                navigate={navigate} t={t} item={item} episode={initialEpisode}
                onSettingsClick={() => { setShowSettingsPanel(p => !p); setShowSubtitlesPanel(false); }}
                onSubtitlesClick={() => { setShowSubtitlesPanel(p => !p); setShowSettingsPanel(false); }}
                settingsButtonRef={settingsButtonRef}
                subtitlesButtonRef={subtitlesButtonRef}
                recommendations={recommendations}
                onRecommendationClick={handleRecommendationPlay}
                infoPanelRef={infoPanelRef}
                controlsPanelRef={controlsPanelRef}
                progressBarRef={progressBarRef}
                recsPanelRef={recsPanelRef}
                isRecsFocused={isRecsFocused}
            />

            <SubtitlesPanel
                show={showSubtitlesPanel}
                tracks={vttTracks}
                activeLang={activeSubtitleLang}
                onSelect={setActiveSubtitleLang}
                onClose={() => setShowSubtitlesPanel(false)}
                triggerRef={subtitlesButtonRef}
            />

            <SettingsPanel
                show={showSettingsPanel}
                onClose={() => setShowSettingsPanel(false)}
                triggerRef={settingsButtonRef}
                playbackRate={playbackRate}
                onRateChange={setPlaybackRate}
                qualities={streamLinks.map(l => l.quality)}
                activeQuality={activeQuality}
                onQualityChange={setActiveQuality}
                subtitleSettings={subtitleSettings}
                onSubtitleSettingsChange={handleSubtitleSettingsChange}
            />
        </div>
    );
};

const Controls: React.FC<any> = ({
    showControls, isPlaying, currentTime, duration,
    togglePlay, navigate, t, item, episode,
    onSettingsClick, onSubtitlesClick,
    settingsButtonRef, subtitlesButtonRef,
    recommendations, onRecommendationClick,
    infoPanelRef, controlsPanelRef, progressBarRef, recsPanelRef,
    isRecsFocused
}) => {
    
    const handleProgressInteraction = (e: React.MouseEvent | React.TouchEvent) => {
        if (!progressBarRef.current || duration === 0) return;
        e.stopPropagation();
        const event = 'touches' in e ? e.touches[0] : e;
        const rect = progressBarRef.current.getBoundingClientRect();
        const clickX = event.clientX - rect.left;
        const width = rect.width;
        let newTime = (clickX / width) * duration;
        newTime = Math.max(0, Math.min(newTime, duration));
        
        const video = (progressBarRef.current.closest('.player-container-scope')?.querySelector('video'));
        if(video) video.currentTime = newTime;
    };
    
    const title = item.title || item.name || '';
    const subtitle = `Sky Sports Premier Leagu... • 200K views • 12 hr ago`;

    return (
        <div className={`absolute inset-x-0 bottom-0 text-white transition-all duration-300 ease-in-out flex flex-col ${showControls ? `opacity-100 ${isRecsFocused ? 'translate-y-0' : 'translate-y-28'}` : 'opacity-0 pointer-events-none translate-y-full'}`} onClick={(e) => e.stopPropagation()}>
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent pointer-events-none"></div>
            
            <div className="relative p-4 lg:p-6 pb-8 lg:pb-10 flex flex-col gap-4">
                <div className="flex items-end justify-between gap-4">
                    {/* Left Info Panel */}
                    <div ref={infoPanelRef} className="bg-white/10 p-5 rounded-lg max-w-lg focus-within:bg-white/90 focus-within:text-black transition-colors duration-300">
                        <h1 tabIndex={0} className="text-2xl font-bold focusable outline-none">{title}</h1>
                        <p className="text-base mt-1">{subtitle}</p>
                    </div>

                    {/* Right Controls Panel */}
                    <div ref={controlsPanelRef} className="flex items-center gap-2">
                        <button ref={subtitlesButtonRef} onClick={onSubtitlesClick} className="player-control-button focusable"><Icons.CCIcon className="w-6 h-6"/></button>
                        <button className="player-control-button focusable"><Icons.LikeIcon className="w-6 h-6"/></button>
                        <button className="player-control-button focusable"><Icons.DislikeIcon className="w-6 h-6"/></button>
                        <button className="player-control-button focusable"><Icons.AddToPlaylistIcon className="w-6 h-6"/></button>
                        <button ref={settingsButtonRef} onClick={onSettingsClick} className="player-control-button focusable"><Icons.SettingsIcon className="w-6 h-6"/></button>
                    </div>
                </div>

                {/* Progress Bar & Timestamps */}
                <div className="w-full">
                    <div 
                        ref={progressBarRef} 
                        tabIndex={0} 
                        onClick={handleProgressInteraction} 
                        onMouseMove={e => e.buttons === 1 && handleProgressInteraction(e)} 
                        className="w-full flex items-center cursor-pointer group h-4 focusable progress-bar-focusable"
                    >
                        <div className="relative w-full bg-white/30 rounded-full transition-all duration-200 h-1.5 group-hover:h-2.5 group-focus-within:h-2.5">
                            <div className="absolute h-full bg-red-600 rounded-full" style={{ width: `${(currentTime / duration) * 100}%` }} />
                            <div 
                                className="absolute top-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-focus-within:opacity-100 transition-opacity pointer-events-none"
                                style={{ 
                                    left: `${(currentTime / duration) * 100}%`,
                                    transform: 'translate(-50%, -50%)',
                                }}
                            />
                        </div>
                    </div>
                    <div className="flex justify-between items-center mt-1 px-1">
                        <span className="text-xs font-mono">{formatTime(currentTime)}</span>
                        <span className="text-xs font-mono">{formatTime(duration)}</span>
                    </div>
                </div>

                {/* Recommendations Shelf */}
                {recommendations && recommendations.length > 0 && (
                     <div ref={recsPanelRef} className="overflow-x-auto no-scrollbar py-3">
                        <div className="flex flex-nowrap gap-x-4">
                            {recommendations.map((rec, index) => (
                                <div key={rec.id} tabIndex={0} onClick={() => onRecommendationClick(rec)} className="flex-shrink-0 w-96 h-56 rounded-lg overflow-hidden cursor-pointer focusable">
                                    <img src={`${IMAGE_BASE_URL}${BACKDROP_SIZE_MEDIUM}${rec.backdrop_path}`} alt={rec.title || rec.name} className="w-full h-full object-cover" />
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default VideoPlayer;
