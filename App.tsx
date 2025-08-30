

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import PlayerPage from './pages/PlayerPage';
import ProfilePage from './pages/ProfilePage';
import GenericPage from './pages/GenericPage';
import ActorDetailsPage from './pages/ActorDetailsPage';
import SettingsPage from './pages/SettingsPage';
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


const App: React.FC = () => {
  // TV Mode State
  const [tvModeActive] = useState(true); // Always on as requested
  const [cursorVisible, setCursorVisible] = useState(true);
  const [cursorPosition, setCursorPosition] = useState({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const [clickEffect, setClickEffect] = useState(false);
  const visibilityTimeout = useRef<number | null>(null);
  
  const CURSOR_SPEED = 25;
  const SCROLL_ZONE = 80; // px from edge to start scrolling
  const MAX_SCROLL_SPEED = 20; // max pixels per frame

  const showAndResetTimeout = useCallback(() => {
    setCursorVisible(true);
    if (visibilityTimeout.current) {
        window.clearTimeout(visibilityTimeout.current);
    }
    // Hide after 5 seconds of inactivity
    visibilityTimeout.current = window.setTimeout(() => {
        setCursorVisible(false);
    }, 5000);
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!tvModeActive) return;

    // Any key press should make the cursor visible
    showAndResetTimeout();
    
    // Prevent default browser behavior for keys we handle, like scrolling.
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Escape'].includes(e.key)) {
        e.preventDefault();
    }

    switch (e.key) {
        case 'ArrowUp':
            setCursorPosition(prev => ({ ...prev, y: Math.max(0, prev.y - CURSOR_SPEED) }));
            break;
        case 'ArrowDown':
            setCursorPosition(prev => ({ ...prev, y: Math.min(window.innerHeight - 1, prev.y + CURSOR_SPEED) }));
            break;
        case 'ArrowLeft':
            setCursorPosition(prev => ({ ...prev, x: Math.max(0, prev.x - CURSOR_SPEED) }));
            break;
        case 'ArrowRight':
            setCursorPosition(prev => ({ ...prev, x: Math.min(window.innerWidth - 1, prev.x + CURSOR_SPEED) }));
            break;
        case 'Escape': {
            const activeEl = document.activeElement;
            // If an input is focused, blur it to exit "typing mode".
            if (activeEl instanceof HTMLInputElement || activeEl instanceof HTMLTextAreaElement) {
                activeEl.blur();
            }
            break;
        }
        case 'Enter': {
            // Temporarily hide the cursor to not interfere with elementFromPoint
            setCursorVisible(false);
            const element = document.elementFromPoint(cursorPosition.x, cursorPosition.y);
            setCursorVisible(true); // Show it back immediately

            if (!element) break;
            
            const activeEl = document.activeElement;

            // If a text input is currently focused and the user clicks on something else,
            // blur the input field first. This exits "typing mode" automatically.
            if (
                (activeEl instanceof HTMLInputElement || activeEl instanceof HTMLTextAreaElement) &&
                activeEl !== element
            ) {
                activeEl.blur();
            }

            // Trigger click effect animation
            setClickEffect(true);
            setTimeout(() => setClickEffect(false), 400);

            if (element instanceof HTMLInputElement ||
                element instanceof HTMLTextAreaElement ||
                (element instanceof HTMLElement && element.isContentEditable)) {
                element.focus();
            } else if (element instanceof HTMLElement) {
                element.click();
            }
            break;
        }
        default:
            break;
    }
  }, [tvModeActive, cursorPosition.x, cursorPosition.y, showAndResetTimeout]);
  
  // Ref for cursor position to be used in animation frame without causing re-renders
  const cursorPositionRef = useRef(cursorPosition);
  useEffect(() => {
    cursorPositionRef.current = cursorPosition;
  }, [cursorPosition]);

  // Main effect for keyboard listening
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    showAndResetTimeout(); // Show cursor on initial mount

    return () => {
        window.removeEventListener('keydown', handleKeyDown);
        if (visibilityTimeout.current) {
            window.clearTimeout(visibilityTimeout.current);
        }
    };
  }, [handleKeyDown, showAndResetTimeout]);

  // Effect for auto-scrolling
  useEffect(() => {
    let animationFrameId: number;
    
    const getScrollableTarget = (x: number, y: number): Element | Window => {
        let element = document.elementFromPoint(x, y);
        while (element) {
            const style = window.getComputedStyle(element);
            const isScrollable = style.overflowY === 'auto' || style.overflowY === 'scroll';
            if (isScrollable && element.scrollHeight > element.clientHeight) {
                return element;
            }
            if (element === document.body || element === document.documentElement) {
                break;
            }
            element = element.parentElement;
        }
        return window;
    };

    const scrollLoop = () => {
        if (tvModeActive && cursorVisible) {
            const pos = cursorPositionRef.current;
            const distanceToBottom = window.innerHeight - pos.y;
            const distanceToTop = pos.y;
            
            let scrollAmount = 0;
            
            if (distanceToBottom < SCROLL_ZONE) {
                const speedFactor = (SCROLL_ZONE - distanceToBottom) / SCROLL_ZONE;
                scrollAmount = speedFactor * MAX_SCROLL_SPEED;
            } else if (distanceToTop < SCROLL_ZONE) {
                const speedFactor = (SCROLL_ZONE - distanceToTop) / SCROLL_ZONE;
                scrollAmount = -speedFactor * MAX_SCROLL_SPEED;
            }
            
            if (scrollAmount !== 0) {
                const scrollTarget = getScrollableTarget(pos.x, pos.y);
                if (scrollTarget === window) {
                    scrollTarget.scrollBy(0, scrollAmount);
                } else {
                    (scrollTarget as Element).scrollTop += scrollAmount;
                }
            }
        }
        animationFrameId = requestAnimationFrame(scrollLoop);
    };
    
    animationFrameId = requestAnimationFrame(scrollLoop);
    
    return () => {
        cancelAnimationFrame(animationFrameId);
    };
  }, [tvModeActive, cursorVisible]);

  return (
    <LanguageProvider>
      <ProfileProvider>
        {/* Render TV Cursor on top of everything */}
        {tvModeActive && <TVCursor position={cursorPosition} visible={cursorVisible} clickEffect={clickEffect} />}
        <HashRouter>
          <PlayerProvider>
            <Routes>
              <Route path="/" element={<ProfilePage />} />
              <Route path="/home" element={<HomePage />} />
              <Route path="/actor/:id" element={<ActorDetailsPage />} />
              <Route path="/player" element={<PlayerPage />} />
              <Route path="/favorites" element={<GenericPageWrapper pageType="favorites" />} />
              <Route path="/search" element={<GenericPageWrapper pageType="search" />} />
              <Route path="/all/:category" element={<GenericPageWrapper pageType="all" />} />
              <Route path="/settings" element={<SettingsPage />} />
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
