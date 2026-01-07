
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { OrbStatus, Language } from './types';
import {
  POLLING_INTERVAL_MIN,
  POLLING_INTERVAL_MAX,
  LANGUAGES as FALLBACK_LANGUAGES,
  GREEK_VOICES as FALLBACK_VOICES,
  DEFAULT_VOICE
} from './constants';
import { useDraggable } from './hooks/useDraggable';
import Orb from './components/Orb';
import { GeminiLiveService } from './services/geminiService';
import { 
  fetchLatestTranscription, 
  getOrbitKeys,
  addOrbitKey
} from './services/supabaseService';

const DEFAULT_TEST_TEXT = `Welcome to Success Class by Orbit, the real-time translation and voice experience.
Knowledge should travel freely, across borders, accents, and cultures.
This is not just translation.
This is voice, context, and human nuance — delivered in real time.`;

const App: React.FC = () => {
  const [status, setStatus] = useState<OrbStatus>(OrbStatus.IDLE);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [orbitKeys, setOrbitKeys] = useState<string[]>([]);
  const [currentKeyIndex, setCurrentKeyIndex] = useState(0);
  const [newOrbitToken, setNewOrbitToken] = useState('');
  const [isAddingToken, setIsAddingToken] = useState(false);
  
  const queryParams = useMemo(() => new URLSearchParams(window.location.search), []);
  
  const [availableLanguages] = useState<Language[]>(FALLBACK_LANGUAGES);
  const [availableVoices] = useState<{id: string, name: string}[]>(FALLBACK_VOICES);
  
  const [selectedLanguage, setSelectedLanguage] = useState(() => 
    queryParams.get('lang') || localStorage.getItem('orb_lang') || 'en-tl'
  );
  
  const [selectedVoice, setSelectedVoice] = useState(() => {
    const qVoice = queryParams.get('voice');
    if (qVoice) return qVoice;
    const stored = localStorage.getItem('orb_voice');
    if (stored) return stored;
    return FALLBACK_VOICES.find(v => v.name === DEFAULT_VOICE)?.id || 'Charon';
  });

  const [meetingId, setMeetingId] = useState(() => 
    queryParams.get('id') || localStorage.getItem('orb_meeting_id') || '43f847a2-6836-4d5f-b16e-bf67f12972e5'
  );
  const [testText, setTestText] = useState(DEFAULT_TEST_TEXT);
  
  const textQueueRef = useRef<string[]>([]);
  const isBusyRef = useRef<boolean>(false);
  const lastProcessedTextRef = useRef<string | null>(null);
  const liveServiceRef = useRef<GeminiLiveService | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const pollingTimerRef = useRef<number | null>(null);
  
  const { position, isDragging, handleMouseDown: dragMouseDown } = useDraggable(100, 200);

  const shareableIframeCode = useMemo(() => {
    const baseUrl = window.location.origin + window.location.pathname;
    const params = new URLSearchParams();
    if (meetingId) params.set('id', meetingId);
    if (selectedLanguage) params.set('lang', selectedLanguage);
    if (selectedVoice) params.set('voice', selectedVoice);
    
    const fullUrl = `${baseUrl}?${params.toString()}`;
    return `<iframe src="${fullUrl}" width="200" height="200" frameborder="0" style="border:none; overflow:hidden;" allow="autoplay"></iframe>`;
  }, [meetingId, selectedLanguage, selectedVoice]);

  const connectService = useCallback(() => {
    if (!liveServiceRef.current) return;
    
    const langName = availableLanguages.find(l => l.code === selectedLanguage)?.name || 'English';
    setErrorMessage(null);

    liveServiceRef.current.connect(langName, selectedVoice, {
      onTranscription: () => {},
      onAudioStarted: () => setStatus(OrbStatus.SPEAKING),
      onAudioEnded: () => setStatus(OrbStatus.IDLE),
      onTurnComplete: () => {
        isBusyRef.current = false;
        processNextInQueue();
      },
      onConnected: () => setStatus(OrbStatus.IDLE),
      onError: (err) => {
        const msg = err?.message || String(err);
        if (msg.includes("429") || msg.includes("quota")) {
          setErrorMessage("Limit Reached. Rotating...");
          rotateKeyAndReconnect();
        } else if (msg.includes("404")) {
          setErrorMessage("Model Link Failed (404)");
        } else {
          setErrorMessage("Link Error.");
        }
        setStatus(OrbStatus.ERROR);
      }
    });
  }, [selectedLanguage, selectedVoice, availableLanguages]);

  const rotateKeyAndReconnect = useCallback(async () => {
    if (orbitKeys.length === 0) return;
    const nextIdx = (currentKeyIndex + 1) % orbitKeys.length;
    setCurrentKeyIndex(nextIdx);
    if (liveServiceRef.current) {
      liveServiceRef.current.updateOrbitToken(orbitKeys[nextIdx]);
      if (isMonitoring) {
        liveServiceRef.current.disconnect();
        connectService();
      }
    }
  }, [orbitKeys, currentKeyIndex, isMonitoring, connectService]);

  const processNextInQueue = useCallback(async () => {
    if (isBusyRef.current || textQueueRef.current.length === 0 || !liveServiceRef.current) return;
    
    isBusyRef.current = true;
    const text = textQueueRef.current.shift()!;
    setStatus(OrbStatus.BUFFERING);
    
    await liveServiceRef.current.sendText(text);
  }, []);

  const loadOrbitKeys = useCallback(async () => {
    console.log("[ORBIT]: Syncing Memory Bank...");
    const keys = await getOrbitKeys();
    setOrbitKeys(keys);
    if (keys.length > 0 && liveServiceRef.current) {
      liveServiceRef.current.updateOrbitToken(keys[0]);
      // If we are supposed to be monitoring, initiate connection now that we have a key
      if (isMonitoring) {
        connectService();
      }
    }
  }, [isMonitoring, connectService]);

  const handleAddToken = async () => {
    if (!newOrbitToken) return;
    setIsAddingToken(true);
    const success = await addOrbitKey(newOrbitToken);
    if (success) {
      setNewOrbitToken('');
      await loadOrbitKeys();
    }
    setIsAddingToken(false);
  };

  useEffect(() => {
    if (!isMonitoring || !meetingId) {
      if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
      return;
    }
    
    const poll = async () => {
      const latestText = await fetchLatestTranscription(meetingId);
      if (latestText && latestText !== lastProcessedTextRef.current) {
        lastProcessedTextRef.current = latestText;
        textQueueRef.current.push(latestText);
        processNextInQueue();
      }
    };

    poll();
    const interval = Math.floor(Math.random() * (POLLING_INTERVAL_MAX - POLLING_INTERVAL_MIN) + POLLING_INTERVAL_MIN);
    pollingTimerRef.current = window.setInterval(poll, interval);

    return () => {
      if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
    };
  }, [isMonitoring, meetingId, processNextInQueue]);

  const handleTestSpeech = () => {
    if (!testText.trim() || !isMonitoring) return;
    textQueueRef.current.push(testText);
    processNextInQueue();
  };

  const copyIframeToClipboard = () => {
    navigator.clipboard.writeText(shareableIframeCode);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  useEffect(() => {
    const service = new GeminiLiveService();
    liveServiceRef.current = service;
    analyserRef.current = service.getAnalyser();
    
    loadOrbitKeys();
    
    if (queryParams.has('id')) {
      setIsMonitoring(true);
    }
    
    return () => service.disconnect();
  }, []);

  useEffect(() => {
    if (isMonitoring && orbitKeys.length > 0) {
      connectService();
    } else {
      liveServiceRef.current?.disconnect();
      setStatus(OrbStatus.IDLE);
    }
  }, [isMonitoring, connectService, orbitKeys.length]);

  const handleOrbMouseDown = (e: any) => {
    dragMouseDown(e);
    const dt = Date.now();
    const endHandler = (upE: any) => {
      window.removeEventListener('mouseup', endHandler);
      window.removeEventListener('touchend', endHandler);
      if (Date.now() - dt < 200) {
        if (!meetingId && !isMonitoring) {
          setIsSidebarOpen(true);
        } else {
          setIsMonitoring(prev => !prev);
        }
      }
    };
    window.addEventListener('mouseup', endHandler);
    window.addEventListener('touchend', endHandler);
  };

  return (
    <div className="fixed inset-0 pointer-events-none text-white font-sans bg-transparent">
      {errorMessage && (
        <div className="absolute top-10 left-1/2 -translate-x-1/2 bg-rose-600 px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest animate-pulse shadow-2xl z-[100] border border-white/20">
          {errorMessage}
        </div>
      )}

      {isSidebarOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-[60] p-4 pointer-events-none">
          <div className="resizable-modal bg-slate-950/98 backdrop-blur-[60px] border-2 border-white/20 transform transition-all pointer-events-auto shadow-[0_40px_100px_rgba(0,0,0,0.9)] flex flex-col rounded-[2.5rem] overflow-hidden w-[480px] h-[90vh]">
            <div className="flex justify-between items-center p-8 shrink-0 border-b border-white/10 bg-black/40">
              <h2 className="text-2xl font-black text-cyan-400 tracking-tighter uppercase italic drop-shadow-sm">System Config</h2>
              <button onClick={() => setIsSidebarOpen(false)} className="p-3 rounded-2xl bg-white/5 text-white/40 hover:text-white transition-all"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-8 p-8 custom-scrollbar">
              <div className="bg-slate-900/60 p-6 rounded-[2rem] border border-cyan-500/20">
                <label className="block text-[10px] font-black text-cyan-400 uppercase tracking-[0.25em] mb-4">Inject Orbit Token</label>
                <div className="flex gap-2">
                  <input type="password" value={newOrbitToken} onChange={e => setNewOrbitToken(e.target.value)} placeholder="Enter ORBIT TOKEN" className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs font-mono outline-none focus:border-cyan-500/50 transition-all text-white" />
                  <button disabled={isAddingToken} onClick={handleAddToken} className="bg-cyan-500 text-black px-6 py-3 rounded-xl font-black text-[10px] uppercase hover:bg-cyan-400 transition-all disabled:opacity-50">Inject</button>
                </div>
              </div>

              <div className="bg-emerald-950/20 p-6 rounded-[2rem] border border-emerald-500/30">
                <label className="block text-[10px] font-black text-emerald-400 uppercase tracking-[0.25em] mb-4">Deep-Link Share</label>
                <div className="space-y-3">
                  <textarea readOnly value={shareableIframeCode} className="w-full bg-black/60 border border-white/5 rounded-xl px-4 py-3 text-[10px] font-mono min-h-[80px] text-emerald-100/70 outline-none resize-none" />
                  <button onClick={copyIframeToClipboard} className={`w-full py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${copyFeedback ? 'bg-emerald-500 text-black' : 'bg-white/10 text-white/60 hover:bg-white/20'}`}>
                    {copyFeedback ? 'Copied' : 'Copy Iframe Code'}
                  </button>
                </div>
              </div>

              <div className="bg-purple-900/10 p-6 rounded-[2rem] border border-purple-500/20">
                <label className="block text-[10px] font-black text-purple-400 uppercase tracking-[0.25em] mb-4">Neural Testing</label>
                <textarea value={testText} onChange={e => setTestText(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs min-h-[100px] focus:border-purple-500/50 outline-none transition-all text-slate-300 mb-3" />
                <button onClick={handleTestSpeech} className="w-full bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white py-3 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg">Pulse Signal</button>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 ml-1">Matrix Link ID</label>
                  <input type="text" value={meetingId} onChange={e => setMeetingId(e.target.value)} className="w-full bg-white/5 border border-white/20 rounded-2xl px-5 py-4 text-sm font-mono shadow-inner text-cyan-100 outline-none focus:border-cyan-500/50" placeholder="UUID Required" />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 ml-1">Linguistic Logic</label>
                    <select value={selectedLanguage} onChange={e => setSelectedLanguage(e.target.value)} className="w-full bg-slate-900/80 border border-white/20 rounded-2xl px-5 py-4 text-xs appearance-none outline-none focus:border-cyan-500">
                      {availableLanguages.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 ml-1">Voice Synthesis</label>
                    <select value={selectedVoice} onChange={e => setSelectedVoice(e.target.value)} className="w-full bg-slate-900/80 border border-white/20 rounded-2xl px-5 py-4 text-xs appearance-none outline-none focus:border-cyan-500">
                      {availableVoices.map((v, i) => <option key={`${v.id}-${i}`} value={v.id}>{v.name}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <button 
                onClick={() => {
                  localStorage.setItem('orb_lang', selectedLanguage);
                  localStorage.setItem('orb_voice', selectedVoice);
                  localStorage.setItem('orb_meeting_id', meetingId);
                  setSaveFeedback(true);
                  setTimeout(() => setSaveFeedback(false), 2000);
                }} 
                className={`w-full py-5 rounded-2xl font-black text-xs uppercase tracking-[0.4em] transition-all border ${saveFeedback ? 'bg-emerald-500 border-emerald-400 text-white' : 'bg-cyan-600/10 border-cyan-500/40 text-cyan-400 hover:bg-cyan-600/20'}`}
              >
                {saveFeedback ? 'Sequence Locked' : 'Commit Configuration'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="pointer-events-auto absolute" style={{ left: position.x, top: position.y }}>
        <Orb 
          status={status} 
          analyser={analyserRef.current} 
          onMouseDown={handleOrbMouseDown} 
          onSettingsClick={() => setIsSidebarOpen(true)}
          isDragging={isDragging} 
          isPressed={false} 
          isMonitoring={isMonitoring} 
        />
      </div>

      {isSidebarOpen && <div onClick={() => setIsSidebarOpen(false)} className="fixed inset-0 bg-black/80 backdrop-blur-xl pointer-events-auto z-[55]" />}
    </div>
  );
};

export default App;
