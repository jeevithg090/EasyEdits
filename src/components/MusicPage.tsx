import React, { useState, useRef } from 'react';
import { API_BASE } from '../lib/api';
import {
  ArrowLeft,
  Music2,
  Link,
  Download,
  Play,
  AlertCircle,
  Loader2,
  Sparkles,
  X,
  Video,
  Wand2,
  Filter,
  Type,
  Palette,
  Volume2,
  ChevronDown,
  Mic,
  Cloud,
  Cpu,
} from 'lucide-react';

interface MusicPageProps {
  onBack: () => void;
}

// Video Filter Definitions with FFmpeg filter strings
const VIDEO_FILTERS = {
  retro: [
    {
      key: 'vhs',
      name: 'VHS',
      description: 'Classic VHS distortion',
      preview: '📼',
      ffmpeg:
        'colorbalance=rs=0.3:gs=-0.05:bs=-0.1,noise=alls=20:allf=t+u,eq=contrast=1.1:brightness=0.05',
    },
    {
      key: 'film_grain',
      name: 'Film Grain',
      description: '35mm film aesthetic',
      preview: '🎞️',
      ffmpeg: 'noise=alls=15:allf=t,eq=saturation=0.9:contrast=1.1',
    },
    {
      key: '8mm',
      name: '8mm Film',
      description: 'Vintage home movie',
      preview: '📽️',
      ffmpeg: 'colorbalance=rs=0.2:gs=0.1:bs=-0.2,noise=alls=25:allf=t+u,vignette=PI/4',
    },
    {
      key: 'sepia',
      name: 'Sepia',
      description: 'Warm sepia tone',
      preview: '🟤',
      ffmpeg: 'colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131',
    },
    {
      key: 'kodak',
      name: 'Kodak Gold',
      description: 'Warm Kodak film look',
      preview: '🌅',
      ffmpeg: 'colorbalance=rs=0.15:gs=0.05:bs=-0.1,eq=saturation=1.2:brightness=0.03',
    },
  ],
  aesthetic: [
    {
      key: 'coquette',
      name: 'Coquette',
      description: 'Soft pink pastel',
      preview: '🎀',
      ffmpeg:
        'colorbalance=rs=0.2:gs=-0.05:bs=0.1,eq=saturation=0.9:brightness=0.05,gblur=sigma=0.5',
    },
    {
      key: 'y2k',
      name: 'Y2K',
      description: 'Vibrant 2000s style',
      preview: '💿',
      ffmpeg: 'eq=saturation=1.4:contrast=1.2,colorbalance=rs=0.1:gs=0.05:bs=0.15',
    },
    {
      key: 'dreamy',
      name: 'Dreamy',
      description: 'Soft ethereal glow',
      preview: '✨',
      ffmpeg: 'gblur=sigma=1.5,eq=brightness=0.1:saturation=0.85',
    },
    {
      key: 'lofi',
      name: 'Lo-Fi',
      description: 'Muted cozy aesthetic',
      preview: '🌙',
      ffmpeg:
        'eq=saturation=0.7:contrast=0.9:brightness=-0.05,colorbalance=rs=-0.05:gs=0.05:bs=0.1',
    },
    {
      key: 'golden_hour',
      name: 'Golden Hour',
      description: 'Warm sunset glow',
      preview: '🌇',
      ffmpeg: 'colorbalance=rs=0.25:gs=0.1:bs=-0.15,eq=saturation=1.1:brightness=0.08',
    },
  ],
  color_grading: [
    {
      key: 'warm_glow',
      name: 'Warm Glow',
      description: 'Cozy warm tones',
      preview: '🔥',
      ffmpeg: 'colorbalance=rs=0.2:gs=0.1:bs=-0.1,eq=brightness=0.05',
    },
    {
      key: 'cool_tones',
      name: 'Cool Tones',
      description: 'Blue/teal aesthetic',
      preview: '❄️',
      ffmpeg: 'colorbalance=rs=-0.15:gs=0:bs=0.2,eq=saturation=0.95',
    },
    {
      key: 'cinematic',
      name: 'Cinematic',
      description: 'Film-like contrast',
      preview: '🎬',
      ffmpeg: 'eq=contrast=1.3:saturation=0.9,colorbalance=rs=-0.05:gs=-0.05:bs=0.1',
    },
    {
      key: 'high_contrast',
      name: 'High Contrast',
      description: 'Bold dramatic look',
      preview: '⬛',
      ffmpeg: 'eq=contrast=1.5:saturation=1.1',
    },
    {
      key: 'desaturated',
      name: 'Desaturated',
      description: 'Subtle muted colors',
      preview: '🩶',
      ffmpeg: 'eq=saturation=0.5',
    },
  ],
  effects: [
    {
      key: 'glitch',
      name: 'Glitch',
      description: 'Digital distortion',
      preview: '📟',
      ffmpeg: 'rgbashift=rh=-3:bh=3,noise=alls=10:allf=t',
    },
    {
      key: 'neon_glow',
      name: 'Neon Glow',
      description: 'Vibrant neon colors',
      preview: '💜',
      ffmpeg: 'eq=saturation=1.8:contrast=1.3,colorbalance=rs=0.1:gs=-0.1:bs=0.2',
    },
    {
      key: 'vignette',
      name: 'Vignette',
      description: 'Dark edge fade',
      preview: '🔲',
      ffmpeg: 'vignette=PI/4',
    },
    {
      key: 'blur_edges',
      name: 'Blur Edges',
      description: 'Dreamy edge blur',
      preview: '🔮',
      ffmpeg: 'vignette=PI/3,gblur=sigma=2',
    },
    {
      key: 'chromatic',
      name: 'Chromatic',
      description: 'RGB split effect',
      preview: '🌈',
      ffmpeg: 'rgbashift=rh=5:bh=-5',
    },
  ],
};

// Caption Style Definitions
const CAPTION_STYLES = [
  {
    key: 'karaoke',
    name: 'Karaoke',
    description: 'Word-by-word highlight',
    preview: '🎤',
    animation: 'highlight',
    fontStyle: 'bold uppercase',
    effect: 'Word highlight synced with audio',
  },
  {
    key: 'bounce',
    name: 'Bounce',
    description: 'Bouncing text animation',
    preview: '⬆️',
    animation: 'bounce',
    fontStyle: 'bold',
    effect: 'Words bounce in on beat',
  },
  {
    key: 'wave',
    name: 'Wave',
    description: 'Flowing wave motion',
    preview: '🌊',
    animation: 'wave',
    fontStyle: 'normal',
    effect: 'Text ripples like waves',
  },
  {
    key: 'neon_glow',
    name: 'Neon Glow',
    description: 'Glowing neon text',
    preview: '💡',
    animation: 'glow',
    fontStyle: 'bold',
    effect: 'Pulsing neon glow effect',
  },
  {
    key: 'typewriter',
    name: 'Typewriter',
    description: 'Letter-by-letter reveal',
    preview: '⌨️',
    animation: 'typewriter',
    fontStyle: 'monospace',
    effect: 'Characters appear one by one',
  },
  {
    key: 'scale_pop',
    name: 'Scale Pop',
    description: 'Words pop with scale',
    preview: '💥',
    animation: 'scale',
    fontStyle: 'bold uppercase',
    effect: 'Words pop in with scale animation',
  },
  {
    key: 'stroke_outline',
    name: 'Stroke Outline',
    description: 'Bold outlined text',
    preview: '🔤',
    animation: 'none',
    fontStyle: 'bold stroke',
    effect: 'High contrast outlined text',
  },
  {
    key: 'shadow_3d',
    name: '3D Shadow',
    description: 'Depth shadow effect',
    preview: '🎭',
    animation: 'none',
    fontStyle: 'bold shadow',
    effect: 'Text with 3D depth shadow',
  },
  {
    key: 'gradient_fill',
    name: 'Gradient Fill',
    description: 'Multi-color gradient',
    preview: '🌈',
    animation: 'gradient',
    fontStyle: 'bold gradient',
    effect: 'Animated gradient text',
  },
];

// Font Options
const FONTS = [
  { key: 'montserrat', name: 'Montserrat' },
  { key: 'poppins', name: 'Poppins' },
  { key: 'roboto', name: 'Roboto' },
  { key: 'inter', name: 'Inter' },
  { key: 'bebas', name: 'Bebas Neue' },
  { key: 'oswald', name: 'Oswald' },
  { key: 'anton', name: 'Anton' },
  { key: 'archivo', name: 'Archivo Black' },
  { key: 'righteous', name: 'Righteous' },
  { key: 'russo', name: 'Russo One' },
];

// Color Options
const COLORS = [
  { key: 'white', name: 'White', hex: '#FFFFFF' },
  { key: 'black', name: 'Black', hex: '#000000' },
  { key: 'yellow', name: 'Yellow', hex: '#FFFF00' },
  { key: 'cyan', name: 'Cyan', hex: '#00FFFF' },
  { key: 'magenta', name: 'Magenta', hex: '#FF00FF' },
  { key: 'lime', name: 'Lime', hex: '#00FF00' },
  { key: 'red', name: 'Red', hex: '#FF0000' },
  { key: 'orange', name: 'Orange', hex: '#FF8000' },
  { key: 'pink', name: 'Pink', hex: '#FF69B4' },
  { key: 'gold', name: 'Gold', hex: '#FFD700' },
];

// Caption Positions
const POSITIONS = [
  { key: 'top', name: 'Top', value: '10%' },
  { key: 'center', name: 'Center', value: '50%' },
  { key: 'bottom', name: 'Bottom', value: '85%' },
];

export const MusicPage: React.FC<MusicPageProps> = ({ onBack }) => {
  // Video state
  const [videoUrl, setVideoUrl] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [videoPath, setVideoPath] = useState<string | null>(null);
  const [videoFilename, setVideoFilename] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Filter state
  const [selectedFilterCategory, setSelectedFilterCategory] =
    useState<keyof typeof VIDEO_FILTERS>('aesthetic');
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null);
  const [filterIntensity, setFilterIntensity] = useState(100);

  // Caption state
  const [selectedCaptionStyle, setSelectedCaptionStyle] = useState<string | null>(null);
  const [captionText, setCaptionText] = useState('Your music lyrics here...');
  const [captionFont, setCaptionFont] = useState('montserrat');
  const [captionColor, setCaptionColor] = useState('white');
  const [captionPosition, setCaptionPosition] = useState('bottom');
  const [captionSize, setCaptionSize] = useState(48);

  // AI Features state
  const [aiFeatures, setAiFeatures] = useState({
    beatSync: false,
    autoEnhance: false,
    smartFilter: false,
  });

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [processProgress, setProcessProgress] = useState(0);
  const [processedVideoPath, setProcessedVideoPath] = useState<string | null>(null);
  const [useColabMode, setUseColabMode] = useState(false);
  const [colabJobId, setColabJobId] = useState<string | null>(null);

  // Transcription state
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcription, setTranscription] = useState<{ text: string; words?: unknown[] } | null>(
    null,
  );

  // Content Resources Modal
  const [showContentResources, setShowContentResources] = useState(false);

  // Handle video download
  const handleDownload = async () => {
    if (!videoUrl) {
      setError('Please enter a video URL');
      return;
    }

    setError(null);
    setIsDownloading(true);
    setDownloadProgress(0);
    setVideoPath(null);
    setVideoFilename(null);

    const progressInterval = setInterval(() => {
      setDownloadProgress((prev) => {
        if (prev >= 90) return prev;
        return prev + Math.random() * 15;
      });
    }, 500);

    try {
      const response = await fetch(`${API_BASE}/api/music-video/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: videoUrl }),
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
      setShowContentResources(false);
    } catch (err) {
      clearInterval(progressInterval);
      setError(err instanceof Error ? err.message : 'An error occurred while downloading');
    } finally {
      setIsDownloading(false);
    }
  };

  // Handle transcription (Whisper)
  const handleTranscribe = async () => {
    if (!videoFilename) {
      setError('Please download a video first');
      return;
    }

    setError(null);
    setIsTranscribing(true);
    setTranscription(null);

    try {
      const response = await fetch(`${API_BASE}/api/music-video/transcribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoFilename }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to transcribe video');
      }

      const data = await response.json();
      setTranscription(data.transcription);
      // Use transcription text as caption
      if (data.transcription?.text) {
        setCaptionText(data.transcription.text);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during transcription');
    } finally {
      setIsTranscribing(false);
    }
  };

  // Handle video processing (apply filter + captions + export)
  const handleProcessVideo = async () => {
    if (!videoFilename) {
      setError('Please download a video first');
      return;
    }

    if (!selectedFilter && !selectedCaptionStyle) {
      setError('Please select at least a filter or caption style');
      return;
    }

    setError(null);
    setIsProcessing(true);
    setProcessProgress(0);
    setProcessedVideoPath(null);

    const progressInterval = setInterval(() => {
      setProcessProgress((prev) => {
        if (prev >= 90) return prev;
        return prev + Math.random() * 8;
      });
    }, 1000);

    try {
      const response = await fetch(`${API_BASE}/api/music-video/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoFilename,
          filter: selectedFilter,
          filterIntensity: filterIntensity / 100,
          captionStyle: selectedCaptionStyle,
          captionText,
          captionFont,
          captionColor,
          captionPosition,
          captionSize,
          aiFeatures,
          useColab: useColabMode,
        }),
      });

      clearInterval(progressInterval);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to process video');
      }

      const data = await response.json();
      setProcessProgress(100);

      if (data.mode === 'colab' && data.jobId) {
        setColabJobId(data.jobId);
        // Would poll for job status here
      } else {
        setProcessedVideoPath(`${API_BASE}${data.videoPath}`);
      }
    } catch (err) {
      clearInterval(progressInterval);
      setError(err instanceof Error ? err.message : 'An error occurred during processing');
    } finally {
      setIsProcessing(false);
    }
  };

  // Get filter preview CSS
  const getFilterPreviewStyle = (filterKey: string) => {
    const filterStyles: Record<string, React.CSSProperties> = {
      vhs: { filter: 'saturate(1.2) contrast(1.1) brightness(1.05)', mixBlendMode: 'multiply' },
      film_grain: { filter: 'sepia(0.1) contrast(1.1)' },
      '8mm': { filter: 'sepia(0.3) contrast(1.1) brightness(0.95)' },
      sepia: { filter: 'sepia(0.8)' },
      kodak: { filter: 'saturate(1.2) sepia(0.2) brightness(1.03)' },
      coquette: { filter: 'saturate(0.9) brightness(1.05) hue-rotate(-10deg)' },
      y2k: { filter: 'saturate(1.4) contrast(1.2)' },
      dreamy: { filter: 'blur(0.5px) brightness(1.1) saturate(0.85)' },
      lofi: { filter: 'saturate(0.7) contrast(0.9) brightness(0.95)' },
      golden_hour: { filter: 'saturate(1.1) sepia(0.2) brightness(1.08)' },
      warm_glow: { filter: 'sepia(0.2) brightness(1.05)' },
      cool_tones: { filter: 'saturate(0.95) hue-rotate(10deg)' },
      cinematic: { filter: 'contrast(1.3) saturate(0.9)' },
      high_contrast: { filter: 'contrast(1.5) saturate(1.1)' },
      desaturated: { filter: 'saturate(0.5)' },
      glitch: { filter: 'hue-rotate(180deg) saturate(1.2)' },
      neon_glow: { filter: 'saturate(1.8) contrast(1.3)' },
      vignette: { boxShadow: 'inset 0 0 100px rgba(0,0,0,0.8)' },
      blur_edges: {
        filter: 'blur(2px)',
        maskImage: 'radial-gradient(circle, black 50%, transparent 100%)',
      },
      chromatic: { filter: 'saturate(1.2)' },
    };
    return filterStyles[filterKey] || {};
  };

  // Get caption preview style
  const getCaptionPreviewStyle = (styleKey: string): React.CSSProperties => {
    const color = COLORS.find((c) => c.key === captionColor)?.hex || '#FFFFFF';
    const baseStyle: React.CSSProperties = {
      fontFamily:
        captionFont === 'bebas'
          ? '"Bebas Neue", sans-serif'
          : captionFont === 'oswald'
            ? '"Oswald", sans-serif'
            : `"${FONTS.find((f) => f.key === captionFont)?.name || 'Montserrat'}", sans-serif`,
      fontSize: `${captionSize / 2}px`,
      color: color,
      textAlign: 'center',
      padding: '10px 20px',
    };

    const styleMap: Record<string, React.CSSProperties> = {
      karaoke: { ...baseStyle, fontWeight: 'bold', textTransform: 'uppercase' as const },
      bounce: { ...baseStyle, fontWeight: 'bold', animation: 'bounce 0.5s ease infinite' },
      wave: { ...baseStyle, animation: 'wave 2s ease-in-out infinite' },
      neon_glow: {
        ...baseStyle,
        fontWeight: 'bold',
        textShadow: `0 0 10px ${color}, 0 0 20px ${color}, 0 0 30px ${color}`,
      },
      typewriter: { ...baseStyle, fontFamily: 'monospace', borderRight: '2px solid white' },
      scale_pop: {
        ...baseStyle,
        fontWeight: 'bold',
        textTransform: 'uppercase' as const,
        animation: 'scalePop 0.3s ease',
      },
      stroke_outline: {
        ...baseStyle,
        fontWeight: 'bold',
        WebkitTextStroke: '2px black',
        color: 'white',
      },
      shadow_3d: {
        ...baseStyle,
        fontWeight: 'bold',
        textShadow: '3px 3px 0px rgba(0,0,0,0.5), 6px 6px 0px rgba(0,0,0,0.3)',
      },
      gradient_fill: {
        ...baseStyle,
        fontWeight: 'bold',
        background: 'linear-gradient(90deg, #ff0080, #ff8c00, #40e0d0)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
      },
    };

    return styleMap[styleKey] || baseStyle;
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
          <Music2 className="w-10 h-10 mr-3 text-pink-400" />
          Music Studio
          <span className="ml-3 px-3 py-1 rounded-full text-xs font-medium bg-pink-500/20 text-pink-300 border border-pink-500/20">
            Beta
          </span>
        </h1>
        <p className="text-gray-400 mt-2">
          Create stunning 9:16 music videos with filters, captions, and AI features
        </p>
      </div>

      {/* Top Action Bar */}
      <div className="mb-8 flex flex-wrap gap-4">
        <button
          onClick={() => setShowContentResources(true)}
          className="px-6 py-3 rounded-xl font-medium text-sm bg-gradient-to-r from-pink-500 to-purple-600 text-white hover:from-pink-400 hover:to-purple-500 shadow-lg shadow-pink-500/25 transition-all flex items-center"
        >
          <Video className="w-4 h-4 mr-2" />
          Content Resources
        </button>
        <div className="flex items-center gap-3 ml-auto">
          <span className="text-gray-400 text-sm">AI Features:</span>
          <button
            onClick={() => setAiFeatures((prev) => ({ ...prev, beatSync: !prev.beatSync }))}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center ${
              aiFeatures.beatSync
                ? 'bg-pink-500/20 text-pink-300 border border-pink-500/50'
                : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
            }`}
          >
            <Volume2 className="w-4 h-4 mr-2" />
            Beat Sync
          </button>
          <button
            onClick={() => setAiFeatures((prev) => ({ ...prev, autoEnhance: !prev.autoEnhance }))}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center ${
              aiFeatures.autoEnhance
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/50'
                : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
            }`}
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Auto Enhance
          </button>
          <button
            onClick={() => setAiFeatures((prev) => ({ ...prev, smartFilter: !prev.smartFilter }))}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center ${
              aiFeatures.smartFilter
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50'
                : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
            }`}
          >
            <Wand2 className="w-4 h-4 mr-2" />
            Smart Filter
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start">
          <AlertCircle className="w-5 h-5 text-red-400 mr-3 flex-shrink-0 mt-0.5" />
          <p className="text-red-300 text-sm">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="w-4 h-4 text-red-400" />
          </button>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Video Preview */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-white/5">
              <h3 className="text-lg font-semibold text-white flex items-center">
                <Play className="w-5 h-5 mr-2 text-pink-400" />
                Video Preview
                <span className="ml-2 px-2 py-0.5 rounded text-xs bg-pink-500/20 text-pink-300">
                  9:16
                </span>
              </h3>
            </div>

            <div
              className="aspect-[9/16] bg-black/60 flex items-center justify-center relative mx-auto max-h-[500px]"
              style={selectedFilter ? getFilterPreviewStyle(selectedFilter) : {}}
            >
              {videoPath ? (
                <video
                  ref={videoRef}
                  src={videoPath}
                  controls
                  className="w-full h-full object-contain"
                  style={selectedFilter ? getFilterPreviewStyle(selectedFilter) : {}}
                >
                  Your browser does not support the video tag.
                </video>
              ) : isDownloading ? (
                <div className="flex flex-col items-center text-center p-8">
                  <div className="w-16 h-16 rounded-full border-4 border-pink-500 border-t-transparent animate-spin mb-4" />
                  <p className="text-gray-300 font-medium">Downloading...</p>
                  <p className="text-gray-500 text-sm mt-1">{Math.round(downloadProgress)}%</p>
                </div>
              ) : (
                <div className="flex flex-col items-center text-center p-8">
                  <div className="w-16 h-16 rounded-full bg-gray-900/50 flex items-center justify-center mb-4">
                    <Music2 className="w-8 h-8 text-gray-700" />
                  </div>
                  <p className="text-gray-400 font-medium text-sm">No video loaded</p>
                  <p className="text-gray-600 text-xs mt-1">
                    Click "Content Resources" to add a video
                  </p>
                </div>
              )}

              {/* Caption Preview Overlay */}
              {videoPath && selectedCaptionStyle && (
                <div
                  className="absolute left-0 right-0 pointer-events-none"
                  style={{
                    top:
                      captionPosition === 'top'
                        ? '10%'
                        : captionPosition === 'center'
                          ? '50%'
                          : undefined,
                    bottom: captionPosition === 'bottom' ? '10%' : undefined,
                    transform: captionPosition === 'center' ? 'translateY(-50%)' : undefined,
                  }}
                >
                  <p style={getCaptionPreviewStyle(selectedCaptionStyle)}>
                    {captionText.substring(0, 30)}...
                  </p>
                </div>
              )}
            </div>

            {videoPath && (
              <div className="p-4 border-t border-white/5 bg-black/20 space-y-3">
                {/* Processing Mode Toggle */}
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-xs">Processing Mode:</span>
                  <div className="flex rounded-lg overflow-hidden border border-gray-700">
                    <button
                      onClick={() => setUseColabMode(false)}
                      className={`px-3 py-1.5 text-xs font-medium flex items-center ${
                        !useColabMode
                          ? 'bg-pink-500/20 text-pink-300'
                          : 'bg-transparent text-gray-500 hover:text-gray-300'
                      }`}
                    >
                      <Cpu className="w-3 h-3 mr-1" />
                      Local
                    </button>
                    <button
                      onClick={() => setUseColabMode(true)}
                      className={`px-3 py-1.5 text-xs font-medium flex items-center ${
                        useColabMode
                          ? 'bg-cyan-500/20 text-cyan-300'
                          : 'bg-transparent text-gray-500 hover:text-gray-300'
                      }`}
                    >
                      <Cloud className="w-3 h-3 mr-1" />
                      Colab GPU
                    </button>
                  </div>
                </div>

                {/* Transcribe Audio Button */}
                <button
                  onClick={handleTranscribe}
                  disabled={isTranscribing}
                  className={`w-full py-2 px-3 rounded-lg text-sm font-medium flex items-center justify-center transition-all ${
                    isTranscribing
                      ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                      : transcription
                        ? 'bg-green-500/20 text-green-300 border border-green-500/50'
                        : 'bg-purple-500/10 text-purple-300 border border-purple-500/30 hover:bg-purple-500/20'
                  }`}
                >
                  {isTranscribing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Transcribing audio...
                    </>
                  ) : transcription ? (
                    <>
                      <Mic className="w-4 h-4 mr-2" />✓ Transcribed (
                      {transcription.words?.length || 0} words)
                    </>
                  ) : (
                    <>
                      <Mic className="w-4 h-4 mr-2" />
                      Transcribe Audio (Whisper)
                    </>
                  )}
                </button>

                {/* Create Video Button */}
                <button
                  onClick={handleProcessVideo}
                  disabled={isProcessing}
                  className={`w-full py-3 px-4 rounded-xl font-bold transition-all flex items-center justify-center ${
                    isProcessing
                      ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-pink-500 to-purple-600 text-white hover:from-pink-400 hover:to-purple-500 shadow-lg shadow-pink-500/25'
                  }`}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {useColabMode ? 'Creating Colab Job...' : 'Processing with YOLO...'}{' '}
                      {Math.round(processProgress)}%
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Create Music Video {useColabMode && '(GPU)'}
                    </>
                  )}
                </button>
                {isProcessing && (
                  <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-pink-500 to-purple-600 transition-all duration-300"
                      style={{ width: `${processProgress}%` }}
                    />
                  </div>
                )}

                {/* Colab Job Status */}
                {colabJobId && (
                  <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-xs text-cyan-300">
                    <p>☁️ Colab Job: {colabJobId.substring(0, 8)}...</p>
                    <p className="text-gray-400 mt-1">Run the Colab notebook to process</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Middle Column: Filters */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass-card rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-white flex items-center mb-4">
              <Filter className="w-5 h-5 mr-2 text-cyan-400" />
              Video Filters
            </h3>

            {/* Filter Categories */}
            <div className="flex flex-wrap gap-2 mb-4">
              {(Object.keys(VIDEO_FILTERS) as Array<keyof typeof VIDEO_FILTERS>).map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedFilterCategory(category)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    selectedFilterCategory === category
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50'
                      : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
                  }`}
                >
                  {category.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                </button>
              ))}
            </div>

            {/* Filter Grid */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              {VIDEO_FILTERS[selectedFilterCategory].map((filter) => (
                <button
                  key={filter.key}
                  onClick={() =>
                    setSelectedFilter(selectedFilter === filter.key ? null : filter.key)
                  }
                  className={`p-3 rounded-xl text-left transition-all ${
                    selectedFilter === filter.key
                      ? 'bg-cyan-500/20 border-2 border-cyan-500 text-white'
                      : 'bg-white/5 border-2 border-transparent text-gray-400 hover:bg-white/10'
                  }`}
                >
                  <div className="text-2xl mb-1">{filter.preview}</div>
                  <div className="font-medium text-sm">{filter.name}</div>
                  <div className="text-xs opacity-70 mt-0.5">{filter.description}</div>
                </button>
              ))}
            </div>

            {/* Intensity Slider */}
            {selectedFilter && (
              <div className="pt-4 border-t border-white/10">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Filter Intensity: {filterIntensity}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={filterIntensity}
                  onChange={(e) => setFilterIntensity(parseInt(e.target.value))}
                  className="w-full accent-cyan-500"
                />
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Captions */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass-card rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-white flex items-center mb-4">
              <Type className="w-5 h-5 mr-2 text-yellow-400" />
              Caption Styles
            </h3>

            {/* Caption Style Grid */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              {CAPTION_STYLES.map((style) => (
                <button
                  key={style.key}
                  onClick={() =>
                    setSelectedCaptionStyle(selectedCaptionStyle === style.key ? null : style.key)
                  }
                  className={`p-2 rounded-xl text-center transition-all ${
                    selectedCaptionStyle === style.key
                      ? 'bg-yellow-500/20 border-2 border-yellow-500 text-white'
                      : 'bg-white/5 border-2 border-transparent text-gray-400 hover:bg-white/10'
                  }`}
                  title={style.description}
                >
                  <div className="text-xl">{style.preview}</div>
                  <div className="font-medium text-xs mt-1">{style.name}</div>
                </button>
              ))}
            </div>

            {selectedCaptionStyle && (
              <div className="space-y-4 pt-4 border-t border-white/10">
                {/* Caption Text */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Caption Text
                  </label>
                  <textarea
                    value={captionText}
                    onChange={(e) => setCaptionText(e.target.value)}
                    className="w-full bg-black/40 border border-gray-700 rounded-xl p-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-yellow-500 focus:border-transparent outline-none transition-all resize-none"
                    rows={2}
                    placeholder="Enter your lyrics or caption..."
                  />
                </div>

                {/* Font Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Font</label>
                  <div className="relative">
                    <select
                      value={captionFont}
                      onChange={(e) => setCaptionFont(e.target.value)}
                      className="w-full bg-black/40 border border-gray-700 rounded-xl p-3 text-white appearance-none cursor-pointer"
                    >
                      {FONTS.map((font) => (
                        <option key={font.key} value={font.key} className="bg-gray-900">
                          {font.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>

                {/* Color Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center">
                    <Palette className="w-4 h-4 mr-2" />
                    Text Color
                  </label>
                  <div className="grid grid-cols-5 gap-2">
                    {COLORS.map((color) => (
                      <button
                        key={color.key}
                        onClick={() => setCaptionColor(color.key)}
                        className={`w-8 h-8 rounded-lg border-2 transition-all ${
                          captionColor === color.key
                            ? 'border-yellow-500 scale-110'
                            : 'border-transparent hover:border-white/30'
                        }`}
                        style={{ backgroundColor: color.hex }}
                        title={color.name}
                      />
                    ))}
                  </div>
                </div>

                {/* Position Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Position</label>
                  <div className="flex gap-2">
                    {POSITIONS.map((pos) => (
                      <button
                        key={pos.key}
                        onClick={() => setCaptionPosition(pos.key)}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                          captionPosition === pos.key
                            ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/50'
                            : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
                        }`}
                      >
                        {pos.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Size Slider */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Font Size: {captionSize}px
                  </label>
                  <input
                    type="range"
                    min="24"
                    max="72"
                    value={captionSize}
                    onChange={(e) => setCaptionSize(parseInt(e.target.value))}
                    className="w-full accent-yellow-500"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Processed Video Section */}
      {processedVideoPath && (
        <div className="mt-8 glass-card rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-white/5">
            <h3 className="text-lg font-semibold text-white flex items-center">
              <Sparkles className="w-5 h-5 mr-2 text-pink-400" />
              Your Music Video
              <span className="ml-2 px-2 py-0.5 rounded text-xs bg-pink-500/20 text-pink-300">
                9:16
              </span>
            </h3>
          </div>
          <div className="p-4 flex flex-col lg:flex-row gap-6">
            <div className="flex-1 aspect-[9/16] max-h-[600px] bg-black rounded-xl overflow-hidden mx-auto">
              <video
                src={processedVideoPath}
                controls
                autoPlay
                className="w-full h-full object-contain"
              >
                Your browser does not support the video tag.
              </video>
            </div>
            <div className="lg:w-64 flex flex-col gap-4">
              <a
                href={processedVideoPath}
                download
                className="w-full py-3 px-4 rounded-xl font-bold bg-gradient-to-r from-pink-500 to-purple-600 text-white hover:from-pink-400 hover:to-purple-500 shadow-lg shadow-pink-500/25 flex items-center justify-center"
              >
                <Download className="w-4 h-4 mr-2" />
                Download Video
              </a>
              <div className="p-3 rounded-lg bg-pink-500/10 border border-pink-500/20">
                <p className="text-xs text-gray-400">
                  <strong className="text-pink-300">Filter:</strong> {selectedFilter || 'None'}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  <strong className="text-pink-300">Caption:</strong>{' '}
                  {selectedCaptionStyle || 'None'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Content Resources Modal */}
      {showContentResources && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-2xl w-full max-w-lg overflow-hidden">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white flex items-center">
                <Video className="w-5 h-5 mr-2 text-pink-400" />
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
                Enter a video URL from YouTube, Instagram, TikTok, or other platforms. The video
                will be automatically cropped to 9:16 for vertical format.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center">
                  <Link className="w-4 h-4 mr-2" />
                  Video URL
                </label>
                <input
                  type="text"
                  className="w-full bg-black/40 border border-gray-700 rounded-xl p-4 text-white placeholder-gray-500 focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none transition-all"
                  placeholder="https://youtube.com/shorts/... or https://instagram.com/reel/..."
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                />
                <p className="text-gray-500 text-xs mt-2">
                  Supports YouTube, Instagram, TikTok, and most video URLs
                </p>
              </div>
            </div>
            <div className="p-4 border-t border-white/10 bg-black/20">
              <button
                onClick={handleDownload}
                disabled={!videoUrl || isDownloading}
                className={`w-full py-3 px-4 rounded-xl font-bold flex items-center justify-center ${
                  !videoUrl || isDownloading
                    ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-pink-500 to-purple-600 text-white hover:from-pink-400 hover:to-purple-500 shadow-lg shadow-pink-500/25'
                }`}
              >
                {isDownloading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Downloading... {Math.round(downloadProgress)}%
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Download Video
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSS Animations */}
      <style>{`
                @keyframes bounce {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-10px); }
                }
                @keyframes wave {
                    0%, 100% { transform: translateY(0) rotate(-1deg); }
                    50% { transform: translateY(-5px) rotate(1deg); }
                }
                @keyframes scalePop {
                    0% { transform: scale(0.5); opacity: 0; }
                    50% { transform: scale(1.1); }
                    100% { transform: scale(1); opacity: 1; }
                }
            `}</style>
    </div>
  );
};
