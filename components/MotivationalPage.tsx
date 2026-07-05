import React, { useState, useRef, useEffect } from 'react';
import {
    ArrowLeft, Quote, Sparkles, Shuffle, Copy, Check, Play, Pause,
    Download, Loader2, AlertCircle, X, ChevronDown, Volume2,
    Video, Mic, Type, Image, Music, Zap, RefreshCw, BookOpen,
    Brain, Heart, TrendingUp, Flame, Sun, Moon, Mountain, Building2,
    ExternalLink
} from 'lucide-react';

interface MotivationalPageProps {
    onBack: () => void;
}

// Niche definitions with colors and icons
const NICHES = [
    {
        key: 'stoicism',
        name: 'Stoicism',
        icon: BookOpen,
        emoji: '🧘',
        description: 'Ancient wisdom for modern life',
        gradient: 'from-slate-600 to-slate-800',
        accent: 'slate',
        quoteSource: 'stoic'
    },
    {
        key: 'hustle',
        name: 'Hustle',
        icon: TrendingUp,
        emoji: '💰',
        description: 'Success mindset & grind',
        gradient: 'from-red-600 to-orange-700',
        accent: 'red',
        quoteSource: 'zen'
    },
    {
        key: 'affirmation',
        name: 'Affirmation',
        icon: Heart,
        emoji: '🌅',
        description: 'Self-love & positivity',
        gradient: 'from-pink-500 to-rose-600',
        accent: 'pink',
        quoteSource: 'affirmation'
    },
    {
        key: 'psychology',
        name: 'Psychology',
        icon: Brain,
        emoji: '🧠',
        description: 'Mind hacks & insights',
        gradient: 'from-indigo-600 to-purple-700',
        accent: 'indigo',
        quoteSource: 'zen'
    },
    {
        key: 'story',
        name: 'Story',
        icon: Flame,
        emoji: '📖',
        description: 'Parables & moral tales',
        gradient: 'from-amber-600 to-orange-700',
        accent: 'amber',
        quoteSource: 'zen'
    }
];

// Visual style presets
const VISUAL_STYLES = [
    { key: 'dark_mode', name: 'Dark Mode', icon: Moon, description: 'Dramatic & high contrast' },
    { key: 'sunrise', name: 'Sunrise', icon: Sun, description: 'Warm golden tones' },
    { key: 'nature', name: 'Nature', icon: Mountain, description: 'Forest & mountains' },
    { key: 'urban', name: 'Urban', icon: Building2, description: 'City & hustle' }
];

// Hook categories
const HOOK_CATEGORIES = [
    { key: 'curiosity', name: 'Curiosity', emoji: '🔍' },
    { key: 'personal', name: 'Personal', emoji: '💫' },
    { key: 'challenge', name: 'Challenge', emoji: '💪' },
    { key: 'wisdom', name: 'Wisdom', emoji: '📜' },
    { key: 'urgent', name: 'Urgent', emoji: '⚡' }
];

export const MotivationalPage: React.FC<MotivationalPageProps> = ({ onBack }) => {
    // Niche selection
    const [selectedNiche, setSelectedNiche] = useState(NICHES[0]);

    // Quote state
    const [quoteMode, setQuoteMode] = useState<'api' | 'custom' | 'ai'>('api');
    const [quote, setQuote] = useState('');
    const [author, setAuthor] = useState('');
    const [customQuote, setCustomQuote] = useState('');
    const [customAuthor, setCustomAuthor] = useState('');
    const [aiTheme, setAiTheme] = useState('');
    const [isLoadingQuote, setIsLoadingQuote] = useState(false);

    // Script state
    const [script, setScript] = useState<any>(null);
    const [isGeneratingScript, setIsGeneratingScript] = useState(false);
    const [selectedHookCategory, setSelectedHookCategory] = useState('wisdom');
    const [hooks, setHooks] = useState<Record<string, string[]>>({});
    const [selectedHook, setSelectedHook] = useState('');

    // Voice state
    const [voices, setVoices] = useState<any[]>([]);
    const [selectedVoice, setSelectedVoice] = useState('male-deep');
    const [voiceSpeed, setVoiceSpeed] = useState('+0%');
    const [isGeneratingVoice, setIsGeneratingVoice] = useState(false);
    const [voiceAudioPath, setVoiceAudioPath] = useState<string | null>(null);
    const [isPlayingVoice, setIsPlayingVoice] = useState(false);
    const audioRef = useRef<HTMLAudioElement>(null);

    // Visual style state
    const [selectedVisualStyle, setSelectedVisualStyle] = useState('dark_mode');
    const [brollResults, setBrollResults] = useState<any[]>([]);
    const [selectedBroll, setSelectedBroll] = useState<string | null>(null);
    const [isSearchingBroll, setIsSearchingBroll] = useState(false);

    // YouTube B-Roll state
    const [brollUrl, setBrollUrl] = useState('');
    const [brollStartTime, setBrollStartTime] = useState('0:00');
    const [brollEndTime, setBrollEndTime] = useState('0:30');
    const [isDownloadingBroll, setIsDownloadingBroll] = useState(false);

    // AI YouTube B-Roll state
    const [brollMode, setBrollMode] = useState<'manual' | 'ai'>('manual');
    const [aiSuggestions, setAiSuggestions] = useState<any>(null);
    const [resolvedClips, setResolvedClips] = useState<any[]>([]);
    const [approvedClipIndices, setApprovedClipIndices] = useState<Set<number>>(new Set());
    const [aiDownloadedClips, setAiDownloadedClips] = useState<any[]>([]);
    const [isGettingAiSuggestions, setIsGettingAiSuggestions] = useState(false);
    const [isResolvingClips, setIsResolvingClips] = useState(false);
    const [isDownloadingAiClips, setIsDownloadingAiClips] = useState(false);
    const [isAssemblingAi, setIsAssemblingAi] = useState(false);
    const [loadingAlternativeIndex, setLoadingAlternativeIndex] = useState<number | null>(null);

    // Video assembly state
    const [isAssembling, setIsAssembling] = useState(false);
    const [assembledVideoPath, setAssembledVideoPath] = useState<string | null>(null);

    // Caption style state
    const [selectedCaptionStyle, setSelectedCaptionStyle] = useState('viral');

    // UI state
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [activeSection, setActiveSection] = useState<'quote' | 'script' | 'voice' | 'visual' | 'export'>('quote');

    // Load hooks on mount
    useEffect(() => {
        fetch('http://localhost:3005/api/motivational/hooks')
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    setHooks(data.hooks);
                    // Set initial hook
                    if (data.hooks.wisdom && data.hooks.wisdom.length > 0) {
                        setSelectedHook(data.hooks.wisdom[0]);
                    }
                }
            })
            .catch(console.error);

        fetch('http://localhost:3005/api/motivational/voices')
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    setVoices(data.voices);
                }
            })
            .catch(console.error);
    }, []);

    // Update selected hook when category changes
    useEffect(() => {
        if (hooks[selectedHookCategory] && hooks[selectedHookCategory].length > 0) {
            setSelectedHook(hooks[selectedHookCategory][0]);
        }
    }, [selectedHookCategory, hooks]);

    // Fetch quote from API
    const fetchQuote = async () => {
        setIsLoadingQuote(true);
        setError(null);

        try {
            const response = await fetch(`http://localhost:3005/api/motivational/quote/${selectedNiche.quoteSource}`);
            const data = await response.json();

            if (data.success) {
                setQuote(data.quote);
                setAuthor(data.author);
            } else {
                throw new Error(data.error || 'Failed to fetch quote');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch quote');
        } finally {
            setIsLoadingQuote(false);
        }
    };

    // Generate AI quote
    const generateAIQuote = async () => {
        setIsLoadingQuote(true);
        setError(null);

        try {
            const response = await fetch('http://localhost:3005/api/motivational/generate-quote', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    niche: selectedNiche.key,
                    theme: aiTheme || 'life wisdom'
                })
            });
            const data = await response.json();

            if (data.success) {
                setQuote(data.quote);
                setAuthor(data.author);
            } else {
                throw new Error(data.error || 'Failed to generate quote');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to generate quote');
        } finally {
            setIsLoadingQuote(false);
        }
    };

    // Use custom quote
    const useCustomQuote = () => {
        if (customQuote.trim()) {
            setQuote(customQuote);
            setAuthor(customAuthor || 'Unknown');
        }
    };

    // Generate full script
    const generateScript = async () => {
        if (!quote) {
            setError('Please get a quote first');
            return;
        }

        setIsGeneratingScript(true);
        setError(null);

        try {
            const response = await fetch('http://localhost:3005/api/motivational/expand-script', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    quote,
                    author,
                    niche: selectedNiche.key,
                    hookStyle: selectedHookCategory,
                    customHook: selectedHook
                })
            });
            const data = await response.json();

            if (data.success) {
                setScript(data.script);
                setActiveSection('script');
            } else {
                throw new Error(data.error || 'Failed to generate script');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to generate script');
        } finally {
            setIsGeneratingScript(false);
        }
    };

    // Generate voiceover
    const generateVoice = async () => {
        if (!script) {
            setError('Please generate a script first');
            return;
        }

        setIsGeneratingVoice(true);
        setError(null);

        // Combine script parts into spoken text
        const spokenText = `${script.hook} ${script.quote} ${script.explanation} ${script.cta}`;

        try {
            const response = await fetch('http://localhost:3005/api/motivational/generate-voice', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: spokenText,
                    voice: selectedVoice,
                    speed: voiceSpeed
                })
            });
            const data = await response.json();

            if (data.success) {
                setVoiceAudioPath(`http://localhost:3005${data.audioPath}`);
                setActiveSection('voice');
            } else {
                throw new Error(data.error || 'Failed to generate voice');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to generate voice');
        } finally {
            setIsGeneratingVoice(false);
        }
    };

    // Play/pause voice preview
    const toggleVoicePlayback = () => {
        if (audioRef.current) {
            if (isPlayingVoice) {
                audioRef.current.pause();
            } else {
                audioRef.current.play();
            }
            setIsPlayingVoice(!isPlayingVoice);
        }
    };

    // Search B-Roll
    const searchBroll = async () => {
        if (!script?.visualCues || script.visualCues.length === 0) {
            setError('Please generate a script first');
            return;
        }

        setIsSearchingBroll(true);
        setError(null);

        try {
            const searchQuery = script.visualCues[0]; // Use first visual cue
            const response = await fetch(`http://localhost:3005/api/broll/search?query=${encodeURIComponent(searchQuery)}&type=video&perPage=8`);
            const data = await response.json();

            if (data.success) {
                setBrollResults(data.results || []);
                setActiveSection('visual');
            } else {
                throw new Error(data.error || 'Failed to search B-Roll');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to search B-Roll');
        } finally {
            setIsSearchingBroll(false);
        }
    };

    // Download YouTube B-Roll
    const downloadBroll = async () => {
        if (!brollUrl) {
            setError('Please enter a YouTube URL');
            return;
        }

        setIsDownloadingBroll(true);
        setError(null);

        try {
            const response = await fetch('http://localhost:3005/api/motivational/download-broll', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: brollUrl,
                    startTime: brollStartTime,
                    endTime: brollEndTime,
                    cropVertical: true
                })
            });
            const data = await response.json();

            if (data.success) {
                setSelectedBroll(data.filename);
                setActiveSection('visual');
            } else {
                throw new Error(data.error || 'Failed to download B-Roll');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to download B-Roll');
        } finally {
            setIsDownloadingBroll(false);
        }
    };

    // AI YouTube: Get AI-suggested clips
    const getAiSuggestions = async () => {
        if (!script) {
            setError('Please generate a script first');
            return;
        }

        setIsGettingAiSuggestions(true);
        setError(null);
        setAiSuggestions(null);
        setResolvedClips([]);
        setApprovedClipIndices(new Set());
        setAiDownloadedClips([]);

        try {
            // Step 1: Get AI suggestions
            const response = await fetch('http://localhost:3005/api/motivational/ai-youtube-suggest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    quote,
                    script,
                    niche: selectedNiche.key
                })
            });
            const data = await response.json();

            if (data.success) {
                setAiSuggestions(data.suggestions);

                // Step 2: Automatically resolve URLs
                setIsGettingAiSuggestions(false);
                setIsResolvingClips(true);

                const resolveResponse = await fetch('http://localhost:3005/api/motivational/ai-youtube-resolve', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ clips: data.suggestions.clips })
                });
                const resolveData = await resolveResponse.json();

                if (resolveData.success) {
                    setResolvedClips(resolveData.resolvedClips);
                }
            } else {
                throw new Error(data.error || 'Failed to get AI suggestions');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to get AI suggestions');
        } finally {
            setIsGettingAiSuggestions(false);
            setIsResolvingClips(false);
        }
    };

    // Toggle clip approval
    const toggleClipApproval = (index: number) => {
        setApprovedClipIndices(prev => {
            const newSet = new Set(prev);
            if (newSet.has(index)) {
                newSet.delete(index);
            } else {
                newSet.add(index);
            }
            return newSet;
        });
    };

    // Open YouTube video at timestamp
    const openYouTubeClip = (clip: any) => {
        if (clip.youtubeUrl) {
            window.open(clip.youtubeUrl, '_blank');
        }
    };

    // Get alternative clip for specific index
    const getAlternativeClip = async (index: number) => {
        const clip = resolvedClips[index];
        if (!clip) return;

        setLoadingAlternativeIndex(index);
        setError(null);

        try {
            const response = await fetch('http://localhost:3005/api/motivational/ai-youtube-alternative', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    segment: clip.segment,
                    currentSuggestion: clip.videoTitle || clip.actualTitle,
                    duration: clip.duration
                })
            });
            const data = await response.json();

            if (data.success && data.alternative) {
                // Replace the clip at this index
                setResolvedClips(prev => {
                    const updated = [...prev];
                    updated[index] = { ...data.alternative, index };
                    return updated;
                });
                // Remove from approved if it was approved
                setApprovedClipIndices(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(index);
                    return newSet;
                });
            } else {
                throw new Error(data.error || 'Failed to get alternative');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to get alternative');
        } finally {
            setLoadingAlternativeIndex(null);
        }
    };

    // AI YouTube: Download only approved clips
    const downloadAiClips = async () => {
        if (approvedClipIndices.size === 0) {
            setError('Please approve at least one clip');
            return;
        }

        const approvedClips = resolvedClips.filter((_, idx) => approvedClipIndices.has(idx));

        setIsDownloadingAiClips(true);
        setError(null);

        try {
            const response = await fetch('http://localhost:3005/api/motivational/ai-youtube-download', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clips: approvedClips })
            });
            const data = await response.json();

            if (data.success) {
                setAiDownloadedClips(data.downloadedClips);
                if (data.errors?.length > 0) {
                    setError(`Downloaded ${data.downloadedClips.length}/${approvedClips.length} clips. Some failed.`);
                }
            } else {
                throw new Error(data.error || 'Failed to download clips');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to download clips');
        } finally {
            setIsDownloadingAiClips(false);
        }
    };

    // AI YouTube: Assemble video with all clips
    const assembleAiVideo = async () => {
        if (!aiDownloadedClips || aiDownloadedClips.length === 0) {
            setError('No clips to assemble');
            return;
        }

        if (!voiceAudioPath) {
            setError('Please generate a voiceover first');
            return;
        }

        setIsAssemblingAi(true);
        setError(null);

        try {
            const audioFilename = voiceAudioPath.split('/').pop();

            const response = await fetch('http://localhost:3005/api/motivational/ai-youtube-assemble', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    clips: aiDownloadedClips,
                    audioFilename,
                    script,
                    captionStyle: selectedCaptionStyle
                })
            });
            const data = await response.json();

            if (data.success) {
                setAssembledVideoPath(`http://localhost:3005${data.videoPath}`);
                setActiveSection('export');
            } else {
                throw new Error(data.error || 'Failed to assemble video');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to assemble video');
        } finally {
            setIsAssemblingAi(false);
        }
    };

    // Assemble final video with INSANE captions
    const assembleVideo = async () => {
        if (!voiceAudioPath) {
            setError('Please generate a voiceover first');
            return;
        }

        setIsAssembling(true);
        setError(null);

        try {
            // Extract filename from path
            const audioFilename = voiceAudioPath.split('/').pop();

            const response = await fetch('http://localhost:3005/api/motivational/assemble-video', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    audioFilename,
                    backgroundVideoFilename: selectedBroll,
                    script: script, // Pass full script for caption burning
                    captionStyle: selectedCaptionStyle // Use selected caption style
                })
            });
            const data = await response.json();

            if (data.success) {
                setAssembledVideoPath(`http://localhost:3005${data.videoPath}`);
                setActiveSection('export');
            } else {
                throw new Error(data.error || 'Failed to assemble video');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to assemble video');
        } finally {
            setIsAssembling(false);
        }
    };

    // Copy script to clipboard
    const copyScript = () => {
        if (script) {
            const fullScript = `${script.hook}\n\n"${script.quote}" - ${script.author}\n\n${script.explanation}\n\n${script.cta}\n\n${script.hashtags?.join(' ') || ''}`;
            navigator.clipboard.writeText(fullScript);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    // Get accent color classes based on niche
    const getAccentClasses = () => {
        const colorMap: Record<string, { bg: string; border: string; text: string; glow: string }> = {
            slate: { bg: 'bg-slate-500/20', border: 'border-slate-500', text: 'text-slate-300', glow: 'shadow-slate-500/25' },
            red: { bg: 'bg-red-500/20', border: 'border-red-500', text: 'text-red-300', glow: 'shadow-red-500/25' },
            pink: { bg: 'bg-pink-500/20', border: 'border-pink-500', text: 'text-pink-300', glow: 'shadow-pink-500/25' },
            indigo: { bg: 'bg-indigo-500/20', border: 'border-indigo-500', text: 'text-indigo-300', glow: 'shadow-indigo-500/25' },
            amber: { bg: 'bg-amber-500/20', border: 'border-amber-500', text: 'text-amber-300', glow: 'shadow-amber-500/25' }
        };
        return colorMap[selectedNiche.accent] || colorMap.slate;
    };

    const accentClasses = getAccentClasses();

    return (
        <div className="min-h-screen pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto animate-fade-in">
            {/* Hidden Audio Element */}
            <audio
                ref={audioRef}
                src={voiceAudioPath || ''}
                onEnded={() => setIsPlayingVoice(false)}
            />

            {/* Header */}
            <div className="mb-8">
                <button
                    onClick={onBack}
                    className="text-gray-500 hover:text-white text-sm mb-4 transition-colors flex items-center group"
                >
                    <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
                    Back to Categories
                </button>
                <h1 className="text-4xl font-bold text-white flex items-center">
                    <Sparkles className={`w-10 h-10 mr-3 ${accentClasses.text}`} />
                    Motivational Studio
                    <span className={`ml-3 px-3 py-1 rounded-full text-xs font-medium ${accentClasses.bg} ${accentClasses.text} border ${accentClasses.border}`}>
                        {selectedNiche.emoji} {selectedNiche.name}
                    </span>
                </h1>
                <p className="text-gray-400 mt-2">Create viral motivational content with AI-powered automation</p>
            </div>

            {/* Error Display */}
            {error && (
                <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start">
                    <AlertCircle className="w-5 h-5 text-red-400 mr-3 flex-shrink-0 mt-0.5" />
                    <p className="text-red-300 text-sm">{error}</p>
                    <button onClick={() => setError(null)} className="ml-auto">
                        <X className="w-4 h-4 text-red-400 hover:text-red-300" />
                    </button>
                </div>
            )}

            {/* Niche Selector */}
            <div className="mb-8">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center">
                    <Zap className="w-5 h-5 mr-2 text-yellow-400" />
                    Choose Your Niche
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {NICHES.map((niche) => {
                        const Icon = niche.icon;
                        const isSelected = selectedNiche.key === niche.key;
                        return (
                            <button
                                key={niche.key}
                                onClick={() => {
                                    setSelectedNiche(niche);
                                    setQuote('');
                                    setAuthor('');
                                    setScript(null);
                                }}
                                className={`p-4 rounded-2xl transition-all duration-300 text-left group relative overflow-hidden ${isSelected
                                    ? `bg-gradient-to-br ${niche.gradient} border-2 border-white/30 shadow-lg`
                                    : 'bg-white/5 border-2 border-transparent hover:bg-white/10 hover:border-white/10'
                                    }`}
                            >
                                <div className="relative z-10">
                                    <div className="text-3xl mb-2">{niche.emoji}</div>
                                    <div className="font-bold text-white">{niche.name}</div>
                                    <div className="text-xs text-white/70 mt-1">{niche.description}</div>
                                </div>
                                {isSelected && (
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Left Column: Quote Engine */}
                <div className="space-y-6">
                    <div className="glass-card rounded-2xl p-6">
                        <h3 className="text-lg font-semibold text-white flex items-center mb-4">
                            <Quote className={`w-5 h-5 mr-2 ${accentClasses.text}`} />
                            Quote Engine
                        </h3>

                        {/* Quote Mode Tabs */}
                        <div className="flex rounded-xl bg-black/30 p-1 mb-4">
                            {[
                                { key: 'api', label: 'API Quote', icon: Shuffle },
                                { key: 'custom', label: 'Custom', icon: Type },
                                { key: 'ai', label: 'AI Generate', icon: Sparkles }
                            ].map((mode) => {
                                const Icon = mode.icon;
                                return (
                                    <button
                                        key={mode.key}
                                        onClick={() => setQuoteMode(mode.key as any)}
                                        className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center ${quoteMode === mode.key
                                            ? `${accentClasses.bg} ${accentClasses.text}`
                                            : 'text-gray-400 hover:text-white'
                                            }`}
                                    >
                                        <Icon className="w-4 h-4 mr-1" />
                                        {mode.label}
                                    </button>
                                );
                            })}
                        </div>

                        {/* API Quote Mode */}
                        {quoteMode === 'api' && (
                            <div className="space-y-4">
                                <p className="text-gray-400 text-sm">
                                    Fetch inspiring quotes from {selectedNiche.quoteSource === 'stoic' ? 'Stoic philosophers' :
                                        selectedNiche.quoteSource === 'affirmation' ? 'daily affirmations' : 'ZenQuotes'}
                                </p>
                                <button
                                    onClick={fetchQuote}
                                    disabled={isLoadingQuote}
                                    className={`w-full py-3 rounded-xl font-bold transition-all flex items-center justify-center bg-gradient-to-r ${selectedNiche.gradient} text-white hover:opacity-90 disabled:opacity-50`}
                                >
                                    {isLoadingQuote ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        <>
                                            <Shuffle className="w-5 h-5 mr-2" />
                                            Get Random Quote
                                        </>
                                    )}
                                </button>
                            </div>
                        )}

                        {/* Custom Quote Mode */}
                        {quoteMode === 'custom' && (
                            <div className="space-y-4">
                                <textarea
                                    value={customQuote}
                                    onChange={(e) => setCustomQuote(e.target.value)}
                                    className="w-full bg-black/40 border border-gray-700 rounded-xl p-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-white/20 focus:border-transparent outline-none resize-none"
                                    rows={3}
                                    placeholder="Enter your quote..."
                                />
                                <input
                                    type="text"
                                    value={customAuthor}
                                    onChange={(e) => setCustomAuthor(e.target.value)}
                                    className="w-full bg-black/40 border border-gray-700 rounded-xl p-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-white/20 focus:border-transparent outline-none"
                                    placeholder="Author name (optional)"
                                />
                                <button
                                    onClick={useCustomQuote}
                                    disabled={!customQuote.trim()}
                                    className={`w-full py-3 rounded-xl font-bold transition-all flex items-center justify-center ${accentClasses.bg} ${accentClasses.text} border ${accentClasses.border} hover:opacity-90 disabled:opacity-50`}
                                >
                                    <Check className="w-5 h-5 mr-2" />
                                    Use This Quote
                                </button>
                            </div>
                        )}

                        {/* AI Generate Mode */}
                        {quoteMode === 'ai' && (
                            <div className="space-y-4">
                                <input
                                    type="text"
                                    value={aiTheme}
                                    onChange={(e) => setAiTheme(e.target.value)}
                                    className="w-full bg-black/40 border border-gray-700 rounded-xl p-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-white/20 focus:border-transparent outline-none"
                                    placeholder="Theme (e.g., perseverance, love, success)"
                                />
                                <button
                                    onClick={generateAIQuote}
                                    disabled={isLoadingQuote}
                                    className={`w-full py-3 rounded-xl font-bold transition-all flex items-center justify-center bg-gradient-to-r ${selectedNiche.gradient} text-white hover:opacity-90 disabled:opacity-50`}
                                >
                                    {isLoadingQuote ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        <>
                                            <Sparkles className="w-5 h-5 mr-2" />
                                            Generate AI Quote
                                        </>
                                    )}
                                </button>
                            </div>
                        )}

                        {/* Current Quote Display */}
                        {quote && (
                            <div className={`mt-6 p-4 rounded-xl ${accentClasses.bg} border ${accentClasses.border}`}>
                                <p className="text-white text-lg italic leading-relaxed">"{quote}"</p>
                                <p className={`${accentClasses.text} text-sm mt-2 font-medium`}>— {author}</p>
                            </div>
                        )}
                    </div>

                    {/* Hook Library */}
                    <div className="glass-card rounded-2xl p-6">
                        <h3 className="text-lg font-semibold text-white flex items-center mb-4">
                            <Flame className="w-5 h-5 mr-2 text-orange-400" />
                            Hook Library
                        </h3>

                        {/* Hook Categories */}
                        <div className="flex flex-wrap gap-2 mb-4">
                            {HOOK_CATEGORIES.map((cat) => (
                                <button
                                    key={cat.key}
                                    onClick={() => setSelectedHookCategory(cat.key)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${selectedHookCategory === cat.key
                                        ? `${accentClasses.bg} ${accentClasses.text} border ${accentClasses.border}`
                                        : 'bg-white/5 text-gray-400 border border-transparent hover:bg-white/10'
                                        }`}
                                >
                                    {cat.emoji} {cat.name}
                                </button>
                            ))}
                        </div>

                        {/* Hook Selection */}
                        {hooks[selectedHookCategory] && (
                            <div className="space-y-2">
                                {hooks[selectedHookCategory].map((hook, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => setSelectedHook(hook)}
                                        className={`w-full p-3 rounded-xl text-left text-sm transition-all ${selectedHook === hook
                                            ? `${accentClasses.bg} ${accentClasses.text} border ${accentClasses.border}`
                                            : 'bg-white/5 text-gray-300 border border-transparent hover:bg-white/10'
                                            }`}
                                    >
                                        "{hook}"
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Center Column: Script Generator */}
                <div className="space-y-6">
                    <div className="glass-card rounded-2xl p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-white flex items-center">
                                <Type className={`w-5 h-5 mr-2 ${accentClasses.text}`} />
                                Script Generator
                            </h3>
                            {script && (
                                <button
                                    onClick={copyScript}
                                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-all"
                                >
                                    {copied ? (
                                        <Check className="w-4 h-4 text-green-400" />
                                    ) : (
                                        <Copy className="w-4 h-4 text-gray-400" />
                                    )}
                                </button>
                            )}
                        </div>

                        {/* Generate Button */}
                        <button
                            onClick={generateScript}
                            disabled={!quote || isGeneratingScript}
                            className={`w-full py-3 rounded-xl font-bold transition-all flex items-center justify-center mb-6 bg-gradient-to-r ${selectedNiche.gradient} text-white hover:opacity-90 disabled:opacity-50 shadow-lg ${accentClasses.glow}`}
                        >
                            {isGeneratingScript ? (
                                <>
                                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                    Generating Script...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="w-5 h-5 mr-2" />
                                    Generate Full Script
                                </>
                            )}
                        </button>

                        {/* Script Display */}
                        {script && (
                            <div className="space-y-4">
                                {/* Hook */}
                                <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/30">
                                    <div className="text-orange-400 text-xs font-bold uppercase mb-1">🪝 Hook</div>
                                    <p className="text-white">{script.hook}</p>
                                </div>

                                {/* Quote */}
                                <div className={`p-4 rounded-xl ${accentClasses.bg} border ${accentClasses.border}`}>
                                    <div className={`${accentClasses.text} text-xs font-bold uppercase mb-1`}>💬 Quote</div>
                                    <p className="text-white italic">"{script.quote}"</p>
                                    <p className="text-gray-400 text-sm mt-1">— {script.author}</p>
                                </div>

                                {/* Explanation */}
                                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                                    <div className="text-gray-400 text-xs font-bold uppercase mb-1">📝 Explanation</div>
                                    <p className="text-gray-200">{script.explanation}</p>
                                </div>

                                {/* CTA */}
                                <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/30">
                                    <div className="text-green-400 text-xs font-bold uppercase mb-1">🎯 CTA</div>
                                    <p className="text-white">{script.cta}</p>
                                </div>

                                {/* Visual Cues */}
                                <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/30">
                                    <div className="text-purple-400 text-xs font-bold uppercase mb-2">🎬 Visual Cues</div>
                                    <div className="flex flex-wrap gap-2">
                                        {script.visualCues?.map((cue: string, idx: number) => (
                                            <span key={idx} className="px-2 py-1 rounded-lg bg-purple-500/20 text-purple-300 text-xs">
                                                {cue}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                {/* Hashtags */}
                                <div className="flex flex-wrap gap-2">
                                    {script.hashtags?.map((tag: string, idx: number) => (
                                        <span key={idx} className="text-cyan-400 text-sm">
                                            {tag}
                                        </span>
                                    ))}
                                </div>

                                {/* Estimated Duration */}
                                <div className="text-center text-gray-500 text-sm">
                                    ⏱️ Estimated Duration: ~{script.estimatedDuration || 25}s
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Column: Voice & Video Builder */}
                <div className="space-y-6">
                    {/* Voice Generator */}
                    <div className="glass-card rounded-2xl p-6">
                        <h3 className="text-lg font-semibold text-white flex items-center mb-4">
                            <Mic className={`w-5 h-5 mr-2 ${accentClasses.text}`} />
                            Voice Generator
                        </h3>

                        {/* Voice Selection */}
                        <div className="mb-4">
                            <label className="block text-gray-400 text-sm mb-2">Select Voice</label>
                            <div className="relative">
                                <select
                                    value={selectedVoice}
                                    onChange={(e) => setSelectedVoice(e.target.value)}
                                    className="w-full bg-black/40 border border-gray-700 rounded-xl p-3 text-white appearance-none cursor-pointer"
                                >
                                    {voices.map((voice) => (
                                        <option key={voice.key} value={voice.key} className="bg-gray-900">
                                            {voice.name}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            </div>
                        </div>

                        {/* Speed Control */}
                        <div className="mb-4">
                            <label className="block text-gray-400 text-sm mb-2">Speed</label>
                            <div className="flex gap-2">
                                {['-10%', '+0%', '+10%', '+20%'].map((speed) => (
                                    <button
                                        key={speed}
                                        onClick={() => setVoiceSpeed(speed)}
                                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${voiceSpeed === speed
                                            ? `${accentClasses.bg} ${accentClasses.text} border ${accentClasses.border}`
                                            : 'bg-white/5 text-gray-400 border border-transparent hover:bg-white/10'
                                            }`}
                                    >
                                        {speed === '+0%' ? 'Normal' : speed}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Generate Voice Button */}
                        <button
                            onClick={generateVoice}
                            disabled={!script || isGeneratingVoice}
                            className={`w-full py-3 rounded-xl font-bold transition-all flex items-center justify-center ${accentClasses.bg} ${accentClasses.text} border ${accentClasses.border} hover:opacity-90 disabled:opacity-50`}
                        >
                            {isGeneratingVoice ? (
                                <>
                                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                    Generating...
                                </>
                            ) : (
                                <>
                                    <Volume2 className="w-5 h-5 mr-2" icon />
                                    Generate Voiceover
                                </>
                            )}
                        </button>

                        {/* Voice Preview */}
                        {voiceAudioPath && (
                            <div className="mt-4 p-4 rounded-xl bg-green-500/10 border border-green-500/30">
                                <div className="flex items-center justify-between">
                                    <span className="text-green-400 text-sm">✓ Voice Generated</span>
                                    <button
                                        onClick={toggleVoicePlayback}
                                        className="p-2 rounded-full bg-green-500/20 hover:bg-green-500/30 transition-all"
                                    >
                                        {isPlayingVoice ? (
                                            <Pause className="w-4 h-4 text-green-400" />
                                        ) : (
                                            <Play className="w-4 h-4 text-green-400" />
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* YouTube B-Roll Download */}
                    <div className="glass-card rounded-2xl p-6">
                        <h3 className="text-lg font-semibold text-white flex items-center mb-4">
                            <Video className={`w-5 h-5 mr-2 ${accentClasses.text}`} />
                            B-Roll Source
                        </h3>

                        {/* Mode Tabs */}
                        <div className="flex rounded-xl bg-black/30 p-1 mb-4">
                            <button
                                onClick={() => setBrollMode('manual')}
                                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${brollMode === 'manual'
                                    ? `${accentClasses.bg} ${accentClasses.text}`
                                    : 'text-gray-400 hover:text-white'
                                    }`}
                            >
                                📹 Manual URL
                            </button>
                            <button
                                onClick={() => setBrollMode('ai')}
                                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${brollMode === 'ai'
                                    ? `${accentClasses.bg} ${accentClasses.text}`
                                    : 'text-gray-400 hover:text-white'
                                    }`}
                            >
                                🤖 AI YouTube
                            </button>
                        </div>

                        {/* Manual URL Mode */}
                        {brollMode === 'manual' && (
                            <>
                                <p className="text-gray-400 text-xs mb-3">
                                    Paste a YouTube URL with cinematic footage. We'll crop it to 9:16 vertical.
                                </p>

                                <input
                                    type="text"
                                    value={brollUrl}
                                    onChange={(e) => setBrollUrl(e.target.value)}
                                    className="w-full bg-black/40 border border-gray-700 rounded-xl p-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-white/20 focus:border-transparent outline-none mb-3 text-sm"
                                    placeholder="https://youtube.com/watch?v=..."
                                />

                                <div className="grid grid-cols-2 gap-3 mb-4">
                                    <div>
                                        <label className="block text-gray-400 text-xs mb-1">Start Time</label>
                                        <input
                                            type="text"
                                            value={brollStartTime}
                                            onChange={(e) => setBrollStartTime(e.target.value)}
                                            className="w-full bg-black/40 border border-gray-700 rounded-lg p-2 text-white placeholder-gray-500 focus:ring-2 focus:ring-white/20 outline-none text-sm"
                                            placeholder="0:00"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-gray-400 text-xs mb-1">End Time</label>
                                        <input
                                            type="text"
                                            value={brollEndTime}
                                            onChange={(e) => setBrollEndTime(e.target.value)}
                                            className="w-full bg-black/40 border border-gray-700 rounded-lg p-2 text-white placeholder-gray-500 focus:ring-2 focus:ring-white/20 outline-none text-sm"
                                            placeholder="0:30"
                                        />
                                    </div>
                                </div>

                                <button
                                    onClick={downloadBroll}
                                    disabled={!brollUrl || isDownloadingBroll}
                                    className={`w-full py-3 rounded-xl font-bold transition-all flex items-center justify-center ${accentClasses.bg} ${accentClasses.text} border ${accentClasses.border} hover:opacity-90 disabled:opacity-50`}
                                >
                                    {isDownloadingBroll ? (
                                        <>
                                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                            Downloading & Cropping...
                                        </>
                                    ) : (
                                        <>
                                            <Download className="w-5 h-5 mr-2" />
                                            Download B-Roll
                                        </>
                                    )}
                                </button>

                                {selectedBroll && (
                                    <div className="mt-4 p-3 rounded-xl bg-green-500/10 border border-green-500/30">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-green-400 text-sm">✓ B-Roll Ready</span>
                                            <button onClick={() => setSelectedBroll(null)} className="text-gray-400 hover:text-white">
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                        <video
                                            src={`http://localhost:3005/api/videos/file/${selectedBroll}`}
                                            className="w-full rounded-lg aspect-[9/16] object-cover"
                                            muted loop autoPlay playsInline
                                        />
                                    </div>
                                )}
                            </>
                        )}

                        {/* AI YouTube Mode */}
                        {brollMode === 'ai' && (
                            <>
                                <p className="text-gray-400 text-xs mb-3">
                                    🤖 AI analyzes your script and finds matching YouTube clips automatically!
                                </p>

                                {/* Step 1: Get AI Suggestions */}
                                <button
                                    onClick={getAiSuggestions}
                                    disabled={!script || isGettingAiSuggestions || isResolvingClips}
                                    className={`w-full py-3 rounded-xl font-bold transition-all flex items-center justify-center mb-4 ${resolvedClips.length > 0
                                        ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                        : `bg-gradient-to-r ${selectedNiche.gradient} text-white`
                                        } hover:opacity-90 disabled:opacity-50`}
                                >
                                    {isGettingAiSuggestions ? (
                                        <>
                                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                            Analyzing Script...
                                        </>
                                    ) : isResolvingClips ? (
                                        <>
                                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                            Finding YouTube Videos...
                                        </>
                                    ) : resolvedClips.length > 0 ? (
                                        <>
                                            <Check className="w-5 h-5 mr-2" />
                                            {resolvedClips.length} Clips Found
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="w-5 h-5 mr-2" />
                                            🎬 Find B-Roll with AI
                                        </>
                                    )}
                                </button>

                                {/* Show Resolved Clips with Interactive Controls */}
                                {resolvedClips.length > 0 && (
                                    <div className="space-y-2 mb-4 max-h-80 overflow-y-auto">
                                        {resolvedClips.map((clip: any, idx: number) => {
                                            const isApproved = approvedClipIndices.has(idx);
                                            const isLoadingAlt = loadingAlternativeIndex === idx;

                                            return (
                                                <div
                                                    key={idx}
                                                    className={`p-3 rounded-lg border text-sm transition-all ${isApproved
                                                            ? 'bg-green-500/10 border-green-500/40'
                                                            : 'bg-white/5 border-white/10'
                                                        }`}
                                                >
                                                    <div className="flex gap-3">
                                                        {/* Thumbnail */}
                                                        {clip.thumbnailUrl && (
                                                            <img
                                                                src={clip.thumbnailUrl}
                                                                alt=""
                                                                className="w-20 h-12 rounded object-cover flex-shrink-0"
                                                            />
                                                        )}

                                                        <div className="flex-1 min-w-0">
                                                            {/* Title */}
                                                            <div className="text-white font-medium text-xs truncate">
                                                                {clip.actualTitle || clip.videoTitle || 'Video'}
                                                            </div>
                                                            {/* Time range */}
                                                            <div className="text-gray-500 text-xs">
                                                                {clip.startTime} - {clip.endTime} ({clip.duration}s)
                                                            </div>
                                                            {/* Segment text */}
                                                            <div className="text-gray-400 text-xs mt-1 truncate">
                                                                "{clip.segment}"
                                                            </div>
                                                        </div>

                                                        {/* Action Buttons */}
                                                        <div className="flex flex-col gap-1 flex-shrink-0">
                                                            {/* Approve Button */}
                                                            <button
                                                                onClick={() => toggleClipApproval(idx)}
                                                                className={`p-1.5 rounded-lg transition-all ${isApproved
                                                                        ? 'bg-green-500 text-white'
                                                                        : 'bg-white/10 text-gray-400 hover:text-white hover:bg-white/20'
                                                                    }`}
                                                                title={isApproved ? 'Approved' : 'Approve'}
                                                            >
                                                                <Check className="w-4 h-4" />
                                                            </button>

                                                            {/* YouTube Button */}
                                                            <button
                                                                onClick={() => openYouTubeClip(clip)}
                                                                disabled={!clip.youtubeUrl}
                                                                className="p-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all disabled:opacity-50"
                                                                title="Open in YouTube"
                                                            >
                                                                <ExternalLink className="w-4 h-4" />
                                                            </button>

                                                            {/* Reset/Alternative Button */}
                                                            <button
                                                                onClick={() => getAlternativeClip(idx)}
                                                                disabled={isLoadingAlt}
                                                                className="p-1.5 rounded-lg bg-white/10 text-gray-400 hover:text-white hover:bg-white/20 transition-all disabled:opacity-50"
                                                                title="Get Alternative"
                                                            >
                                                                <RefreshCw className={`w-4 h-4 ${isLoadingAlt ? 'animate-spin' : ''}`} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Approval Summary */}
                                {resolvedClips.length > 0 && (
                                    <div className="text-xs text-gray-400 mb-3 text-center">
                                        {approvedClipIndices.size} of {resolvedClips.length} clips approved
                                    </div>
                                )}

                                {/* Step 2: Download Approved Clips */}
                                {resolvedClips.length > 0 && (
                                    <button
                                        onClick={downloadAiClips}
                                        disabled={approvedClipIndices.size === 0 || isDownloadingAiClips || aiDownloadedClips.length > 0}
                                        className={`w-full py-3 rounded-xl font-bold transition-all flex items-center justify-center mb-4 ${aiDownloadedClips.length > 0
                                            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                            : `${accentClasses.bg} ${accentClasses.text} border ${accentClasses.border}`
                                            } hover:opacity-90 disabled:opacity-50`}
                                    >
                                        {isDownloadingAiClips ? (
                                            <>
                                                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                                Downloading {approvedClipIndices.size} Clips...
                                            </>
                                        ) : aiDownloadedClips.length > 0 ? (
                                            <>
                                                <Check className="w-5 h-5 mr-2" />
                                                {aiDownloadedClips.length} Clips Downloaded
                                            </>
                                        ) : (
                                            <>
                                                <Download className="w-5 h-5 mr-2" />
                                                Download Approved ({approvedClipIndices.size})
                                            </>
                                        )}
                                    </button>
                                )}

                                {/* Step 3: Assemble Video */}
                                {aiDownloadedClips.length > 0 && (
                                    <button
                                        onClick={assembleAiVideo}
                                        disabled={!voiceAudioPath || isAssemblingAi}
                                        className={`w-full py-4 rounded-xl font-bold transition-all flex items-center justify-center bg-gradient-to-r ${selectedNiche.gradient} text-white hover:opacity-90 disabled:opacity-50 shadow-lg`}
                                    >
                                        {isAssemblingAi ? (
                                            <>
                                                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                                Creating AI Video...
                                            </>
                                        ) : (
                                            <>
                                                <Video className="w-5 h-5 mr-2" />
                                                🔥 Create AI Video
                                            </>
                                        )}
                                    </button>
                                )}

                                {aiSuggestions?.notes && (
                                    <div className="mt-3 p-3 rounded-lg bg-white/5 border border-white/10">
                                        <div className="text-gray-400 text-xs">📝 {aiSuggestions.notes}</div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* Caption Style Selector */}
                    <div className="glass-card rounded-2xl p-6">
                        <h3 className="text-lg font-semibold text-white flex items-center mb-4">
                            <Type className={`w-5 h-5 mr-2 ${accentClasses.text}`} />
                            Caption Style
                        </h3>
                        <p className="text-gray-400 text-xs mb-3">
                            Choose how your captions appear in the video
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                            {[
                                { key: 'viral', name: '🔥 Viral', desc: 'Impact font, pop animation' },
                                { key: 'minimal', name: '✨ Minimal', desc: 'Clean, subtle' },
                                { key: 'bold', name: '💪 Bold', desc: 'Extra large, scale effect' },
                                { key: 'neon', name: '💜 Neon', desc: 'Cyan/purple glow' }
                            ].map((style) => (
                                <button
                                    key={style.key}
                                    onClick={() => setSelectedCaptionStyle(style.key)}
                                    className={`p-3 rounded-xl text-left transition-all ${selectedCaptionStyle === style.key
                                        ? `${accentClasses.bg} ${accentClasses.text} border ${accentClasses.border}`
                                        : 'bg-white/5 text-gray-300 border border-transparent hover:bg-white/10'
                                        }`}
                                >
                                    <div className="font-semibold text-sm">{style.name}</div>
                                    <div className="text-xs text-gray-500">{style.desc}</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Export Button */}
                    <button
                        onClick={assembleVideo}
                        disabled={!voiceAudioPath || !script || isAssembling}
                        className={`w-full py-4 rounded-2xl font-bold transition-all flex items-center justify-center bg-gradient-to-r ${selectedNiche.gradient} text-white hover:opacity-90 disabled:opacity-50 shadow-xl ${accentClasses.glow}`}
                    >
                        {isAssembling ? (
                            <>
                                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                Burning Captions & Assembling...
                            </>
                        ) : (
                            <>
                                <Video className="w-5 h-5 mr-2" />
                                🔥 Create Video with Captions
                            </>
                        )}
                    </button>

                    {/* Assembled Video Preview */}
                    {assembledVideoPath && (
                        <div className="glass-card rounded-2xl p-4">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-green-400 font-semibold">✓ Video Ready!</span>
                                <a
                                    href={assembledVideoPath}
                                    download
                                    className={`px-4 py-2 rounded-lg ${accentClasses.bg} ${accentClasses.text} font-medium flex items-center`}
                                >
                                    <Download className="w-4 h-4 mr-2" />
                                    Download
                                </a>
                            </div>
                            <video
                                src={assembledVideoPath}
                                controls
                                className="w-full rounded-xl"
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
