import React, { useState, useRef } from 'react';
import { API_BASE } from '../lib/api';
import {
  ArrowLeft,
  Video,
  Link,
  Music,
  Loader2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Play,
  Pause,
  Download,
  Volume2,
  Sparkles,
} from 'lucide-react';

interface SportsPageProps {
  onBack: () => void;
}

interface MusicSuggestion {
  start: string;
  end: string;
  startSeconds: number;
  endSeconds: number;
  reason: string;
}

interface AISongSuggestion {
  title: string;
  artist: string;
  youtubeSearchQuery: string;
  reason: string;
  suggestedStart: string;
  suggestedEnd: string;
  section: string;
}

export const SportsPage: React.FC<SportsPageProps> = ({ onBack }) => {
  // Video state
  const [videoUrl, setVideoUrl] = useState('');
  const [isDownloadingVideo, setIsDownloadingVideo] = useState(false);
  const [videoPath, setVideoPath] = useState<string | null>(null);
  const [videoFilename, setVideoFilename] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number>(30);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Music state
  const [showMusicSection, setShowMusicSection] = useState(false);
  const [musicUrl, setMusicUrl] = useState('');
  const [isAnalyzingMusic, setIsAnalyzingMusic] = useState(false);
  const [musicSuggestion, setMusicSuggestion] = useState<MusicSuggestion | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [audioFilename, setAudioFilename] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Merge state
  const [isMerging, setIsMerging] = useState(false);
  const [finalVideoPath, setFinalVideoPath] = useState<string | null>(null);

  // AI Music suggestion state
  const [isGettingAiSuggestions, setIsGettingAiSuggestions] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<AISongSuggestion[]>([]);
  const [showAiSuggestions, setShowAiSuggestions] = useState(false);

  // Download video clip
  const handleDownloadVideo = async () => {
    if (!videoUrl) {
      setError('Please enter a video URL');
      return;
    }

    setError(null);
    setIsDownloadingVideo(true);
    setVideoPath(null);
    setVideoFilename(null);
    setShowMusicSection(false);
    setMusicSuggestion(null);
    setFinalVideoPath(null);

    try {
      const response = await fetch(`${API_BASE}/api/content-crop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoUrl }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to download video');
      }

      const data = await response.json();
      setVideoPath(`${API_BASE}${data.videoPath}`);
      setVideoFilename(data.filename);
      setShowMusicSection(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while downloading');
    } finally {
      setIsDownloadingVideo(false);
    }
  };

  // Get AI music suggestions based on video analysis
  const handleGetAiSuggestions = async () => {
    if (!videoFilename) {
      setError('Please download a video first');
      return;
    }

    setError(null);
    setIsGettingAiSuggestions(true);
    setAiSuggestions([]);
    setShowAiSuggestions(false);

    try {
      const response = await fetch(`${API_BASE}/api/sports/ai-suggest-music`, {
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
      setError(
        err instanceof Error ? err.message : 'An error occurred while getting AI suggestions',
      );
    } finally {
      setIsGettingAiSuggestions(false);
    }
  };

  // Select an AI suggestion - search YouTube and populate music URL
  const handleSelectAiSuggestion = (suggestion: AISongSuggestion) => {
    // Create YouTube search URL and open in new tab
    const searchQuery = encodeURIComponent(suggestion.youtubeSearchQuery);
    const youtubeSearchUrl = `https://www.youtube.com/results?search_query=${searchQuery}`;

    // Open YouTube search in new tab
    window.open(youtubeSearchUrl, '_blank');

    // Clear the music URL field - user needs to paste the actual video URL
    setMusicUrl('');
    setShowAiSuggestions(false);

    // Show a helpful message (use a positive indicator, not error)
    setError(
      `🎵 Find "${suggestion.title}" by ${suggestion.artist} and paste the video URL below. Best section: ${suggestion.suggestedStart} - ${suggestion.suggestedEnd} (${suggestion.section})`,
    );
  };

  // Analyze music with Gemini
  const handleAnalyzeMusic = async () => {
    if (!musicUrl) {
      setError('Please enter a music URL');
      return;
    }

    setError(null);
    setIsAnalyzingMusic(true);
    setMusicSuggestion(null);
    setAudioPreviewUrl(null);
    setAudioFilename(null);

    try {
      const response = await fetch(`${API_BASE}/api/sports/analyze-music`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          musicUrl,
          videoDuration: Math.round(videoDuration), // Use actual video duration
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to analyze music');
      }

      const data = await response.json();
      setMusicSuggestion(data.suggestion);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during music analysis');
    } finally {
      setIsAnalyzingMusic(false);
    }
  };

  // Accept suggestion - download music section
  const handleAcceptSuggestion = async () => {
    if (!musicSuggestion) return;

    setError(null);

    try {
      const response = await fetch(`${API_BASE}/api/sports/download-music-section`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          musicUrl,
          start: musicSuggestion.start,
          end: musicSuggestion.end,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to download music section');
      }

      const data = await response.json();
      setAudioFilename(data.filename);
      setAudioPreviewUrl(`${API_BASE}${data.audioPath}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while downloading music');
    }
  };

  // Reject - clear music state
  const handleRejectSuggestion = () => {
    setMusicSuggestion(null);
    setMusicUrl('');
    setAudioPreviewUrl(null);
    setAudioFilename(null);
  };

  // Regenerate - re-analyze
  const handleRegenerateSuggestion = () => {
    setMusicSuggestion(null);
    handleAnalyzeMusic();
  };

  // Toggle audio preview
  const toggleAudioPreview = () => {
    if (audioRef.current) {
      if (isPreviewPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPreviewPlaying(!isPreviewPlaying);
    }
  };

  // Merge video and music
  const handleMerge = async () => {
    if (!videoFilename || !audioFilename) {
      setError('Both video and audio are required for merging');
      return;
    }

    setError(null);
    setIsMerging(true);
    setFinalVideoPath(null);

    try {
      const response = await fetch(`${API_BASE}/api/sports/merge-video-music`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoFilename,
          audioFilename,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to merge video and music');
      }

      const data = await response.json();
      setFinalVideoPath(`${API_BASE}${data.videoPath}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during merge');
    } finally {
      setIsMerging(false);
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
          Sports Studio
          <span className="ml-3 px-3 py-1 rounded-full text-xs font-medium bg-orange-500/20 text-orange-300 border border-orange-500/20">
            Beta
          </span>
        </h1>
        <p className="text-gray-400 mt-2">
          Download sports clips and add the perfect music with AI-powered section selection
        </p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 flex items-center">
          <XCircle className="w-5 h-5 mr-2 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column - Video Download */}
        <div className="space-y-6">
          {/* Video URL Input */}
          <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
              <Video className="w-5 h-5 mr-2 text-orange-400" />
              Download Sports Clip
            </h3>

            <div className="space-y-4">
              <div className="relative">
                <Link className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="text"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="Paste YouTube, Instagram, or TikTok URL..."
                  className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                />
              </div>

              <button
                onClick={handleDownloadVideo}
                disabled={isDownloadingVideo || !videoUrl}
                className="w-full py-3 px-4 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl font-medium hover:from-orange-400 hover:to-red-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {isDownloadingVideo ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Downloading & Processing...
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5 mr-2" />
                    Download & Crop
                  </>
                )}
              </button>
            </div>

            {/* Video Preview */}
            {videoPath && (
              <div className="mt-6">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium text-gray-400">Video Preview</h4>
                  <span className="text-xs text-orange-400 font-mono">
                    Duration: {Math.round(videoDuration)}s
                  </span>
                </div>
                <video
                  ref={videoRef}
                  src={videoPath}
                  controls
                  className="w-full rounded-xl border border-white/10"
                  style={{ maxHeight: '300px' }}
                  onLoadedMetadata={(e) => {
                    const video = e.currentTarget;
                    setVideoDuration(video.duration);
                    console.log(`Video duration: ${video.duration}s`);
                  }}
                />
              </div>
            )}
          </div>

          {/* Music Section - Shows after video download */}
          {showMusicSection && (
            <div className="bg-white/5 rounded-2xl border border-white/10 p-6 animate-fade-in">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                <Music className="w-5 h-5 mr-2 text-purple-400" />
                Add Music
              </h3>

              <div className="space-y-4">
                {/* AI Music Button */}
                <button
                  onClick={handleGetAiSuggestions}
                  disabled={isGettingAiSuggestions || !videoFilename}
                  className="w-full py-3 px-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-medium hover:from-amber-400 hover:to-orange-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isGettingAiSuggestions ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Analyzing Video...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      AI Music Suggestions
                    </>
                  )}
                </button>

                {/* AI Suggestions Dropdown */}
                {showAiSuggestions && aiSuggestions.length > 0 && (
                  <div className="bg-gradient-to-b from-amber-500/10 to-orange-500/10 rounded-xl border border-amber-500/30 p-4 space-y-3 animate-fade-in">
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
                          <div className="text-right ml-3">
                            <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-1 rounded-full">
                              {suggestion.section}
                            </span>
                            <p className="text-gray-500 text-xs mt-1">
                              {suggestion.suggestedStart} - {suggestion.suggestedEnd}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2 text-gray-500 text-sm">
                  <div className="flex-1 h-px bg-white/10"></div>
                  <span>or enter URL manually</span>
                  <div className="flex-1 h-px bg-white/10"></div>
                </div>

                <div className="relative">
                  <Link className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="text"
                    value={musicUrl}
                    onChange={(e) => setMusicUrl(e.target.value)}
                    placeholder="Paste music YouTube URL..."
                    className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  />
                </div>

                <button
                  onClick={handleAnalyzeMusic}
                  disabled={isAnalyzingMusic || !musicUrl}
                  className="w-full py-3 px-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-medium hover:from-purple-400 hover:to-pink-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {isAnalyzingMusic ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      AI Analyzing Music...
                    </>
                  ) : (
                    <>
                      <Music className="w-5 h-5 mr-2" />
                      Find Best Section
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Music Suggestion & Preview */}
        <div className="space-y-6">
          {/* AI Suggestion Display */}
          {musicSuggestion && (
            <div className="bg-white/5 rounded-2xl border border-white/10 p-6 animate-fade-in">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                <CheckCircle2 className="w-5 h-5 mr-2 text-green-400" />
                AI Suggestion
              </h3>

              <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-xl p-4 border border-purple-500/20 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400 text-sm">Best Section:</span>
                  <span className="text-white font-mono font-bold">
                    {musicSuggestion.start} → {musicSuggestion.end}
                  </span>
                </div>
                <p className="text-purple-300 text-sm">{musicSuggestion.reason}</p>
              </div>

              {/* Control Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleAcceptSuggestion}
                  className="flex-1 py-3 px-4 bg-green-500/20 border border-green-500/30 text-green-400 rounded-xl font-medium hover:bg-green-500/30 transition-all flex items-center justify-center"
                >
                  <CheckCircle2 className="w-5 h-5 mr-2" />
                  Accept
                </button>
                <button
                  onClick={handleRejectSuggestion}
                  className="flex-1 py-3 px-4 bg-red-500/20 border border-red-500/30 text-red-400 rounded-xl font-medium hover:bg-red-500/30 transition-all flex items-center justify-center"
                >
                  <XCircle className="w-5 h-5 mr-2" />
                  Reject
                </button>
                <button
                  onClick={handleRegenerateSuggestion}
                  className="flex-1 py-3 px-4 bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 rounded-xl font-medium hover:bg-yellow-500/30 transition-all flex items-center justify-center"
                >
                  <RefreshCw className="w-5 h-5 mr-2" />
                  Retry
                </button>
              </div>
            </div>
          )}

          {/* Audio Preview */}
          {audioPreviewUrl && (
            <div className="bg-white/5 rounded-2xl border border-white/10 p-6 animate-fade-in">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                <Volume2 className="w-5 h-5 mr-2 text-blue-400" />
                Audio Preview
              </h3>

              <audio
                ref={audioRef}
                src={audioPreviewUrl}
                onEnded={() => setIsPreviewPlaying(false)}
                className="hidden"
              />

              <div className="flex items-center gap-4 mb-6">
                <button
                  onClick={toggleAudioPreview}
                  className="w-14 h-14 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center hover:scale-105 transition-transform"
                >
                  {isPreviewPlaying ? (
                    <Pause className="w-6 h-6 text-white" />
                  ) : (
                    <Play className="w-6 h-6 text-white ml-1" />
                  )}
                </button>
                <div>
                  <p className="text-white font-medium">Music Section Ready</p>
                  <p className="text-gray-400 text-sm">
                    {musicSuggestion?.start} - {musicSuggestion?.end}
                  </p>
                </div>
              </div>

              {/* Merge Button */}
              <button
                onClick={handleMerge}
                disabled={isMerging}
                className="w-full py-4 px-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl font-bold text-lg hover:from-green-400 hover:to-emerald-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {isMerging ? (
                  <>
                    <Loader2 className="w-6 h-6 mr-2 animate-spin" />
                    Merging Video & Music...
                  </>
                ) : (
                  <>
                    <Video className="w-6 h-6 mr-2" />
                    Create Final Video
                  </>
                )}
              </button>
            </div>
          )}

          {/* Final Video Preview */}
          {finalVideoPath && (
            <div className="bg-white/5 rounded-2xl border border-white/10 p-6 animate-fade-in">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                <CheckCircle2 className="w-5 h-5 mr-2 text-green-400" />
                Final Video
              </h3>

              <video
                src={finalVideoPath}
                controls
                className="w-full rounded-xl border border-white/10 mb-4"
              />

              <a
                href={finalVideoPath}
                download
                className="w-full py-3 px-4 bg-white/10 border border-white/20 text-white rounded-xl font-medium hover:bg-white/20 transition-all flex items-center justify-center"
              >
                <Download className="w-5 h-5 mr-2" />
                Download Video
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
