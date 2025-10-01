import React, { useState, useEffect } from 'react';
import { X, Send, Loader2, Sparkles, Code, Lightbulb, Bug, Zap } from 'lucide-react';
import { FileType } from '../types';
import { callAIAssistantDirect } from '../api/ai-assistant';
import WebXRideAIAssistant from './WebXRideAIAssistant';

interface AIAssistantProps {
  open: boolean;
  onClose: () => void;
  code: string;
  language: FileType;
  fileName?: string;
  onApplySuggestion?: (suggestion: string) => void;
}

interface AIResponse {
  suggestion: string;
  explanation: string;
  confidence: number;
}

const AIAssistant: React.FC<AIAssistantProps> = ({
  open,
  onClose,
  code,
  language,
  fileName,
  onApplySuggestion
}) => {
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState<AIResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [intention, setIntention] = useState<'fix' | 'optimize' | 'brainstorm' | 'explain'>('fix');

  // Map intentions to temperature and prompt styles
  const intentionConfig = {
    fix: { temperature: 0.1, label: '🐛 Fix Bugs', description: 'Precise fixes, low creativity' },
    optimize: { temperature: 0.2, label: '⚡ Optimize', description: 'Performance improvements' },
    explain: { temperature: 0.3, label: '📚 Explain', description: 'Clear explanations' },
    brainstorm: { temperature: 0.7, label: '💡 Brainstorm', description: 'Creative ideas, high creativity' }
  };

  // Handle Escape key to close modal
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && open) {
        onClose();
      }
    };

    if (open) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [open, onClose]);

  const quickPrompts = [
    {
      icon: <Bug className="w-4 h-4 text-gray-700" />,
      text: "Fix bugs and errors",
      prompt: "Please review this code and identify any bugs, errors, or potential issues. Provide fixes and explanations.",
      intention: 'fix' as const
    },
    {
      icon: <Zap className="w-4 h-4 text-gray-700" />,
      text: "Optimize performance",
      prompt: "Please analyze this code for performance improvements and optimization opportunities. Suggest specific changes.",
      intention: 'optimize' as const
    },
    {
      icon: <Lightbulb className="w-4 h-4 text-gray-700" />,
      text: "Add new features",
      prompt: "Please suggest how to add new features or functionality to this code. Provide code examples and implementation details.",
      intention: 'brainstorm' as const
    },
    {
      icon: <Code className="w-4 h-4 text-gray-700" />,
      text: "Improve code quality",
      prompt: "Please review this code and suggest improvements for readability, maintainability, and best practices.",
      intention: 'explain' as const
    }
  ];

  const handleSubmit = async (customPrompt?: string) => {
    const prompt = customPrompt || query;
    if (!prompt.trim()) return;

    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      const data = await callAIAssistantDirect({
        code,
        language: language.toLowerCase(),
        fileName,
        prompt,
        context: 'WebXR development with A-Frame, Three.js, and modern web technologies',
        temperature: intentionConfig[intention].temperature
      });
      setResponse(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get AI response');
      console.error('AI Assistant error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickPrompt = (prompt: string, intention?: 'fix' | 'optimize' | 'brainstorm' | 'explain') => {
    if (intention) {
      setIntention(intention);
    }
    setQuery(prompt);
    handleSubmit(prompt);
  };

  const handleApplySuggestion = () => {
    if (response?.suggestion && onApplySuggestion) {
      // If the suggestion looks like a complete file replacement (contains <!DOCTYPE or <html>),
      // warn the user and ask for confirmation
      if (response.suggestion.includes('<!DOCTYPE') || response.suggestion.includes('<html')) {
        const confirmReplace = window.confirm(
          'This suggestion appears to be a complete file replacement. This will replace your entire code. Are you sure you want to continue?'
        );
        if (!confirmReplace) {
          return;
        }
      }
      
      onApplySuggestion(response.suggestion);
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-5/6 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <WebXRideAIAssistant 
              isThinking={loading}
              isHappy={!!response && !error}
              isConfused={!!error}
              size={40}
            />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Ridey · WebXRide AI Assistant</h2>
              <span className="text-sm text-gray-500">
                {language} {fileName && `• ${fileName}`}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded text-gray-600 hover:text-gray-900"
            title="Close AI Assistant"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Intention Selector */}
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h3 className="text-sm font-medium text-gray-700 mb-2">What would you like Ridey to do?</h3>
          <div className="flex space-x-2">
            {Object.entries(intentionConfig).map(([key, config]) => (
              <button
                key={key}
                onClick={() => setIntention(key as keyof typeof intentionConfig)}
                className={`px-3 py-2 text-sm rounded-md border transition-colors ${
                  intention === key
                    ? 'bg-purple-100 border-purple-300 text-purple-800'
                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
                title={config.description}
              >
                {config.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {intentionConfig[intention].description} (Temperature: {intentionConfig[intention].temperature})
          </p>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel - Code Preview */}
          <div className="w-1/2 border-r border-gray-200 flex flex-col">
            <div className="p-3 bg-gray-50 border-b border-gray-200">
              <h3 className="text-sm font-medium text-gray-700">Current Code</h3>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <pre className="text-sm text-gray-800 whitespace-pre-wrap font-mono">
                {code}
              </pre>
            </div>
          </div>

          {/* Right Panel - AI Interaction */}
          <div className="w-1/2 flex flex-col">
            {/* Quick Prompts */}
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Quick Actions</h3>
              <div className="grid grid-cols-2 gap-2">
                {quickPrompts.map((prompt, index) => (
                  <button
                    key={index}
                    onClick={() => handleQuickPrompt(prompt.prompt, prompt.intention)}
                    className="flex items-center space-x-2 p-2 text-left text-sm text-gray-900 bg-gray-50 hover:bg-gray-100 rounded border"
                    disabled={loading}
                  >
                    {prompt.icon}
                    <span>{prompt.text}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Query Input */}
            <div className="p-4 border-b border-gray-200">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Ask AI to help with your code..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  onKeyPress={(e) => e.key === 'Enter' && handleSubmit()}
                  disabled={loading}
                />
                <button
                  onClick={() => handleSubmit()}
                  disabled={loading || !query.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  <span>Ask</span>
                </button>
              </div>
            </div>

            {/* Response Area */}
            <div className="flex-1 overflow-auto p-4">
              {loading && (
                <div className="flex items-center justify-center h-32">
                  <div className="text-center">
                    <WebXRideAIAssistant 
                      isThinking={true}
                      size={60}
                      className="mx-auto mb-3"
                    />
                    <p className="text-sm text-gray-600">Analyzing your code...</p>
                    <p className="text-xs text-gray-400 mt-1">This might take a moment</p>
                  </div>
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-md p-4">
                  <h4 className="text-sm font-medium text-red-800 mb-2">Error</h4>
                  <p className="text-sm text-red-700">{error}</p>
                  <div className="mt-2 text-xs text-red-600">
                    <p>Common solutions:</p>
                    <ul className="list-disc list-inside mt-1">
                      <li>Check if your OpenAI API key is set correctly</li>
                      <li>Verify you have internet connection</li>
                      <li>Check browser console for more details</li>
                    </ul>
                  </div>
                </div>
              )}

              {response && (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                    <h4 className="text-sm font-medium text-blue-800 mb-2">AI Suggestion</h4>
                    <pre className="text-sm text-blue-700 whitespace-pre-wrap font-mono">
                      {response.suggestion}
                    </pre>
                  </div>

                  <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
                    <h4 className="text-sm font-medium text-gray-800 mb-2">Explanation</h4>
                    <p className="text-sm text-gray-700">{response.explanation}</p>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="text-xs text-gray-500">
                      Confidence: {Math.round(response.confidence * 100)}%
                    </div>
                    <button
                      onClick={handleApplySuggestion}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
                    >
                      Apply Suggestion
                    </button>
                  </div>
                </div>
              )}

              {!loading && !error && !response && (
                <div className="text-center text-gray-500 mt-8">
                  <WebXRideAIAssistant 
                    isHappy={true}
                    size={80}
                    className="mx-auto mb-4"
                  />
                  <p className="text-sm font-medium text-gray-700 mb-2">Hi! I'm Ridey, your WebXRide AI Assistant</p>
                  <p className="text-sm text-gray-500 mb-1">I can help you with:</p>
                  <ul className="text-xs text-gray-400 space-y-1">
                    <li>• Fixing bugs and errors in your code</li>
                    <li>• Optimizing performance for WebXR</li>
                    <li>• Adding new features and functionality</li>
                    <li>• Improving code quality and best practices</li>
                  </ul>
                  <p className="text-xs text-gray-400 mt-3">
                    Try one of the quick actions above or type your own question!
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIAssistant;
