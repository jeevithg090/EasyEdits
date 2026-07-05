import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from './Button';
import {
    Upload,
    X,
    Sparkles,
    Download,
    AlertCircle,
    Image as ImageIcon,
    Highlighter,
    Palette,
    Clock,
    Wand2,
    RefreshCw,
    Video,
    FileText,
    MessageSquare,
    ExternalLink,
    Copy,
    Check,
    Mic,
    Volume2,
    Play,
    Pause,
    Film,
    Search,
    Grid3X3
} from 'lucide-react';

interface UploadedImage {
    id: string;
    file: File;
    preview: string;
}

interface HighlightResult {
    inputImage: string;
    outputVideo: string;
    videoPath: string;
    boxes: Array<{ x: number; y: number; w: number; h: number }>;
}

interface ScriptData {
    // New SSML format
    ssml_script?: string;
    plain_text?: string;
    // Legacy format (backward compatibility)
    hook?: string;
    intro?: string;
    main_points?: Array<{ point: string; visual_cue: string }>;
    cta?: string;
    tone?: string;
    estimated_duration?: string;
    hashtags?: string[];
    why_this_works?: string;
    raw_text?: string;
}

interface ResourceData {
    youtube_videos?: Array<{
        url: string;
        title: string;
        why_useful: string;
        suggested_clip?: string;
    }>;
    articles?: Array<{
        url: string;
        title: string;
        key_points: string;
    }>;
    social_posts?: Array<{
        platform: string;
        url: string;
        summary: string;
        why_useful: string;
    }>;
    search_summary?: string;
    raw_text?: string;
}

interface TextHighlighterPageProps {
    onBack: () => void;
}

interface Voice {
    id: string;
    name: string;
    gender: string;
    locale: string;
    preview?: string;
    tags: string[];
}

interface GeneratedAudio {
    filename: string;
    audioPath: string;
    duration: number | null;
}

interface BRollItem {
    id: string; // Now string to support format like "pexels_123"
    source: 'pexels' | 'pixabay' | 'unsplash';
    type: 'photo' | 'video';
    thumbnail: string;
    preview: string;
    download: string;
    duration?: number;
    width: number;
    height: number;
    photographer: string;
    source_url: string;
}

const API_BASE = 'http://localhost:3005';

const SPEED_OPTIONS = [
    { key: 'slow', name: 'Slow', description: 'Natural pace' },
    { key: 'medium', name: 'Medium', description: 'Slightly faster for engagement' },
    { key: 'fast', name: 'Fast', description: 'Energetic for Reels/Shorts' },
    { key: 'very-fast', name: 'Very Fast', description: 'Maximum urgency' },
];

const HIGHLIGHT_COLORS = [
    { key: 'yellow', name: 'Yellow', hex: '#FFFF00', gradient: 'from-yellow-400 to-yellow-500' },
    { key: 'blue', name: 'Blue', hex: '#6495ED', gradient: 'from-blue-400 to-blue-500' },
    { key: 'green', name: 'Green', hex: '#00FF7F', gradient: 'from-green-400 to-green-500' },
    { key: 'pink', name: 'Pink', hex: '#FF69B4', gradient: 'from-pink-400 to-pink-500' },
    { key: 'orange', name: 'Orange', hex: '#FFA500', gradient: 'from-orange-400 to-orange-500' },
];

export const TextHighlighterPage: React.FC<TextHighlighterPageProps> = ({ onBack }) => {
    const [images, setImages] = useState<UploadedImage[]>([]);
    const [targetText, setTargetText] = useState('');
    const [selectedColor, setSelectedColor] = useState('yellow');
    const [duration, setDuration] = useState(0.4);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [results, setResults] = useState<HighlightResult[]>([]);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const dropZoneRef = useRef<HTMLDivElement>(null);

    // Create Content state
    const [contentTopic, setContentTopic] = useState('');
    const [scriptData, setScriptData] = useState<ScriptData | null>(null);
    const [resourceData, setResourceData] = useState<ResourceData | null>(null);
    const [isGeneratingScript, setIsGeneratingScript] = useState(false);
    const [isFindingResources, setIsFindingResources] = useState(false);
    const [scriptComment, setScriptComment] = useState('');
    const [resourceComment, setResourceComment] = useState('');
    const [contentError, setContentError] = useState<string | null>(null);
    const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

    // Audio generation state
    const [voices, setVoices] = useState<Voice[]>([]);
    const [selectedVoice, setSelectedVoice] = useState<string>('');
    const [audioSpeed, setAudioSpeed] = useState('medium');
    const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
    const [generatedAudio, setGeneratedAudio] = useState<GeneratedAudio | null>(null);
    const [audioError, setAudioError] = useState<string | null>(null);
    const [isLoadingVoices, setIsLoadingVoices] = useState(false);
    const audioRef = useRef<HTMLAudioElement>(null);

    // B-Roll Finder state
    const [brollKeywords, setBrollKeywords] = useState<string[]>([]);
    const [brollResults, setBrollResults] = useState<BRollItem[]>([]);
    const [brollSearchType, setBrollSearchType] = useState<'photos' | 'videos'>('videos');
    const [isExtractingKeywords, setIsExtractingKeywords] = useState(false);
    const [isSearchingBroll, setIsSearchingBroll] = useState(false);
    const [brollError, setBrollError] = useState<string | null>(null);
    const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set());

    // Fetch available voices on mount
    useEffect(() => {
        const fetchVoices = async () => {
            setIsLoadingVoices(true);
            try {
                const response = await fetch(`${API_BASE}/api/audio/voices`);
                const data = await response.json();
                if (data.success && data.voices) {
                    setVoices(data.voices);
                    if (data.voices.length > 0) {
                        setSelectedVoice(data.voices[0].id);
                    }
                }
            } catch (err) {
                console.error('Failed to fetch voices:', err);
            } finally {
                setIsLoadingVoices(false);
            }
        };
        fetchVoices();
    }, []);

    // Handle file selection
    const handleFiles = useCallback((files: FileList | null) => {
        if (!files) return;

        const newImages: UploadedImage[] = [];
        const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

        Array.from(files).forEach(file => {
            if (allowedTypes.includes(file.type) && file.size <= 10 * 1024 * 1024) {
                const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                newImages.push({
                    id,
                    file,
                    preview: URL.createObjectURL(file)
                });
            }
        });

        setImages(prev => [...prev, ...newImages].slice(0, 10)); // Max 10 images
        setError(null);
    }, []);

    // Drag and drop handlers
    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dropZoneRef.current?.classList.add('border-brand-500', 'bg-brand-500/10');
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dropZoneRef.current?.classList.remove('border-brand-500', 'bg-brand-500/10');
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dropZoneRef.current?.classList.remove('border-brand-500', 'bg-brand-500/10');
        handleFiles(e.dataTransfer.files);
    }, [handleFiles]);

    // Remove image
    const removeImage = useCallback((id: string) => {
        setImages(prev => {
            const updated = prev.filter(img => img.id !== id);
            // Revoke URL of removed image
            const removed = prev.find(img => img.id === id);
            if (removed) URL.revokeObjectURL(removed.preview);
            return updated;
        });
    }, []);

    // Generate highlights
    const handleGenerate = async () => {
        if (images.length === 0 || !targetText.trim()) return;

        setIsProcessing(true);
        setProgress(0);
        setError(null);
        setResults([]);

        try {
            const formData = new FormData();
            images.forEach(img => formData.append('images', img.file));
            formData.append('targetText', targetText);
            formData.append('color', selectedColor);
            formData.append('duration', duration.toString());

            // Simulate progress (since we can't get real progress from fetch)
            const progressInterval = setInterval(() => {
                setProgress(prev => Math.min(prev + 5, 90));
            }, 500);

            const response = await fetch(`${API_BASE}/api/text-highlight`, {
                method: 'POST',
                body: formData
            });

            clearInterval(progressInterval);
            setProgress(100);

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to generate highlight video');
            }

            setResults(data.results);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setIsProcessing(false);
        }
    };

    // Download video
    const handleDownload = async (videoPath: string, filename: string) => {
        try {
            const response = await fetch(`${API_BASE}${videoPath}`);
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err) {
            setError('Failed to download video');
        }
    };

    // Generate script using Gemini AI
    const handleGenerateScript = async (withComment = false) => {
        if (!contentTopic.trim()) return;

        setIsGeneratingScript(true);
        setContentError(null);

        try {
            const response = await fetch(`${API_BASE}/api/create-content/script`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    topic: contentTopic,
                    comment: withComment ? scriptComment : undefined
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to generate script');
            }

            setScriptData(data.script);
            setScriptComment('');
        } catch (err) {
            setContentError(err instanceof Error ? err.message : 'Script generation failed');
        } finally {
            setIsGeneratingScript(false);
        }
    };

    // Find resources using Gemini AI with Google Search
    const handleFindResources = async (withComment = false) => {
        if (!contentTopic.trim()) return;

        setIsFindingResources(true);
        setContentError(null);

        try {
            const response = await fetch(`${API_BASE}/api/create-content/resources`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    topic: contentTopic,
                    comment: withComment ? resourceComment : undefined
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to find resources');
            }

            setResourceData(data.resources);
            setResourceComment('');
        } catch (err) {
            setContentError(err instanceof Error ? err.message : 'Resource finding failed');
        } finally {
            setIsFindingResources(false);
        }
    };

    // Copy URL to clipboard
    const handleCopyUrl = async (url: string) => {
        try {
            await navigator.clipboard.writeText(url);
            setCopiedUrl(url);
            setTimeout(() => setCopiedUrl(null), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    // Get full script text from scriptData (plain text for display)
    const getFullScript = (): string => {
        if (!scriptData) return '';

        // Prefer new SSML format's plain_text
        if (scriptData.plain_text) {
            return scriptData.plain_text;
        }

        // Fallback to legacy format
        const parts: string[] = [];

        if (scriptData.hook) parts.push(scriptData.hook);
        if (scriptData.intro) parts.push(scriptData.intro);
        if (scriptData.main_points) {
            scriptData.main_points.forEach(p => parts.push(p.point));
        }
        if (scriptData.cta) parts.push(scriptData.cta);

        // Fallback to raw text if no structured data
        if (parts.length === 0 && scriptData.raw_text) {
            return scriptData.raw_text;
        }

        return parts.join('. ');
    };

    // Get SSML script for TTS (with emotions and prosody)
    const getSSMLScript = (): string => {
        if (!scriptData) return '';

        // Use SSML script if available
        if (scriptData.ssml_script) {
            return scriptData.ssml_script;
        }

        // Fallback to plain text wrapped in speak tags
        const plainText = getFullScript();
        return `<speak>${plainText}</speak>`;
    };

    // Generate audio from script
    const handleGenerateAudio = async () => {
        const plainText = getFullScript();
        const ssmlScript = getSSMLScript();

        if (!plainText.trim()) {
            setAudioError('No script available. Generate a script first.');
            return;
        }

        if (!selectedVoice) {
            setAudioError('Please select a voice.');
            return;
        }

        setIsGeneratingAudio(true);
        setAudioError(null);
        setGeneratedAudio(null);

        try {
            const response = await fetch(`${API_BASE}/api/audio/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    script: ssmlScript, // Send SSML script for TTS
                    plainScript: plainText, // For logging
                    voiceId: selectedVoice,
                    speed: audioSpeed,
                    isSSML: !!scriptData?.ssml_script // Flag indicating SSML format
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to generate audio');
            }

            setGeneratedAudio({
                filename: data.filename,
                audioPath: data.audioPath,
                duration: data.duration
            });
        } catch (err) {
            setAudioError(err instanceof Error ? err.message : 'Audio generation failed');
        } finally {
            setIsGeneratingAudio(false);
        }
    };

    // B-Roll: Extract keywords from script
    const handleExtractKeywords = async () => {
        const scriptText = getFullScript();
        if (!scriptText) {
            setBrollError('Generate a script first to extract keywords');
            return;
        }

        setIsExtractingKeywords(true);
        setBrollError(null);

        try {
            const response = await fetch(`${API_BASE}/api/broll/extract-keywords`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ script: scriptText })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to extract keywords');
            }

            setBrollKeywords(data.keywords || []);
        } catch (err) {
            setBrollError(err instanceof Error ? err.message : 'Keyword extraction failed');
        } finally {
            setIsExtractingKeywords(false);
        }
    };

    // B-Roll: Search all sources (Pexels, Pixabay, Unsplash)
    const handleSearchBroll = async (keyword: string) => {
        setIsSearchingBroll(true);
        setBrollError(null);

        try {
            const response = await fetch(
                `${API_BASE}/api/broll/search-all?query=${encodeURIComponent(keyword)}&type=${brollSearchType}&per_page=6`
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || data.message || 'Search failed');
            }

            setBrollResults(data.results || []);

            // Log source breakdown
            if (data.sources) {
                console.log(`B-Roll results: Pexels: ${data.sources.pexels}, Pixabay: ${data.sources.pixabay}, Unsplash: ${data.sources.unsplash}`);
            }
        } catch (err) {
            setBrollError(err instanceof Error ? err.message : 'Search failed');
        } finally {
            setIsSearchingBroll(false);
        }
    };

    // B-Roll: Download asset
    const handleDownloadBroll = async (item: BRollItem) => {
        setDownloadingIds(prev => new Set(prev).add(item.id));

        try {
            const response = await fetch(`${API_BASE}/api/broll/download`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: item.download,
                    type: item.type,
                    filename: `broll_${item.id}.${item.type === 'video' ? 'mp4' : 'jpg'}`
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Download failed');
            }

            // Open download in new tab
            window.open(`${API_BASE}${data.path}`, '_blank');
        } catch (err) {
            setBrollError(err instanceof Error ? err.message : 'Download failed');
        } finally {
            setDownloadingIds(prev => {
                const next = new Set(prev);
                next.delete(item.id);
                return next;
            });
        }
    };

    // Remove keyword
    const handleRemoveKeyword = (keyword: string) => {
        setBrollKeywords(prev => prev.filter(k => k !== keyword));
    };

    return (
        <div className="min-h-screen pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto animate-fade-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                <div>
                    <button
                        onClick={onBack}
                        className="text-gray-500 hover:text-white text-sm mb-2 transition-colors flex items-center"
                    >
                        ← Back to Categories
                    </button>
                    <h1 className="text-3xl font-bold text-white flex items-center">
                        <Highlighter className="w-8 h-8 mr-3 text-yellow-400" />
                        Text Highlighter
                        <span className="ml-3 px-2 py-1 rounded text-xs font-medium bg-brand-500/20 text-brand-300 border border-brand-500/20">
                            OCR + AI
                        </span>
                    </h1>
                    <p className="text-gray-400 mt-2">
                        Create viral "documentary style" text highlight animations from screenshots
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Input Section */}
                <div className="lg:col-span-5 space-y-6">
                    {/* Image Upload Area */}
                    <div className="glass-card p-6 rounded-2xl">
                        <label className="block text-sm font-medium text-gray-300 mb-3 flex items-center">
                            <Upload className="w-4 h-4 mr-2" />
                            Upload Screenshots
                        </label>

                        {/* Drop Zone */}
                        <div
                            ref={dropZoneRef}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                            className="border-2 border-dashed border-gray-700 rounded-xl p-8 text-center cursor-pointer transition-all hover:border-gray-500"
                        >
                            <ImageIcon className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                            <p className="text-gray-400 text-sm mb-1">
                                Drag & drop images here, or click to browse
                            </p>
                            <p className="text-gray-600 text-xs">
                                PNG, JPG, WEBP up to 10MB (max 10 images)
                            </p>
                        </div>

                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/png,image/jpeg,image/jpg,image/webp"
                            multiple
                            onChange={(e) => handleFiles(e.target.files)}
                            className="hidden"
                        />

                        {/* Preview Grid */}
                        {images.length > 0 && (
                            <div className="mt-4 grid grid-cols-3 gap-3">
                                {images.map(img => (
                                    <div key={img.id} className="relative group aspect-video rounded-lg overflow-hidden bg-black/40">
                                        <img
                                            src={img.preview}
                                            alt="Upload preview"
                                            className="w-full h-full object-cover"
                                        />
                                        <button
                                            onClick={(e) => { e.stopPropagation(); removeImage(img.id); }}
                                            className="absolute top-1 right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <X className="w-4 h-4 text-white" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Text Input */}
                    <div className="glass-card p-6 rounded-2xl">
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            Text to Highlight
                        </label>
                        <textarea
                            className="w-full bg-black/40 border border-gray-700 rounded-xl p-4 text-white placeholder-gray-500 focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all resize-none h-24"
                            placeholder="Paste the exact text from the image that you want to highlight..."
                            value={targetText}
                            onChange={(e) => setTargetText(e.target.value)}
                        />
                        <p className="text-gray-600 text-xs mt-2">
                            Tip: Copy the text exactly as it appears in the image
                        </p>
                    </div>

                    {/* Style Options */}
                    <div className="glass-card p-6 rounded-2xl">
                        {/* Color Selection */}
                        <div className="mb-6">
                            <label className="block text-sm font-medium text-gray-300 mb-3 flex items-center">
                                <Palette className="w-4 h-4 mr-2" />
                                Highlight Color
                            </label>
                            <div className="flex gap-3">
                                {HIGHLIGHT_COLORS.map(color => (
                                    <button
                                        key={color.key}
                                        onClick={() => setSelectedColor(color.key)}
                                        className={`w-10 h-10 rounded-full transition-all flex items-center justify-center ${selectedColor === color.key
                                            ? 'ring-2 ring-white ring-offset-2 ring-offset-black scale-110'
                                            : 'hover:scale-105'
                                            }`}
                                        style={{ backgroundColor: color.hex }}
                                        title={color.name}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* Duration Slider */}
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-3 flex items-center">
                                <Clock className="w-4 h-4 mr-2" />
                                Animation Speed: {duration.toFixed(1)}s per line
                            </label>
                            <input
                                type="range"
                                min="0.2"
                                max="1.0"
                                step="0.1"
                                value={duration}
                                onChange={(e) => setDuration(parseFloat(e.target.value))}
                                className="w-full accent-brand-500"
                            />
                            <div className="flex justify-between text-xs text-gray-600 mt-1">
                                <span>Fast</span>
                                <span>Slow</span>
                            </div>
                        </div>
                    </div>

                    {/* Generate Button */}
                    <Button
                        className="w-full"
                        onClick={handleGenerate}
                        isLoading={isProcessing}
                        disabled={images.length === 0 || !targetText.trim()}
                        icon={<Sparkles className="w-5 h-5" />}
                    >
                        {isProcessing ? `Processing... ${progress}%` : 'Generate Highlight Video'}
                    </Button>
                </div>

                {/* Output Section */}
                <div className="lg:col-span-7">
                    {error && (
                        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start">
                            <AlertCircle className="w-5 h-5 text-red-400 mr-3 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="text-red-400 font-medium">Error</p>
                                <p className="text-red-300 text-sm">{error}</p>
                            </div>
                        </div>
                    )}

                    {results.length === 0 && !isProcessing && (
                        <div className="h-full min-h-[500px] flex flex-col items-center justify-center glass-card rounded-2xl p-12 text-center border-dashed border-2 border-gray-800">
                            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-yellow-500/20 to-orange-500/20 flex items-center justify-center mb-6">
                                <Highlighter className="w-10 h-10 text-yellow-500/50" />
                            </div>
                            <h3 className="text-xl font-medium text-gray-300 mb-2">Ready to Highlight</h3>
                            <p className="text-gray-500 max-w-md">
                                Upload a screenshot (X post, news article, etc.), enter the text you want to highlight,
                                and we'll create an animated video with a professional highlight effect.
                            </p>
                        </div>
                    )}

                    {isProcessing && (
                        <div className="h-full min-h-[500px] flex flex-col items-center justify-center glass-card rounded-2xl p-12 text-center">
                            <div className="w-16 h-16 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mb-6"></div>
                            <h3 className="text-xl font-medium text-gray-300 mb-2">Processing...</h3>
                            <p className="text-gray-500 mb-4">Scanning image and creating animation</p>
                            <div className="w-full max-w-xs bg-gray-800 rounded-full h-2">
                                <div
                                    className="bg-gradient-to-r from-brand-500 to-purple-500 h-2 rounded-full transition-all"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                            <p className="text-gray-600 text-sm mt-2">{progress}%</p>
                        </div>
                    )}

                    {results.length > 0 && (
                        <div className="space-y-6">
                            <h3 className="text-lg font-semibold text-white">Generated Videos</h3>
                            {results.map((result, idx) => (
                                <div key={idx} className="glass-card rounded-xl overflow-hidden">
                                    <div className="aspect-video bg-black">
                                        <video
                                            src={`${API_BASE}${result.videoPath}`}
                                            controls
                                            className="w-full h-full object-contain"
                                            autoPlay
                                            loop
                                        />
                                    </div>
                                    <div className="p-4 flex items-center justify-between">
                                        <div>
                                            <p className="text-white font-medium">{result.outputVideo}</p>
                                            <p className="text-gray-500 text-sm">
                                                Found {result.boxes.length} text region(s)
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => handleDownload(result.videoPath, result.outputVideo)}
                                            className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-medium flex items-center transition-colors"
                                        >
                                            <Download className="w-4 h-4 mr-2" />
                                            Download
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* ========== CREATE CONTENT SECTION ========== */}
            <div className="mt-16 pt-12 border-t border-gray-800">
                <div className="mb-8">
                    <h2 className="text-2xl font-bold text-white flex items-center">
                        <Wand2 className="w-7 h-7 mr-3 text-purple-400" />
                        Create Content
                        <span className="ml-3 px-2 py-1 rounded text-xs font-medium bg-purple-500/20 text-purple-300 border border-purple-500/20">
                            Gemini AI
                        </span>
                    </h2>
                    <p className="text-gray-400 mt-2">
                        Generate viral video scripts and find resources using AI with Google Search
                    </p>
                </div>

                {/* Topic Input */}
                <div className="glass-card p-6 rounded-2xl mb-6">
                    <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center">
                        <MessageSquare className="w-4 h-4 mr-2" />
                        What content do you want to create?
                    </label>
                    <input
                        type="text"
                        className="w-full bg-black/40 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                        placeholder="e.g., AI assistants revolutionizing healthcare in 2024"
                        value={contentTopic}
                        onChange={(e) => setContentTopic(e.target.value)}
                    />

                    <div className="flex gap-4 mt-4">
                        <Button
                            onClick={() => handleGenerateScript(false)}
                            isLoading={isGeneratingScript}
                            disabled={!contentTopic.trim()}
                            icon={<Sparkles className="w-5 h-5" />}
                            className="flex-1"
                        >
                            {isGeneratingScript ? 'Generating Script...' : 'Generate Script'}
                        </Button>
                        <Button
                            onClick={() => handleFindResources(false)}
                            isLoading={isFindingResources}
                            disabled={!contentTopic.trim()}
                            icon={<Video className="w-5 h-5" />}
                            className="flex-1 !bg-purple-600 hover:!bg-purple-700"
                        >
                            {isFindingResources ? 'Finding Resources...' : 'Find Resources'}
                        </Button>
                    </div>
                </div>

                {/* Error Display */}
                {contentError && (
                    <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start">
                        <AlertCircle className="w-5 h-5 text-red-400 mr-3 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-red-400 font-medium">Error</p>
                            <p className="text-red-300 text-sm">{contentError}</p>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Script Panel */}
                    <div className="glass-card p-6 rounded-2xl">
                        <h3 className="text-lg font-semibold text-white flex items-center mb-4">
                            <FileText className="w-5 h-5 mr-2 text-yellow-400" />
                            Video Script
                        </h3>

                        {!scriptData && !isGeneratingScript && (
                            <div className="text-center py-12 text-gray-500">
                                <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                <p>Enter a topic and click "Generate Script" to create a viral video script</p>
                            </div>
                        )}

                        {isGeneratingScript && (
                            <div className="text-center py-12">
                                <div className="w-12 h-12 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                                <p className="text-gray-400">Generating script with Gemini AI...</p>
                            </div>
                        )}

                        {scriptData && !isGeneratingScript && (
                            <div className="space-y-4">
                                {scriptData.hook && (
                                    <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                                        <span className="text-xs text-yellow-400 font-medium">🎣 HOOK</span>
                                        <p className="text-white mt-1">{scriptData.hook}</p>
                                    </div>
                                )}

                                {scriptData.intro && (
                                    <div>
                                        <span className="text-xs text-gray-500 font-medium">INTRO</span>
                                        <p className="text-gray-300 text-sm mt-1">{scriptData.intro}</p>
                                    </div>
                                )}

                                {scriptData.main_points && scriptData.main_points.length > 0 && (
                                    <div>
                                        <span className="text-xs text-gray-500 font-medium">MAIN POINTS</span>
                                        <div className="space-y-2 mt-2">
                                            {scriptData.main_points.map((point, idx) => (
                                                <div key={idx} className="p-2 rounded bg-white/5 text-sm">
                                                    <p className="text-white">{point.point}</p>
                                                    <p className="text-gray-500 text-xs mt-1">📹 {point.visual_cue}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {scriptData.cta && (
                                    <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                                        <span className="text-xs text-green-400 font-medium">📢 CTA</span>
                                        <p className="text-white mt-1">{scriptData.cta}</p>
                                    </div>
                                )}

                                {scriptData.hashtags && (
                                    <div className="flex flex-wrap gap-2">
                                        {scriptData.hashtags.map((tag, idx) => (
                                            <span key={idx} className="px-2 py-1 text-xs bg-brand-500/20 text-brand-300 rounded">
                                                #{tag}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                {scriptData.why_this_works && (
                                    <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                                        <span className="text-xs text-purple-400 font-medium">💡 WHY THIS WORKS</span>
                                        <p className="text-gray-300 text-sm mt-1">{scriptData.why_this_works}</p>
                                    </div>
                                )}

                                {scriptData.raw_text && !scriptData.hook && (
                                    <div className="p-3 rounded bg-gray-800 text-sm text-gray-300 whitespace-pre-wrap">
                                        {scriptData.raw_text}
                                    </div>
                                )}

                                {/* Regenerate with comment */}
                                <div className="pt-4 border-t border-gray-700">
                                    <textarea
                                        className="w-full bg-black/40 border border-gray-700 rounded-lg p-3 text-white placeholder-gray-500 text-sm resize-none h-20 focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                                        placeholder="Add feedback to improve the script... (e.g., 'make it more energetic' or 'add more pauses')"
                                        value={scriptComment}
                                        onChange={(e) => setScriptComment(e.target.value)}
                                    />
                                    <button
                                        onClick={() => handleGenerateScript(true)}
                                        disabled={isGeneratingScript || !scriptComment.trim()}
                                        className={`mt-2 px-4 py-2 rounded-lg flex items-center text-sm font-medium transition-all ${isGeneratingScript || !scriptComment.trim()
                                            ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                            : 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 hover:text-yellow-300'
                                            }`}
                                    >
                                        <RefreshCw className={`w-4 h-4 mr-2 ${isGeneratingScript ? 'animate-spin' : ''}`} />
                                        {isGeneratingScript ? 'Regenerating...' : 'Re-generate with feedback'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Resources Panel */}
                    <div className="glass-card p-6 rounded-2xl">
                        <h3 className="text-lg font-semibold text-white flex items-center mb-4">
                            <Video className="w-5 h-5 mr-2 text-purple-400" />
                            Resources
                        </h3>

                        {!resourceData && !isFindingResources && (
                            <div className="text-center py-12 text-gray-500">
                                <Video className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                <p>Click "Find Resources" to discover videos, articles, and posts</p>
                            </div>
                        )}

                        {isFindingResources && (
                            <div className="text-center py-12">
                                <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                                <p className="text-gray-400">Searching with Google...</p>
                            </div>
                        )}

                        {resourceData && !isFindingResources && (
                            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                                {/* YouTube Videos */}
                                {resourceData.youtube_videos && resourceData.youtube_videos.length > 0 && (
                                    <div>
                                        <span className="text-xs text-red-400 font-medium flex items-center mb-2">
                                            <Video className="w-3 h-3 mr-1" /> YOUTUBE VIDEOS
                                        </span>
                                        <div className="space-y-2">
                                            {resourceData.youtube_videos.map((video, idx) => (
                                                <div key={idx} className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                                                    <p className="text-white text-sm font-medium">{video.title}</p>
                                                    <p className="text-gray-400 text-xs mt-1">{video.why_useful}</p>
                                                    {video.suggested_clip && (
                                                        <p className="text-red-400 text-xs mt-1">📍 {video.suggested_clip}</p>
                                                    )}
                                                    <div className="flex items-center gap-2 mt-2">
                                                        <a
                                                            href={video.url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-xs text-red-400 hover:text-red-300 flex items-center"
                                                        >
                                                            <ExternalLink className="w-3 h-3 mr-1" /> Open
                                                        </a>
                                                        <button
                                                            onClick={() => handleCopyUrl(video.url)}
                                                            className="text-xs text-gray-400 hover:text-white flex items-center"
                                                        >
                                                            {copiedUrl === video.url ? (
                                                                <><Check className="w-3 h-3 mr-1 text-green-400" /> Copied</>
                                                            ) : (
                                                                <><Copy className="w-3 h-3 mr-1" /> Copy URL</>
                                                            )}
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Articles */}
                                {resourceData.articles && resourceData.articles.length > 0 && (
                                    <div>
                                        <span className="text-xs text-blue-400 font-medium flex items-center mb-2">
                                            <FileText className="w-3 h-3 mr-1" /> ARTICLES
                                        </span>
                                        <div className="space-y-2">
                                            {resourceData.articles.map((article, idx) => (
                                                <div key={idx} className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                                                    <p className="text-white text-sm font-medium">{article.title}</p>
                                                    <p className="text-gray-400 text-xs mt-1">{article.key_points}</p>
                                                    <a
                                                        href={article.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-xs text-blue-400 hover:text-blue-300 flex items-center mt-2"
                                                    >
                                                        <ExternalLink className="w-3 h-3 mr-1" /> Read Article
                                                    </a>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Social Posts */}
                                {resourceData.social_posts && resourceData.social_posts.length > 0 && (
                                    <div>
                                        <span className="text-xs text-cyan-400 font-medium flex items-center mb-2">
                                            <MessageSquare className="w-3 h-3 mr-1" /> SOCIAL POSTS
                                        </span>
                                        <div className="space-y-2">
                                            {resourceData.social_posts.map((post, idx) => (
                                                <div key={idx} className="p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                                                    <span className="text-xs text-cyan-400">{post.platform}</span>
                                                    <p className="text-gray-300 text-sm mt-1">{post.summary}</p>
                                                    <div className="flex items-center gap-2 mt-2">
                                                        <a
                                                            href={post.url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center"
                                                        >
                                                            <ExternalLink className="w-3 h-3 mr-1" /> View
                                                        </a>
                                                        <button
                                                            onClick={() => handleCopyUrl(post.url)}
                                                            className="text-xs text-gray-400 hover:text-white flex items-center"
                                                        >
                                                            {copiedUrl === post.url ? (
                                                                <><Check className="w-3 h-3 mr-1 text-green-400" /> Copied</>
                                                            ) : (
                                                                <><Copy className="w-3 h-3 mr-1" /> Copy URL</>
                                                            )}
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {resourceData.search_summary && (
                                    <div className="p-3 rounded-lg bg-gray-800 text-gray-400 text-xs">
                                        {resourceData.search_summary}
                                    </div>
                                )}

                                {resourceData.raw_text && !resourceData.youtube_videos && (
                                    <div className="p-3 rounded bg-gray-800 text-sm text-gray-300 whitespace-pre-wrap">
                                        {resourceData.raw_text}
                                    </div>
                                )}

                                {/* Try better with comment */}
                                <div className="pt-4 border-t border-gray-700">
                                    <textarea
                                        className="w-full bg-black/40 border border-gray-700 rounded-lg p-3 text-white placeholder-gray-500 text-sm resize-none h-20"
                                        placeholder="Add feedback to find better resources..."
                                        value={resourceComment}
                                        onChange={(e) => setResourceComment(e.target.value)}
                                    />
                                    <button
                                        onClick={() => handleFindResources(true)}
                                        disabled={isFindingResources}
                                        className="mt-2 flex items-center text-sm text-purple-400 hover:text-purple-300 transition-colors"
                                    >
                                        <RefreshCw className={`w-4 h-4 mr-2 ${isFindingResources ? 'animate-spin' : ''}`} />
                                        Try better with feedback
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ========== GENERATE AUDIO SECTION ========== */}
            <div className="mt-16 pt-12 border-t border-gray-800">
                <div className="mb-8">
                    <h2 className="text-2xl font-bold text-white flex items-center">
                        <Mic className="w-7 h-7 mr-3 text-green-400" />
                        Generate Audio
                        <span className="ml-3 px-2 py-1 rounded text-xs font-medium bg-green-500/20 text-green-300 border border-green-500/20">
                            Speechify AI
                        </span>
                    </h2>
                    <p className="text-gray-400 mt-2">
                        Convert your script to a professional voiceover optimized for short-form content
                    </p>
                </div>

                <div className="glass-card p-6 rounded-2xl">
                    {/* Voice and Speed Selection */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        {/* Voice Selector */}
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center">
                                <Volume2 className="w-4 h-4 mr-2" />
                                Select Voice
                            </label>
                            {isLoadingVoices ? (
                                <div className="bg-black/40 border border-gray-700 rounded-xl px-4 py-3 text-gray-500">
                                    Loading voices...
                                </div>
                            ) : (
                                <select
                                    value={selectedVoice}
                                    onChange={(e) => setSelectedVoice(e.target.value)}
                                    className="w-full bg-black/40 border border-gray-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
                                >
                                    {voices.length === 0 ? (
                                        <option value="">No voices available</option>
                                    ) : (
                                        voices.map(voice => (
                                            <option key={voice.id} value={voice.id}>
                                                {voice.name} ({voice.gender}, {voice.locale})
                                            </option>
                                        ))
                                    )}
                                </select>
                            )}
                        </div>

                        {/* Speed Selector */}
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center">
                                <Clock className="w-4 h-4 mr-2" />
                                Speaking Speed
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                {SPEED_OPTIONS.map(speed => (
                                    <button
                                        key={speed.key}
                                        onClick={() => setAudioSpeed(speed.key)}
                                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${audioSpeed === speed.key
                                            ? 'bg-green-500 text-white'
                                            : 'bg-white/5 text-gray-300 hover:bg-white/10'
                                            }`}
                                    >
                                        {speed.name}
                                    </button>
                                ))}
                            </div>
                            <p className="text-gray-600 text-xs mt-2">
                                {SPEED_OPTIONS.find(s => s.key === audioSpeed)?.description}
                            </p>
                        </div>
                    </div>

                    {/* Script Preview */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            Script Preview
                        </label>
                        <div className="bg-black/40 border border-gray-700 rounded-xl p-4 max-h-32 overflow-y-auto">
                            {scriptData ? (
                                <p className="text-gray-300 text-sm">{getFullScript()}</p>
                            ) : (
                                <p className="text-gray-500 text-sm italic">
                                    Generate a script first using the Create Content section above
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Error Display */}
                    {audioError && (
                        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start">
                            <AlertCircle className="w-5 h-5 text-red-400 mr-3 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="text-red-400 font-medium">Error</p>
                                <p className="text-red-300 text-sm">{audioError}</p>
                            </div>
                        </div>
                    )}

                    {/* Generate Button */}
                    <Button
                        onClick={handleGenerateAudio}
                        isLoading={isGeneratingAudio}
                        disabled={!scriptData || !selectedVoice}
                        icon={<Mic className="w-5 h-5" />}
                        className="w-full !bg-green-600 hover:!bg-green-700"
                    >
                        {isGeneratingAudio ? 'Generating Audio...' : 'Generate Audio'}
                    </Button>

                    {/* Audio Player */}
                    {generatedAudio && (
                        <div className="mt-6 p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center">
                                    <Volume2 className="w-5 h-5 text-green-400 mr-2" />
                                    <span className="text-white font-medium">{generatedAudio.filename}</span>
                                </div>
                                <button
                                    onClick={() => {
                                        const a = document.createElement('a');
                                        a.href = `${API_BASE}${generatedAudio.audioPath}`;
                                        a.download = generatedAudio.filename;
                                        a.click();
                                    }}
                                    className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium flex items-center transition-colors"
                                >
                                    <Download className="w-4 h-4 mr-1" />
                                    Download
                                </button>
                            </div>
                            <audio
                                ref={audioRef}
                                src={`${API_BASE}${generatedAudio.audioPath}`}
                                controls
                                className="w-full"
                            />
                            {generatedAudio.duration && (
                                <p className="text-gray-500 text-xs mt-2">
                                    Duration: {generatedAudio.duration.toFixed(1)}s
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* ========== B-ROLL FINDER SECTION ========== */}
            <div className="mt-16 pt-12 border-t border-gray-800">
                <div className="mb-8">
                    <h2 className="text-2xl font-bold text-white flex items-center">
                        <Film className="w-7 h-7 mr-3 text-cyan-400" />
                        B-Roll Finder
                        <span className="ml-3 px-2 py-1 rounded text-xs font-medium bg-cyan-500/20 text-cyan-300 border border-cyan-500/20">
                            Pexels
                        </span>
                    </h2>
                    <p className="text-gray-400 mt-2">
                        Find free stock videos and images that match your script
                    </p>
                </div>

                <div className="glass-card p-6 rounded-2xl">
                    {/* Extract Keywords Button */}
                    <Button
                        onClick={handleExtractKeywords}
                        isLoading={isExtractingKeywords}
                        disabled={!scriptData}
                        icon={<Wand2 className="w-5 h-5" />}
                        className="mb-6 !bg-cyan-600 hover:!bg-cyan-700"
                    >
                        {isExtractingKeywords ? 'Extracting Keywords...' : 'Extract Keywords from Script'}
                    </Button>

                    {/* Keyword Chips */}
                    {brollKeywords.length > 0 && (
                        <div className="mb-6">
                            <label className="block text-sm font-medium text-gray-300 mb-3">
                                Click a keyword to search:
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {brollKeywords.map((keyword, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => handleSearchBroll(keyword)}
                                        className="group px-3 py-1.5 bg-cyan-500/20 text-cyan-300 rounded-full text-sm font-medium hover:bg-cyan-500/30 transition-all flex items-center"
                                    >
                                        <Search className="w-3 h-3 mr-1.5 opacity-50 group-hover:opacity-100" />
                                        {keyword}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleRemoveKeyword(keyword);
                                            }}
                                            className="ml-2 opacity-50 hover:opacity-100"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Photo/Video Toggle */}
                    <div className="mb-6 flex items-center gap-4">
                        <span className="text-sm text-gray-400">Show:</span>
                        <div className="flex rounded-lg overflow-hidden border border-gray-700">
                            <button
                                onClick={() => setBrollSearchType('videos')}
                                className={`px-4 py-2 text-sm font-medium transition-all flex items-center ${brollSearchType === 'videos'
                                    ? 'bg-cyan-500 text-white'
                                    : 'bg-black/20 text-gray-400 hover:text-white'
                                    }`}
                            >
                                <Video className="w-4 h-4 mr-2" />
                                Videos
                            </button>
                            <button
                                onClick={() => setBrollSearchType('photos')}
                                className={`px-4 py-2 text-sm font-medium transition-all flex items-center ${brollSearchType === 'photos'
                                    ? 'bg-cyan-500 text-white'
                                    : 'bg-black/20 text-gray-400 hover:text-white'
                                    }`}
                            >
                                <ImageIcon className="w-4 h-4 mr-2" />
                                Photos
                            </button>
                        </div>
                    </div>

                    {/* Error Display */}
                    {brollError && (
                        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start">
                            <AlertCircle className="w-5 h-5 text-red-400 mr-3 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="text-red-400 font-medium">Error</p>
                                <p className="text-red-300 text-sm">{brollError}</p>
                            </div>
                        </div>
                    )}

                    {/* Loading State */}
                    {isSearchingBroll && (
                        <div className="text-center py-12">
                            <RefreshCw className="w-8 h-8 mx-auto mb-3 text-cyan-400 animate-spin" />
                            <p className="text-gray-400">Searching Pexels...</p>
                        </div>
                    )}

                    {/* Results Grid */}
                    {!isSearchingBroll && brollResults.length > 0 && (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {brollResults.map((item) => (
                                <div
                                    key={item.id}
                                    className="relative group rounded-xl overflow-hidden bg-gray-800 aspect-[9/16]"
                                >
                                    <img
                                        src={item.thumbnail}
                                        alt=""
                                        className="w-full h-full object-cover"
                                    />

                                    {/* Video Duration Badge */}
                                    {item.type === 'video' && item.duration && (
                                        <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/70 rounded text-xs text-white">
                                            {item.duration}s
                                        </div>
                                    )}

                                    {/* Source Badge */}
                                    <div className={`absolute top-2 right-2 px-2 py-0.5 rounded text-xs font-medium uppercase ${item.source === 'pexels' ? 'bg-green-500/80 text-white' :
                                            item.source === 'pixabay' ? 'bg-purple-500/80 text-white' :
                                                'bg-pink-500/80 text-white'
                                        }`}>
                                        {item.source}
                                    </div>

                                    {/* Hover Overlay */}
                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                                        <p className="text-white text-xs mb-2 truncate">
                                            by {item.photographer}
                                        </p>
                                        <button
                                            onClick={() => handleDownloadBroll(item)}
                                            disabled={downloadingIds.has(item.id)}
                                            className="w-full px-3 py-2 bg-cyan-500 hover:bg-cyan-600 disabled:bg-gray-600 text-white rounded-lg text-sm font-medium flex items-center justify-center transition-colors"
                                        >
                                            {downloadingIds.has(item.id) ? (
                                                <RefreshCw className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <>
                                                    <Download className="w-4 h-4 mr-1" />
                                                    Download
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Empty State */}
                    {!isSearchingBroll && brollResults.length === 0 && brollKeywords.length > 0 && (
                        <div className="text-center py-12 text-gray-500">
                            <Grid3X3 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                            <p>Click a keyword above to search for B-Roll</p>
                        </div>
                    )}

                    {/* Initial State */}
                    {brollKeywords.length === 0 && (
                        <div className="text-center py-12 text-gray-500">
                            <Film className="w-12 h-12 mx-auto mb-3 opacity-30" />
                            <p>Generate a script first, then extract keywords to find B-Roll</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
