
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { SUPPORTED_LANGUAGES, TARGET_LANGUAGES } from './constants';
import { LanguageSelector } from './components/LanguageSelector';
import { Button } from './components/Button';
import { translateTextStream, playSpeech } from './services/geminiService';
import { HistoryItem } from './types';

const App: React.FC = () => {
  const [inputText, setInputText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [sourceLang, setSourceLang] = useState('auto');
  const [targetLang, setTargetLang] = useState('es');
  const [isTranslating, setIsTranslating] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  const abortControllerRef = useRef<number | null>(null);
  const translationIdRef = useRef<string | null>(null);

  // Load history from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('translation_history');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load history", e);
      }
    }
  }, []);

  const saveToHistory = useCallback((text: string, translated: string, sLang: string, tLang: string) => {
    if (!translated.trim() || !text.trim()) return;
    
    setHistory(prev => {
      // Avoid duplicates at the top
      if (prev.length > 0 && prev[0].translatedText === translated) return prev;

      const item: HistoryItem = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        sourceLanguage: sLang,
        targetLanguage: tLang,
        translatedText: translated,
      };

      const newHistory = [item, ...prev].slice(0, 10);
      localStorage.setItem('translation_history', JSON.stringify(newHistory));
      return newHistory;
    });
  }, []);

  const performTranslation = async (text: string) => {
    if (!text.trim()) {
      setTranslatedText('');
      return;
    }

    setIsTranslating(true);
    setError(null);
    let fullText = '';
    
    try {
      // Clear previous translation state
      setTranslatedText('');
      
      await translateTextStream(
        text,
        sourceLang,
        targetLang,
        (chunk) => {
          fullText += chunk;
          setTranslatedText(fullText);
        }
      );
      
      saveToHistory(text, fullText, sourceLang, targetLang);
    } catch (err: any) {
      // Only show error if it's not a manual abort or interruption
      if (err.name !== 'AbortError') {
        setError(err.message || 'Translation failed. Please try again.');
      }
    } finally {
      setIsTranslating(false);
    }
  };

  // Debounce logic for live translation
  useEffect(() => {
    if (abortControllerRef.current) {
      window.clearTimeout(abortControllerRef.current);
    }

    if (!inputText.trim()) {
      setTranslatedText('');
      setIsTranslating(false);
      return;
    }

    abortControllerRef.current = window.setTimeout(() => {
      performTranslation(inputText);
    }, 800);

    return () => {
      if (abortControllerRef.current) window.clearTimeout(abortControllerRef.current);
    };
  }, [inputText, sourceLang, targetLang]);

  const handleSwapLanguages = () => {
    if (sourceLang === 'auto') return;
    const oldSource = sourceLang;
    const oldTarget = targetLang;
    const oldInput = inputText;
    const oldOutput = translatedText;

    setSourceLang(oldTarget);
    setTargetLang(oldSource);
    setInputText(oldOutput);
    setTranslatedText(oldInput);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const clearAll = () => {
    setInputText('');
    setTranslatedText('');
    setError(null);
  };

  const speakText = (text: string, langCode: string) => {
    const lang = SUPPORTED_LANGUAGES.find(l => l.code === langCode);
    if (lang) {
      playSpeech(text, lang.name);
    }
  };

  return (
    <div className="min-h-screen pb-12 bg-[#F8FAFC]">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold shadow-indigo-100 shadow-lg">L</div>
            <h1 className="text-xl font-bold text-gray-800 tracking-tight">LingoSync</h1>
          </div>
          <div className="flex items-center gap-3">
             <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium transition-colors ${isTranslating ? 'bg-indigo-50 text-indigo-600' : 'bg-gray-50 text-gray-400'}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${isTranslating ? 'bg-indigo-600 animate-pulse' : 'bg-gray-300'}`}></div>
                {isTranslating ? 'AI is thinking...' : 'AI Standby'}
             </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 mt-8">
        {/* Language Selection Bar */}
        <div className="bg-white p-2 rounded-2xl shadow-sm border border-gray-200 flex flex-col md:flex-row items-center gap-2 mb-6">
          <div className="flex-1 w-full">
            <LanguageSelector 
              label="Source Language"
              languages={SUPPORTED_LANGUAGES}
              value={sourceLang}
              onChange={setSourceLang}
            />
          </div>
          
          <button 
            onClick={handleSwapLanguages}
            disabled={sourceLang === 'auto'}
            className="p-3 hover:bg-gray-100 rounded-xl transition-all disabled:opacity-30 active:scale-95 bg-gray-50 md:bg-transparent"
            title="Swap Languages"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 16V4M7 4L3 8M7 4L11 8" />
              <path d="M17 8v12M17 20l4-4M17 20l-4-4" />
            </svg>
          </button>

          <div className="flex-1 w-full">
            <LanguageSelector 
              label="Target Language"
              languages={TARGET_LANGUAGES}
              value={targetLang}
              onChange={setTargetLang}
            />
          </div>
        </div>

        {/* Translation Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Panel */}
          <div className="flex flex-col gap-2">
            <div className="relative bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden group focus-within:border-indigo-300 focus-within:ring-4 focus-within:ring-indigo-50 transition-all">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Type or paste text here..."
                className="w-full h-[320px] p-6 resize-none outline-none text-xl leading-relaxed text-gray-800 placeholder-gray-400 font-light"
              />
              <div className="absolute bottom-4 right-4 flex gap-2">
                {inputText && (
                  <button 
                    onClick={clearAll}
                    className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-lg transition-colors"
                    title="Clear"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                )}
              </div>
              <div className="absolute bottom-4 left-6 text-[10px] font-bold uppercase tracking-widest text-gray-300">
                 {inputText.length} Characters
              </div>
            </div>
            <div className="flex justify-between items-center px-1">
               <button 
                  onClick={() => speakText(inputText, sourceLang === 'auto' ? 'en' : sourceLang)}
                  disabled={!inputText}
                  className="flex items-center gap-2 text-xs font-semibold text-gray-400 hover:text-indigo-600 disabled:opacity-0 transition-all"
               >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                  Listen
               </button>
            </div>
          </div>

          {/* Output Panel */}
          <div className="flex flex-col gap-2">
            <div className={`relative bg-indigo-50/30 rounded-2xl shadow-sm border border-indigo-100 overflow-hidden min-h-[320px] transition-all ${isTranslating ? 'border-indigo-300 ring-2 ring-indigo-50' : ''}`}>
              <div className="w-full h-full p-6 text-xl leading-relaxed text-gray-800 whitespace-pre-wrap font-light">
                {translatedText || (
                  <span className="text-gray-300 italic">Translated text will appear here as you type...</span>
                )}
                {isTranslating && !translatedText && (
                  <div className="flex gap-1 mt-1">
                    <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"></span>
                    <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                    <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                  </div>
                )}
              </div>
              
              <div className="absolute bottom-4 right-4 flex gap-2">
                {translatedText && (
                  <>
                    <button 
                      onClick={() => copyToClipboard(translatedText)}
                      className="p-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-500 rounded-lg shadow-sm transition-all active:scale-90"
                      title="Copy to Clipboard"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                    </button>
                    <button 
                      onClick={() => speakText(translatedText, targetLang)}
                      className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-md transition-all active:scale-90"
                      title="Listen"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                    </button>
                  </>
                )}
              </div>
            </div>
            <div className="flex justify-end px-1">
               <div className="text-[10px] font-bold uppercase tracking-widest text-indigo-300">
                  AI-Powered Real-time Translation
               </div>
            </div>
          </div>
        </div>

        {/* Error Feedback */}
        {error && (
          <div className="mt-6 p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
            <p className="font-medium">{error}</p>
          </div>
        )}

        {/* Recent History Grid */}
        {history.length > 0 && (
          <div className="mt-16">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-gray-800">Recent</h2>
                <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-[10px] font-bold uppercase">{history.length}</span>
              </div>
              <button 
                className="text-xs font-semibold text-gray-400 hover:text-red-500 transition-colors"
                onClick={() => {
                  setHistory([]);
                  localStorage.removeItem('translation_history');
                }}
              >
                Clear History
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {history.map((item) => (
                <div 
                  key={item.id} 
                  className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:border-indigo-200 hover:shadow-md transition-all group cursor-pointer"
                  onClick={() => {
                    setInputText(item.sourceLanguage === sourceLang ? inputText : ''); // Simple logic to "recall" if needed
                  }}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-indigo-500">
                      <span>{SUPPORTED_LANGUAGES.find(l => l.code === item.sourceLanguage)?.name}</span>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 opacity-50" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                      <span>{SUPPORTED_LANGUAGES.find(l => l.code === item.targetLanguage)?.name}</span>
                    </div>
                    <span className="text-[10px] text-gray-300 font-medium">
                      {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-gray-800 text-sm font-medium line-clamp-2 leading-relaxed">
                    {item.translatedText}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Modern Footer */}
      <footer className="mt-24 border-t border-gray-100 py-12 text-center">
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-1.5 grayscale opacity-50">
            <div className="w-5 h-5 bg-indigo-600 rounded flex items-center justify-center text-[10px] text-white font-bold">L</div>
            <span className="text-sm font-bold text-gray-800">LingoSync</span>
          </div>
          <p className="text-xs text-gray-400 font-medium">Built with Gemini 3 Flash for zero-latency communication.</p>
          <div className="flex gap-6 mt-2">
            <a href="#" className="text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-indigo-600">Privacy</a>
            <a href="#" className="text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-indigo-600">Terms</a>
            <a href="#" className="text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-indigo-600">API</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
