import React, { useState, useRef } from 'react';
import {
    ArrowLeft, Film, Clapperboard, Tv, Sparkles, Link, Download, Play, Pause,
    Loader2, CheckCircle2, XCircle, Volume2, Music, Zap, Filter, Wand2,
    MessageCircle, Send, Clock, ExternalLink, Search, Type, Camera, Sun,
    Plus, Trash2
} from 'lucide-react';
import { TimelineEditor, TimelineItem } from './TimelineEditor';

interface MovieTVPageProps {
    onBack: () => void;
}

// Feature definitions
const FEATURES = [
    {
        key: 'scene_edit',
        title: 'Scene Edits',
        emoji: '🎬',
        description: 'Add trending music to movie scenes',
        gradient: 'from-violet-500 to-purple-600',
        icon: Film,
        workflow: ['Download clip', 'AI suggests music', 'Merge & export']
    },
    {
        key: 'sigma_edit',
        title: 'Sigma Edits',
        emoji: '🐺',
        description: 'Phonk-style movie edits with effects',
        gradient: 'from-slate-600 to-zinc-800',
        icon: Zap,
        workflow: ['Download clip', 'Apply phonk preset', 'Export with music']
    },
    {
        key: 'tv_moments',
        title: 'TV Moments',
        emoji: '😂',
        description: 'AI finds viral-worthy scenes from any show or movie',
        gradient: 'from-amber-500 to-orange-600',
        icon: Tv,
        workflow: ['Enter title', 'AI suggests scenes', 'Find & download']
    },
    {
        key: 'fan_edit',
        title: 'Fan Edits',
        emoji: '✨',
        description: 'Aesthetic edits with filters',
        gradient: 'from-pink-500 to-rose-600',
        icon: Sparkles,
        workflow: ['Download clip', 'Apply aesthetic filter', 'Export']
    }
];

// Filter presets for fan edits with visual previews
const FILTER_PRESETS = [
    {
        key: 'vhs',
        name: 'VHS',
        icon: Film,
        ffmpeg: 'colorbalance=rs=0.3:gs=-0.05:bs=-0.1,noise=alls=20:allf=t+u,eq=contrast=1.1',
        description: 'Retro 80s tape effect with noise',
        previewGradient: 'from-red-600/80 via-pink-500/60 to-blue-500/40',
        previewOverlay: 'bg-gradient-to-b from-transparent via-white/5 to-transparent',
        scanlines: true
    },
    {
        key: 'coquette',
        name: 'Coquette',
        icon: Sparkles,
        ffmpeg: 'colorbalance=rs=0.2:gs=-0.05:bs=0.1,eq=saturation=0.9:brightness=0.05',
        description: 'Soft pink & romantic vibes',
        previewGradient: 'from-pink-400/70 via-rose-300/50 to-pink-200/60',
        previewOverlay: 'bg-gradient-to-tr from-white/20 to-transparent',
        scanlines: false
    },
    {
        key: 'dreamcore',
        name: 'Dreamcore',
        icon: Wand2,
        ffmpeg: 'eq=saturation=0.7:brightness=0.1,gblur=sigma=1',
        description: 'Hazy, surreal & ethereal look',
        previewGradient: 'from-purple-500/50 via-indigo-400/40 to-cyan-300/30',
        previewOverlay: 'bg-gradient-to-b from-white/30 to-white/10 backdrop-blur-[2px]',
        scanlines: false
    },
    {
        key: 'vintage',
        name: 'Vintage',
        icon: Camera,
        ffmpeg: 'colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131,eq=brightness=0.05',
        description: 'Classic sepia film tones',
        previewGradient: 'from-amber-600/70 via-yellow-500/50 to-orange-300/40',
        previewOverlay: 'bg-gradient-to-b from-amber-900/20 to-transparent',
        scanlines: false
    },
    {
        key: 'golden',
        name: 'Golden Hour',
        icon: Sun,
        ffmpeg: 'colorbalance=rs=0.25:gs=0.1:bs=-0.15,eq=saturation=1.1:brightness=0.08',
        description: 'Warm sunset glow effect',
        previewGradient: 'from-orange-500/70 via-amber-400/60 to-yellow-300/50',
        previewOverlay: 'bg-gradient-to-tr from-orange-600/30 to-transparent',
        scanlines: false
    },
];

// Text overlay styles
const TEXT_STYLES = [
    { key: 'bold_shadow', name: 'Bold Shadow', preview: 'A̲B̲C̲', description: 'White text with heavy shadow' },
    { key: 'outline', name: 'Outline', preview: '[ABC]', description: 'White text with black outline' },
    { key: 'box', name: 'Box', preview: '■ABC■', description: 'Text with background box' },
    { key: 'neon', name: 'Neon', preview: '✧ABC✧', description: 'Yellow glowing effect' },
];

interface AISongSuggestion {
    title: string;
    artist: string;
    youtubeSearchQuery: string;
    reason: string;
    suggestedStart: string;
    suggestedEnd: string;
    section: string;
}

interface SceneSuggestion {
    sceneName: string;
    description: string;
    whyViral: string;
    locationHint: string;
    duration: number;
    captionIdeas: string[];
    youtubeSearch: string;
}

export const MovieTVPage: React.FC<MovieTVPageProps> = ({ onBack }) => {
    // Active feature
    const [activeFeature, setActiveFeature] = useState<string | null>(null);

    // Video state
    const [videoUrl, setVideoUrl] = useState('');
    const [isDownloading, setIsDownloading] = useState(false);
    const [videoPath, setVideoPath] = useState<string | null>(null);
    const [videoFilename, setVideoFilename] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);

    // AI Music state (for scene edits)
    const [isGettingAiSuggestions, setIsGettingAiSuggestions] = useState(false);
    const [aiSuggestions, setAiSuggestions] = useState<AISongSuggestion[]>([]);
    const [showAiSuggestions, setShowAiSuggestions] = useState(false);

    // Filter state (for fan edits)
    const [selectedFilter, setSelectedFilter] = useState<string>('vhs');

    // Processing state
    const [isProcessing, setIsProcessing] = useState(false);
    const [finalVideoPath, setFinalVideoPath] = useState<string | null>(null);

    // Timeline state (Fan Edits)
    const [timelineItems, setTimelineItems] = useState<TimelineItem[]>([]);
    const [videoDuration, setVideoDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);

    // TV Moments chatbot state
    const [tvMomentsMode, setTvMomentsMode] = useState<'manual' | 'ai'>('ai');
    const [showTitle, setShowTitle] = useState('');
    const [showType, setShowType] = useState<'movie' | 'tv_show'>('movie');
    const [isAnalyzingShow, setIsAnalyzingShow] = useState(false);
    const [sceneSuggestions, setSceneSuggestions] = useState<SceneSuggestion[]>([]);
    const [selectedScene, setSelectedScene] = useState<SceneSuggestion | null>(null);

    // Text Overlay state
    const [isGeneratingOverlay, setIsGeneratingOverlay] = useState(false);
    const [overlayText, setOverlayText] = useState<string | null>(null);
    const [memeVideoPath, setMemeVideoPath] = useState<string | null>(null);
    const [selectedTextStyle, setSelectedTextStyle] = useState('bold_shadow');

    // Download video
    const handleDownload = async () => {
        if (!videoUrl) {
            setError('Please enter a video URL');
            return;
        }

        setError(null);
        setIsDownloading(true);
        setVideoPath(null);
        setVideoFilename(null);
        setFinalVideoPath(null);
        setAiSuggestions([]);

        try {
            // Use different endpoints based on feature
            // Fan edits uses simple download (no autocrop needed)
            // Other features may use content-crop
            const endpoint = activeFeature === 'fan_edit'
                ? 'http://localhost:3005/api/fan-edit/download'
                : 'http://localhost:3005/api/fan-edit/download'; // Using simple download for all Movie/TV features

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ videoUrl }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to download video');
            }

            const data = await response.json();
            setVideoPath(`http://localhost:3005${data.videoPath}`);
            setVideoFilename(data.filename);

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Download failed');
        } finally {
            setIsDownloading(false);
        }
    };

    // Get AI music suggestions
    const handleGetAiSuggestions = async () => {
        if (!videoFilename) return;

        setError(null);
        setIsGettingAiSuggestions(true);
        setAiSuggestions([]);

        try {
            const response = await fetch('http://localhost:3005/api/sports/ai-suggest-music', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ videoFilename }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to get AI suggestions');
            }

            const data = await response.json();
            setAiSuggestions(data.suggestions || []);
            setShowAiSuggestions(true);

        } catch (err) {
            setError(err instanceof Error ? err.message : 'AI suggestion failed');
        } finally {
            setIsGettingAiSuggestions(false);
        }
    };

    // Select AI suggestion
    const handleSelectAiSuggestion = (suggestion: AISongSuggestion) => {
        const searchQuery = encodeURIComponent(suggestion.youtubeSearchQuery);
        window.open(`https://www.youtube.com/results?search_query=${searchQuery}`, '_blank');
        setShowAiSuggestions(false);
        setError(`🎵 Search for "${suggestion.title}" and paste the URL. Best section: ${suggestion.suggestedStart} - ${suggestion.suggestedEnd}`);
    };

    // Add filter to timeline
    const handleAddFilterToTimeline = (key: string) => {
        if (activeFeature !== 'fan_edit' || !videoPath) return;

        const newId = Date.now().toString();
        // Default duration 3s or remainder of video
        const start = currentTime;
        const duration = Math.min(3, videoDuration - start);

        if (duration <= 0) {
            // If at end, add to beginning or handle error?
            // Just add at 0
            setTimelineItems([...timelineItems, {
                id: newId,
                filterKey: key,
                start: 0,
                end: Math.min(3, videoDuration)
            }]);
            return;
        }

        setTimelineItems([...timelineItems, {
            id: newId,
            filterKey: key,
            start,
            end: start + duration
        }]);
    };

    // Apply filter (for fan edits) - Supports Timeline!
    const handleApplyFilter = async () => {
        console.log('🖱️ handleApplyFilter called');

        if (!videoFilename) {
            console.error('❌ videoFilename is missing!');
            return;
        }

        // Use selectedFilter if timeline is empty, otherwise use timeline
        // Actually, let's enforce timeline usage if items exist
        const useTimeline = timelineItems.length > 0;

        // If no timeline items, fallback to selectedFilter (global)
        // But the user asked for "slider", so we prioritize the timeline.

        const payload: any = {
            videoFilename,
        };

        if (useTimeline) {
            payload.timeline = timelineItems;
            console.log('   Sending Timeline payload:', payload);
        } else {
            const filter = FILTER_PRESETS.find(f => f.key === selectedFilter);
            if (!filter) return;
            payload.filter = filter.key;
            console.log('   Sending Single Filter payload:', payload);
        }

        setError(null);
        setIsProcessing(true);
        setFinalVideoPath(null);

        try {
            const response = await fetch('http://localhost:3005/api/music-video/apply-filter', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to apply filter');
            }

            const data = await response.json();
            setFinalVideoPath(`http://localhost:3005${data.videoPath}`);

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Filter processing failed');
        } finally {
            setIsProcessing(false);
        }
    };

    // Reset state when switching features
    const handleSelectFeature = (featureKey: string) => {
        if (activeFeature === featureKey) {
            setActiveFeature(null);
        } else {
            setActiveFeature(featureKey);
            setVideoUrl('');
            setVideoPath(null);
            setVideoFilename(null);
            setFinalVideoPath(null);
            setAiSuggestions([]);
            setShowTitle('');
            setSceneSuggestions([]);
            setSelectedScene(null);
            setError(null);
        }
    };

    // TV Moments: Get AI scene suggestions
    const handleGetSceneSuggestions = async () => {
        if (!showTitle.trim()) {
            setError('Please enter a movie or TV show title');
            return;
        }

        setError(null);
        setIsAnalyzingShow(true);
        setSceneSuggestions([]);
        setSelectedScene(null);

        try {
            const response = await fetch('http://localhost:3005/api/entertainment/suggest-scenes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: showTitle,
                    type: showType
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to analyze');
            }

            const data = await response.json();
            setSceneSuggestions(data.suggestions || []);

        } catch (err) {
            setError(err instanceof Error ? err.message : 'AI analysis failed');
        } finally {
            setIsAnalyzingShow(false);
        }
    };

    // TV Moments: Open YouTube search for scene
    const handleSearchScene = (scene: SceneSuggestion) => {
        const searchQuery = encodeURIComponent(scene.youtubeSearch);
        window.open(`https://www.youtube.com/results?search_query=${searchQuery}`, '_blank');
        setSelectedScene(scene);
    };

    // Generate Text Overlay with AI
    const handleGenerateTextOverlay = async () => {
        if (!videoFilename) {
            setError('No video available');
            return;
        }

        setError(null);
        setIsGeneratingOverlay(true);
        setOverlayText(null);
        setMemeVideoPath(null);

        try {
            const response = await fetch('http://localhost:3005/api/entertainment/generate-text-overlay', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    videoFilename,
                    textStyle: selectedTextStyle
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to generate overlay');
            }

            const data = await response.json();
            setOverlayText(data.overlayText);
            setMemeVideoPath(`http://localhost:3005${data.videoPath}`);

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to generate text overlay');
        } finally {
            setIsGeneratingOverlay(false);
        }
    };

    return (
        <div className="min-h-screen pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto animate-fade-in">
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
                    <Clapperboard className="w-10 h-10 mr-3 text-purple-400" />
                    Movie & TV Studio
                    <span className="ml-3 px-3 py-1 rounded-full text-xs font-medium bg-purple-500/20 text-purple-300 border border-purple-500/20">
                        Entertainment
                    </span>
                </h1>
                <p className="text-gray-400 mt-2">Create viral movie scenes, sigma edits, TV moments, and fan edits</p>
            </div>

            {/* Error Display */}
            {error && (
                <div className={`mb-6 p-4 rounded-xl flex items-center ${error.startsWith('🎵') ? 'bg-blue-500/10 border border-blue-500/30 text-blue-400' : 'bg-red-500/10 border border-red-500/30 text-red-400'}`}>
                    {error.startsWith('🎵') ? <Music className="w-5 h-5 mr-2 flex-shrink-0" /> : <XCircle className="w-5 h-5 mr-2 flex-shrink-0" />}
                    {error}
                </div>
            )}

            {/* Feature Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                {FEATURES.map((feature) => {
                    const Icon = feature.icon;
                    const isActive = activeFeature === feature.key;

                    return (
                        <div
                            key={feature.key}
                            className={`group relative rounded-2xl border transition-all duration-300 overflow-hidden ${isActive
                                ? 'bg-white/10 border-white/20 shadow-2xl'
                                : 'bg-white/5 border-white/10 hover:bg-white/8 hover:border-white/20 cursor-pointer hover:shadow-lg hover:-translate-y-1'
                                }`}
                        >
                            {/* Card Header */}
                            <div
                                onClick={() => handleSelectFeature(feature.key)}
                                className="p-6 cursor-pointer"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-5">
                                        <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${feature.gradient} p-0.5 shadow-lg group-hover:shadow-${feature.gradient.split('-')[1]}/50 transition-shadow duration-300`}>
                                            <div className="w-full h-full bg-black/40 backdrop-blur-sm rounded-xl flex items-center justify-center">
                                                <Icon className="w-7 h-7 text-white" />
                                            </div>
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-bold text-white group-hover:text-purple-300 transition-colors">{feature.title}</h3>
                                            <p className="text-gray-400 text-sm mt-1">{feature.description}</p>
                                        </div>
                                    </div>
                                    <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${isActive ? 'border-green-500 bg-green-500/20' : 'border-white/10 group-hover:border-white/30'
                                        }`}>
                                        {isActive && <CheckCircle2 className="w-5 h-5 text-green-500" />}
                                    </div>
                                </div>

                                {/* Workflow Steps */}
                                <div className="flex items-center mt-6 gap-2 flex-wrap">
                                    {feature.workflow.map((step, idx) => (
                                        <React.Fragment key={idx}>
                                            <span className="text-xs font-medium bg-white/5 border border-white/5 px-3 py-1.5 rounded-lg text-gray-400 group-hover:bg-white/10 group-hover:text-gray-300 transition-colors">
                                                {step}
                                            </span>
                                            {idx < feature.workflow.length - 1 && (
                                                <span className="text-gray-700">→</span>
                                            )}
                                        </React.Fragment>
                                    ))}
                                </div>
                            </div>

                            {/* Expanded Workflow Panel */}
                            {isActive && (
                                <div className="border-t border-white/10 p-6 bg-black/20 animate-fade-in">
                                    {/* URL Input */}
                                    <div className="space-y-4">
                                        <div className="relative">
                                            <Link className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                                            <input
                                                type="text"
                                                value={videoUrl}
                                                onChange={(e) => setVideoUrl(e.target.value)}
                                                placeholder="Paste YouTube, Instagram, or TikTok URL..."
                                                className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                                            />
                                        </div>

                                        <button
                                            onClick={handleDownload}
                                            disabled={isDownloading || !videoUrl}
                                            className={`w-full py-3 px-4 bg-gradient-to-r ${feature.gradient} text-white rounded-xl font-medium hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center`}
                                        >
                                            {isDownloading ? (
                                                <>
                                                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                                    Downloading...
                                                </>
                                            ) : (
                                                <>
                                                    <Download className="w-5 h-5 mr-2" />
                                                    Download & Process
                                                </>
                                            )}
                                        </button>
                                    </div>

                                    {/* Video Preview */}
                                    {videoPath && (
                                        <div className="mt-6">
                                            <h4 className="text-sm font-medium text-gray-400 mb-2">Video Preview</h4>
                                            <video
                                                ref={videoRef}
                                                key={videoPath}
                                                src={videoPath}
                                                controls
                                                className="w-full rounded-xl border border-white/10"
                                                style={{ maxHeight: '250px' }}
                                                onLoadedMetadata={(e) => setVideoDuration(e.currentTarget.duration)}
                                                onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                                            />

                                            {/* Timeline Editor */}
                                            <div className="mt-4">
                                                <TimelineEditor
                                                    duration={videoDuration || 10} // Fallback to 10s if not loaded
                                                    currentTime={currentTime}
                                                    items={timelineItems}
                                                    presets={FILTER_PRESETS}
                                                    onUpdateItems={setTimelineItems}
                                                    onSeek={(t) => {
                                                        if (videoRef.current) {
                                                            videoRef.current.currentTime = t;
                                                            setCurrentTime(t);
                                                        }
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* Feature-Specific Actions */}
                                    {videoPath && feature.key === 'scene_edit' && (
                                        <div className="mt-6 space-y-4">
                                            <button
                                                onClick={handleGetAiSuggestions}
                                                disabled={isGettingAiSuggestions}
                                                className="w-full py-3 px-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-medium hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                            >
                                                {isGettingAiSuggestions ? (
                                                    <>
                                                        <Loader2 className="w-5 h-5 animate-spin" />
                                                        Analyzing Scene...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Sparkles className="w-5 h-5" />
                                                        AI Suggest Music
                                                    </>
                                                )}
                                            </button>

                                            {/* AI Suggestions */}
                                            {showAiSuggestions && aiSuggestions.length > 0 && (
                                                <div className="bg-gradient-to-b from-amber-500/10 to-orange-500/10 rounded-xl border border-amber-500/30 p-4 space-y-3">
                                                    <h4 className="text-sm font-medium text-amber-300 flex items-center gap-2">
                                                        <Sparkles className="w-4 h-4" />
                                                        AI Recommended Songs
                                                    </h4>
                                                    {aiSuggestions.map((suggestion, idx) => (
                                                        <div
                                                            key={idx}
                                                            className="bg-white/5 rounded-lg p-3 hover:bg-white/10 transition-all cursor-pointer border border-white/5 hover:border-amber-500/30"
                                                            onClick={() => handleSelectAiSuggestion(suggestion)}
                                                        >
                                                            <div className="flex items-start justify-between">
                                                                <div className="flex-1">
                                                                    <p className="text-white font-medium">{suggestion.title}</p>
                                                                    <p className="text-gray-400 text-sm">{suggestion.artist}</p>
                                                                    <p className="text-amber-300/70 text-xs mt-1">{suggestion.reason}</p>
                                                                </div>
                                                                <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-1 rounded-full">
                                                                    {suggestion.section}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {videoPath && feature.key === 'fan_edit' && (
                                        <div className="mt-6 space-y-4">
                                            <h4 className="text-sm font-medium text-gray-400 flex items-center gap-2">
                                                <Filter className="w-4 h-4" />
                                                Select Filter Style
                                            </h4>
                                            <div className="grid grid-cols-5 gap-3">
                                                {FILTER_PRESETS.map((filter) => {
                                                    const FilterIcon = filter.icon;
                                                    const isSelected = selectedFilter === filter.key;
                                                    return (
                                                        <button
                                                            key={filter.key}
                                                            onClick={() => {
                                                                setSelectedFilter(filter.key);
                                                                handleAddFilterToTimeline(filter.key);
                                                            }}
                                                            className={`relative h-24 rounded-xl border transition-all overflow-hidden group hover:scale-105 active:scale-95 text-left
                                                                ${selectedFilter === filter.key ? 'ring-2 ring-pink-500 border-transparent' : 'border-white/10 hover:border-white/30'}
                                                            `}
                                                        >
                                                            {/* Preview Thumbnail */}
                                                            <div className={`aspect-square relative bg-gradient-to-br ${filter.previewGradient}`}>
                                                                {/* Overlay effect */}
                                                                <div className={`absolute inset-0 ${filter.previewOverlay}`}></div>

                                                                {/* VHS Scanlines effect */}
                                                                {filter.scanlines && (
                                                                    <div className="absolute inset-0 opacity-30" style={{
                                                                        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.3) 2px, rgba(0,0,0,0.3) 4px)'
                                                                    }}></div>
                                                                )}

                                                                {/* Center Icon */}
                                                                <div className="absolute inset-0 flex items-center justify-center">
                                                                    <FilterIcon className={`w-8 h-8 transition-all duration-300 ${isSelected ? 'text-white drop-shadow-lg' : 'text-white/70 group-hover:text-white'}`} />
                                                                </div>

                                                                {/* Selected checkmark */}
                                                                {isSelected && (
                                                                    <div className="absolute top-1 right-1 w-5 h-5 bg-pink-500 rounded-full flex items-center justify-center">
                                                                        <CheckCircle2 className="w-3 h-3 text-white" />
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* Filter Name & Description */}
                                                            <div className={`p-2 text-center transition-colors ${isSelected ? 'bg-pink-500/20' : 'bg-black/40'}`}>
                                                                <p className={`text-xs font-semibold ${isSelected ? 'text-pink-300' : 'text-white'}`}>{filter.name}</p>
                                                                <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-1">{filter.description}</p>
                                                            </div>
                                                        </button>
                                                    );
                                                })}
                                            </div>

                                            <button
                                                onClick={handleApplyFilter}
                                                disabled={isProcessing}
                                                className="w-full py-3 px-4 bg-gradient-to-r from-pink-500 to-rose-600 text-white rounded-xl font-medium hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-pink-500/25"
                                            >
                                                {isProcessing ? (
                                                    <>
                                                        <Loader2 className="w-5 h-5 animate-spin" />
                                                        Applying Filter...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Wand2 className="w-5 h-5" />
                                                        Apply Filter & Export
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    )}

                                    {videoPath && (feature.key === 'sigma_edit') && (
                                        <div className="mt-6 p-4 bg-white/5 rounded-xl border border-white/10 text-center flex flex-col items-center justify-center gap-2">
                                            <Zap className="w-8 h-8 text-gray-500" />
                                            <p className="text-gray-400 text-sm">
                                                Phonk preset with slow-mo & effects coming soon!
                                            </p>
                                        </div>
                                    )}

                                    {/* TV Moments - Chatbot Interface */}
                                    {feature.key === 'tv_moments' && (
                                        <div className="space-y-4">
                                            {/* Manual / AI Mode Toggle */}
                                            <div className="flex gap-2 p-1 bg-white/5 rounded-xl">
                                                <button
                                                    onClick={() => setTvMomentsMode('manual')}
                                                    className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${tvMomentsMode === 'manual'
                                                        ? 'bg-white/10 text-white shadow-sm'
                                                        : 'text-gray-400 hover:text-white'
                                                        }`}
                                                >
                                                    <Link className="w-4 h-4" />
                                                    Manual
                                                </button>
                                                <button
                                                    onClick={() => setTvMomentsMode('ai')}
                                                    className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${tvMomentsMode === 'ai'
                                                        ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-300 shadow-sm border border-amber-500/30'
                                                        : 'text-gray-400 hover:text-white'
                                                        }`}
                                                >
                                                    <Sparkles className="w-4 h-4" />
                                                    AI Scene Finder
                                                </button>
                                            </div>

                                            {/* Manual Mode - URL Input */}
                                            {tvMomentsMode === 'manual' && (
                                                <div className="space-y-4 animate-fade-in">
                                                    <div className="relative">
                                                        <Link className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                                                        <input
                                                            type="text"
                                                            value={videoUrl}
                                                            onChange={(e) => setVideoUrl(e.target.value)}
                                                            placeholder="Paste video URL (YouTube, Instagram, TikTok)..."
                                                            className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                                                        />
                                                    </div>
                                                    <button
                                                        onClick={handleDownload}
                                                        disabled={isDownloading || !videoUrl}
                                                        className="w-full py-3 px-4 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl font-medium hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                                    >
                                                        {isDownloading ? (
                                                            <>
                                                                <Loader2 className="w-5 h-5 animate-spin" />
                                                                Downloading...
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Download className="w-5 h-5" />
                                                                Download Video
                                                            </>
                                                        )}
                                                    </button>

                                                    {/* Video Preview for Manual Mode */}
                                                    {videoPath && (
                                                        <div className="mt-4 space-y-4">
                                                            <h4 className="text-sm font-medium text-gray-400 mb-2">Downloaded Video</h4>
                                                            <video
                                                                src={videoPath}
                                                                controls
                                                                className="w-full rounded-xl border border-white/10"
                                                                style={{ maxHeight: '250px' }}
                                                            />
                                                            {/* Text Style Selector */}
                                                            <div className="space-y-2">
                                                                <h4 className="text-sm font-medium text-gray-400">Choose Text Style</h4>
                                                                <div className="grid grid-cols-2 gap-2">
                                                                    {TEXT_STYLES.map((style) => (
                                                                        <button
                                                                            key={style.key}
                                                                            onClick={() => setSelectedTextStyle(style.key)}
                                                                            className={`p-3 rounded-lg border text-left transition-all ${selectedTextStyle === style.key
                                                                                ? 'bg-purple-500/20 border-purple-500/50'
                                                                                : 'bg-white/5 border-white/10 hover:bg-white/10'
                                                                                }`}
                                                                        >
                                                                            <div className="flex items-center gap-2">
                                                                                <span className="text-lg font-mono">{style.preview}</span>
                                                                                <span className={`text-sm font-medium ${selectedTextStyle === style.key
                                                                                    ? 'text-purple-300'
                                                                                    : 'text-gray-300'
                                                                                    }`}>{style.name}</span>
                                                                            </div>
                                                                            <p className="text-xs text-gray-500 mt-1">{style.description}</p>
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            </div>

                                                            {/* Generate Text Overlay Button */}
                                                            <button
                                                                onClick={handleGenerateTextOverlay}
                                                                disabled={isGeneratingOverlay || !videoFilename}
                                                                className="w-full py-3 px-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-medium hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                                            >
                                                                {isGeneratingOverlay ? (
                                                                    <>
                                                                        <Loader2 className="w-5 h-5 animate-spin" />
                                                                        Generating Meme Overlay...
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <Type className="w-5 h-5" />
                                                                        Generate Text Overlay (AI)
                                                                    </>
                                                                )}
                                                            </button>

                                                            {/* Overlay Result */}
                                                            {overlayText && (
                                                                <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4 animate-fade-in">
                                                                    <h5 className="text-purple-300 font-medium text-sm mb-2 flex items-center gap-2">
                                                                        <Type className="w-4 h-4" />
                                                                        Generated Text Overlay
                                                                    </h5>
                                                                    <p className="text-white font-medium text-lg mb-2">"{overlayText}"</p>
                                                                </div>
                                                            )}

                                                            {/* Meme Video Preview */}
                                                            {memeVideoPath && (
                                                                <div className="mt-4">
                                                                    <h4 className="text-sm font-medium text-green-400 mb-2 flex items-center gap-2">
                                                                        <CheckCircle2 className="w-4 h-4" />
                                                                        Meme Video Ready!
                                                                    </h4>
                                                                    <video
                                                                        src={memeVideoPath}
                                                                        controls
                                                                        className="w-full rounded-xl border border-green-500/30"
                                                                        style={{ maxHeight: '400px' }}
                                                                    />
                                                                    <a
                                                                        href={memeVideoPath}
                                                                        download
                                                                        className="w-full mt-3 py-3 px-4 bg-green-500/20 border border-green-500/30 text-green-400 rounded-xl font-medium hover:bg-green-500/30 transition-all flex items-center justify-center"
                                                                    >
                                                                        <Download className="w-5 h-5 mr-2" />
                                                                        Download Meme Video
                                                                    </a>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* AI Mode - Scene Finder */}
                                            {tvMomentsMode === 'ai' && (
                                                <div className="space-y-4 animate-fade-in">
                                                    {/* Movie / TV Show Toggle */}
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => setShowType('movie')}
                                                            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${showType === 'movie'
                                                                ? 'bg-amber-500/20 border border-amber-500/50 text-amber-300'
                                                                : 'bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10'
                                                                }`}
                                                        >
                                                            <Film className="w-4 h-4" />
                                                            Movie
                                                        </button>
                                                        <button
                                                            onClick={() => setShowType('tv_show')}
                                                            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${showType === 'tv_show'
                                                                ? 'bg-amber-500/20 border border-amber-500/50 text-amber-300'
                                                                : 'bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10'
                                                                }`}
                                                        >
                                                            <Tv className="w-4 h-4" />
                                                            TV Show
                                                        </button>
                                                    </div>

                                                    {/* Title Input */}
                                                    <div className="relative">
                                                        <MessageCircle className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                                                        <input
                                                            type="text"
                                                            value={showTitle}
                                                            onChange={(e) => setShowTitle(e.target.value)}
                                                            onKeyDown={(e) => e.key === 'Enter' && handleGetSceneSuggestions()}
                                                            placeholder={showType === 'movie' ? "Enter movie name (e.g., The Dark Knight)" : "Enter TV show name (e.g., Breaking Bad)"}
                                                            className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                                                        />
                                                    </div>

                                                    <button
                                                        onClick={handleGetSceneSuggestions}
                                                        disabled={isAnalyzingShow || !showTitle.trim()}
                                                        className="w-full py-3 px-4 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl font-medium hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                                    >
                                                        {isAnalyzingShow ? (
                                                            <>
                                                                <Loader2 className="w-5 h-5 animate-spin" />
                                                                AI Analyzing {showType === 'movie' ? 'Movie' : 'Show'}...
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Sparkles className="w-5 h-5" />
                                                                Find Viral Scenes
                                                            </>
                                                        )}
                                                    </button>

                                                    {/* Scene Suggestions */}
                                                    {sceneSuggestions.length > 0 && (
                                                        <div className="space-y-3 animate-fade-in">
                                                            <h4 className="text-sm font-medium text-amber-300 flex items-center gap-2">
                                                                <Sparkles className="w-4 h-4" />
                                                                Viral Scene Suggestions for "{showTitle}"
                                                            </h4>

                                                            {sceneSuggestions.map((scene, idx) => (
                                                                <div
                                                                    key={idx}
                                                                    className={`bg-gradient-to-r from-white/5 to-white/[0.02] rounded-xl border p-4 transition-all ${selectedScene === scene
                                                                        ? 'border-amber-500/50 bg-amber-500/10'
                                                                        : 'border-white/10 hover:border-white/20'
                                                                        }`}
                                                                >
                                                                    <div className="flex items-start justify-between mb-2">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-300 text-xs flex items-center justify-center font-bold">
                                                                                {idx + 1}
                                                                            </span>
                                                                            <h5 className="text-white font-semibold">{scene.sceneName}</h5>
                                                                        </div>
                                                                        <div className="flex items-center gap-1 text-xs text-gray-500">
                                                                            <Clock className="w-3 h-3" />
                                                                            {scene.duration}s
                                                                        </div>
                                                                    </div>

                                                                    <p className="text-gray-300 text-sm mb-2">{scene.description}</p>

                                                                    <div className="bg-amber-500/10 rounded-lg p-2 mb-3">
                                                                        <p className="text-amber-200/80 text-xs">
                                                                            <span className="font-semibold">🔥 Why it's viral:</span> {scene.whyViral}
                                                                        </p>
                                                                    </div>

                                                                    <div className="flex items-center justify-between text-xs mb-3">
                                                                        <span className="text-gray-500">📍 {scene.locationHint}</span>
                                                                    </div>

                                                                    {/* Caption Ideas */}
                                                                    <div className="flex flex-wrap gap-2 mb-3">
                                                                        {scene.captionIdeas.map((caption, cidx) => (
                                                                            <span
                                                                                key={cidx}
                                                                                className="text-xs bg-white/5 px-2 py-1 rounded-full text-gray-400"
                                                                            >
                                                                                "{caption}"
                                                                            </span>
                                                                        ))}
                                                                    </div>

                                                                    <button
                                                                        onClick={() => handleSearchScene(scene)}
                                                                        className="w-full py-2 px-3 bg-white/5 border border-white/10 text-gray-300 rounded-lg text-sm font-medium hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                                                                    >
                                                                        <Search className="w-4 h-4" />
                                                                        Find on YouTube
                                                                        <ExternalLink className="w-3 h-3" />
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {/* Selected Scene Info */}
                                                    {selectedScene && (
                                                        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 animate-fade-in">
                                                            <h5 className="text-green-400 font-medium flex items-center gap-2 mb-2">
                                                                <CheckCircle2 className="w-4 h-4" />
                                                                Scene Selected
                                                            </h5>
                                                            <p className="text-gray-300 text-sm mb-3">
                                                                Find the clip on YouTube, download it using the other tools, then come back to add music or filters!
                                                            </p>
                                                            <div className="text-xs text-gray-500">
                                                                💡 Tip: Use "Scene Edits" to add music or "Fan Edits" to apply filters after downloading.
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Final Video */}
                                    {finalVideoPath && (
                                        <div className="mt-6">
                                            <h4 className="text-sm font-medium text-green-400 mb-2 flex items-center">
                                                <CheckCircle2 className="w-4 h-4 mr-2" />
                                                Export Ready
                                            </h4>
                                            <video
                                                key={finalVideoPath}
                                                src={finalVideoPath}
                                                controls
                                                className="w-full rounded-xl border border-green-500/30"
                                                style={{ maxHeight: '250px' }}
                                            />
                                            <a
                                                href={finalVideoPath}
                                                download
                                                className="w-full mt-3 py-3 px-4 bg-green-500/20 border border-green-500/30 text-green-400 rounded-xl font-medium hover:bg-green-500/30 transition-all flex items-center justify-center"
                                            >
                                                <Download className="w-5 h-5 mr-2" />
                                                Download Video
                                            </a>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
