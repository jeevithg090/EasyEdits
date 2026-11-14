import React, { useState, useRef, useEffect, useCallback } from 'react';
import { API_BASE } from '../lib/api';
import { ArrowLeft, Youtube, Clock, Download, Play, AlertCircle, Cloud, Monitor, Loader2, Crop, ChevronDown, Cpu, RefreshCw, CheckCircle2, XCircle, FolderOpen, Trash2, FileText, Type, Palette, Sparkles, X, Video, Link, Image, Wand2 } from 'lucide-react';

interface ProcessedVideo {
    filename: string;
    path: string;
    size: number;
}

interface TranscriptionWord {
    word: string;
    start: number;
    end: number;
}

interface Transcription {
    words: TranscriptionWord[];
    text: string;
    language: string;
}

interface CaptionTheme {
    key: string;
    name: string;
    hex?: string;
}

interface CaptionSettings {
    font: string;
    color: string;
    highlightColor: string;
    wordsPerSegment: number;
    position: 'top' | 'center' | 'bottom' | 'custom';
    customPositionY: number;
}

interface GeneratedImage {
    timeStart: number;
    timeEnd: number;
    imageIndex: number;
    prompt: string;
    filename: string;
    localPath: string;
    url: string;
}

interface TransitionOption {
    key: string;
    name: string;
    description: string;
}

interface PodcastPageProps {
    onBack: () => void;
}

const ASPECT_RATIOS = [
    { value: '9:16', label: '9:16 (TikTok/Reels)', width: 9, height: 16 },
    { value: '4:5', label: '4:5 (Instagram)', width: 4, height: 5 },
    { value: '1:1', label: '1:1 (Square)', width: 1, height: 1 },
];

// Default caption themes (will be fetched from server)
const DEFAULT_FONTS: CaptionTheme[] = [
    { key: 'montserrat', name: 'Montserrat' },
    { key: 'poppins', name: 'Poppins' },
    { key: 'roboto', name: 'Roboto' },
    { key: 'opensans', name: 'Open Sans' },
    { key: 'inter', name: 'Inter' },
    { key: 'bebas', name: 'Bebas Neue' },
    { key: 'oswald', name: 'Oswald' },
    { key: 'anton', name: 'Anton' },
];

const DEFAULT_COLORS: CaptionTheme[] = [
    { key: 'white', name: 'White', hex: '#FFFFFF' },
    { key: 'black', name: 'Black', hex: '#000000' },
    { key: 'yellow', name: 'Yellow', hex: '#FFFF00' },
    { key: 'red', name: 'Red', hex: '#FF0000' },
    { key: 'cyan', name: 'Cyan', hex: '#00FFFF' },
    { key: 'lime', name: 'Lime', hex: '#00FF00' },
    { key: 'pink', name: 'Pink', hex: '#FF00FF' },
    { key: 'orange', name: 'Orange', hex: '#FF8000' },
];

const DEFAULT_HIGHLIGHT_COLORS: CaptionTheme[] = [
    { key: 'yellow', name: 'Yellow', hex: '#FFFF00' },
    { key: 'cyan', name: 'Cyan', hex: '#00FFFF' },
    { key: 'lime', name: 'Lime', hex: '#00FF00' },
    { key: 'magenta', name: 'Magenta', hex: '#FF00FF' },
    { key: 'orange', name: 'Orange', hex: '#FF8000' },
    { key: 'red', name: 'Red', hex: '#FF0000' },
    { key: 'white', name: 'White', hex: '#FFFFFF' },
    { key: 'gold', name: 'Gold', hex: '#FFD700' },
];

export const PodcastPage: React.FC<PodcastPageProps> = ({ onBack }) => {
    const [mode, setMode] = useState<'local' | 'cloud' | 'colab'>('local');
    const [youtubeUrl, setYoutubeUrl] = useState('');
    const [startTime, setStartTime] = useState('00:00:00');
    const [endTime, setEndTime] = useState('00:00:30');
    const [isDownloading, setIsDownloading] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState(0);
    const [videoPath, setVideoPath] = useState<string | null>(null);
    const [videoFilename, setVideoFilename] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);

    // Autocrop state
    const [aspectRatio, setAspectRatio] = useState('9:16');
    const [isAutocropping, setIsAutocropping] = useState(false);
    const [autocropProgress, setAutocropProgress] = useState(0);
    const [croppedVideoPath, setCroppedVideoPath] = useState<string | null>(null);

    // Cloud/Colab processing state
    const [cloudJobId, setCloudJobId] = useState<string | null>(null);
    const [cloudJobStatus, setCloudJobStatus] = useState<string | null>(null);
    const [cloudJobProgress, setCloudJobProgress] = useState(0);
    const [isCloudAvailable, setIsCloudAvailable] = useState(false);
    const [isCheckingCloud, setIsCheckingCloud] = useState(false);

    // Processed videos state
    const [processedVideos, setProcessedVideos] = useState<ProcessedVideo[]>([]);
    const [showProcessedVideos, setShowProcessedVideos] = useState(false);

    // Transcription & Caption state
    const [transcription, setTranscription] = useState<Transcription | null>(null);
    const [showTranscription, setShowTranscription] = useState(false);
    const [showCaptionSettings, setShowCaptionSettings] = useState(false);
    const [captionSettings, setCaptionSettings] = useState<CaptionSettings>({
        font: 'montserrat',
        color: 'white',
        highlightColor: 'yellow',
        wordsPerSegment: 4,
        position: 'bottom',
        customPositionY: 85
    });
    const [isGeneratingCaptions, setIsGeneratingCaptions] = useState(false);
    const [captionJobId, setCaptionJobId] = useState<string | null>(null);
    const [captionJobStatus, setCaptionJobStatus] = useState<string | null>(null);
    const [captionedVideoPath, setCaptionedVideoPath] = useState<string | null>(null);

    // Theme options
    const [fonts] = useState<CaptionTheme[]>(DEFAULT_FONTS);
    const [colors] = useState<CaptionTheme[]>(DEFAULT_COLORS);
    const [highlightColors] = useState<CaptionTheme[]>(DEFAULT_HIGHLIGHT_COLORS);

    // Caption preview animation state
    const [previewHighlightIndex, setPreviewHighlightIndex] = useState(0);
    const [useRealTranscription, setUseRealTranscription] = useState(true);
    const samplePreviewWords = ['This', 'is', 'how', 'your', 'captions', 'will', 'look', 'on', 'video'];

    // Content Resources state
    const [showContentResources, setShowContentResources] = useState(false);
    const [contentVideoUrl, setContentVideoUrl] = useState('');
    const [isContentCropping, setIsContentCropping] = useState(false);
    const [contentCroppedVideoPath, setContentCroppedVideoPath] = useState<string | null>(null);

    // AI Image Generation state
    const [showImageGenSettings, setShowImageGenSettings] = useState(false);
    const [isGeneratingImagePrompts, setIsGeneratingImagePrompts] = useState(false);
    const [isGeneratingImages, setIsGeneratingImages] = useState(false);
    const [isCreatingSplitVideo, setIsCreatingSplitVideo] = useState(false);
    const [imageGenProgress, setImageGenProgress] = useState(0);
    const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
    const [transitionType, setTransitionType] = useState('fade');
    const [zoomEffect, setZoomEffect] = useState('ken_burns');
    const [splitVideoPath, setSplitVideoPath] = useState<string | null>(null);
    const [transitionOptions] = useState<TransitionOption[]>([
        { key: 'fade', name: 'Fade', description: 'Smooth fade between images' },
        { key: 'wipe', name: 'Wipe', description: 'Slide transition' },
        { key: 'zoom', name: 'Zoom', description: 'Zoom in/out transition' },
        { key: 'none', name: 'None', description: 'No transition' }
    ]);
    const [zoomOptions] = useState<TransitionOption[]>([
        { key: 'ken_burns', name: 'Ken Burns', description: 'Slow pan and zoom effect' },
        { key: 'zoom_in', name: 'Zoom In', description: 'Gradually zoom into image' },
        { key: 'zoom_out', name: 'Zoom Out', description: 'Gradually zoom out of image' },
        { key: 'none', name: 'None', description: 'No zoom effect' }
    ]);

    const isValidYoutubeUrl = (url: string) => {
        const pattern = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/;
        return pattern.test(url);
    };

    const isValidTimeFormat = (time: string) => {
        const pattern = /^([0-9]{1,2}):([0-5][0-9]):([0-5][0-9])$/;
        return pattern.test(time);
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 100);
        return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
    };

    const handleDownload = async () => {
        if (!youtubeUrl || !isValidYoutubeUrl(youtubeUrl)) {
            setError('Please enter a valid YouTube URL');
            return;
        }

        if (!isValidTimeFormat(startTime) || !isValidTimeFormat(endTime)) {
            setError('Please enter valid time format (HH:MM:SS)');
            return;
        }

        setError(null);
        setIsDownloading(true);
        setDownloadProgress(0);
        setVideoPath(null);
        setVideoFilename(null);
        setCroppedVideoPath(null);
        setTranscription(null);
        setCaptionedVideoPath(null);

        const progressInterval = setInterval(() => {
            setDownloadProgress(prev => {
                if (prev >= 90) return prev;
                return prev + Math.random() * 15;
            });
        }, 500);

        try {
            const response = await fetch(`${API_BASE}/api/download`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    url: youtubeUrl,
                    startTime,
                    endTime,
                }),
            });

            clearInterval(progressInterval);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to download video');
            }

            const data = await response.json();
            setDownloadProgress(100);
            setVideoPath(`${API_BASE}/api/videos/file/${data.filename}`);
            setVideoFilename(data.filename);
        } catch (err) {
            clearInterval(progressInterval);
            setError(err instanceof Error ? err.message : 'An error occurred while downloading');
        } finally {
            setIsDownloading(false);
        }
    };

    const handleAutocrop = async () => {
        if (!videoFilename) {
            setError('Please download a video first');
            return;
        }

        setError(null);
        setIsAutocropping(true);
        setAutocropProgress(0);
        setCroppedVideoPath(null);

        const progressInterval = setInterval(() => {
            setAutocropProgress(prev => {
                if (prev >= 90) return prev;
                return prev + Math.random() * 8;
            });
        }, 1000);

        try {
            const response = await fetch(`${API_BASE}/api/autocrop`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    inputVideo: videoFilename,
                    aspectRatio,
                }),
            });

            clearInterval(progressInterval);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to autocrop video');
            }

            const data = await response.json();
            setAutocropProgress(100);
            setCroppedVideoPath(`${API_BASE}/api/videos/file/${data.filename}`);
        } catch (err) {
            clearInterval(progressInterval);
            setError(err instanceof Error ? err.message : 'An error occurred during autocrop');
        } finally {
            setIsAutocropping(false);
        }
    };

    // Fetch transcription for completed job
    const fetchTranscription = useCallback(async () => {
        if (!cloudJobId) return;

        try {
            const response = await fetch(`${API_BASE}/api/cloud/jobs/${cloudJobId}/transcription`);
            if (response.ok) {
                const data = await response.json();
                setTranscription(data.transcription);
            }
        } catch (err) {
            console.error('Failed to fetch transcription:', err);
        }
    }, [cloudJobId]);

    // Check cloud availability on mount
    useEffect(() => {
        const checkCloudAvailability = async () => {
            setIsCheckingCloud(true);
            try {
                const response = await fetch(`${API_BASE}/api/cloud/status`);
                const data = await response.json();
                setIsCloudAvailable(data.available === true);
            } catch {
                setIsCloudAvailable(false);
            } finally {
                setIsCheckingCloud(false);
            }
        };
        checkCloudAvailability();
    }, []);

    // Fetch processed videos
    const fetchProcessedVideos = async () => {
        try {
            const response = await fetch(`${API_BASE}/api/videos`);
            const videos = await response.json();
            // Filter to only show cropped videos
            const cropped = videos.filter((v: ProcessedVideo) => v.filename.startsWith('cropped_'));
            setProcessedVideos(cropped);
        } catch (err) {
            console.error('Failed to fetch videos:', err);
        }
    };

    // Load processed videos on mount
    useEffect(() => {
        fetchProcessedVideos();
    }, []);

    // Poll for job status when we have an active cloud job
    useEffect(() => {
        if (!cloudJobId || cloudJobStatus === 'completed' || cloudJobStatus === 'failed') {
            return;
        }

        const pollInterval = setInterval(async () => {
            try {
                const response = await fetch(`${API_BASE}/api/cloud/jobs/${cloudJobId}`);
                const job = await response.json();

                setCloudJobStatus(job.status);
                setCloudJobProgress(job.progress || 0);

                if (job.status === 'completed' && job.outputUrl) {
                    setCroppedVideoPath(job.outputUrl);
                    // Fetch transcription when job completes
                    if (job.transcription) {
                        setTranscription(job.transcription);
                    } else {
                        fetchTranscription();
                    }
                    clearInterval(pollInterval);
                } else if (job.status === 'failed') {
                    setError(job.error || 'Cloud processing failed');
                    clearInterval(pollInterval);
                }
            } catch (err) {
                console.error('Failed to poll job status:', err);
            }
        }, 3000); // Poll every 3 seconds

        return () => clearInterval(pollInterval);
    }, [cloudJobId, cloudJobStatus, fetchTranscription]);

    // Poll for caption job status
    useEffect(() => {
        if (!captionJobId || captionJobStatus === 'completed' || captionJobStatus === 'failed') {
            return;
        }

        const pollInterval = setInterval(async () => {
            try {
                const response = await fetch(`${API_BASE}/api/cloud/jobs/${captionJobId}`);
                const job = await response.json();

                setCaptionJobStatus(job.status);

                if (job.status === 'completed' && job.outputUrl) {
                    setCaptionedVideoPath(job.outputUrl);
                    setIsGeneratingCaptions(false);
                    clearInterval(pollInterval);
                } else if (job.status === 'failed') {
                    setError(job.error || 'Caption generation failed');
                    setIsGeneratingCaptions(false);
                    clearInterval(pollInterval);
                }
            } catch (err) {
                console.error('Failed to poll caption job status:', err);
            }
        }, 3000);

        return () => clearInterval(pollInterval);
    }, [captionJobId, captionJobStatus]);

    // Animate caption preview highlight
    useEffect(() => {
        if (!showCaptionSettings) return;

        // Calculate total words for animation - use transcription if available and selected, otherwise sample
        const totalWords = (useRealTranscription && transcription?.words?.length)
            ? Math.min(15, transcription.words.length)
            : samplePreviewWords.length;

        const interval = setInterval(() => {
            setPreviewHighlightIndex(prev => (prev + 1) % totalWords);
        }, 600); // Change word every 600ms for a nice animation speed

        return () => clearInterval(interval);
    }, [showCaptionSettings, samplePreviewWords.length, useRealTranscription, transcription?.words?.length]);

    // Handle cloud upload (for Google Colab mode)
    const handleCloudUpload = async () => {
        if (!youtubeUrl || !isValidYoutubeUrl(youtubeUrl)) {
            setError('Please enter a valid YouTube URL');
            return;
        }

        if (!isValidTimeFormat(startTime) || !isValidTimeFormat(endTime)) {
            setError('Please enter valid time format (HH:MM:SS)');
            return;
        }

        setError(null);
        setIsDownloading(true);
        setDownloadProgress(0);
        setCloudJobId(null);
        setCloudJobStatus(null);
        setCloudJobProgress(0);
        setCroppedVideoPath(null);
        setTranscription(null);
        setCaptionedVideoPath(null);

        const progressInterval = setInterval(() => {
            setDownloadProgress(prev => {
                if (prev >= 90) return prev;
                return prev + Math.random() * 10;
            });
        }, 500);

        try {
            const response = await fetch(`${API_BASE}/api/cloud/upload`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    url: youtubeUrl,
                    startTime,
                    endTime,
                    aspectRatio,
                }),
            });

            clearInterval(progressInterval);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to upload to cloud');
            }

            const data = await response.json();
            setDownloadProgress(100);
            setCloudJobId(data.jobId);
            setCloudJobStatus('pending');

        } catch (err) {
            clearInterval(progressInterval);
            setError(err instanceof Error ? err.message : 'An error occurred during cloud upload');
        } finally {
            setIsDownloading(false);
        }
    };

    // Generate captions
    const handleGenerateCaptions = async () => {
        if (!cloudJobId) {
            setError('No job available for caption generation');
            return;
        }

        setError(null);
        setIsGeneratingCaptions(true);
        setCaptionJobId(null);
        setCaptionJobStatus(null);
        setCaptionedVideoPath(null);

        try {
            const response = await fetch(`${API_BASE}/api/cloud/jobs/${cloudJobId}/generate-captions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(captionSettings),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to generate captions');
            }

            const data = await response.json();
            setCaptionJobId(data.captionJobId);
            setCaptionJobStatus('caption_pending');
            setShowCaptionSettings(false);

        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred during caption generation');
            setIsGeneratingCaptions(false);
        }
    };

    // Handle Content Resources crop
    const handleContentCrop = async () => {
        if (!contentVideoUrl) {
            setError('Please enter a video URL');
            return;
        }

        setError(null);
        setIsContentCropping(true);
        setContentCroppedVideoPath(null);

        try {
            const response = await fetch(`${API_BASE}/api/content-crop`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    videoUrl: contentVideoUrl,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to crop content');
            }

            const data = await response.json();
            setContentCroppedVideoPath(`${API_BASE}${data.videoPath}`);
            setShowContentResources(false);

        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred during content cropping');
        } finally {
            setIsContentCropping(false);
        }
    };

    // Handle Add Images to Video - full pipeline
    const handleAddImagesToVideo = async () => {
        if (!transcription) {
            setError('Transcription is required for image generation');
            return;
        }

        // Determine which video to use (priority: captioned > cropped > original)
        let targetVideoFilename: string | null = null;

        if (captionedVideoPath) {
            // Extract filename from captioned video URL
            const url = new URL(captionedVideoPath, API_BASE);
            targetVideoFilename = url.pathname.split('/').pop() || null;
            console.log('Using captioned video:', targetVideoFilename);
        } else if (croppedVideoPath) {
            // Extract filename from cropped video URL (could be local or cloud)
            try {
                const url = new URL(croppedVideoPath, API_BASE);
                targetVideoFilename = url.pathname.split('/').pop() || null;
            } catch {
                // If URL parsing fails, try simple split
                targetVideoFilename = croppedVideoPath.split('/').pop() || null;
            }
            console.log('Using cropped video:', targetVideoFilename);
        } else if (videoFilename) {
            targetVideoFilename = videoFilename;
            console.log('Using original video:', targetVideoFilename);
        }

        if (!targetVideoFilename) {
            setError('No video available for processing. Please download and crop a video first.');
            return;
        }

        setError(null);
        setShowImageGenSettings(false);
        setImageGenProgress(0);
        setSplitVideoPath(null);

        try {
            // Step 1: Generate image prompts from transcription
            setIsGeneratingImagePrompts(true);
            setImageGenProgress(10);

            const promptsResponse = await fetch(`${API_BASE}/api/generate-image-prompts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    transcription,
                    intervalSeconds: 10
                }),
            });

            if (!promptsResponse.ok) {
                const errorData = await promptsResponse.json();
                throw new Error(errorData.error || 'Failed to generate image prompts');
            }

            const promptsData = await promptsResponse.json();
            setIsGeneratingImagePrompts(false);
            setImageGenProgress(30);

            // Step 2: Generate AI images from prompts
            setIsGeneratingImages(true);

            const imagesResponse = await fetch(`${API_BASE}/api/generate-ai-images`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imagePrompts: promptsData.imagePrompts }),
            });

            if (!imagesResponse.ok) {
                const errorData = await imagesResponse.json();
                throw new Error(errorData.error || 'Failed to generate AI images');
            }

            const imagesData = await imagesResponse.json();
            setGeneratedImages(imagesData.images);
            setIsGeneratingImages(false);
            setImageGenProgress(70);

            // Step 3: Create split-screen video
            setIsCreatingSplitVideo(true);

            // Determine the source video URL to use
            const sourceVideoUrl = captionedVideoPath || croppedVideoPath || null;
            let videoFilenameToUse = targetVideoFilename;

            // If the video is from cloud (URL), download it first
            if (sourceVideoUrl && sourceVideoUrl.startsWith('http')) {
                console.log('Downloading cloud video for processing...');
                const downloadResponse = await fetch(`${API_BASE}/api/download-cloud-video`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ videoUrl: sourceVideoUrl }),
                });

                if (!downloadResponse.ok) {
                    const errorData = await downloadResponse.json();
                    throw new Error(errorData.error || 'Failed to download cloud video');
                }

                const downloadData = await downloadResponse.json();
                videoFilenameToUse = downloadData.filename;
                console.log('Cloud video downloaded:', videoFilenameToUse);
            }

            const splitResponse = await fetch(`${API_BASE}/api/create-split-video`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    videoFilename: videoFilenameToUse,
                    images: imagesData.images,
                    transitionType,
                    zoomEffect,
                }),
            });

            if (!splitResponse.ok) {
                const errorData = await splitResponse.json();
                throw new Error(errorData.error || 'Failed to create split-screen video');
            }

            const splitData = await splitResponse.json();
            setSplitVideoPath(`${API_BASE}${splitData.videoPath}`);
            setImageGenProgress(100);

        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred during image generation');
        } finally {
            setIsGeneratingImagePrompts(false);
            setIsGeneratingImages(false);
            setIsCreatingSplitVideo(false);
        }
    };

    // Get job status text for display
    const getJobStatusDisplay = () => {
        switch (cloudJobStatus) {
            case 'pending':
                return { text: 'Waiting for Colab worker...', icon: <RefreshCw className="w-4 h-4 animate-spin" /> };
            case 'processing':
                return { text: `Processing (${Math.round(cloudJobProgress)}%)`, icon: <Loader2 className="w-4 h-4 animate-spin" /> };
            case 'transcribing':
                return { text: 'Transcribing audio...', icon: <FileText className="w-4 h-4 animate-pulse" /> };
            case 'completed':
                return { text: 'Completed!', icon: <CheckCircle2 className="w-4 h-4 text-green-400" /> };
            case 'failed':
                return { text: 'Failed', icon: <XCircle className="w-4 h-4 text-red-400" /> };
            default:
                return null;
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
                    Podcast Studio
                    <span className="ml-3 px-3 py-1 rounded-full text-xs font-medium bg-purple-500/20 text-purple-300 border border-purple-500/20">
                        Beta
                    </span>
                </h1>
                <p className="text-gray-400 mt-2">Download and process YouTube videos for your podcast content</p>
            </div>

            {/* Mode Toggle */}
            <div className="mb-8">
                <div className="inline-flex p-1 rounded-xl bg-white/5 border border-white/10">
                    <button
                        onClick={() => setMode('local')}
                        className={`flex items-center px-6 py-3 rounded-lg font-medium text-sm transition-all ${mode === 'local'
                            ? 'bg-gradient-to-r from-brand-500 to-brand-600 text-white shadow-lg shadow-brand-500/25'
                            : 'text-gray-400 hover:text-white'
                            }`}
                    >
                        <Monitor className="w-4 h-4 mr-2" />
                        Run Locally
                    </button>
                    <button
                        onClick={() => setMode('colab')}
                        className={`flex items-center px-6 py-3 rounded-lg font-medium text-sm transition-all relative ${mode === 'colab'
                            ? 'bg-gradient-to-r from-orange-500 to-yellow-500 text-white shadow-lg shadow-orange-500/25'
                            : isCloudAvailable
                                ? 'text-gray-400 hover:text-white'
                                : 'text-gray-600 cursor-not-allowed'
                            }`}
                        disabled={!isCloudAvailable && !isCheckingCloud}
                    >
                        <Cpu className="w-4 h-4 mr-2" />
                        Google Colab
                        {isCheckingCloud && (
                            <Loader2 className="w-3 h-3 ml-1 animate-spin" />
                        )}
                        {!isCloudAvailable && !isCheckingCloud && (
                            <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-800 text-gray-300 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                Configure R2 & Firebase
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => { }}
                        disabled
                        className="flex items-center px-6 py-3 rounded-lg font-medium text-sm text-gray-600 cursor-not-allowed relative group"
                    >
                        <Cloud className="w-4 h-4 mr-2" />
                        Cloud
                        <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-800 text-gray-300 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                            Coming Soon
                        </span>
                    </button>
                </div>
                {/* Content Resources Button */}
                <button
                    onClick={() => setShowContentResources(true)}
                    className="ml-4 px-4 py-2 rounded-lg font-medium text-sm bg-gradient-to-r from-violet-500 to-purple-600 text-white hover:from-violet-400 hover:to-purple-500 shadow-lg shadow-violet-500/25 transition-all flex items-center"
                >
                    <Video className="w-4 h-4 mr-2" />
                    Content Resources
                </button>
                {mode === 'colab' && (
                    <p className="text-orange-400 text-sm mt-2 flex items-center">
                        <Cpu className="w-4 h-4 mr-1" />
                        GPU processing via Google Colab. Make sure your Colab notebook is running.
                    </p>
                )}
            </div>

            {/* Main Content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Input Section */}
                <div className="space-y-6">
                    {/* YouTube URL Input */}
                    <div className="glass-card p-6 rounded-2xl">
                        <label className="block text-sm font-medium text-gray-300 mb-3 flex items-center">
                            <Youtube className="w-4 h-4 mr-2 text-red-500" />
                            YouTube Video URL
                        </label>
                        <input
                            type="text"
                            className={`w-full bg-black/40 border rounded-xl p-4 text-white placeholder-gray-500 focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all ${youtubeUrl && !isValidYoutubeUrl(youtubeUrl)
                                ? 'border-red-500/50'
                                : 'border-gray-700'
                                }`}
                            placeholder="https://www.youtube.com/watch?v=..."
                            value={youtubeUrl}
                            onChange={(e) => setYoutubeUrl(e.target.value)}
                        />
                        {youtubeUrl && !isValidYoutubeUrl(youtubeUrl) && (
                            <p className="text-red-400 text-xs mt-2 flex items-center">
                                <AlertCircle className="w-3 h-3 mr-1" />
                                Please enter a valid YouTube URL
                            </p>
                        )}
                    </div>

                    {/* Time Range */}
                    <div className="glass-card p-6 rounded-2xl">
                        <label className="block text-sm font-medium text-gray-300 mb-3 flex items-center">
                            <Clock className="w-4 h-4 mr-2 text-brand-400" />
                            Time Range to Download
                        </label>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs text-gray-500 mb-2">Start Time</label>
                                <input
                                    type="text"
                                    className="w-full bg-black/40 border border-gray-700 rounded-xl p-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all text-center font-mono text-sm"
                                    placeholder="00:00:00"
                                    value={startTime}
                                    onChange={(e) => setStartTime(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-2">End Time</label>
                                <input
                                    type="text"
                                    className="w-full bg-black/40 border border-gray-700 rounded-xl p-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all text-center font-mono text-sm"
                                    placeholder="00:00:30"
                                    value={endTime}
                                    onChange={(e) => setEndTime(e.target.value)}
                                />
                            </div>
                        </div>
                        <p className="text-gray-500 text-xs mt-3">Format: HH:MM:SS</p>
                    </div>

                    {/* Aspect Ratio Selector */}
                    <div className="glass-card p-6 rounded-2xl">
                        <label className="block text-sm font-medium text-gray-300 mb-3 flex items-center">
                            <Crop className="w-4 h-4 mr-2 text-purple-400" />
                            Output Aspect Ratio
                        </label>
                        <div className="relative">
                            <select
                                value={aspectRatio}
                                onChange={(e) => setAspectRatio(e.target.value)}
                                className="w-full bg-black/40 border border-gray-700 rounded-xl p-4 text-white appearance-none cursor-pointer focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                            >
                                {ASPECT_RATIOS.map((ratio) => (
                                    <option key={ratio.value} value={ratio.value} className="bg-gray-900">
                                        {ratio.label}
                                    </option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                        </div>
                    </div>

                    {/* Error Display */}
                    {error && (
                        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start">
                            <AlertCircle className="w-5 h-5 text-red-400 mr-3 flex-shrink-0 mt-0.5" />
                            <p className="text-red-300 text-sm">{error}</p>
                        </div>
                    )}

                    {/* Download Button */}
                    <button
                        onClick={mode === 'colab' ? handleCloudUpload : handleDownload}
                        disabled={isDownloading || !youtubeUrl}
                        className={`w-full py-4 px-6 rounded-xl font-bold text-lg transition-all flex items-center justify-center ${isDownloading || !youtubeUrl
                            ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                            : mode === 'colab'
                                ? 'bg-gradient-to-r from-orange-500 to-yellow-500 text-white hover:from-orange-400 hover:to-yellow-400 shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40'
                                : 'bg-gradient-to-r from-brand-500 to-purple-500 text-white hover:from-brand-400 hover:to-purple-400 shadow-lg shadow-brand-500/25 hover:shadow-brand-500/40'
                            }`}
                    >
                        {isDownloading ? (
                            <>
                                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                {mode === 'colab' ? 'Uploading to Cloud...' : 'Downloading...'} {Math.round(downloadProgress)}%
                            </>
                        ) : (
                            <>
                                {mode === 'colab' ? <Cpu className="w-5 h-5 mr-2" /> : <Download className="w-5 h-5 mr-2" />}
                                {mode === 'colab' ? 'Process with Colab GPU' : 'Download Clip'}
                            </>
                        )}
                    </button>

                    {isDownloading && (
                        <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                            <div
                                className={`h-full transition-all duration-300 ${mode === 'colab'
                                    ? 'bg-gradient-to-r from-orange-500 to-yellow-500'
                                    : 'bg-gradient-to-r from-brand-500 to-purple-500'}`}
                                style={{ width: `${downloadProgress}%` }}
                            />
                        </div>
                    )}

                    {/* Cloud Job Status (Colab mode) */}
                    {mode === 'colab' && cloudJobId && (
                        <div className="glass-card p-4 rounded-xl border border-orange-500/20">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center">
                                    {getJobStatusDisplay()?.icon}
                                    <span className="ml-2 text-sm text-gray-300">
                                        {getJobStatusDisplay()?.text}
                                    </span>
                                </div>
                                <span className="text-xs text-gray-500 font-mono">
                                    Job: {cloudJobId.substring(0, 8)}...
                                </span>
                            </div>
                            {cloudJobStatus === 'processing' && (
                                <div className="w-full h-1 bg-gray-800 rounded-full overflow-hidden mt-2">
                                    <div
                                        className="h-full bg-gradient-to-r from-orange-500 to-yellow-500 transition-all duration-300"
                                        style={{ width: `${cloudJobProgress}%` }}
                                    />
                                </div>
                            )}
                            {cloudJobStatus === 'pending' && (
                                <p className="text-xs text-gray-500 mt-2">
                                    Open your Google Colab notebook and run the worker cell to start processing.
                                </p>
                            )}
                        </div>
                    )}
                </div>

                {/* Raw Video Player */}
                <div className="glass-card rounded-2xl overflow-hidden">
                    <div className="p-4 border-b border-white/5">
                        <h3 className="text-lg font-semibold text-white flex items-center">
                            <Play className="w-5 h-5 mr-2 text-brand-400" />
                            Raw Video
                        </h3>
                    </div>

                    <div className="aspect-video bg-black/60 flex items-center justify-center relative">
                        {videoPath ? (
                            <video
                                ref={videoRef}
                                src={videoPath}
                                controls
                                className="w-full h-full object-contain"
                            >
                                Your browser does not support the video tag.
                            </video>
                        ) : isDownloading ? (
                            <div className="flex flex-col items-center text-center p-8">
                                <div className="w-16 h-16 rounded-full border-4 border-brand-500 border-t-transparent animate-spin mb-4" />
                                <p className="text-gray-300 font-medium">Downloading...</p>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center text-center p-8">
                                <div className="w-16 h-16 rounded-full bg-gray-900/50 flex items-center justify-center mb-4">
                                    <Play className="w-8 h-8 text-gray-700" />
                                </div>
                                <p className="text-gray-400 font-medium text-sm">No video loaded</p>
                            </div>
                        )}
                    </div>

                    {videoPath && (
                        <div className="p-4 border-t border-white/5 bg-black/20">
                            <button
                                onClick={handleAutocrop}
                                disabled={isAutocropping}
                                className={`w-full py-3 px-4 rounded-xl font-bold transition-all flex items-center justify-center ${isAutocropping
                                    ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                                    : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-400 hover:to-pink-400 shadow-lg shadow-purple-500/25'
                                    }`}
                            >
                                {isAutocropping ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Autocropping... {Math.round(autocropProgress)}%
                                    </>
                                ) : (
                                    <>
                                        <Crop className="w-4 h-4 mr-2" />
                                        Autocrop to {aspectRatio}
                                    </>
                                )}
                            </button>
                            {isAutocropping && (
                                <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden mt-3">
                                    <div
                                        className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300"
                                        style={{ width: `${autocropProgress}%` }}
                                    />
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Cropped Video Player */}
                <div className="glass-card rounded-2xl overflow-hidden">
                    <div className="p-4 border-b border-white/5">
                        <h3 className="text-lg font-semibold text-white flex items-center">
                            <Crop className="w-5 h-5 mr-2 text-purple-400" />
                            Cropped Video
                            <span className="ml-2 px-2 py-0.5 rounded text-xs bg-purple-500/20 text-purple-300">
                                {aspectRatio}
                            </span>
                        </h3>
                    </div>

                    <div className="aspect-[9/16] max-h-[500px] bg-black/60 flex items-center justify-center relative mx-auto">
                        {croppedVideoPath ? (
                            <video
                                src={croppedVideoPath}
                                controls
                                className="w-full h-full object-contain"
                                autoPlay
                            >
                                Your browser does not support the video tag.
                            </video>
                        ) : isAutocropping ? (
                            <div className="flex flex-col items-center text-center p-8">
                                <div className="w-16 h-16 rounded-full border-4 border-purple-500 border-t-transparent animate-spin mb-4" />
                                <p className="text-gray-300 font-medium">Processing...</p>
                                <p className="text-gray-500 text-sm mt-1">AI is analyzing scenes</p>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center text-center p-8">
                                <div className="w-16 h-16 rounded-full bg-gray-900/50 flex items-center justify-center mb-4">
                                    <Crop className="w-8 h-8 text-gray-700" />
                                </div>
                                <p className="text-gray-400 font-medium text-sm">No cropped video yet</p>
                                <p className="text-gray-600 text-xs mt-1">Download a video then click Autocrop</p>
                            </div>
                        )}
                    </div>

                    {croppedVideoPath && (
                        <div className="p-4 border-t border-white/5 bg-black/20 space-y-3">
                            {/* Download Button */}
                            <a
                                href={croppedVideoPath}
                                download
                                className="w-full py-3 px-4 rounded-xl font-bold bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:from-green-400 hover:to-emerald-400 shadow-lg shadow-green-500/25 flex items-center justify-center"
                            >
                                <Download className="w-4 h-4 mr-2" />
                                Download Cropped Video
                            </a>

                            {/* View Transcriptions Button (Colab mode only) */}
                            {mode === 'colab' && transcription && (
                                <button
                                    onClick={() => setShowTranscription(true)}
                                    className="w-full py-3 px-4 rounded-xl font-bold bg-gradient-to-r from-blue-500 to-indigo-500 text-white hover:from-blue-400 hover:to-indigo-400 shadow-lg shadow-blue-500/25 flex items-center justify-center"
                                >
                                    <FileText className="w-4 h-4 mr-2" />
                                    View Transcriptions
                                </button>
                            )}

                            {/* Generate Captions Button (Colab mode only) */}
                            {mode === 'colab' && transcription && (
                                <button
                                    onClick={() => setShowCaptionSettings(true)}
                                    disabled={isGeneratingCaptions}
                                    className={`w-full py-3 px-4 rounded-xl font-bold flex items-center justify-center ${isGeneratingCaptions
                                        ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                                        : 'bg-gradient-to-r from-pink-500 to-rose-500 text-white hover:from-pink-400 hover:to-rose-400 shadow-lg shadow-pink-500/25'
                                        }`}
                                >
                                    {isGeneratingCaptions ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Generating Captions...
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="w-4 h-4 mr-2" />
                                            Generate Captions
                                        </>
                                    )}
                                </button>
                            )}

                            {/* Add Images to Video Button (when transcription available) */}
                            {transcription && (
                                <button
                                    onClick={() => setShowImageGenSettings(true)}
                                    disabled={isGeneratingImagePrompts || isGeneratingImages || isCreatingSplitVideo}
                                    className={`w-full py-3 px-4 rounded-xl font-bold flex items-center justify-center ${isGeneratingImagePrompts || isGeneratingImages || isCreatingSplitVideo
                                        ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                                        : 'bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white hover:from-violet-400 hover:to-fuchsia-400 shadow-lg shadow-violet-500/25'
                                        }`}
                                >
                                    {isGeneratingImagePrompts || isGeneratingImages || isCreatingSplitVideo ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            {isGeneratingImagePrompts ? 'Generating Prompts...' :
                                                isGeneratingImages ? 'Generating Images...' :
                                                    'Creating Split Video...'}
                                        </>
                                    ) : (
                                        <>
                                            <Wand2 className="w-4 h-4 mr-2" />
                                            Add Images to Video
                                        </>
                                    )}
                                </button>
                            )}

                            {/* Image Generation Progress */}
                            {(isGeneratingImagePrompts || isGeneratingImages || isCreatingSplitVideo) && (
                                <div className="p-3 rounded-lg bg-violet-500/10 border border-violet-500/20">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm text-gray-300">
                                            {isGeneratingImagePrompts ? 'Step 1/3: Generating prompts...' :
                                                isGeneratingImages ? 'Step 2/3: Creating images...' :
                                                    'Step 3/3: Composing video...'}
                                        </span>
                                        <span className="text-xs text-gray-500">{Math.round(imageGenProgress)}%</span>
                                    </div>
                                    <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-300"
                                            style={{ width: `${imageGenProgress}%` }}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Caption Job Status */}
                            {captionJobId && (
                                <div className="p-3 rounded-lg bg-pink-500/10 border border-pink-500/20">
                                    <div className="flex items-center">
                                        {captionJobStatus === 'completed' ? (
                                            <CheckCircle2 className="w-4 h-4 text-green-400 mr-2" />
                                        ) : captionJobStatus === 'failed' ? (
                                            <XCircle className="w-4 h-4 text-red-400 mr-2" />
                                        ) : (
                                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                        )}
                                        <span className="text-sm text-gray-300">
                                            {captionJobStatus === 'completed' ? 'Captions ready!' :
                                                captionJobStatus === 'failed' ? 'Caption generation failed' :
                                                    'Generating captions in Colab...'}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Captioned Video Section */}
            {captionedVideoPath && (
                <div className="mt-8 glass-card rounded-2xl overflow-hidden">
                    <div className="p-4 border-b border-white/5">
                        <h3 className="text-lg font-semibold text-white flex items-center">
                            <Sparkles className="w-5 h-5 mr-2 text-pink-400" />
                            Captioned Video
                        </h3>
                    </div>
                    <div className="p-4 flex flex-col lg:flex-row gap-6">
                        <div className="flex-1 aspect-[9/16] max-h-[600px] bg-black rounded-xl overflow-hidden">
                            <video
                                src={captionedVideoPath}
                                controls
                                className="w-full h-full object-contain"
                            >
                                Your browser does not support the video tag.
                            </video>
                        </div>
                        <div className="lg:w-64 flex flex-col gap-4">
                            <a
                                href={captionedVideoPath}
                                download
                                className="w-full py-3 px-4 rounded-xl font-bold bg-gradient-to-r from-pink-500 to-rose-500 text-white hover:from-pink-400 hover:to-rose-400 shadow-lg shadow-pink-500/25 flex items-center justify-center"
                            >
                                <Download className="w-4 h-4 mr-2" />
                                Download Captioned Video
                            </a>
                        </div>
                    </div>
                </div>
            )}

            {/* Split-Screen Video Section */}
            {splitVideoPath && (
                <div className="mt-8 glass-card rounded-2xl overflow-hidden">
                    <div className="p-4 border-b border-white/5">
                        <h3 className="text-lg font-semibold text-white flex items-center">
                            <Wand2 className="w-5 h-5 mr-2 text-violet-400" />
                            Split-Screen Video with AI Images
                            <span className="ml-2 px-2 py-0.5 rounded text-xs bg-violet-500/20 text-violet-300">
                                65/35 Split
                            </span>
                        </h3>
                    </div>
                    <div className="p-4 flex flex-col lg:flex-row gap-6">
                        <div className="flex-1 aspect-[9/16] max-h-[600px] bg-black rounded-xl overflow-hidden">
                            <video
                                src={splitVideoPath}
                                controls
                                autoPlay
                                className="w-full h-full object-contain"
                            >
                                Your browser does not support the video tag.
                            </video>
                        </div>
                        <div className="lg:w-64 flex flex-col gap-4">
                            <a
                                href={splitVideoPath}
                                download
                                className="w-full py-3 px-4 rounded-xl font-bold bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white hover:from-violet-400 hover:to-fuchsia-400 shadow-lg shadow-violet-500/25 flex items-center justify-center"
                            >
                                <Download className="w-4 h-4 mr-2" />
                                Download Split-Screen Video
                            </a>
                            <div className="p-3 rounded-lg bg-violet-500/10 border border-violet-500/20">
                                <p className="text-xs text-gray-400">
                                    <strong className="text-violet-300">Generated:</strong> {generatedImages.length} AI images
                                </p>
                                <p className="text-xs text-gray-400 mt-1">
                                    <strong className="text-violet-300">Effect:</strong> {transitionType} + {zoomEffect}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Transcription Modal */}
            {showTranscription && transcription && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-gray-900 rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
                        <div className="p-4 border-b border-white/10 flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-white flex items-center">
                                <FileText className="w-5 h-5 mr-2 text-blue-400" />
                                Transcription
                            </h3>
                            <button
                                onClick={() => setShowTranscription(false)}
                                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5 text-gray-400" />
                            </button>
                        </div>
                        <div className="p-4 overflow-y-auto flex-1">
                            <div className="space-y-2">
                                {transcription.words.map((word, idx) => (
                                    <span
                                        key={idx}
                                        className="inline-block mr-1 px-2 py-1 bg-white/5 rounded text-white hover:bg-blue-500/20 cursor-pointer transition-colors"
                                        title={`${formatTime(word.start)} - ${formatTime(word.end)}`}
                                    >
                                        <span className="text-xs text-gray-500 mr-1">[{formatTime(word.start)}]</span>
                                        {word.word}
                                    </span>
                                ))}
                            </div>
                        </div>
                        <div className="p-4 border-t border-white/10 bg-black/20">
                            <p className="text-sm text-gray-400">
                                <span className="font-medium text-gray-300">Full Text:</span> {transcription.text}
                            </p>
                            <p className="text-xs text-gray-500 mt-2">
                                Language: {transcription.language} | Words: {transcription.words.length}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Caption Settings Modal */}
            {showCaptionSettings && (() => {
                // Get the selected color hex values for the preview
                const selectedColorHex = colors.find(c => c.key === captionSettings.color)?.hex || '#FFFFFF';
                const selectedHighlightHex = highlightColors.find(c => c.key === captionSettings.highlightColor)?.hex || '#FFFF00';

                // Font family mapping
                const fontFamilyMap: Record<string, string> = {
                    'montserrat': '"Montserrat", sans-serif',
                    'poppins': '"Poppins", sans-serif',
                    'roboto': '"Roboto", sans-serif',
                    'opensans': '"Open Sans", sans-serif',
                    'inter': '"Inter", sans-serif',
                    'bebas': '"Bebas Neue", sans-serif',
                    'oswald': '"Oswald", sans-serif',
                    'anton': '"Anton", sans-serif',
                };
                const selectedFontFamily = fontFamilyMap[captionSettings.font] || '"Montserrat", sans-serif';

                // Get words for preview - use real transcription or sample
                const realWords = transcription?.words?.slice(0, 15).map(w => w.word) || [];
                const previewWords = (useRealTranscription && realWords.length > 0) ? realWords : samplePreviewWords;

                // Group words for preview based on wordsPerSegment
                const groupedWords: string[][] = [];
                for (let i = 0; i < previewWords.length; i += captionSettings.wordsPerSegment) {
                    groupedWords.push(previewWords.slice(i, i + captionSettings.wordsPerSegment));
                }

                return (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-gray-900 rounded-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
                            <div className="p-4 border-b border-white/10 flex items-center justify-between">
                                <h3 className="text-lg font-semibold text-white flex items-center">
                                    <Sparkles className="w-5 h-5 mr-2 text-pink-400" />
                                    Caption Settings
                                </h3>
                                <button
                                    onClick={() => setShowCaptionSettings(false)}
                                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                                >
                                    <X className="w-5 h-5 text-gray-400" />
                                </button>
                            </div>
                            <div className="p-6 space-y-6">
                                {/* Live Caption Preview */}
                                <div className="relative">
                                    <div className="flex items-center justify-between mb-3">
                                        <label className="block text-sm font-medium text-gray-300 flex items-center">
                                            <Play className="w-4 h-4 mr-2" />
                                            Subtitle Preview
                                        </label>
                                        {transcription && transcription.words && transcription.words.length > 0 && (
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-gray-500">Sample</span>
                                                <button
                                                    onClick={() => setUseRealTranscription(!useRealTranscription)}
                                                    className={`relative w-10 h-5 rounded-full transition-colors ${useRealTranscription ? 'bg-pink-500' : 'bg-gray-600'}`}
                                                >
                                                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${useRealTranscription ? 'translate-x-5' : ''}`} />
                                                </button>
                                                <span className="text-xs text-gray-500">Real</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-gradient-to-br from-gray-800 via-gray-900 to-black">
                                        {/* Phone-style frame */}
                                        <div className="aspect-[9/16] max-h-[280px] relative flex items-center justify-center">
                                            {/* Simulated video gradient background */}
                                            <div className="absolute inset-0 bg-gradient-to-br from-violet-900/40 via-black to-fuchsia-900/30"></div>
                                            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-pink-500/10 via-transparent to-transparent"></div>

                                            {/* Caption text preview - dynamically positioned */}
                                            <div
                                                className="absolute left-0 right-0 flex flex-col items-center px-4 space-y-2 transition-all duration-300"
                                                style={{
                                                    top: captionSettings.position === 'top' ? '32px' :
                                                        captionSettings.position === 'center' ? '50%' :
                                                            captionSettings.position === 'custom' ? `${captionSettings.customPositionY}%` : 'auto',
                                                    bottom: captionSettings.position === 'bottom' ? '32px' : 'auto',
                                                    transform: captionSettings.position === 'center' ? 'translateY(-50%)' :
                                                        captionSettings.position === 'custom' ? 'translateY(-50%)' : 'none'
                                                }}
                                            >
                                                {groupedWords.map((group, groupIdx) => {
                                                    // Determine which word in the group is highlighted
                                                    const globalStartIndex = groupIdx * captionSettings.wordsPerSegment;
                                                    const highlightedWordInGroup = previewHighlightIndex >= globalStartIndex &&
                                                        previewHighlightIndex < globalStartIndex + group.length
                                                        ? previewHighlightIndex - globalStartIndex
                                                        : -1;

                                                    return (
                                                        <div
                                                            key={groupIdx}
                                                            className="flex flex-wrap justify-center gap-x-2"
                                                        >
                                                            {group.map((word, wordIdx) => {
                                                                const isHighlighted = wordIdx === highlightedWordInGroup;
                                                                return (
                                                                    <span
                                                                        key={wordIdx}
                                                                        className="relative text-xl font-bold uppercase tracking-wide transition-all duration-300"
                                                                        style={{
                                                                            fontFamily: selectedFontFamily,
                                                                            color: isHighlighted ? selectedHighlightHex : selectedColorHex,
                                                                            textShadow: isHighlighted
                                                                                ? `0 0 20px ${selectedHighlightHex}80, 0 0 40px ${selectedHighlightHex}40, 2px 2px 4px rgba(0,0,0,0.8)`
                                                                                : '2px 2px 4px rgba(0,0,0,0.8)',
                                                                            transform: isHighlighted ? 'scale(1.1)' : 'scale(1)',
                                                                        }}
                                                                    >
                                                                        {word}
                                                                    </span>
                                                                );
                                                            })}
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {/* Subtle animated gradient overlay */}
                                            <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/60 to-transparent pointer-events-none"></div>
                                        </div>

                                        {/* Preview info badge */}
                                        <div className="absolute top-3 right-3 px-2 py-1 rounded-full bg-pink-500/20 border border-pink-500/30 backdrop-blur-sm">
                                            <span className="text-xs font-medium text-pink-300">
                                                {useRealTranscription && transcription?.words?.length ? 'Your Transcript' : 'Sample Preview'}
                                            </span>
                                        </div>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-2 text-center">
                                        {useRealTranscription && transcription?.words?.length
                                            ? `Preview using first ${Math.min(15, transcription.words.length)} words from your transcription`
                                            : 'Toggle "Real" to preview with your actual transcription'}
                                    </p>
                                </div>

                                {/* Font Selection */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-3 flex items-center">
                                        <Type className="w-4 h-4 mr-2" />
                                        Font Style
                                    </label>
                                    <div className="grid grid-cols-4 gap-2">
                                        {fonts.map((font) => (
                                            <button
                                                key={font.key}
                                                onClick={() => setCaptionSettings(prev => ({ ...prev, font: font.key }))}
                                                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${captionSettings.font === font.key
                                                    ? 'bg-pink-500 text-white'
                                                    : 'bg-white/5 text-gray-400 hover:bg-white/10'
                                                    }`}
                                            >
                                                {font.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Color Selection */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-3 flex items-center">
                                        <Palette className="w-4 h-4 mr-2" />
                                        Text Color
                                    </label>
                                    <div className="grid grid-cols-8 gap-2">
                                        {colors.map((color) => (
                                            <button
                                                key={color.key}
                                                onClick={() => setCaptionSettings(prev => ({ ...prev, color: color.key }))}
                                                className={`w-10 h-10 rounded-lg border-2 transition-all ${captionSettings.color === color.key
                                                    ? 'border-pink-500 scale-110'
                                                    : 'border-transparent hover:border-white/30'
                                                    }`}
                                                style={{ backgroundColor: color.hex }}
                                                title={color.name}
                                            />
                                        ))}
                                    </div>
                                </div>

                                {/* Highlight Color Selection */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-3 flex items-center">
                                        <Sparkles className="w-4 h-4 mr-2" />
                                        Highlight Color (Sync)
                                    </label>
                                    <div className="grid grid-cols-8 gap-2">
                                        {highlightColors.map((color) => (
                                            <button
                                                key={color.key}
                                                onClick={() => setCaptionSettings(prev => ({ ...prev, highlightColor: color.key }))}
                                                className={`w-10 h-10 rounded-lg border-2 transition-all ${captionSettings.highlightColor === color.key
                                                    ? 'border-pink-500 scale-110'
                                                    : 'border-transparent hover:border-white/30'
                                                    }`}
                                                style={{ backgroundColor: color.hex }}
                                                title={color.name}
                                            />
                                        ))}
                                    </div>
                                </div>

                                {/* Words Per Segment */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-3">
                                        Words Per Caption Line: {captionSettings.wordsPerSegment}
                                    </label>
                                    <input
                                        type="range"
                                        min="2"
                                        max="8"
                                        value={captionSettings.wordsPerSegment}
                                        onChange={(e) => setCaptionSettings(prev => ({ ...prev, wordsPerSegment: parseInt(e.target.value) }))}
                                        className="w-full accent-pink-500"
                                    />
                                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                                        <span>2</span>
                                        <span>8</span>
                                    </div>
                                </div>

                                {/* Caption Position */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-3 flex items-center">
                                        <ArrowLeft className="w-4 h-4 mr-2 rotate-90" />
                                        Caption Position
                                    </label>
                                    <div className="grid grid-cols-4 gap-2 mb-3">
                                        {[
                                            { key: 'top', label: 'Top', icon: '↑' },
                                            { key: 'center', label: 'Center', icon: '↔' },
                                            { key: 'bottom', label: 'Bottom', icon: '↓' },
                                            { key: 'custom', label: 'Custom', icon: '⚙' }
                                        ].map((pos) => (
                                            <button
                                                key={pos.key}
                                                onClick={() => setCaptionSettings(prev => ({ ...prev, position: pos.key as 'top' | 'center' | 'bottom' | 'custom' }))}
                                                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all flex flex-col items-center gap-1 ${captionSettings.position === pos.key
                                                        ? 'bg-pink-500 text-white'
                                                        : 'bg-white/5 text-gray-400 hover:bg-white/10'
                                                    }`}
                                            >
                                                <span className="text-lg">{pos.icon}</span>
                                                <span className="text-xs">{pos.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                    {captionSettings.position === 'custom' && (
                                        <div className="mt-2">
                                            <label className="block text-xs text-gray-400 mb-2">
                                                Vertical Position: {captionSettings.customPositionY}% from top
                                            </label>
                                            <input
                                                type="range"
                                                min="10"
                                                max="90"
                                                value={captionSettings.customPositionY}
                                                onChange={(e) => setCaptionSettings(prev => ({ ...prev, customPositionY: parseInt(e.target.value) }))}
                                                className="w-full accent-pink-500"
                                            />
                                            <div className="flex justify-between text-xs text-gray-500 mt-1">
                                                <span>10% (Top)</span>
                                                <span>90% (Bottom)</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="p-4 border-t border-white/10 bg-black/20">
                                <button
                                    onClick={handleGenerateCaptions}
                                    className="w-full py-3 px-4 rounded-xl font-bold bg-gradient-to-r from-pink-500 to-rose-500 text-white hover:from-pink-400 hover:to-rose-400 shadow-lg shadow-pink-500/25 flex items-center justify-center"
                                >
                                    <Sparkles className="w-4 h-4 mr-2" />
                                    Generate Subtitles with These Settings
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Image Generation Settings Modal */}
            {
                showImageGenSettings && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-gray-900 rounded-2xl w-full max-w-xl overflow-hidden">
                            <div className="p-4 border-b border-white/10 flex items-center justify-between">
                                <h3 className="text-lg font-semibold text-white flex items-center">
                                    <Wand2 className="w-5 h-5 mr-2 text-violet-400" />
                                    Add Images to Video
                                </h3>
                                <button
                                    onClick={() => setShowImageGenSettings(false)}
                                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                                >
                                    <X className="w-5 h-5 text-gray-400" />
                                </button>
                            </div>
                            <div className="p-6 space-y-6">
                                <div className="p-4 rounded-xl bg-violet-500/10 border border-violet-500/20">
                                    <p className="text-sm text-gray-300">
                                        This will generate AI images based on your video transcript and create a split-screen video with:
                                    </p>
                                    <ul className="mt-2 text-sm text-gray-400 space-y-1">
                                        <li>• <strong className="text-violet-300">Top 65%:</strong> Your original cropped video</li>
                                        <li>• <strong className="text-violet-300">Bottom 35%:</strong> AI-generated image slideshow</li>
                                        <li>• <strong className="text-violet-300">Split appears:</strong> Every 5 seconds during playback</li>
                                    </ul>
                                </div>

                                {/* Transition Effect Selection */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-3 flex items-center">
                                        <Sparkles className="w-4 h-4 mr-2" />
                                        Transition Effect
                                    </label>
                                    <div className="grid grid-cols-2 gap-3">
                                        {transitionOptions.map((option) => (
                                            <button
                                                key={option.key}
                                                onClick={() => setTransitionType(option.key)}
                                                className={`p-3 rounded-xl text-left transition-all ${transitionType === option.key
                                                    ? 'bg-violet-500/20 border-2 border-violet-500 text-white'
                                                    : 'bg-white/5 border-2 border-transparent text-gray-400 hover:bg-white/10'
                                                    }`}
                                            >
                                                <div className="font-medium">{option.name}</div>
                                                <div className="text-xs mt-1 opacity-70">{option.description}</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Zoom Effect Selection */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-3 flex items-center">
                                        <Image className="w-4 h-4 mr-2" />
                                        Image Zoom Effect
                                    </label>
                                    <div className="grid grid-cols-2 gap-3">
                                        {zoomOptions.map((option) => (
                                            <button
                                                key={option.key}
                                                onClick={() => setZoomEffect(option.key)}
                                                className={`p-3 rounded-xl text-left transition-all ${zoomEffect === option.key
                                                    ? 'bg-fuchsia-500/20 border-2 border-fuchsia-500 text-white'
                                                    : 'bg-white/5 border-2 border-transparent text-gray-400 hover:bg-white/10'
                                                    }`}
                                            >
                                                <div className="font-medium">{option.name}</div>
                                                <div className="text-xs mt-1 opacity-70">{option.description}</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className="p-4 border-t border-white/10 bg-black/20">
                                <button
                                    onClick={handleAddImagesToVideo}
                                    className="w-full py-3 px-4 rounded-xl font-bold bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white hover:from-violet-400 hover:to-fuchsia-400 shadow-lg shadow-violet-500/25 flex items-center justify-center"
                                >
                                    <Wand2 className="w-4 h-4 mr-2" />
                                    Generate Images & Create Video
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Content Resources Modal */}
            {
                showContentResources && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-gray-900 rounded-2xl w-full max-w-lg overflow-hidden">
                            <div className="p-4 border-b border-white/10 flex items-center justify-between">
                                <h3 className="text-lg font-semibold text-white flex items-center">
                                    <Video className="w-5 h-5 mr-2 text-violet-400" />
                                    Content Resources
                                </h3>
                                <button
                                    onClick={() => setShowContentResources(false)}
                                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                                >
                                    <X className="w-5 h-5 text-gray-400" />
                                </button>
                            </div>
                            <div className="p-6 space-y-4">
                                <p className="text-gray-400 text-sm">
                                    Enter a video URL to automatically detect and crop the content area.
                                    Works great for meme videos with black/white backgrounds.
                                </p>
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center">
                                        <Link className="w-4 h-4 mr-2" />
                                        Video URL
                                    </label>
                                    <input
                                        type="text"
                                        className="w-full bg-black/40 border border-gray-700 rounded-xl p-4 text-white placeholder-gray-500 focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none transition-all"
                                        placeholder="https://www.instagram.com/reel/..."
                                        value={contentVideoUrl}
                                        onChange={(e) => setContentVideoUrl(e.target.value)}
                                    />
                                    <p className="text-gray-500 text-xs mt-2">
                                        Supports YouTube, Instagram, TikTok, and most video URLs
                                    </p>
                                </div>
                            </div>
                            <div className="p-4 border-t border-white/10 bg-black/20">
                                <button
                                    onClick={handleContentCrop}
                                    disabled={!contentVideoUrl || isContentCropping}
                                    className={`w-full py-3 px-4 rounded-xl font-bold flex items-center justify-center ${!contentVideoUrl || isContentCropping
                                        ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                                        : 'bg-gradient-to-r from-violet-500 to-purple-600 text-white hover:from-violet-400 hover:to-purple-500 shadow-lg shadow-violet-500/25'
                                        }`}
                                >
                                    {isContentCropping ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Processing...
                                        </>
                                    ) : (
                                        <>
                                            <Crop className="w-4 h-4 mr-2" />
                                            Crop Content Area
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Content Cropped Video Section */}
            {
                contentCroppedVideoPath && (
                    <div className="mt-8 glass-card rounded-2xl overflow-hidden">
                        <div className="p-4 border-b border-white/5">
                            <h3 className="text-lg font-semibold text-white flex items-center">
                                <Video className="w-5 h-5 mr-2 text-violet-400" />
                                Content Cropped Video
                            </h3>
                        </div>
                        <div className="p-4 flex flex-col lg:flex-row gap-6">
                            <div className="flex-1 aspect-video bg-black rounded-xl overflow-hidden">
                                <video
                                    src={contentCroppedVideoPath}
                                    controls
                                    className="w-full h-full object-contain"
                                >
                                    Your browser does not support the video tag.
                                </video>
                            </div>
                            <div className="lg:w-64 flex flex-col gap-4">
                                <a
                                    href={contentCroppedVideoPath}
                                    download
                                    className="w-full py-3 px-4 rounded-xl font-bold bg-gradient-to-r from-violet-500 to-purple-600 text-white hover:from-violet-400 hover:to-purple-500 shadow-lg shadow-violet-500/25 flex items-center justify-center"
                                >
                                    <Download className="w-4 h-4 mr-2" />
                                    Download Video
                                </a>
                                <button
                                    onClick={() => setContentCroppedVideoPath(null)}
                                    className="w-full py-3 px-4 rounded-xl font-bold bg-gray-800 text-gray-300 hover:bg-gray-700 flex items-center justify-center"
                                >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Clear
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Processed Videos Section */}
            <div className="mt-8">
                <button
                    onClick={() => {
                        setShowProcessedVideos(!showProcessedVideos);
                        if (!showProcessedVideos) fetchProcessedVideos();
                    }}
                    className="flex items-center text-gray-400 hover:text-white transition-colors mb-4"
                >
                    <FolderOpen className="w-5 h-5 mr-2" />
                    Processed Videos ({processedVideos.length})
                    <ChevronDown className={`w-4 h-4 ml-2 transition-transform ${showProcessedVideos ? 'rotate-180' : ''}`} />
                </button>

                {showProcessedVideos && (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {processedVideos.length === 0 ? (
                            <p className="text-gray-500 col-span-full text-center py-8">No processed videos yet</p>
                        ) : (
                            processedVideos.map((video) => (
                                <div key={video.filename} className="glass-card rounded-xl overflow-hidden group">
                                    <div className="aspect-[9/16] bg-black/60 relative">
                                        <video
                                            src={`${API_BASE}${video.path}`}
                                            className="w-full h-full object-contain"
                                            muted
                                            onMouseEnter={(e) => e.currentTarget.play()}
                                            onMouseLeave={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
                                        />
                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                            <button
                                                onClick={() => setCroppedVideoPath(`${API_BASE}${video.path}`)}
                                                className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors"
                                                title="View"
                                            >
                                                <Play className="w-5 h-5 text-white" />
                                            </button>
                                            <a
                                                href={`${API_BASE}${video.path}`}
                                                download
                                                className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors"
                                                title="Download"
                                            >
                                                <Download className="w-5 h-5 text-white" />
                                            </a>
                                        </div>
                                    </div>
                                    <div className="p-2">
                                        <p className="text-xs text-gray-400 truncate">{video.filename}</p>
                                        <p className="text-xs text-gray-600">{(video.size / 1024 / 1024).toFixed(1)} MB</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div >
    );
};
