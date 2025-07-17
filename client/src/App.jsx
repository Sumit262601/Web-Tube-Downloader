import React, { useState, useEffect } from 'react';
import {
  Download,
  Video,
  Music,
  Settings,
  AlertCircle,
  CheckCircle,
  Loader,
  Play
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { Footer } from './components/Footer';

const API_BASE = 'http://127.0.0.1:5000/api';

const validateYouTubeUrl = (url) => {
  const regex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/;
  return regex.test(url);
};

const formatOptions = [
  { value: 'mp4', label: 'MP4 (Video)', icon: Video },
  { value: 'mp3', label: 'MP3 (Audio)', icon: Music },
  { value: 'webm', label: 'WebM (Video)', icon: Video }
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
  const [isDetecting, setIsDetecting] = useState(false);
  const [status, setStatus] = useState('');
  const [error, seterror] = useState('');
  const [videoInfo, setVideoInfo] = useState(null);
  const [showDownloadOptions, setShowDownloadOptions] = useState(false);

  useEffect(() => {
    const detectVideo = async () => {
      if (!url || !validateYouTubeUrl(url)) {
        setVideoInfo(null);
        setShowDownloadOptions(false);
        seterror('');
        return;
      }

      setIsDetecting(true);
      seterror('');
      setStatus('Detecting video...');

      try {
        const res = await fetch(`${API_BASE}/info`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url })
        });

        const data = await res.json();

        if (data.error) {
          toast.error(data.error);
          setVideoInfo(null);
          setShowDownloadOptions(false);
          return;
        }

        setVideoInfo({
          id: data.id,
          thumbnail: `${API_BASE}/thumbnail/${data.id}`,
          title: data.title,
          duration: `${Math.floor(data.duration / 60)}:${String(data.duration % 60).padStart(2, '0')}`,
          views: `${data.views} views`
        });

        setShowDownloadOptions(true);
        toast.success('Video detected successfully!');
        setStatus('');
      } catch (error) {
        toast.error(`Failed to detect video: ${error.message}`);
        setVideoInfo(null);
        setShowDownloadOptions(false);
      } finally {
        setIsDetecting(false);
      }
    };

    const timeoutId = setTimeout(detectVideo, 800);
    return () => clearTimeout(timeoutId);
  }, [url]);

  const handleUrlChange = (e) => {
    const newUrl = e.target.value;
    setUrl(newUrl);
    setStatus('');
  };

  const handleDownload = async () => {
    if (!url || !validateYouTubeUrl(url)) {
      toast.error('Please enter a valid YouTube URL');
      return;
    }

    setIsLoading(true);
    setStatus('Preparing download...');
    seterror('');

    try {
      const res = await fetch(`${API_BASE}/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, format, quality })
      });

      if (!res.ok) throw new error('Download failed');

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `video.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();

      toast.success('Download completed successfully!');
      setStatus('');
    } catch (error) {
      toast.error(`Download failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 p-4">
      <Toaster position="top-center" reverseOrder={false} />
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 bg-red-600 rounded-full">
              <Download className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-gray-800">NextTube - YouTube Downloader</h1>
          </div>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Paste the YouTube URL and download in your preferrored format.
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
                placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 pr-12"
              />
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                {isDetecting ? (
                  <Loader className="w-5 h-5 text-blue-500 animate-spin" />
                ) : url && validateYouTubeUrl(url) && videoInfo ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : url && validateYouTubeUrl(url) ? (
                  <Loader className="w-5 h-5 text-blue-500 animate-spin" />
                ) : url && (
                  <AlertCircle className="w-5 h-5 text-red-500" />
                )}
              </div>
            </div>
          </div>

          {/* Video Preview */}
          {videoInfo && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg border-2 border-green-200">
              <div className="flex gap-4">
                <div className="relative">
                  <img
                    src={videoInfo.thumbnail}
                    alt="Video thumbnail"
                    className="w-40 h-28 object-cover rounded-lg"
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="bg-black bg-opacity-50 rounded-full p-2">
                      <Play className="w-6 h-6 text-white" />
                    </div>
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-800 mb-2 text-lg">{videoInfo.title}</h3>
                  <p className="text-sm text-gray-600 mb-1">Duration: {videoInfo.duration}</p>
                  <p className="text-sm text-gray-600">{videoInfo.views}</p>
                </div>
              </div>
            </div>
          )}

          {/* Download Options */}
          {showDownloadOptions && videoInfo && (
            <div className="space-y-6 border-t pt-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Download Options</h3>

              {/* Format Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Format</label>
                <div className="grid grid-cols-3 gap-3">
                  {formatOptions.map((option) => {
                    const IconComponent = option.icon;
                    return (
                      <button
                        key={option.value}
                        onClick={() => setFormat(option.value)}
                        className={`p-3 rounded-lg border-2 transition-colors flex items-center justify-center gap-2 ${format === option.value
                          ? 'border-red-500 bg-red-50 text-red-700'
                          : 'border-gray-200 hover:border-gray-300'
                          }`}
                      >
                        <IconComponent className="w-4 h-4" />
                        <span className="text-sm font-medium">{option.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Quality Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Quality</label>
                <div className="grid grid-cols-3 gap-3">
                  {qualityOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setQuality(option.value)}
                      className={`p-3 rounded-lg border-2 transition-colors ${quality === option.value
                        ? 'border-red-500 bg-red-50 text-red-700'
                        : 'border-gray-200 hover:border-gray-300'
                        }`}
                    >
                      <span className="text-sm font-medium">{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Download Button */}
              <button
                onClick={handleDownload}
                disabled={isLoading}
                className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-semibold py-4 px-6 rounded-lg transition-colors flex items-center justify-center gap-3 text-lg"
              >
                {isLoading ? (
                  <>
                    <Loader className="w-5 h-5 animate-spin" />
                    {status || 'Processing...'}
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5" />
                    Download {format.toUpperCase()} - {quality}
                  </>
                )}
              </button>
            </div>
          )}

          {/* No Video Message */}
          {!videoInfo && !isDetecting && (
            <div className="text-center py-8 text-gray-500">
              <Video className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <p className="text-lg mb-2">Paste a YouTube URL to get started</p>
              <p className="text-sm">The video will be automatically detected and download options will appear</p>
            </div>
          )}
        </div>

        {/* Features Section */}
        <div className="grid grid-cols-1 md:grid-cols-1 gap-6 mb-8">
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
            <h3 className="font-semibold text-gray-800 mb-2">Auto Detection</h3>
            <p className="text-sm text-gray-600">Automatically detects video info when URL is pasted</p>
          </div>
        </div>
      </div>
      {/* Footer */}
      <Footer />
    </div>
  );
};

export default YouTubeDownloader;
