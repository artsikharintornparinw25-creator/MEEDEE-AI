
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { analyzeAndWriteStory, generateSpeech, decodeAudioData } from './services/geminiService';
import { ChatSidebar } from './components/ChatSidebar';
import { MorphingLoader } from './components/MorphingLoader';
import { StoryDraft } from './types';

const STORY_GENRES = [
  'Sci-Fi',
  'Fantasy',
  'Mystery',
  'Horror',
  'Romance',
  'Thriller'
];

const STORY_STYLES = [
  'Cinematic',
  'Gothic Noir',
  'High Fantasy',
  'Cyberpunk',
  'Whimsical',
  'Gritty Realism',
  'Lovecraftian'
];

const PACING_OPTIONS = [
  'Slow',
  'Normal',
  'Fast'
];

const AMBIENCE_OPTIONS = [
  'Automatic',
  'Rainy Night',
  'Enchanted Forest',
  'Distopian City',
  'Ancient Hall',
  'Ethereal Void',
  'Ocean Shore',
  'Busy Tavern',
  'Mechanical Works',
  'Snowy Peak',
  'Summer Meadow',
  'Zen Garden'
];

const App: React.FC = () => {
  const [image, setImage] = useState<string | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [story, setStory] = useState<string>('');
  const [selectedGenre, setSelectedGenre] = useState('Sci-Fi');
  const [selectedStyle, setSelectedStyle] = useState('Cinematic');
  const [selectedPacing, setSelectedPacing] = useState('Normal');
  const [selectedAmbience, setSelectedAmbience] = useState('Automatic');
  const [isGenerating, setIsGenerating] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isNarrating, setIsNarrating] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [drafts, setDrafts] = useState<StoryDraft[]>([]);
  const [copySuccess, setCopySuccess] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);

  // Load session and drafts on mount
  useEffect(() => {
    const savedSession = localStorage.getItem('meedee_session');
    if (savedSession) {
      try {
        const { image: savedImage, story: savedStory, genre: savedGenre, style: savedStyle, pacing: savedPacing, ambience: savedAmbience } = JSON.parse(savedSession);
        if (savedImage) setImage(savedImage);
        if (savedStory) setStory(savedStory);
        if (savedGenre) setSelectedGenre(savedGenre);
        if (savedStyle) setSelectedStyle(savedStyle);
        if (savedPacing) setSelectedPacing(savedPacing);
        if (savedAmbience) setSelectedAmbience(savedAmbience);
      } catch (e) {
        console.error("Failed to restore session", e);
      }
    }

    const savedDrafts = localStorage.getItem('meedee_drafts');
    if (savedDrafts) {
      try {
        setDrafts(JSON.parse(savedDrafts));
      } catch (e) {
        console.error("Failed to load drafts", e);
      }
    }
  }, []);

  // Persist session on change
  useEffect(() => {
    if (image || story) {
      localStorage.setItem('meedee_session', JSON.stringify({ 
        image, 
        story, 
        genre: selectedGenre,
        style: selectedStyle,
        pacing: selectedPacing,
        ambience: selectedAmbience
      }));
    }
  }, [image, story, selectedGenre, selectedStyle, selectedPacing, selectedAmbience]);

  // Persist drafts on change
  useEffect(() => {
    localStorage.setItem('meedee_drafts', JSON.stringify(drafts));
  }, [drafts]);

  // Update playback speed in real-time if audio is playing
  useEffect(() => {
    if (sourceNodeRef.current) {
      sourceNodeRef.current.playbackRate.setTargetAtTime(playbackSpeed, audioContextRef.current?.currentTime || 0, 0.1);
    }
  }, [playbackSpeed]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Create immediate local preview
      const previewUrl = URL.createObjectURL(file);
      setLocalPreview(previewUrl);
      setUploadProgress(10);
      
      const reader = new FileReader();
      
      // Simulate upload progress for clearer feedback
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => (prev < 90 ? prev + 3 : prev));
      }, 150);

      reader.onload = async (event) => {
        clearInterval(progressInterval);
        setUploadProgress(100);
        const base64 = event.target?.result as string;
        
        // Brief delay for the user to see the 100% state and the scanning effect
        setTimeout(() => {
          setImage(base64);
          setLocalPreview(null);
          processImage(base64, selectedGenre, selectedStyle, selectedPacing);
          setUploadProgress(0);
        }, 1200);
      };
      reader.readAsDataURL(file);
    }
  };

  const processImage = async (base64: string, genre: string, style: string, pacing: string) => {
    setIsGenerating(true);
    setError(null);
    setStory('');
    try {
      const generatedStory = await analyzeAndWriteStory(base64, style, pacing, genre);
      setStory(generatedStory);
    } catch (err) {
      setError("Failed to reach the creative gods. Check your connection.");
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  const stopNarration = useCallback(() => {
    if (sourceNodeRef.current) {
      sourceNodeRef.current.stop();
      sourceNodeRef.current = null;
    }
    setIsNarrating(false);
  }, []);

  const handleNarration = async () => {
    if (isNarrating) {
      stopNarration();
      return;
    }

    setIsNarrating(true);
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      
      const audioBytes = await generateSpeech(story, selectedAmbience);
      const audioBuffer = await decodeAudioData(audioBytes, audioContextRef.current);
      
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.playbackRate.value = playbackSpeed; // Apply initial speed
      source.connect(audioContextRef.current.destination);
      source.onended = () => setIsNarrating(false);
      
      sourceNodeRef.current = source;
      source.start();
    } catch (err) {
      console.error(err);
      setIsNarrating(false);
      setError("The voice of the story was lost in the wind.");
    }
  };

  const handleSaveDraft = () => {
    if (!story) return;
    const newDraft: StoryDraft = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      image,
      story,
      genre: selectedGenre,
      style: selectedStyle,
      pacing: selectedPacing,
      ambience: selectedAmbience
    };
    setDrafts(prev => [newDraft, ...prev]);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const loadDraft = (draft: StoryDraft) => {
    stopNarration();
    setImage(draft.image);
    setStory(draft.story);
    setSelectedGenre(draft.genre);
    setSelectedStyle(draft.style);
    setSelectedPacing(draft.pacing);
    setSelectedAmbience(draft.ambience);
    setIsLibraryOpen(false);
  };

  const deleteDraft = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDrafts(prev => prev.filter(d => d.id !== id));
  };

  const reset = () => {
    stopNarration();
    setImage(null);
    setLocalPreview(null);
    setStory('');
    setError(null);
    setIsShareModalOpen(false);
    localStorage.removeItem('meedee_session');
    localStorage.removeItem('meedee_chat');
  };

  const handleCopyStory = () => {
    const textToCopy = `MEEDEE-AI Story (${selectedGenre} | ${selectedStyle} style, ${selectedPacing} pacing):\n\n${story}\n\nGenerated with MEEDEE-AI.`;
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row h-screen bg-stone-950 text-stone-100 selection:bg-cyan-600/30">
      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Header */}
        <header className="p-6 border-b border-stone-900 flex items-center justify-between bg-stone-950/80 backdrop-blur-md z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-cyan-600 rounded-lg flex items-center justify-center text-white shadow-[0_0_20px_rgba(8,145,178,0.4)]">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 10v3"/><path d="M6 6v11"/><path d="M10 3v18"/><path d="M14 8v7"/><path d="M18 5v13"/><path d="M22 10v3"/></svg>
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-stone-400 bg-clip-text text-transparent">MEEDEE-AI</h1>
              <p className="text-[10px] text-cyan-500 font-bold uppercase tracking-[0.2em]">Cinematic Audio Engine</p>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <button 
              onClick={() => setIsLibraryOpen(true)}
              className="text-stone-500 hover:text-stone-200 transition-colors flex items-center gap-2 text-sm font-medium relative"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16">
                <path d="M1 2.828c.885-.37 2.154-.769 3.388-.893 1.33-.134 2.458.063 3.112.752v9.746c-.935-.53-2.12-.603-3.213-.493-1.18.12-2.37.461-3.287.811V2.828zm7.5-.141c.654-.689 1.782-.886 3.112-.752 1.234.124 2.503.523 3.388.893v9.923c-.918-.35-2.107-.692-3.287-.81-1.094-.111-2.278-.039-3.213.492V2.687zM8 1.783C7.015.936 5.587.81 4.287.94c-1.514.153-3.042.672-3.994 1.105A.5.5 0 0 0 0 2.5v11a.5.5 0 0 0 .707.455c.882-.4 2.303-.881 3.68-1.02 1.409-.142 2.59.087 3.223.877a.5.5 0 0 0 .78 0c.633-.79 1.814-1.019 3.222-.877 1.378.139 2.8.62 3.681 1.02A.5.5 0 0 0 16 13.5v-11a.5.5 0 0 0-.293-.455c-.952-.433-2.48-.952-3.994-1.105C10.413.809 8.985.936 8 1.783z"/>
              </svg>
              Archive
              {drafts.length > 0 && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
                </span>
              )}
            </button>
            {(image || localPreview) && (
              <button 
                onClick={reset}
                className="text-stone-500 hover:text-cyan-400 transition-colors flex items-center gap-2 text-sm font-medium"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M11.534 7h3.932a.25.25 0 0 1 .192.41l-1.966 2.36a.25.25 0 0 1-.384 0l-1.966-2.36a.25.25 0 0 1 .192-.41zm-1.1 2c.15 0 .285.064.385.166l1.242 1.488c.31.371.91.371 1.22 0l1.242-1.488c.1-.102.235-.166.385-.166h.1a.5.5 0 0 1 0 1h-.1c-.05 0-.085.034-.135.084l-1.242 1.488a1.5 1.5 0 0 1-2.44 0l-1.242-1.488c-.05-.05-.085-.084-.135-.084h-.1a.5.5 0 0 1 0-1h.1z"/>
                  <path d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/>
                  <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/>
                </svg>
                New Sequence
              </button>
            )}
          </div>
        </header>

        {/* Workspace */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center">
          {!image ? (
            <div className="max-w-2xl w-full text-center space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-1000">
              <div className="space-y-4">
                <h2 className="text-4xl md:text-5xl font-serif italic text-stone-200">
                  Visuals that speak volumes.
                </h2>
                <p className="text-stone-500 text-lg">
                  Configure your sequence and upload an image to synthesize a story.
                </p>
              </div>

              {/* Genre, Style, Pacing & Ambience Selectors */}
              <div className={`space-y-8 transition-opacity duration-500 ${uploadProgress > 0 ? 'opacity-20 pointer-events-none' : 'opacity-100'}`}>
                <div className="space-y-4">
                  <p className="text-[10px] uppercase tracking-widest text-cyan-600 font-bold">Story Genre</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {STORY_GENRES.map(genre => (
                      <button
                        key={genre}
                        onClick={() => setSelectedGenre(genre)}
                        className={`px-4 py-2 rounded-full text-xs font-semibold transition-all border ${
                          selectedGenre === genre 
                            ? 'bg-cyan-600 border-cyan-500 text-white shadow-[0_0_15px_rgba(8,145,178,0.3)]' 
                            : 'bg-stone-900 border-stone-800 text-stone-400 hover:border-stone-600'
                        }`}
                      >
                        {genre}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <p className="text-[10px] uppercase tracking-widest text-cyan-600 font-bold">Atmospheric Style</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {STORY_STYLES.map(style => (
                      <button
                        key={style}
                        onClick={() => setSelectedStyle(style)}
                        className={`px-4 py-2 rounded-full text-xs font-semibold transition-all border ${
                          selectedStyle === style 
                            ? 'bg-cyan-600 border-cyan-500 text-white shadow-[0_0_15px_rgba(8,145,178,0.3)]' 
                            : 'bg-stone-900 border-stone-800 text-stone-400 hover:border-stone-600'
                        }`}
                      >
                        {style}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <p className="text-[10px] uppercase tracking-widest text-cyan-600 font-bold">Narrative Tempo</p>
                  <div className="flex justify-center gap-2">
                    {PACING_OPTIONS.map(pacing => (
                      <button
                        key={pacing}
                        onClick={() => setSelectedPacing(pacing)}
                        className={`px-6 py-2 rounded-full text-xs font-semibold transition-all border ${
                          selectedPacing === pacing 
                            ? 'bg-stone-100 border-stone-100 text-stone-950 shadow-[0_0_15px_rgba(255,255,255,0.1)]' 
                            : 'bg-stone-900 border-stone-800 text-stone-400 hover:border-stone-600'
                        }`}
                      >
                        {pacing}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <p className="text-[10px] uppercase tracking-widest text-cyan-600 font-bold">Atmospheric Soundscape</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {AMBIENCE_OPTIONS.map(ambience => (
                      <button
                        key={ambience}
                        onClick={() => setSelectedAmbience(ambience)}
                        className={`px-4 py-2 rounded-full text-xs font-semibold transition-all border ${
                          selectedAmbience === ambience 
                            ? 'bg-cyan-600 border-cyan-500 text-white shadow-[0_0_15px_rgba(8,145,178,0.3)]' 
                            : 'bg-stone-900 border-stone-800 text-stone-400 hover:border-stone-600'
                        }`}
                      >
                        {ambience}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <label className={`group relative block w-full aspect-video border-2 border-dashed rounded-3xl transition-all cursor-pointer flex flex-col items-center justify-center gap-4 overflow-hidden shadow-2xl ${uploadProgress > 0 ? 'border-cyan-600/50 bg-stone-900 scale-105' : 'border-stone-800 hover:border-cyan-600/50 hover:bg-stone-900/50'}`}>
                <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} disabled={uploadProgress > 0} />
                
                {localPreview ? (
                  <div className="absolute inset-0 w-full h-full overflow-hidden flex items-center justify-center">
                    <img src={localPreview} alt="Preview" className="w-full h-full object-cover opacity-60 grayscale blur-[2px]" />
                    
                    {/* Scanning Line Animation */}
                    <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_15px_rgba(34,211,238,0.8)] animate-scan z-30"></div>
                    
                    <div className="absolute inset-0 bg-stone-950/60 backdrop-blur-[1px] flex flex-col items-center justify-center p-12 space-y-8 z-20">
                      <div className="flex flex-col items-center gap-4">
                         <div className="w-16 h-16 rounded-full border-4 border-cyan-600/30 border-t-cyan-500 animate-spin"></div>
                         <h3 className="text-cyan-500 text-sm font-bold uppercase tracking-[0.3em] animate-pulse">
                           Ingesting Source
                         </h3>
                      </div>
                      
                      <div className="w-full max-w-sm space-y-3">
                        <div className="h-1.5 bg-stone-800 rounded-full overflow-hidden shadow-inner">
                          <div 
                            className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 transition-all duration-300 shadow-[0_0_10px_rgba(8,145,178,0.5)]"
                            style={{ width: `${uploadProgress}%` }}
                          ></div>
                        </div>
                        <div className="flex justify-between text-[10px] font-bold text-stone-500 uppercase tracking-widest">
                          <span>Metadata Extraction</span>
                          <span className="text-cyan-600">{uploadProgress}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="w-16 h-16 bg-stone-900 rounded-full flex items-center justify-center text-stone-600 group-hover:text-cyan-500 group-hover:scale-110 transition-all shadow-inner">
                      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
                        <path d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708l3-3z"/>
                      </svg>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-stone-400 font-bold uppercase tracking-widest text-sm group-hover:text-stone-200 transition-colors">Inject Visual Source</span>
                      <span className="text-stone-600 text-[10px] font-medium italic">JPEG, PNG, WEBP</span>
                    </div>
                  </>
                )}
              </label>
            </div>
          ) : (
            <div className="w-full max-w-4xl space-y-8 animate-in fade-in duration-700">
              {/* Image & Story Split */}
              <div className="grid md:grid-cols-2 gap-8 items-start">
                <div className="relative group">
                  <div className="absolute -inset-4 bg-cyan-600/5 blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <img 
                    src={image} 
                    alt="Source" 
                    className="w-full rounded-2xl shadow-2xl border border-stone-800 relative z-10 aspect-[4/3] object-cover"
                  />
                  <div className="absolute top-4 left-4 z-20 flex flex-col gap-2">
                    <div className="px-3 py-1 bg-cyan-600 text-white text-[10px] font-bold uppercase rounded-full shadow-lg">
                      {selectedGenre}
                    </div>
                    <div className="px-3 py-1 bg-stone-100 text-stone-900 text-[10px] font-bold uppercase rounded-full shadow-lg">
                      {selectedStyle} Style
                    </div>
                    <div className="px-3 py-1 bg-stone-800 text-stone-200 text-[10px] font-bold uppercase rounded-full shadow-lg">
                      {selectedPacing} Tempo
                    </div>
                  </div>
                  {isGenerating && <MorphingLoader />}
                </div>

                <div className="space-y-6 flex flex-col justify-center min-h-[300px]">
                  {error ? (
                    <div className="p-4 bg-red-900/20 border border-red-900/50 rounded-xl text-red-200 text-sm">
                      {error}
                    </div>
                  ) : story ? (
                    <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
                      <div className="relative">
                        <svg className="absolute -left-6 -top-2 w-12 h-12 text-stone-800 -z-10" fill="currentColor" viewBox="0 0 32 32">
                          <path d="M10 8c-3.3 0-6 2.7-6 6v10h10V14H6c0-2.2 1.8-4 4-4V8zm14 0c-3.3 0-6 2.7-6 6v10h10V14h-8c0-2.2 1.8-4 4-4V8z"/>
                        </svg>
                        <p className="font-serif text-xl md:text-2xl leading-relaxed text-stone-300 first-letter:text-5xl first-letter:font-bold first-letter:text-cyan-500 first-letter:mr-3 first-letter:float-left">
                          {story}
                        </p>
                      </div>

                      <div className="flex flex-col gap-3 pt-4">
                        <div className="flex flex-wrap items-center gap-4">
                          <button 
                            onClick={handleNarration}
                            className={`flex items-center gap-3 px-6 py-3 rounded-full font-semibold transition-all shadow-lg active:scale-95 ${
                              isNarrating 
                                ? 'bg-cyan-600 text-white hover:bg-cyan-500 ring-4 ring-cyan-600/20' 
                                : 'bg-stone-800 text-stone-200 hover:bg-stone-700'
                            }`}
                          >
                            {isNarrating ? (
                              <>
                                <div className="flex gap-1">
                                  <span className="w-1 h-3 bg-white/60 animate-bounce delay-75"></span>
                                  <span className="w-1 h-4 bg-white animate-bounce delay-150"></span>
                                  <span className="w-1 h-3 bg-white/60 animate-bounce delay-300"></span>
                                </div>
                                Stop Audio
                              </>
                            ) : (
                              <>
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                                  <path d="M11.536 14.01A8.473 8.473 0 0 0 14.026 8a8.473 8.473 0 0 0-2.49-6.01l-.708.707A7.476 7.476 0 0 1 13.025 8c0 2.071-.84 3.946-2.197 5.303l.708.707z"/>
                                  <path d="M10.121 12.596A6.48 6.48 0 0 0 12.025 8a6.48 6.48 0 0 0-1.904-4.596l-.707.707A5.483 5.483 0 0 1 11.025 8a5.483 5.483 0 0 1-1.61 3.89l.706.706z"/>
                                  <path d="M8.707 11.182A4.486 4.486 0 0 0 10.025 8a4.486 4.486 0 0 0-1.318-3.182l-.707.707A3.489 3.489 0 0 1 9.025 8a3.489 3.489 0 0 1-1.025 2.475l.707.707z"/>
                                  <path d="M7 4a.5.5 0 0 0-.812-.39L3.825 5.5H1.5A.5.5 0 0 0 1 6v4a.5.5 0 0 0 .5.5h2.325l2.363 1.89A.5.5 0 0 0 7 12V4z"/>
                                </svg>
                                Play Audio
                              </>
                            )}
                          </button>

                          <div className="flex items-center bg-stone-900 border border-stone-800 rounded-full px-4 py-3 gap-2">
                             <span className="text-[10px] font-bold text-stone-500 uppercase tracking-tighter">Environment</span>
                             <select 
                                value={selectedAmbience}
                                onChange={(e) => setSelectedAmbience(e.target.value)}
                                className="bg-transparent text-cyan-500 text-xs font-bold outline-none cursor-pointer focus:text-cyan-400"
                             >
                                {AMBIENCE_OPTIONS.map(opt => (
                                  <option key={opt} value={opt} className="bg-stone-900">{opt}</option>
                                ))}
                             </select>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <button 
                              onClick={handleSaveDraft}
                              className={`flex items-center gap-3 px-6 py-3 rounded-full font-semibold border transition-all shadow-lg active:scale-95 ${
                                saveSuccess 
                                  ? 'bg-green-600/20 border-green-500 text-green-400' 
                                  : 'bg-stone-900 border-stone-800 text-stone-300 hover:bg-stone-800'
                              }`}
                            >
                              {saveSuccess ? (
                                <>
                                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16">
                                    <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
                                  </svg>
                                  Saved to Archive
                                </>
                              ) : (
                                <>
                                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16">
                                    <path d="M2 1a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H2zm2 4.5a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zm0 2a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zm0 2a.5.5 0 0 1 .5-.5h4a.5.5 0 0 1 0 1h-4a.5.5 0 0 1-.5-.5z"/>
                                  </svg>
                                  Save as Draft
                                </>
                              )}
                            </button>

                            <button 
                              onClick={() => setIsShareModalOpen(true)}
                              className="flex items-center gap-3 px-6 py-3 rounded-full font-semibold bg-stone-900 border border-stone-800 text-stone-300 hover:bg-stone-800 transition-all shadow-lg active:scale-95"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16">
                                <path d="M13.5 1a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM11 2.5a2.5 2.5 0 1 1 .603 1.628l-6.718 3.12a2.499 2.499 0 0 1 0 1.504l6.718 3.12a2.5 2.5 0 1 1-.488.876l-6.718-3.12a2.5 2.5 0 1 1 0-3.256l6.718-3.12A2.5 2.5 0 0 1 11 2.5zm-8.5 4a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm11 5.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/>
                              </svg>
                              Share
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 px-2">
                           <span className="flex h-2 w-2 rounded-full bg-cyan-500 animate-pulse"></span>
                           <span className="text-[10px] uppercase tracking-widest text-stone-500 font-bold">MEEDEE Atmospheric Engine Active</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4 animate-pulse">
                      <div className="h-4 bg-stone-800 rounded w-3/4"></div>
                      <div className="h-4 bg-stone-800 rounded w-full"></div>
                      <div className="h-4 bg-stone-800 rounded w-5/6"></div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Sidebar - Chat Interface */}
      <aside className="w-full md:w-80 lg:w-96 flex-shrink-0">
        <ChatSidebar storyContext={story} />
      </aside>

      {/* Library Modal */}
      {isLibraryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-end">
          <div className="absolute inset-0 bg-stone-950/80 backdrop-blur-sm" onClick={() => setIsLibraryOpen(false)}></div>
          <div className="relative w-full max-w-md h-full bg-stone-900 border-l border-stone-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <header className="p-6 border-b border-stone-800 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-serif italic text-cyan-500">Draft Archive</h2>
                <p className="text-[10px] text-stone-500 uppercase tracking-widest font-bold">Stored in local memory</p>
              </div>
              <button 
                onClick={() => setIsLibraryOpen(false)}
                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-stone-800 text-stone-500 transition-all"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </header>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {drafts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 opacity-30">
                  <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M1 2.828c.885-.37 2.154-.769 3.388-.893 1.33-.134 2.458.063 3.112.752v9.746c-.935-.53-2.12-.603-3.213-.493-1.18.12-2.37.461-3.287.811V2.828zm7.5-.141c.654-.689 1.782-.886 3.112-.752 1.234.124 2.503.523 3.388.893v9.923c-.918-.35-2.107-.692-3.287-.81-1.094-.111-2.278-.039-3.213.492V2.687z"/>
                  </svg>
                  <p className="text-sm font-medium">The Archive is currently empty.</p>
                </div>
              ) : (
                drafts.map((draft) => (
                  <div 
                    key={draft.id} 
                    onClick={() => loadDraft(draft)}
                    className="group relative bg-stone-950 border border-stone-800 rounded-xl overflow-hidden hover:border-cyan-600/50 transition-all cursor-pointer shadow-lg active:scale-[0.98]"
                  >
                    <div className="flex h-24">
                      {draft.image && (
                        <div className="w-24 h-full shrink-0">
                          <img src={draft.image} className="w-full h-full object-cover" alt="" />
                        </div>
                      )}
                      <div className="flex-1 p-3 flex flex-col justify-between overflow-hidden">
                        <div className="space-y-1">
                          <div className="flex justify-between items-start">
                            <span className="text-[10px] font-bold text-cyan-500 uppercase tracking-widest">{draft.genre}</span>
                            <button 
                              onClick={(e) => deleteDraft(draft.id, e)}
                              className="text-stone-700 hover:text-red-500 transition-colors p-1"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                                <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                                <path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4L4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                              </svg>
                            </button>
                          </div>
                          <p className="text-xs text-stone-400 line-clamp-2 italic font-serif leading-tight">
                            "{draft.story}"
                          </p>
                        </div>
                        <span className="text-[8px] text-stone-600 font-bold uppercase tracking-widest">
                          {new Date(draft.timestamp).toLocaleDateString()} • {draft.style}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            <footer className="p-6 border-t border-stone-800 bg-stone-950/50">
              <p className="text-[10px] text-stone-600 text-center uppercase tracking-[0.2em] font-medium">MEEDEE Sequence Library</p>
            </footer>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {isShareModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-10">
          <div className="absolute inset-0 bg-stone-950/90 backdrop-blur-xl" onClick={() => setIsShareModalOpen(false)}></div>
          <div className="relative w-full max-w-3xl bg-stone-900 border border-stone-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-full animate-in zoom-in-95 duration-300">
            <header className="p-6 border-b border-stone-800 flex items-center justify-between bg-stone-900/50">
              <h2 className="text-xl font-serif italic text-cyan-500">Share Sequence</h2>
              <button 
                onClick={() => setIsShareModalOpen(false)}
                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-stone-800 text-stone-500 hover:text-stone-300 transition-all"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-8">
              <div className="flex flex-col md:flex-row gap-8 items-start">
                <img 
                  src={image || ''} 
                  alt="Story Inspiration" 
                  className="w-full md:w-1/3 aspect-[4/3] object-cover rounded-xl border border-stone-800 shadow-lg"
                />
                <div className="flex-1 space-y-4">
                  <h3 className="text-stone-500 uppercase tracking-widest text-[10px] font-bold">The Narrative</h3>
                  <div className="relative">
                    <svg className="absolute -left-4 -top-1 w-8 h-8 text-stone-800 -z-10" fill="currentColor" viewBox="0 0 32 32">
                      <path d="M10 8c-3.3 0-6 2.7-6 6v10h10V14H6c0-2.2 1.8-4 4-4V8zm14 0c-3.3 0-6 2.7-6 6v10h10V14h-8c0-2.2 1.8-4 4-4V8z"/>
                    </svg>
                    <p className="font-serif text-lg leading-relaxed text-stone-300">
                      {story}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-stone-950 p-4 rounded-xl border border-stone-800 space-y-3">
                <p className="text-stone-500 text-[10px] uppercase font-bold tracking-widest">Digital Export</p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button 
                    onClick={handleCopyStory}
                    className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2"
                  >
                    {copySuccess ? (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16">
                          <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
                        </svg>
                        Copied!
                      </>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16">
                          <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/>
                          <path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 1 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"/>
                        </svg>
                        Copy Narrative
                      </>
                    )}
                  </button>
                  <button 
                    onClick={() => {
                      if (navigator.share) {
                        navigator.share({
                          title: 'MEEDEE-AI Cinematic Export',
                          text: story,
                          url: window.location.href,
                        }).catch(console.error);
                      }
                    }}
                    className="flex-1 bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold py-3 rounded-xl transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M13.5 1a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM11 2.5a2.5 2.5 0 1 1 .603 1.628l-6.718 3.12a2.499 2.499 0 0 1 0 1.504l6.718 3.12a2.5 2.5 0 1 1-.488.876l-6.718-3.12a2.5 2.5 0 1 1 0-3.256l6.718-3.12A2.5 2.5 0 0 1 11 2.5zm-8.5 4a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm11 5.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/>
                    </svg>
                    Mobile Share
                  </button>
                </div>
              </div>
            </div>

            <footer className="p-6 border-t border-stone-800 text-center bg-stone-900/80">
              <p className="text-[10px] text-stone-500 uppercase tracking-widest font-medium">Rendered with MEEDEE-AI Cinematic Engine</p>
            </footer>
          </div>
        </div>
      )}

      <style>{`
        @keyframes scan {
          0% { top: -5%; }
          100% { top: 105%; }
        }
        .animate-scan {
          animation: scan 2s linear infinite;
        }
      `}</style>
    </div>
  );
};

export default App;
