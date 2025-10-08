import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useTranslation } from '../contexts/LanguageContext';
import { GoogleGenAI, Type } from "@google/genai";
import { fetchFromTMDB } from '../services/apiService';
import { Movie } from '../types';
import { useProfile } from '../contexts/ProfileContext';
import { IMAGE_BASE_URL, BACKDROP_SIZE_MEDIUM } from '../contexts/constants';
import Layout from '../components/Layout';
import { useNavigate } from 'react-router-dom';
import { VirtualKeyboard } from '../components/common';

interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

const recommendationSchema = {
  type: Type.OBJECT,
  properties: {
    recommendations: {
      type: Type.ARRAY,
      description: 'A list of up to 3 movie or TV show recommendations based on the user query.',
      items: {
        type: Type.OBJECT,
        properties: {
          title: {
            type: Type.STRING,
            description: 'The exact title of the movie or TV show.',
          },
          media_type: {
            type: Type.STRING,
            description: 'The type of media. Must be either "movie" or "tv".',
          },
        },
        required: ['title', 'media_type'],
      },
    },
  },
  required: ['recommendations'],
};

const systemInstruction = `You are a movie and TV show finder for a streaming service called CineStream. The user will give you a description.
Your ONLY task is to use your knowledge and access to Google Search to identify the most likely titles the user is looking for.
For each title you identify, you must determine if it's a 'movie' or a 'tv' show.
You must return ONLY a JSON object that adheres to the provided schema, containing an array of up to 3 best matches. Do not add any conversational text or markdown formatting around the JSON object.
Your response must be in the same language as the user's prompt.`;


const SearchResultCard: React.FC<{ movie: Movie; index: number }> = ({ movie, index }) => {
    const { setModalItem } = useProfile();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const type = movie.media_type || (movie.title ? 'movie' : 'tv');

    const handleClick = () => {
        setModalItem(movie);
    };

    if (!movie.backdrop_path) return null;

    return (
        <div 
            onClick={handleClick} 
            className="interactive-card-container cursor-pointer group animate-fade-in-up focusable rounded-lg"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && handleClick()}
            style={{ animationDelay: `${index * 80}ms` }}
        >
            <div className="relative overflow-hidden transition-all duration-300 ease-in-out transform rounded-lg shadow-lg bg-[var(--surface)] interactive-card">
                <img 
                    src={`${IMAGE_BASE_URL}${BACKDROP_SIZE_MEDIUM}${movie.backdrop_path}`} 
                    alt={movie.title || movie.name}
                    className="w-full h-auto object-cover aspect-video"
                />
                 <div className="quick-view bg-[var(--surface)] px-3">
                   <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button onClick={(e) => { e.stopPropagation(); navigate('/player', { state: { item: movie, type } }); }} className="w-9 h-9 flex items-center justify-center text-black bg-white rounded-full text-lg btn-press"><i className="fas fa-play"></i></button>
                        <button onClick={(e) => { e.stopPropagation(); /* TODO */ }} className="w-9 h-9 flex items-center justify-center text-white border-2 border-zinc-500 rounded-full text-lg btn-press hover:border-white"><i className="fas fa-plus"></i></button>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); handleClick(); }} className="w-9 h-9 flex items-center justify-center text-white border-2 border-zinc-500 rounded-full text-lg btn-press hover:border-white"><i className="fas fa-chevron-down"></i></button>
                   </div>
                   <div className="flex items-center gap-2 text-xs mt-3">
                      <span className="font-bold text-green-500">{(movie.vote_average * 10).toFixed(0)}% {t('match')}</span>
                      <span className='px-1.5 py-0.5 border border-white/50 text-[10px] rounded'>HD</span>
                   </div>
                </div>
            </div>
        </div>
    );
};


const AISearchPage: React.FC = () => {
    const { t } = useTranslation();
    const { setModalItem } = useProfile();
    const [messages, setMessages] = useState<ChatMessage[]>([
        { role: 'model', content: t('aiGreeting') }
    ]);
    const [searchResults, setSearchResults] = useState<Movie[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const ai = useMemo(() => {
        if (!process.env.API_KEY) return null;
        return new GoogleGenAI({ apiKey: process.env.API_KEY });
    }, []);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isLoading, isKeyboardVisible]);

    const doSearch = async (query: string) => {
        if (!query || isLoading || !ai) return;

        const userMessage: ChatMessage = { role: 'user', content: query };
        setMessages(prev => [...prev, userMessage]);
        setSearchResults([]);
        setInput('');
        setIsLoading(true);
        setIsKeyboardVisible(false); // Hide keyboard on search

        try {
            // Stage 1: Identification Search using Gemini
            setMessages(prev => [...prev, { role: 'model', content: "Thinking... Let me see what that could be." }]);
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: userMessage.content,
                config: {
                    systemInstruction,
                    responseMimeType: "application/json",
                    responseSchema: recommendationSchema,
                },
                tools: [{ googleSearch: {} }],
            });

            const jsonResponse = JSON.parse(response.text);
            const candidates: { title: string; media_type: 'movie' | 'tv' }[] = jsonResponse.recommendations || [];

            if (candidates.length > 0) {
                const titles = candidates.map(c => `"${c.title}"`).join(', ');
                setMessages(prev => [...prev, { role: 'model', content: `Okay, I think you might be looking for ${titles}. Let me check our library...` }]);

                // Stage 2 & 3: Search TMDB and set results
                const tmdbPromises = candidates.map(candidate =>
                    fetchFromTMDB(`/search/${candidate.media_type}`, { query: candidate.title })
                        .then(res => res.results?.[0] ? { ...res.results[0], media_type: candidate.media_type } : null) // Take top result and ensure media_type
                        .catch(() => null)
                );

                const tmdbResults = await Promise.all(tmdbPromises);
                const validResults = tmdbResults.filter((item): item is Movie => !!(item && item.backdrop_path));

                setSearchResults(validResults);

                if (validResults.length > 0) {
                    setMessages(prev => [...prev, { role: 'model', content: "Here are the best matches I found for you! Click any of them to see the details." }]);
                } else {
                    setMessages(prev => [...prev, { role: 'model', content: "I found some potential titles, but unfortunately, they don't seem to be in our library right now." }]);
                }
            } else {
                setMessages(prev => [...prev, { role: 'model', content: "I couldn't quite figure out what you're looking for. Could you try describing it differently?" }]);
            }
        } catch (error) {
            console.error("Error with AI search:", error);
            setMessages(prev => [...prev, { role: 'model', content: "Sorry, I encountered an error. Please try again." }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        doSearch(input);
    };

    const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (isKeyboardVisible) {
            e.preventDefault();
            if (e.key === 'ArrowDown') {
                const firstKey = document.querySelector('[data-row="0"][data-col="0"]') as HTMLElement | null;
                firstKey?.focus();
            } else if (e.key === 'Enter') {
                doSearch(input);
            }
        }
    };
    
    if (!ai) {
        return (
             <Layout>
                <div className="pt-24 px-4 flex justify-center text-center">
                    <div className="w-full max-w-2xl bg-[var(--surface)] rounded-2xl p-8">
                        <h2 className="text-2xl font-bold text-red-500">Configuration Error</h2>
                        <p className="mt-4 text-zinc-300">The Gemini API key is not configured. Please set the `GEMINI_API_KEY` environment variable to use this feature.</p>
                    </div>
                </div>
            </Layout>
        )
    }

    return (
        <Layout>
            <div className="pt-24 px-4 flex justify-center">
                <div 
                    className="w-full max-w-3xl flex flex-col" 
                    style={{ 
                        height: 'calc(100vh - 6rem)',
                        paddingBottom: isKeyboardVisible ? '280px' : '0',
                        transition: 'padding-bottom 0.3s ease-out'
                    }}
                >
                    <main className="flex-1 overflow-y-auto p-4 no-scrollbar">
                        <div className="space-y-4">
                            {messages.map((msg, index) => (
                                <div key={index} className={`flex gap-3 animate-fade-in-up ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    {msg.role === 'model' && <div className="w-8 h-8 flex-shrink-0 bg-red-600 rounded-full flex items-center justify-center font-bold text-lg" style={{fontFamily: "'Anton', sans-serif"}}>N</div>}
                                    <div className={`max-w-md lg:max-w-xl rounded-2xl p-4 ${msg.role === 'user' ? 'bg-zinc-700 rounded-br-none' : 'bg-zinc-800 rounded-bl-none'}`}>
                                    <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                                    </div>
                                </div>
                            ))}

                            {isLoading && messages[messages.length - 1]?.role !== 'model' && (
                                <div className="flex gap-3 animate-fade-in-up justify-start">
                                    <div className="w-8 h-8 flex-shrink-0 bg-red-600 rounded-full flex items-center justify-center font-bold text-lg" style={{fontFamily: "'Anton', sans-serif"}}>N</div>
                                    <div className="max-w-md lg:max-w-2xl rounded-2xl p-4 bg-zinc-800 rounded-bl-none">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 bg-zinc-400 rounded-full animate-[pulse_1.5s_infinite_0.1s]"></div>
                                            <div className="w-2 h-2 bg-zinc-400 rounded-full animate-[pulse_1.5s_infinite_0.2s]"></div>
                                            <div className="w-2 h-2 bg-zinc-400 rounded-full animate-[pulse_1.5s_infinite_0.3s]"></div>
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div ref={chatEndRef} />
                        </div>  
   
                        {searchResults.length > 0 && (
                            <div className="mt-6 pt-6 border-t border-zinc-700/50">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {searchResults.map((movie, index) => <SearchResultCard key={movie.id} movie={movie} index={index} />)}
                                </div>
                            </div>
                        )}
                    </main>

                    <footer className="p-4 flex-shrink-0">
                        <form onSubmit={handleFormSubmit} className="flex items-center gap-3">
                            <input
                                ref={inputRef}
                                type="text"
                                value={input}
                                onFocus={() => setIsKeyboardVisible(true)}
                                readOnly
                                onKeyDown={handleInputKeyDown}
                                placeholder={t('aiSearchPlaceholder')}
                                className="flex-1 bg-zinc-700 h-12 px-4 rounded-full text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focusable"
                                disabled={isLoading}
                            />
                            <button type="submit" disabled={isLoading || !input.trim()} className="w-12 h-12 bg-[var(--primary)] rounded-full flex items-center justify-center text-white disabled:bg-zinc-600 btn-press focusable">
                                <i className="fa-solid fa-arrow-up text-lg"></i>
                            </button>
                        </form>
                    </footer>
                </div>
            </div>
            {isKeyboardVisible && (
                <VirtualKeyboard
                    isVisible={isKeyboardVisible}
                    onInput={(char) => setInput(prev => prev + char)}
                    onBackspace={() => setInput(prev => prev.slice(0, -1))}
                    onClose={() => {
                        setIsKeyboardVisible(false);
                        inputRef.current?.blur();
                    }}
                    onFocusUp={() => inputRef.current?.focus()}
                />
            )}
        </Layout>
    );
};

export default AISearchPage;
