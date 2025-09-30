import React, { useState, useEffect, useRef, useCallback } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import PlayerPage from './pages/PlayerPage';
import ProfilePage from './pages/ProfilePage';
import GenericPage from './pages/GenericPage';
import ActorDetailsPage from './pages/ActorDetailsPage';
import SettingsPage from './pages/SettingsPage';
import MoviesPage from './pages/MoviesPage';
import TvShowsPage from './pages/TvShowsPage';
import DetailsPage from './pages/DetailsPage';
import CinemaPage from './pages/CinemaPage';
import LiveRoomPage from './pages/LiveRoomPage';
import ShortsPage from './pages/ShortsPage';
import YouPage from './pages/YouPage';
import { ProfileProvider, useProfile } from './contexts/ProfileContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { PlayerProvider } from './contexts/PlayerContext';
import { ToastContainer, DetailsModal, TVCursor } from './components/common';
import PipPlayer from './components/PipPlayer';
import { useTranslation } from './contexts/LanguageContext';

const GenericPageWrapper: React.FC<{ pageType: 'favorites' | 'search' | 'all' }> = ({ pageType }) => {
  const { t } = useTranslation();
  const pageTitles = {
    favorites: t('myList'),
    search: t('search'),
    all: t('allCategory'),
  }
  return <GenericPage pageType={pageType} title={pageTitles[pageType]} />;
};

const GlobalModal: React.FC = () => {
    const { modalItem, setModalItem } = useProfile();
    if (!modalItem) return null;
    return <DetailsModal item={modalItem} onClose={() => setModalItem(null)} />;
}

// Helper for dynamic glow effect
const colorCache = new Map<string, string>();
const canvas = document.createElement('canvas');
const context = canvas.getContext('2d', { willReadFrequently: true });
canvas.width = 1;
canvas.height = 1;

const extractColorFromImage = (imageUrl: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (colorCache.has(imageUrl)) {
      resolve(colorCache.get(imageUrl)!);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = imageUrl;

    img.onload = () => {
      if (!context) {
        reject('Canvas context not available');
        return;
      }
      context.drawImage(img, 0, 0, 1, 1);
      const data = context.getImageData(0, 0, 1, 1).data;
      const rgba = `rgba(${data[0]}, ${data[1]}, ${data[2]}, 0.75)`; // Increased opacity for a more prominent glow
      colorCache.set(imageUrl, rgba);
      resolve(rgba);
    };

    img.onerror = () => {
      const defaultColor = 'rgba(128, 128, 128, 0.2)';
      colorCache.set(imageUrl, defaultColor);
      resolve(defaultColor);
    };
  });
};


const App: React.FC = () => {
  // Triple-enter cursor state
  const [enterPressCount, setEnterPressCount] = useState(0);
  const [showTvCursor, setShowTvCursor] = useState(false);
  const enterPressTimeout = useRef<number | null>(null);
  const [cursorPosition, setCursorPosition] = useState({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const [clickEffect, setClickEffect] = useState(false);
  
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Handle triple-enter for cursor
    if (e.key === 'Enter') {
      if (enterPressTimeout.current) {
        clearTimeout(enterPressTimeout.current);
      }
      const newCount = enterPressCount + 1;
      setEnterPressCount(newCount);

      if (newCount === 3) {
        setShowTvCursor(true);
        setEnterPressCount(0);
      } else {
        enterPressTimeout.current = window.setTimeout(() => {
          setEnterPressCount(0);
        }, 500); // Reset if presses are too slow
      }
    }

    if (showTvCursor) {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        setShowTvCursor(false);
        // Fall through to spatial nav
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const element = document.elementFromPoint(cursorPosition.x, cursorPosition.y);
        setClickEffect(true);
        setTimeout(() => setClickEffect(false), 400);
        if (element instanceof HTMLElement) {
          element.click();
        }
        return;
      } else {
        return; // Let other keys pass through if cursor is active
      }
    }

    // --- Spatial Navigation Logic ---
    const arrowKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
    if (!arrowKeys.includes(e.key)) {
      return;
    }
    e.preventDefault();

    const currentElement = document.activeElement as HTMLElement;
    
    const modalElement = document.querySelector('.details-modal-content');
    const navigationScope = modalElement || document;

    // If nothing is focused, or the focused element is not part of our system, find the first available one.
    if (!currentElement || !currentElement.matches('.focusable')) {
      const firstFocusable = navigationScope.querySelector('.focusable') as HTMLElement;
      if (firstFocusable) {
        firstFocusable.focus();
        firstFocusable.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      }
      return;
    }

    const focusables = (Array.from(navigationScope.querySelectorAll('.focusable:not([disabled])')) as HTMLElement[])
      .filter(el => {
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
      });
    const currentRect = currentElement.getBoundingClientRect();

    let bestCandidate: HTMLElement | null = null;
    let minDistance = Infinity;

    for (const candidate of focusables) {
      if (candidate === currentElement) continue;

      const candidateRect = candidate.getBoundingClientRect();
      
      const dx = (candidateRect.left + candidateRect.width / 2) - (currentRect.left + currentRect.width / 2);
      const dy = (candidateRect.top + candidateRect.height / 2) - (currentRect.top + currentRect.height / 2);

      let distance: number;

      switch (e.key) {
        case 'ArrowRight':
          if (dx > 0) { // Must be to the right
            distance = Math.abs(dy) * 2 + dx; // Heavily penalize vertical distance
            if (distance < minDistance) {
              minDistance = distance;
              bestCandidate = candidate;
            }
          }
          break;
        case 'ArrowLeft':
          if (dx < 0) { // Must be to the left
            distance = Math.abs(dy) * 2 + Math.abs(dx);
            if (distance < minDistance) {
              minDistance = distance;
              bestCandidate = candidate;
            }
          }
          break;
        case 'ArrowDown':
          if (dy > 0) { // Must be below
            distance = Math.abs(dx) * 2 + dy; // Heavily penalize horizontal distance
            if (distance < minDistance) {
              minDistance = distance;
              bestCandidate = candidate;
            }
          }
          break;
        case 'ArrowUp':
          if (dy < 0) { // Must be above
            distance = Math.abs(dx) * 2 + Math.abs(dy);
            if (distance < minDistance) {
              minDistance = distance;
              bestCandidate = candidate;
            }
          }
          break;
      }
    }

    if (bestCandidate) {
      bestCandidate.focus();
      bestCandidate.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    }
  }, [enterPressCount, showTvCursor, cursorPosition.x, cursorPosition.y]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
  
  useEffect(() => {
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      const focusableCard = target.closest('.focusable');

      // Ensure any previous glow is removed before applying a new one.
      document.body.classList.remove('glow-active');

      if (!focusableCard || !focusableCard.querySelector('img')) {
        return; // Not a card with an image, so no glow.
      }

      const rect = focusableCard.getBoundingClientRect();
      const img = focusableCard.querySelector('img');

      // Set position statically. This is the main performance improvement.
      document.documentElement.style.setProperty('--glow-x', `${rect.left + rect.width / 2}px`);
      document.documentElement.style.setProperty('--glow-y', `${rect.top + rect.height / 2}px`);
      
      if (img && img.src) {
        const imageUrl = img.src;
        // Immediately activate glow with cached or default color for responsiveness
        const immediateColor = colorCache.get(imageUrl) || 'rgba(128, 128, 128, 0.2)';
        document.documentElement.style.setProperty('--glow-color', immediateColor);
        document.body.classList.add('glow-active');

        // If color wasn't cached, fetch it asynchronously and update
        if (!colorCache.has(imageUrl)) {
            extractColorFromImage(imageUrl)
              .then(color => {
                // Only update if the same element is still focused
                if (document.activeElement === target || document.activeElement === focusableCard) {
                  document.documentElement.style.setProperty('--glow-color', color);
                }
              })
              .catch(error => {
                console.error('Error setting glow color:', error);
                // The default glow is already active, so no need to do anything on error
              });
        }
      } else {
        // Fallback for cards that are focusable but might not have an `img` tag
        document.documentElement.style.setProperty('--glow-color', 'rgba(128, 128, 128, 0.2)');
        document.body.classList.add('glow-active');
      }
    };

    const handleFocusOut = () => {
      // Simply remove the class on focus out.
      document.body.classList.remove('glow-active');
    };

    document.body.addEventListener('focusin', handleFocusIn);
    document.body.addEventListener('focusout', handleFocusOut);

    return () => {
        document.body.removeEventListener('focusin', handleFocusIn);
        document.body.removeEventListener('focusout', handleFocusOut);
        document.body.classList.remove('glow-active');
    };
  }, []);

  return ( 
    <LanguageProvider>
      <ProfileProvider>
        {showTvCursor && <TVCursor position={cursorPosition} visible={true} clickEffect={clickEffect} />}
        <HashRouter>
          <PlayerProvider>
            <Routes>
              <Route path="/" element={<ProfilePage />} />
              <Route path="/home" element={<HomePage />} />
              <Route path="/movies" element={<MoviesPage />} />
              <Route path="/tv" element={<TvShowsPage />} />
              <Route path="/actor/:id" element={<ActorDetailsPage />} />
              <Route path="/player" element={<PlayerPage />} />
              <Route path="/favorites" element={<GenericPageWrapper pageType="favorites" />} />
              <Route path="/search" element={<GenericPageWrapper pageType="search" />} />
              <Route path="/all/:category" element={<GenericPageWrapper pageType="all" />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/details/:type/:id" element={<DetailsPage />} />
              <Route path="/cinema" element={<CinemaPage />} />
              <Route path="/live/:type/:id" element={<LiveRoomPage />} />
              <Route path="/shorts" element={<ShortsPage />} />
              <Route path="/you" element={<YouPage />} />
            </Routes>
            <PipPlayer />
            <GlobalModal />
          </PlayerProvider>
        </HashRouter>
        <ToastContainer />
      </ProfileProvider>
    </LanguageProvider>
  );
};

export default App;
