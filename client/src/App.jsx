import React, { useState } from 'react';
import {
  Download,
  Video,
  Music,
  Settings,
  AlertCircle,
  CheckCircle,
  Loader
} from 'lucide-react';

const API_BASE = 'http://localhost:5000/api';

const validateYouTubeUrl = (url) => {
  const regex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/;
  return regex.test(url);
};

const formatOptions = [
  { value: 'mp4', label: 'MP4 (Video)' },
  { value: 'mp3', label: 'MP3 (Audio)' },
  { value: 'webm', label: 'WebM (Video)' }
];

const qualityOptions = [
  { value: '144p', label: '144p' },
  { value: '360p', label: '360p' },
  { value: '720p', label: '720p' },
  { value: '1080p', label: '1080p' },
  { value: '1440p 2k', label: '1440p 2K' },
  { value: '2160p 4k', label: '2160p 4K' },
];

const YouTubeDownloader = () => {
  const [url, setUrl] = useState('');
  const [format, setFormat] = useState('mp4');
  const [quality, setQuality] = useState('1080p');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [videoInfo, setVideoInfo] = useState(null);

  const handleUrlChange = async (e) => {
    const newUrl = e.target.value;
    setUrl(newUrl);
    setError('');

    if (!newUrl || !validateYouTubeUrl(newUrl)) {
      setVideoInfo(null);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: newUrl })
      });

      const data = await res.json();

      if (data.error) {
        setError(data.error);
        setVideoInfo(null);
        return;
      }

      setVideoInfo({
        id: data.id,
        thumbnail: `${API_BASE}/thumbnail/${data.id}`,
        title: data.title,
        duration: `${Math.floor(data.duration / 60)}:${String(data.duration % 60).padStart(2, '0')}`,
        views: `${data.views} views`
      });
    } catch (err) {
      setError(`Failed to fetch video info: ${err.message}`);
      setVideoInfo(null);
    }
  };

  const handleDownload = async () => {
    if (!url || !validateYouTubeUrl(url)) {
      setError('Please enter a valid YouTube URL');
      return;
    }

    setIsLoading(true);
    setStatus('Preparing download...');
    setError('');

    try {
      const res = await fetch(`${API_BASE}/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, format, quality })
      });

      if (!res.ok) throw new Error('Download failed');

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `video.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      setError(`Download failed: ${err.message}`);
    } finally {
      setIsLoading(false);
      setStatus('');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 bg-red-600 rounded-full">
              <Download className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-gray-800">YouTube Downloader</h1>
          </div>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Paste the YouTube URL and download in your preferred format.
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
          {/* URL Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              YouTube URL
            </label>
            <div className="relative">
              <input
                type="url"
                value={url}
                onChange={handleUrlChange}
                placeholder="https://www.youtube.com/watch?v=..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 pr-12"
              />
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                {url && validateYouTubeUrl(url) ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : url && (
                  <AlertCircle className="w-5 h-5 text-red-500" />
                )}
              </div>
            </div>
            {error && (
              <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {error}
              </p>
            )}
          </div>

          {/* Video Preview */}
          {videoInfo && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <div className="flex gap-4">
                <img
                  src={videoInfo.thumbnail}
                  alt="Video thumbnail"
                  className="w-32 h-24 object-cover rounded-lg"
                />
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-800 mb-1">{videoInfo.title}</h3>
                  <p className="text-sm text-gray-600">Duration: {videoInfo.duration}</p>
                  <p className="text-sm text-gray-600">{videoInfo.views}</p>
                </div>
              </div>
            </div>
          )}

          {/* Format Selector */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Format</label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
            >
              {formatOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Quality Selector */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Quality</label>
            <select
              value={quality}
              onChange={(e) => setQuality(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
            >
              {qualityOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Download Button */}
          <button
            onClick={handleDownload}
            disabled={isLoading || !url || !validateYouTubeUrl(url)}
            className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-semibold py-4 px-6 rounded-lg transition-colors flex items-center justify-center gap-3"
          >
            {isLoading ? (
              <>
                <Loader className="w-5 h-5 animate-spin" />
                {status || 'Processing...'}
              </>
            ) : (
              <>
                <Download className="w-5 h-5" />
                Download Video
              </>
            )}
          </button>
        </div>
      </div>

      {/* Features Section - Single Column */}
      <div className="grid grid-cols-1 gap-6 mb-8">
        <div className="bg-white rounded-lg p-6 text-center">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Video className="w-6 h-6 text-red-600" />
          </div>
          <h3 className="font-semibold text-gray-800 mb-2">Multiple Formats</h3>
          <p className="text-sm text-gray-600">Download in MP4, WebM, MP3, and more formats</p>
        </div>

        <div className="bg-white rounded-lg p-6 text-center">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Settings className="w-6 h-6 text-red-600" />
          </div>
          <h3 className="font-semibold text-gray-800 mb-2">Quality Options</h3>
          <p className="text-sm text-gray-600">Choose from 144p to 4K resolution</p>
        </div>

        <div className="bg-white rounded-lg p-6 text-center">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Download className="w-6 h-6 text-red-600" />
          </div>
          <h3 className="font-semibold text-gray-800 mb-2">Fast & Secure</h3>
          <p className="text-sm text-gray-600">Quick processing with secure downloads</p>
        </div>
      </div>
    </div>
  );
};

export default YouTubeDownloader;
