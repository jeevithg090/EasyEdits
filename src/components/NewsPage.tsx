import React, { useState, useEffect } from 'react';
import { API_BASE } from '../lib/api';
import {
  ArrowLeft,
  Newspaper,
  Sparkles,
  Loader2,
  AlertCircle,
  X,
  ChevronRight,
  Check,
  RefreshCw,
  Copy,
  Image,
  TrendingUp,
  Clock,
  ExternalLink,
  Zap,
  MessageSquare,
  CheckCircle2,
  Download,
  Layers,
  FileImage,
} from 'lucide-react';

interface NewsPageProps {
  onBack: () => void;
}

interface QAItem {
  question: string;
  options: string[];
  answer: string;
}

interface NewsItem {
  title: string;
  summary: string;
  source: string;
  url: string;
  imageUrl?: string;
  publishedAt: string;
  trendingScore: number;
  isLatest: boolean;
}

interface ImageStyle {
  key: string;
  name: string;
  emoji: string;
  description: string;
}

interface PostFormat {
  key: 'single' | 'slider';
  name: string;
  description: string;
  icon: string;
}

interface GeneratedImage {
  index: number;
  base64: string;
  mimeType: string;
  description: string;
}

interface GeneratedNewsPost {
  format: 'single' | 'slider';
  hookHeadline: string;
  originalHeadline: string;
  summary: string;
  images: GeneratedImage[];
  style: string;
}

const IMAGE_STYLES: ImageStyle[] = [
  {
    key: 'minimalist',
    name: 'Minimalist',
    emoji: '⚪',
    description: 'Clean, simple design with bold text',
  },
  {
    key: 'dramatic',
    name: 'Dramatic',
    emoji: '🎭',
    description: 'High contrast, impactful visuals',
  },
  {
    key: 'infographic',
    name: 'Infographic',
    emoji: '📊',
    description: 'Data-driven visual layout',
  },
  {
    key: 'breaking',
    name: 'Breaking News',
    emoji: '🚨',
    description: 'Urgent, attention-grabbing style',
  },
  { key: 'quote', name: 'Quote Card', emoji: '💬', description: 'Key quote highlighted' },
  { key: 'gradient', name: 'Gradient', emoji: '🌈', description: 'Modern gradient backgrounds' },
];

const POST_FORMATS: PostFormat[] = [
  { key: 'single', name: 'Single Image', description: 'One image with news caption', icon: '🖼️' },
  { key: 'slider', name: 'Image Slider', description: 'Multiple images as carousel', icon: '📱' },
];

export const NewsPage: React.FC<NewsPageProps> = ({ onBack }) => {
  // Questionnaire state
  const [activeSection, setActiveSection] = useState<'questionnaire' | 'news' | 'image-style'>(
    'questionnaire',
  );
  const [conversationHistory, setConversationHistory] = useState<QAItem[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<{
    question: string;
    options: string[];
  } | null>(null);
  const [isLoadingQuestion, setIsLoadingQuestion] = useState(false);
  const [questionCount, setQuestionCount] = useState(0);
  const [niche, setNiche] = useState<string>('');

  // News state
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [isLoadingNews, setIsLoadingNews] = useState(false);
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);

  // Image prompt state
  const [selectedStyle, setSelectedStyle] = useState<string>('minimalist');
  const [selectedFormat, setSelectedFormat] = useState<'single' | 'slider'>('single');
  const [imagePrompt, setImagePrompt] = useState<string>('');
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
  const [isGeneratingPost, setIsGeneratingPost] = useState(false);
  const [generatedPost, setGeneratedPost] = useState<GeneratedNewsPost | null>(null);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [copied, setCopied] = useState(false);

  // UI state
  const [error, setError] = useState<string | null>(null);

  // Start questionnaire on mount
  useEffect(() => {
    startQuestionnaire();
  }, []);

  const startQuestionnaire = async () => {
    setIsLoadingQuestion(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/api/news/start-questionnaire`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json();

      if (data.success) {
        setCurrentQuestion({
          question: data.question,
          options: data.options,
        });
        setQuestionCount(1);
      } else {
        throw new Error(data.error || 'Failed to start questionnaire');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start questionnaire');
    } finally {
      setIsLoadingQuestion(false);
    }
  };

  const handleAnswer = async (answer: string) => {
    if (!currentQuestion) return;

    const newHistory = [
      ...conversationHistory,
      {
        question: currentQuestion.question,
        options: currentQuestion.options,
        answer,
      },
    ];
    setConversationHistory(newHistory);
    setIsLoadingQuestion(true);
    setError(null);

    try {
      // Check if we should finish (after 4 questions)
      if (questionCount >= 4) {
        await finishQuestionnaire(newHistory);
        return;
      }

      const response = await fetch(`${API_BASE}/api/news/next-question`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationHistory: newHistory }),
      });
      const data = await response.json();

      if (data.success) {
        if (data.isComplete) {
          await finishQuestionnaire(newHistory);
        } else {
          setCurrentQuestion({
            question: data.question,
            options: data.options,
          });
          setQuestionCount((prev) => prev + 1);
        }
      } else {
        throw new Error(data.error || 'Failed to get next question');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get next question');
    } finally {
      setIsLoadingQuestion(false);
    }
  };

  const finishQuestionnaire = async (history: QAItem[]) => {
    setIsLoadingQuestion(true);

    try {
      const response = await fetch(`${API_BASE}/api/news/finish-questionnaire`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationHistory: history }),
      });
      const data = await response.json();

      if (data.success) {
        setNiche(data.niche);
        setCurrentQuestion(null);
        // Automatically fetch news
        await fetchNews(data.niche, data.keywords);
      } else {
        throw new Error(data.error || 'Failed to finish questionnaire');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to finish questionnaire');
    } finally {
      setIsLoadingQuestion(false);
    }
  };

  const fetchNews = async (nicheText: string, keywords: string[] = []) => {
    setIsLoadingNews(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/api/news/fetch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ niche: nicheText, keywords }),
      });
      const data = await response.json();

      if (data.success) {
        setNewsItems(data.headlines);
        setActiveSection('news');
      } else {
        throw new Error(data.error || 'Failed to fetch news');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch news');
    } finally {
      setIsLoadingNews(false);
    }
  };

  const handleNewsSelect = (news: NewsItem) => {
    setSelectedNews(news);
    setActiveSection('image-style');
    setImagePrompt('');
  };

  const generateImagePrompt = async () => {
    if (!selectedNews) return;

    setIsGeneratingPrompt(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/api/news/generate-image-prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          headline: selectedNews,
          style: selectedStyle,
        }),
      });
      const data = await response.json();

      if (data.success) {
        setImagePrompt(data.imagePrompt);
      } else {
        throw new Error(data.error || 'Failed to generate prompt');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate prompt');
    } finally {
      setIsGeneratingPrompt(false);
    }
  };

  const copyPrompt = () => {
    navigator.clipboard.writeText(imagePrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const generateImagePost = async () => {
    if (!selectedNews) return;

    setIsGeneratingPost(true);
    setGeneratedPost(null);
    setCurrentSlideIndex(0);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/api/news/generate-image-post`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          headline: selectedNews,
          style: selectedStyle,
          format: selectedFormat,
        }),
      });
      const data = await response.json();

      if (data.success) {
        setGeneratedPost({
          format: data.format,
          hookHeadline: data.hookHeadline,
          originalHeadline: data.originalHeadline,
          summary: data.summary,
          images: data.images,
          style: data.style,
        });
      } else {
        throw new Error(data.error || 'Failed to generate post');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate post');
    } finally {
      setIsGeneratingPost(false);
    }
  };

  const downloadImage = (image: GeneratedImage, index: number) => {
    const link = document.createElement('a');
    link.href = `data:${image.mimeType};base64,${image.base64}`;
    link.download = `news_post_${index + 1}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadAllImages = () => {
    if (!generatedPost) return;
    generatedPost.images.forEach((img, idx) => downloadImage(img, idx));
  };

  const resetFlow = () => {
    setActiveSection('questionnaire');
    setConversationHistory([]);
    setCurrentQuestion(null);
    setQuestionCount(0);
    setNiche('');
    setNewsItems([]);
    setSelectedNews(null);
    setImagePrompt('');
    setGeneratedPost(null);
    setCurrentSlideIndex(0);
    startQuestionnaire();
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
          <Newspaper className="w-10 h-10 mr-3 text-blue-400" />
          News Discovery
          {niche && (
            <span className="ml-3 px-3 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-300 border border-blue-500">
              {niche}
            </span>
          )}
        </h1>
        <p className="text-gray-400 mt-2">
          Discover personalized news with AI and create stunning Instagram posts
        </p>
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

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-center space-x-4">
          {[
            { key: 'questionnaire', label: 'Discover', icon: MessageSquare },
            { key: 'news', label: 'News', icon: Newspaper },
            { key: 'image-style', label: 'Create', icon: Image },
          ].map((step, idx) => {
            const Icon = step.icon;
            const isActive = activeSection === step.key;
            const isComplete =
              (step.key === 'questionnaire' && activeSection !== 'questionnaire') ||
              (step.key === 'news' && activeSection === 'image-style');
            return (
              <React.Fragment key={step.key}>
                {idx > 0 && (
                  <div className={`w-12 h-0.5 ${isComplete ? 'bg-blue-500' : 'bg-gray-700'}`} />
                )}
                <div
                  className={`flex items-center px-4 py-2 rounded-full transition-all ${
                    isActive
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500'
                      : isComplete
                        ? 'bg-green-500/20 text-green-300 border border-green-500'
                        : 'bg-white/5 text-gray-500 border border-transparent'
                  }`}
                >
                  {isComplete ? (
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                  ) : (
                    <Icon className="w-4 h-4 mr-2" />
                  )}
                  <span className="text-sm font-medium">{step.label}</span>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Section 1: Questionnaire */}
      {activeSection === 'questionnaire' && (
        <div className="max-w-2xl mx-auto">
          {/* Conversation History */}
          {conversationHistory.length > 0 && (
            <div className="mb-6 space-y-3">
              {conversationHistory.map((qa, idx) => (
                <div key={idx} className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <p className="text-gray-400 text-sm mb-2">{qa.question}</p>
                  <div className="flex items-center">
                    <Check className="w-4 h-4 text-green-400 mr-2" />
                    <span className="text-white font-medium">{qa.answer}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Current Question */}
          {isLoadingQuestion ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="w-10 h-10 text-blue-400 animate-spin mb-4" />
              <p className="text-gray-400">
                {questionCount === 0 ? 'Starting questionnaire...' : 'Analyzing your interests...'}
              </p>
            </div>
          ) : currentQuestion ? (
            <div className="glass-card rounded-2xl p-6">
              <div className="flex items-center mb-4">
                <Sparkles className="w-5 h-5 text-blue-400 mr-2" />
                <span className="text-blue-300 text-sm font-medium">
                  Question {questionCount} of 4
                </span>
              </div>
              <h3 className="text-xl font-bold text-white mb-6">{currentQuestion.question}</h3>
              <div className="space-y-3">
                {currentQuestion.options.map((option, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleAnswer(option)}
                    className="w-full p-4 rounded-xl bg-white/5 border border-white/10 text-left text-white hover:bg-blue-500/20 hover:border-blue-500 transition-all group flex items-center justify-between"
                  >
                    <span>{option}</span>
                    <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
                  </button>
                ))}
              </div>
            </div>
          ) : isLoadingNews ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="w-10 h-10 text-blue-400 animate-spin mb-4" />
              <p className="text-gray-400">Fetching personalized news...</p>
            </div>
          ) : null}
        </div>
      )}

      {/* Section 2: News Display */}
      {activeSection === 'news' && (
        <div>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <Zap className="w-5 h-5 text-yellow-400 mr-2" />
              <span className="text-white font-semibold">Your Personalized News</span>
              <span className="ml-2 text-gray-400 text-sm">({newsItems.length} articles)</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => fetchNews(niche)}
                className="px-4 py-2 rounded-lg bg-white/5 text-gray-300 hover:bg-white/10 transition-colors flex items-center text-sm"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </button>
              <button
                onClick={resetFlow}
                className="px-4 py-2 rounded-lg bg-white/5 text-gray-300 hover:bg-white/10 transition-colors text-sm"
              >
                New Topic
              </button>
            </div>
          </div>

          {isLoadingNews ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="w-10 h-10 text-blue-400 animate-spin mb-4" />
              <p className="text-gray-400">Loading news...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {newsItems.map((news, idx) => (
                <button
                  key={idx}
                  onClick={() => handleNewsSelect(news)}
                  className="glass-card rounded-2xl p-5 text-left hover:border-blue-500/50 transition-all group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex gap-2">
                      {news.isLatest && (
                        <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-300 text-xs font-medium flex items-center">
                          <Clock className="w-3 h-3 mr-1" />
                          Latest
                        </span>
                      )}
                      {news.trendingScore > 70 && (
                        <span className="px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-300 text-xs font-medium flex items-center">
                          <TrendingUp className="w-3 h-3 mr-1" />
                          Trending
                        </span>
                      )}
                    </div>
                    <ExternalLink className="w-4 h-4 text-gray-500 group-hover:text-blue-400 transition-colors" />
                  </div>
                  <h4 className="text-white font-bold text-lg mb-2 line-clamp-2 group-hover:text-blue-300 transition-colors">
                    {news.title}
                  </h4>
                  <p className="text-gray-400 text-sm line-clamp-2 mb-3">{news.summary}</p>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{news.source}</span>
                    <span>{news.publishedAt}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Section 3: Image Style Selection */}
      {activeSection === 'image-style' && selectedNews && (
        <div className="max-w-3xl mx-auto">
          <button
            onClick={() => setActiveSection('news')}
            className="text-gray-400 hover:text-white text-sm mb-6 flex items-center"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to News
          </button>

          {/* Selected News Preview */}
          <div className="glass-card rounded-2xl p-5 mb-6">
            <h4 className="text-white font-bold text-lg mb-2">{selectedNews.title}</h4>
            <p className="text-gray-400 text-sm">{selectedNews.summary}</p>
          </div>

          {/* Post Format Selection */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
              <Layers className="w-5 h-5 mr-2 text-purple-400" />
              Choose Post Format
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {POST_FORMATS.map((format) => (
                <button
                  key={format.key}
                  onClick={() => setSelectedFormat(format.key)}
                  className={`p-4 rounded-xl transition-all text-left ${
                    selectedFormat === format.key
                      ? 'bg-purple-500/20 border-2 border-purple-500'
                      : 'bg-white/5 border-2 border-transparent hover:bg-white/10'
                  }`}
                >
                  <span className="text-2xl mb-2 block">{format.icon}</span>
                  <span className="text-white font-medium block">{format.name}</span>
                  <span className="text-gray-400 text-xs">{format.description}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Style Selection */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
              <Image className="w-5 h-5 mr-2 text-blue-400" />
              Choose Image Style
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {IMAGE_STYLES.map((style) => (
                <button
                  key={style.key}
                  onClick={() => setSelectedStyle(style.key)}
                  className={`p-4 rounded-xl transition-all text-left ${
                    selectedStyle === style.key
                      ? 'bg-blue-500/20 border-2 border-blue-500'
                      : 'bg-white/5 border-2 border-transparent hover:bg-white/10'
                  }`}
                >
                  <span className="text-2xl mb-2 block">{style.emoji}</span>
                  <span className="text-white font-medium block">{style.name}</span>
                  <span className="text-gray-400 text-xs">{style.description}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Generate News Post Button */}
          <button
            onClick={generateImagePost}
            disabled={isGeneratingPost}
            className="w-full py-4 rounded-xl font-bold transition-all bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:opacity-90 disabled:opacity-50 flex items-center justify-center mb-6"
          >
            {isGeneratingPost ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Generating {selectedFormat === 'slider' ? '4 images' : 'image'}... This may take a
                minute
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 mr-2" />
                Generate News Post
              </>
            )}
          </button>

          {/* Generated Post Preview */}
          {generatedPost && (
            <div className="glass-card rounded-2xl overflow-hidden">
              {/* Hook Headline */}
              <div className="p-4 bg-gradient-to-r from-purple-600/20 to-blue-600/20 border-b border-white/10">
                <p className="text-xs text-purple-300 mb-1">🎣 Hook Headline</p>
                <h3 className="text-xl font-bold text-white">{generatedPost.hookHeadline}</h3>
              </div>

              {/* Image Preview */}
              <div className="relative">
                {generatedPost.images.length > 0 && (
                  <div className="aspect-square bg-gray-900 flex items-center justify-center">
                    <img
                      src={`data:${generatedPost.images[currentSlideIndex].mimeType};base64,${generatedPost.images[currentSlideIndex].base64}`}
                      alt={`Generated post ${currentSlideIndex + 1}`}
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                )}

                {/* Slider Navigation */}
                {generatedPost.format === 'slider' && generatedPost.images.length > 1 && (
                  <>
                    <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
                      {generatedPost.images.map((_, idx) => (
                        <button
                          key={idx}
                          onClick={() => setCurrentSlideIndex(idx)}
                          className={`w-2 h-2 rounded-full transition-all ${
                            idx === currentSlideIndex
                              ? 'bg-white w-6'
                              : 'bg-white/50 hover:bg-white/75'
                          }`}
                        />
                      ))}
                    </div>
                    <button
                      onClick={() => setCurrentSlideIndex((prev) => Math.max(0, prev - 1))}
                      disabled={currentSlideIndex === 0}
                      className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white disabled:opacity-30"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() =>
                        setCurrentSlideIndex((prev) =>
                          Math.min(generatedPost.images.length - 1, prev + 1),
                        )
                      }
                      disabled={currentSlideIndex === generatedPost.images.length - 1}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white disabled:opacity-30"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </>
                )}
              </div>

              {/* Actions */}
              <div className="p-4 border-t border-white/10 flex gap-3">
                <button
                  onClick={() =>
                    downloadImage(generatedPost.images[currentSlideIndex], currentSlideIndex)
                  }
                  className="flex-1 py-3 rounded-xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:opacity-90 flex items-center justify-center"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download{' '}
                  {generatedPost.format === 'slider' ? `Image ${currentSlideIndex + 1}` : 'Image'}
                </button>
                {generatedPost.format === 'slider' && (
                  <button
                    onClick={downloadAllImages}
                    className="px-4 py-3 rounded-xl font-bold bg-white/10 text-white hover:bg-white/20 flex items-center"
                  >
                    <FileImage className="w-4 h-4 mr-2" />
                    All ({generatedPost.images.length})
                  </button>
                )}
              </div>

              {/* Caption for Copy */}
              <div className="p-4 bg-black/20 border-t border-white/10">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs text-gray-400">📝 Detailed News Caption for Instagram</p>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(generatedPost.summary);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:opacity-90 text-xs flex items-center font-medium"
                  >
                    {copied ? (
                      <Check className="w-3 h-3 mr-1" />
                    ) : (
                      <Copy className="w-3 h-3 mr-1" />
                    )}
                    {copied ? 'Copied!' : 'Copy Caption'}
                  </button>
                </div>
                <div className="max-h-64 overflow-y-auto bg-black/30 rounded-lg p-3">
                  <pre className="text-gray-300 text-sm whitespace-pre-wrap font-sans leading-relaxed">
                    {generatedPost.summary}
                  </pre>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  ✨ AI-generated news caption with hook, key points, and hashtags
                </p>
              </div>
            </div>
          )}

          {/* Legacy: Generate Prompt Button (kept for backward compatibility) */}
          {!generatedPost && (
            <div className="mt-6 pt-6 border-t border-white/10">
              <p className="text-gray-500 text-sm mb-3 text-center">
                Or generate a prompt to use elsewhere:
              </p>
              <button
                onClick={generateImagePrompt}
                disabled={isGeneratingPrompt}
                className="w-full py-3 rounded-xl font-medium transition-all bg-white/5 text-gray-300 hover:bg-white/10 disabled:opacity-50 flex items-center justify-center"
              >
                {isGeneratingPrompt ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>Generate Prompt Only</>
                )}
              </button>
            </div>
          )}

          {/* Generated Prompt (legacy) */}
          {imagePrompt && !generatedPost && (
            <div className="glass-card rounded-2xl p-5 mt-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-white font-semibold flex items-center">
                  <Sparkles className="w-4 h-4 mr-2 text-purple-400" />
                  Generated Prompt
                </h4>
                <button
                  onClick={copyPrompt}
                  className="px-3 py-1.5 rounded-lg bg-white/10 text-gray-300 hover:bg-white/20 transition-colors flex items-center text-sm"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 mr-1 text-green-400" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-1" />
                      Copy
                    </>
                  )}
                </button>
              </div>
              <p className="text-gray-300 text-sm leading-relaxed bg-black/30 rounded-lg p-4">
                {imagePrompt}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
