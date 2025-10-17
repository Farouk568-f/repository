import React, { useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useProfile } from '../contexts/ProfileContext';
import { useTranslation } from '../contexts/LanguageContext';

const TopNavbar: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { activeProfile, switchProfile } = useProfile();

  const navLinks = [
    { to: '/home', text: t('home') },
    { to: '/tv', text: t('tvShows') },
    { to: '/movies', text: t('movies') },
    { to: '/favorites', text: t('myList') },
  ];

  const navItemClasses = "transition-all duration-200 py-2 px-4 rounded-full focusable text-zinc-300 hover:text-white";
  const activeNavItemClasses = "text-black bg-white font-semibold";


  return (
    <header className={`absolute top-0 w-full z-40 flex items-center h-20 px-4 md:px-10 bg-transparent`}>
      {/* Left Side: Avatar */}
      <div className="flex-shrink-0">
        <div 
            className="flex items-center gap-2 cursor-pointer focusable rounded-full p-1" 
            onClick={switchProfile}
            onKeyDown={(e) => e.key === 'Enter' && switchProfile()}
            tabIndex={0}
        >
          {activeProfile && (
            <img src={activeProfile.avatar} alt={activeProfile.name} className="w-9 h-9 rounded-md object-cover" />
          )}
          <i className="fas fa-caret-down text-white text-sm"></i>
        </div>
      </div>

      {/* Center: Search + Nav */}
      <div className="flex-1 flex justify-center items-center">
        <nav className="hidden md:flex items-center gap-6 text-base">
          <button onClick={() => navigate('/search')} aria-label={t('search')} className="text-2xl text-zinc-100 hover:text-white transition-colors focusable rounded-full w-12 h-12 flex items-center justify-center">
            <i className="fas fa-search"></i>
          </button>
          
          <NavLink to="/home" className={({isActive}) => `${navItemClasses} ${isActive ? activeNavItemClasses : ''}`}>{t('home')}</NavLink>
          <NavLink to="/tv" className={({isActive}) => `${navItemClasses} ${isActive ? activeNavItemClasses : ''}`}>{t('tvShows')}</NavLink>
          <NavLink to="/movies" className={({isActive}) => `${navItemClasses} ${isActive ? activeNavItemClasses : ''}`}>{t('movies')}</NavLink>

          <NavLink to="/ai-search" className={({isActive}) => `${navItemClasses} ${isActive ? activeNavItemClasses : ''}`}>{t('aiSearch')}</NavLink>
          
          <NavLink to="/favorites" className={({isActive}) => `${navItemClasses} ${isActive ? activeNavItemClasses : ''}`}>{t('myList')}</NavLink>

        </nav>
      </div>

      {/* Right Side: N icon */}
      <div className="flex-shrink-0">
        <div className="w-9 h-9 bg-red-600 flex items-center justify-center font-bold text-2xl rounded-md" style={{fontFamily: "'Anton', sans-serif"}}>
          N
        </div>
      </div>
    </header>
  );
};


const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { activeProfile, isKidsMode } = useProfile();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!activeProfile) {
      navigate('/', { replace: true });
    }
  }, [activeProfile, navigate]);

  useEffect(() => {
    if (isKidsMode) {
      document.body.classList.add('kids-mode-bg');
    } else {
      document.body.classList.remove('kids-mode-bg');
    }
    return () => {
      document.body.classList.remove('kids-mode-bg');
    };
  }, [isKidsMode]);

  if (!activeProfile) {
    return null; 
  }

  const noLayout = location.pathname.startsWith('/player');

  if (noLayout) {
      return <>{children}</>
  }

  return (
    <div className="min-h-screen text-[var(--text-light)] bg-transparent transition-colors duration-300">
      <TopNavbar />
      <main key={location.pathname} className={`pb-12`}>
        {children}
      </main>
    </div>
  );
};

export default Layout;
