import React, { useState } from 'react';
import { ContentCategory, ScriptData } from '../types';
import { generateVideoScript, generateConceptImage } from '../services/generatorApi';
import { getErrorMessage } from '../lib/api';
import { Button } from './Button';
import { Sparkles, Copy, RefreshCw, ImageIcon, FileText, Download, AlertCircle } from 'lucide-react';

interface GeneratorProps {
  category: ContentCategory;
  onBack: () => void;
}

export const Generator: React.FC<GeneratorProps> = ({ category, onBack }) => {
  const [topic, setTopic] = useState('');
  const [tone, setTone] = useState('Energetic');
  const [isGenerating, setIsGenerating] = useState(false);
  const [scriptData, setScriptData] = useState<ScriptData | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isImageGenerating, setIsImageGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<'script' | 'visuals'>('script');
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    setError(null);
    setIsGenerating(true);
    setScriptData(null);
    setGeneratedImage(null);
    try {
      const data = await generateVideoScript(category, topic, tone);
      setScriptData(data);
    } catch (error) {
      setError(getErrorMessage(error, 'Failed to generate script. Please try again.'));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateImage = async () => {
    if (!scriptData) return;
    setError(null);
    setIsImageGenerating(true);
    try {
      const image = await generateConceptImage(`${scriptData.title} - ${scriptData.visual_cues[0]}`);
      setGeneratedImage(image);
    } catch (error) {
      setError(getErrorMessage(error, 'Failed to generate image.'));
    } finally {
      setIsImageGenerating(false);
    }
  };

  const tones = ['Energetic', 'Professional', 'Funny', 'Emotional', 'Educational', 'Controversial', 'Chill'];

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
            {category} Generator
            <span className="ml-3 px-2 py-1 rounded text-xs font-medium bg-brand-500/20 text-brand-300 border border-brand-500/20">AI Powered</span>
          </h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Input Section */}
        <div className="lg:col-span-4 space-y-6">
          <div className="glass-card p-6 rounded-2xl">
            <label htmlFor="generator-topic" className="block text-sm font-medium text-gray-300 mb-2">
              What's your video about?
            </label>
            <textarea
              id="generator-topic"
              maxLength={500}
              className="w-full bg-black/40 border border-gray-700 rounded-xl p-4 text-white placeholder-gray-500 focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all resize-none h-32"
              placeholder={`e.g., Top 5 tools for ${category.toLowerCase()}...`}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
            
            <label className="block text-sm font-medium text-gray-300 mt-6 mb-2">
              Select Tone
            </label>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Tone">
              {tones.map(t => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={tone === t}
                  onClick={() => setTone(t)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    tone === t 
                      ? 'bg-brand-500 text-white' 
                      : 'bg-white/5 text-gray-400 hover:bg-white/10'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            <Button 
              className="w-full mt-8" 
              onClick={handleGenerate} 
              isLoading={isGenerating}
              disabled={!topic.trim()}
              icon={<Sparkles className="w-5 h-5" />}
            >
              Generate Magic
            </Button>

            {error && (
              <div
                role="alert"
                className="mt-4 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Tips Card */}
          <div className="p-6 rounded-2xl border border-dashed border-gray-800 bg-black/20">
            <h3 className="text-gray-400 font-medium mb-2 text-sm uppercase tracking-wider">Pro Tips</h3>
            <ul className="text-sm text-gray-500 space-y-2 list-disc list-inside">
              <li>Be specific about your niche</li>
              <li>Mention your target audience</li>
              <li>Include key keywords for better SEO hashtags</li>
            </ul>
          </div>
        </div>

        {/* Output Section */}
        <div className="lg:col-span-8">
          {!scriptData ? (
            <div className="h-full min-h-[500px] flex flex-col items-center justify-center glass-card rounded-2xl p-12 text-center border-dashed border-2 border-gray-800">
              <div className="w-20 h-20 rounded-full bg-gray-900 flex items-center justify-center mb-6">
                <Sparkles className="w-10 h-10 text-gray-700" />
              </div>
              <h3 className="text-xl font-medium text-gray-300 mb-2">Ready to Create?</h3>
              <p className="text-gray-500 max-w-md">
                Enter your topic on the left and hit generate. We'll craft the perfect script, hooks, and visual direction for you.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Tabs */}
              <div className="flex space-x-2 border-b border-gray-800 pb-1">
                <button
                  onClick={() => setActiveTab('script')}
                  className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors flex items-center ${
                    activeTab === 'script' ? 'text-brand-400 border-b-2 border-brand-400 bg-brand-500/5' : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Script & Plan
                </button>
                <button
                  onClick={() => setActiveTab('visuals')}
                  className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors flex items-center ${
                    activeTab === 'visuals' ? 'text-brand-400 border-b-2 border-brand-400 bg-brand-500/5' : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <ImageIcon className="w-4 h-4 mr-2" />
                  Visual Concepts
                </button>
              </div>

              <div className="animate-fade-in">
                {activeTab === 'script' ? (
                  <div className="space-y-6">
                    {/* Title & Stats */}
                    <div className="glass-card rounded-xl p-6">
                       <h2 className="text-2xl font-bold text-white mb-2">{scriptData.title}</h2>
                       <div className="flex gap-2 mt-4 flex-wrap">
                         {scriptData.hashtags.map((tag, i) => (
                           <span key={i} className="text-xs text-brand-300 bg-brand-500/10 px-2 py-1 rounded-md border border-brand-500/20">
                             #{tag}
                           </span>
                         ))}
                       </div>
                    </div>

                    {/* The Hook */}
                    <div className="relative group glass-card p-6 rounded-xl border-l-4 border-brand-500">
                       <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button className="text-gray-400 hover:text-white" title="Copy"><Copy className="w-4 h-4"/></button>
                       </div>
                       <h3 className="text-sm font-semibold text-brand-400 uppercase tracking-wide mb-2">The Hook (0-3s)</h3>
                       <p className="text-lg text-white font-medium leading-relaxed">"{scriptData.hook}"</p>
                    </div>

                    {/* The Body */}
                    <div className="relative group glass-card p-6 rounded-xl">
                       <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-2">Script Body</h3>
                       <p className="text-gray-200 whitespace-pre-line leading-relaxed">{scriptData.script_body}</p>
                    </div>

                    {/* CTA */}
                    <div className="relative group glass-card p-6 rounded-xl border-l-4 border-purple-500">
                       <h3 className="text-sm font-semibold text-purple-400 uppercase tracking-wide mb-2">Call to Action</h3>
                       <p className="text-lg text-white font-medium">"{scriptData.cta}"</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Visual Cues */}
                    <div className="glass-card p-6 rounded-xl">
                      <h3 className="text-lg font-semibold text-white mb-4">Recommended B-Roll</h3>
                      <ul className="space-y-3">
                        {scriptData.visual_cues.map((cue, idx) => (
                          <li key={idx} className="flex items-start text-gray-300 bg-black/20 p-3 rounded-lg">
                            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-900 text-brand-300 flex items-center justify-center text-xs font-bold mr-3 mt-0.5">
                              {idx + 1}
                            </span>
                            {cue}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Concept Art Generator */}
                    <div className="glass-card p-6 rounded-xl">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-white">AI Concept Art</h3>
                        <Button 
                          variant="secondary" 
                          onClick={handleGenerateImage} 
                          isLoading={isImageGenerating}
                          className="!py-2 !px-4 text-sm"
                          icon={<RefreshCw className={`w-4 h-4 ${isImageGenerating ? 'animate-spin' : ''}`} />}
                        >
                          Generate Thumbnail
                        </Button>
                      </div>

                      <div className="aspect-video w-full bg-black/40 rounded-xl overflow-hidden flex items-center justify-center border border-gray-800">
                        {isImageGenerating ? (
                           <div className="flex flex-col items-center">
                              <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                              <p className="text-gray-400 text-sm animate-pulse">Designing concept art...</p>
                           </div>
                        ) : generatedImage ? (
                          <div className="relative w-full h-full group">
                            <img src={generatedImage} alt="AI Generated Concept" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                               <a href={generatedImage} download="concept-art.png" className="px-4 py-2 bg-white text-black rounded-lg font-medium flex items-center hover:bg-gray-200">
                                 <Download className="w-4 h-4 mr-2" /> Download
                               </a>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center p-8">
                            <ImageIcon className="w-12 h-12 text-gray-700 mx-auto mb-3" />
                            <p className="text-gray-500 text-sm">Click generate to create a visual concept based on your script.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};