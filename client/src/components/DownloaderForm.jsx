import React, { useState } from 'react';
import { Download, Video, Music, Loader, CheckCircle, AlertCircle, PlayCircle, Eye, Calendar, User, Wifi, WifiOff } from 'lucide-react';

const DownloaderForm = () => {
  const [url, setUrl] = useState('');
  const [videoInfo, setVideoInfo] = useState(null);
  const [quality, setQuality] = useState('');
  const [format, setFormat] = useState('mp4');
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loadingInfo, setLoadingInfo] = useState(false);
  const [downloadType, setDownloadType] = useState('single');
  const [maxItems, setMaxItems] = useState(10);
  const [serverStatus, setServerStatus] = useState('unknown');

  // Try multiple API endpoints - user should replace with their actual backend URL
  const API_ENDPOINTS = [
    'http://localhost:5000/api',
  ];

  let currentApiBase = API_ENDPOINTS[0];

  // Format options with icons
  const formatOptions = {
    video: [
      { value: 'mp4', label: 'MP4 (Video)', icon: Video },
      { value: 'webm', label: 'WebM (Video)', icon: Video },
      { value: 'mkv', label: 'MKV (Video)', icon: Video },
    ],
    audio: [
      { value: 'mp3', label: 'MP3 (Audio)', icon: Music },
      { value: 'wav', label: 'WAV (Audio)', icon: Music },
      { value: 'aac', label: 'AAC (Audio)', icon: Music },
      { value: 'm4a', label: 'M4A (Audio)', icon: Music },
    ]
  };

  // Quality options with enhanced labels
  const getResolutionOptions = () => {
    return [
      { value: '2160p', label: '2160p (4K)' },
      { value: '1440p', label: '1440p (2K)' },
      { value: '1080p', label: '1080p (HD)' },
      { value: '720p', label: '720p' },
      { value: '480p', label: '480p' },
      { value: '360p', label: '360p' },
      { value: '240p', label: '240p' },
      { value: '144p', label: '144p' }
    ];
  };

  // Enhanced URL validation
  const isYouTubeUrl = (url) => {
    const videoRegex = /^(https?:\/\/)?(www\.)?(m\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[A-Za-z0-9_-]{11}.*$/;
    const playlistRegex = /^(https?:\/\/)?(www\.)?(m\.)?(youtube\.com\/playlist\?list=)[A-Za-z0-9_-]+.*$/;
    return videoRegex.test(url) || playlistRegex.test(url);
  };

  // Check server connectivity
  const checkServerStatus = async () => {
    for (const endpoint of API_ENDPOINTS) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout

        const response = await fetch(`${endpoint}/health`, {
          method: 'GET',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
          }
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          currentApiBase = endpoint;
          setServerStatus('connected');
          return true;
        }
      } catch (error) {
        console.log(`Failed to connect to ${endpoint}:`, error.message);
      }
    }

    setServerStatus('disconnected');
    return false;
  };

  // Utility functions
  const clearMessages = () => {
    setError('');
    setSuccess('');
  };

  const formatDuration = (seconds) => {
    if (!seconds) return 'N/A';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const formatNumber = (num) => {
    if (!num) return 'N/A';
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const year = dateString.substring(0, 4);
    const month = dateString.substring(4, 6);
    const day = dateString.substring(6, 8);
    return `${day}/${month}/${year}`;
  };

  const getQualityLabel = (qualityValue) => {
    const qualityMap = {
      '144p': '144p',
      '240p': '240p',
      '360p': '360p',
      '480p': '480p',
      '720p': '720p',
      '1080p': '1080p (HD)',
      '1440p': '1440p (2K)',
      '2160p': '2160p (4K)',
    };
    return qualityMap[qualityValue] || qualityValue;
  };

  // Handle URL change with auto-fetch
  const handleUrlChange = (e) => {
    const value = e.target.value;
    setUrl(value);
    clearMessages();
    setVideoInfo(null);
    setShowOptions(false);

    if (isYouTubeUrl(value)) {
      fetchVideoInfo(value);
    }
  };

  // Enhanced fetch with better error handling
  const fetchWithRetry = async (url, options, retries = 2) => {
    for (let i = 0; i <= retries; i++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        return response;
      } catch (error) {
        if (i === retries) throw error;
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // Progressive delay
      }
    }
  };

  // Fetch video information with improved error handling - REAL DATA ONLY
  const fetchVideoInfo = async (videoUrl) => {
    if (!videoUrl.trim()) return;

    if (!isYouTubeUrl(videoUrl)) {
      setError("Please enter a valid YouTube link.");
      return;
    }

    setLoadingInfo(true);
    setShowOptions(false);
    clearMessages();

    try {
      // First check server connectivity
      const isServerOnline = await checkServerStatus();

      if (!isServerOnline) {
        throw new Error("Cannot connect to the backend server. Please ensure your backend is running on one of the expected ports (5000, 3001, 8000).");
      }

      const res = await fetchWithRetry(`${currentApiBase}/info`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ url: videoUrl }),
      });

      if (!res.ok) {
        let errorMessage = `Server error: ${res.status}`;
        try {
          const errorData = await res.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          // If we can't parse JSON, use the status message
          errorMessage = `HTTP ${res.status}: ${res.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      // Validate that we have real video data
      if (!data.title || !data.id) {
        throw new Error("Invalid video data received from server. Please check if the URL is correct and the video is accessible.");
      }

      // Process real video data
      setVideoInfo(data);
      setShowOptions(true);

      // Set default quality to the highest available
      if (data.available_qualities?.length) {
        setQuality(data.available_qualities[0]);
      } else {
        // Fallback to 1080p if no qualities specified
        setQuality('1080p');
      }

      setSuccess('Video information loaded successfully!');
    } catch (err) {
      console.error('API error:', err);
      let errorMessage = err.message;

      // Provide more specific error messages
      if (err.name === 'AbortError') {
        errorMessage = 'Request timed out. Please check your internet connection and try again.';
      } else if (err.message.includes('Failed to fetch')) {
        errorMessage = 'Cannot connect to server. Please ensure your backend is running and accessible.';
      } else if (err.message.includes('NetworkError')) {
        errorMessage = 'Network error. Please check your internet connection.';
      }

      setError(`Failed to fetch video information: ${errorMessage}`);
    } finally {
      setLoadingInfo(false);
    }
  };

  // Handle download with improved error handling
  const handleDownload = async () => {
    if (!videoInfo || !url) return;

    setDownloading(true);
    clearMessages();

    try {
      // Check server status first
      const isServerOnline = await checkServerStatus();

      if (!isServerOnline) {
        throw new Error("Cannot connect to the backend server for download.");
      }

      let endpoint = '';
      let requestData = {};

      if (downloadType === 'single') {
        endpoint = `${currentApiBase}/download`;
        requestData = { url, format, quality };
      } else if (downloadType === 'playlist') {
        endpoint = `${currentApiBase}/download/playlist`;
        requestData = { url, format, quality, max_items: maxItems };
      }

      const res = await fetchWithRetry(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/octet-stream',
        },
        body: JSON.stringify(requestData),
      });

      if (!res.ok) {
        let errorMessage = `Download failed: ${res.status}`;
        try {
          const errorData = await res.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          errorMessage = `HTTP ${res.status}: ${res.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const blob = await res.blob();
      const contentDisposition = res.headers.get("Content-Disposition");
      const filenameMatch = /filename="(.+)"/.exec(contentDisposition);
      const filename = filenameMatch ? filenameMatch[1] : `download.${format}`;

      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(link.href);

      setSuccess('Download completed successfully!');
    } catch (err) {
      console.error("Download error:", err);
      let errorMessage = err.message;

      if (err.name === 'AbortError') {
        errorMessage = 'Download timed out. Please try again.';
      } else if (err.message.includes('Failed to fetch')) {
        errorMessage = 'Cannot connect to server for download. Please ensure your backend is running.';
      }

      setError(`Download failed: ${errorMessage}`);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-8">
          {/* Header */}
          <div className="text-center mb-8">
            {/* <h1 className="text-3xl font-bold text-gray-800 mb-2">YouTube Downloader</h1>
            <p className="text-gray-600">Download YouTube videos and playlists in high quality</p> */}

            {/* Server Status Indicator */}
            <div className={`inline-flex items-center mt-2 px-3 py-1 rounded-full text-sm ${serverStatus === 'connected' ? 'bg-green-100 text-green-700' :
              serverStatus === 'disconnected' ? 'bg-red-100 text-red-700' :
                'bg-gray-100 text-gray-700'
              }`}>
              {serverStatus === 'connected' ? (
                <><Wifi className="w-4 h-4 mr-1" /> Server Connected</>
              ) : serverStatus === 'disconnected' ? (
                <><WifiOff className="w-4 h-4 mr-1" /> Server Offline</>
              ) : (
                <><Loader className="w-4 h-4 mr-1 animate-spin" /> Checking Connection</>
              )}
            </div>
          </div>

          {/* Connection Issues Help */}
          {serverStatus === 'disconnected' && (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <h3 className="font-semibold text-yellow-800 mb-2">Backend Server Required</h3>
              <p className="text-yellow-700 text-sm mb-2">
                This app requires a running backend server to fetch real video data. Please ensure:
              </p>
              <ul className="text-yellow-700 text-sm list-disc list-inside space-y-1">
                <li>Your backend server is running on port 5000, 3001, or 8000</li>
                <li>The server has endpoints: /api/info, /api/download, /api/health</li>
                <li>CORS is properly configured</li>
                <li>The server can access YouTube's API or use yt-dlp</li>
              </ul>
            </div>
          )}

          {/* Download Type Selector */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">Download Type</label>
            <div className="flex space-x-4">
              <button
                type="button"
                onClick={() => setDownloadType('single')}
                className={`flex items-center px-4 py-2 rounded-lg font-medium transition-all ${downloadType === 'single'
                  ? 'bg-purple-100 text-purple-700 ring-2 ring-purple-500'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                <Video className="w-4 h-4 mr-2" />
                Single Video
              </button>
              <button
                type="button"
                onClick={() => setDownloadType('playlist')}
                className={`flex items-center px-4 py-2 rounded-lg font-medium transition-all ${downloadType === 'playlist'
                  ? 'bg-purple-100 text-purple-700 ring-2 ring-purple-500'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                <PlayCircle className="w-4 h-4 mr-2" />
                Playlist
              </button>
            </div>
          </div>

          {/* URL Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              YouTube URL
            </label>
            <div className="relative">
              <input
                type="text"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                placeholder="Paste your YouTube video or playlist link here..."
                value={url}
                onChange={handleUrlChange}
                onKeyPress={(e) => e.key === 'Enter' && fetchVideoInfo(url)}
              />
              {loadingInfo && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <Loader className="w-5 h-5 animate-spin text-purple-500" />
                </div>
              )}
              {videoInfo && !loadingInfo && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                </div>
              )}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start">
              <AlertCircle className="w-5 h-5 text-red-500 mr-2 flex-shrink-0 mt-0.5" />
              <span className="text-red-700 text-sm">{error}</span>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center">
              <CheckCircle className="w-5 h-5 text-green-500 mr-2 flex-shrink-0" />
              <span className="text-green-700 text-sm">{success}</span>
            </div>
          )}

          {/* Video Information Display */}
          {videoInfo && showOptions && (
            <div className="mb-8 p-6 bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 rounded-xl border-2 border-blue-200 shadow-lg">
              <div className="flex items-start space-x-6">
                <div className="relative flex-shrink-0">
                  <img
                    src={videoInfo.thumbnail || `https://img.youtube.com/vi/${videoInfo.id}/maxresdefault.jpg`}
                    alt="Video Thumbnail"
                    className="w-40 h-28 object-cover rounded-xl shadow-md border-2 border-white"
                    onError={(e) => {
                      // Fallback to standard quality thumbnail
                      e.target.src = `https://img.youtube.com/vi/${videoInfo.id}/hqdefault.jpg`;
                    }}
                  />
                  {videoInfo.duration && (
                    <div className="absolute bottom-2 right-2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
                      {formatDuration(videoInfo.duration)}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-lg text-gray-800 mb-3 line-clamp-2 leading-tight">
                    {videoInfo.title}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-600">
                    {videoInfo.uploader && (
                      <div className="flex items-center bg-white rounded-lg p-2 shadow-sm">
                        <User className="w-4 h-4 mr-2 text-blue-500 flex-shrink-0" />
                        <span className="font-medium truncate">{videoInfo.uploader}</span>
                      </div>
                    )}
                    {videoInfo.view_count && (
                      <div className="flex items-center bg-white rounded-lg p-2 shadow-sm">
                        <Eye className="w-4 h-4 mr-2 text-green-500 flex-shrink-0" />
                        <span className="font-medium">{formatNumber(videoInfo.view_count)} views</span>
                      </div>
                    )}
                    {videoInfo.upload_date && (
                      <div className="flex items-center bg-white rounded-lg p-2 shadow-sm">
                        <Calendar className="w-4 h-4 mr-2 text-purple-500 flex-shrink-0" />
                        <span className="font-medium">{formatDate(videoInfo.upload_date)}</span>
                      </div>
                    )}
                    {videoInfo.duration && (
                      <div className="flex items-center bg-white rounded-lg p-2 shadow-sm">
                        <PlayCircle className="w-4 h-4 mr-2 text-red-500 flex-shrink-0" />
                        <span className="font-medium">
                          {formatDuration(videoInfo.duration)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Available qualities */}
                  {videoInfo.available_qualities?.length > 0 && (
                    <div className="mt-3 bg-white rounded-lg p-3 shadow-sm">
                      <span className="text-sm font-semibold text-gray-700">Available qualities: </span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {videoInfo.available_qualities.map((quality, index) => (
                          <span key={index} className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-medium">
                            {quality}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Playlist Videos Preview */}
              {videoInfo.videos && videoInfo.type === 'playlist' && (
                <div className="mt-6">
                  <h3 className="text-lg font-semibold mb-3">Playlist Videos ({videoInfo.videos.length} total):</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-64 overflow-y-auto">
                    {videoInfo.videos.slice(0, 9).map((vid, index) => (
                      <div key={vid.id || index} className="border border-gray-200 p-3 rounded-lg bg-white">
                        {vid.thumbnail && (
                          <img
                            src={vid.thumbnail}
                            alt={vid.title}
                            className="max-w-5xl h-72"
                            onError={(e) => e.target.style.display = 'none'}
                          />
                        )}
                        <p className="text-sm font-medium truncate" title={vid.title}>
                          {vid.title}
                        </p>
                        {vid.duration && (
                          <p className="text-xs text-gray-500 mt-1">{formatDuration(vid.duration)}</p>
                        )}
                      </div>
                    ))}
                  </div>
                  {videoInfo.videos.length > 9 && (
                    <p className="text-sm text-gray-600 mt-2">
                      ...and {videoInfo.videos.length - 9} more videos
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Download Options */}
          {showOptions && videoInfo && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Format Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Format
                  </label>
                  <select
                    value={format}
                    onChange={(e) => setFormat(e.target.value)}
                    className="w-full p-3 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                    disabled={downloading}
                  >
                    <optgroup label="Video Formats">
                      {formatOptions.video.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Audio Formats">
                      {formatOptions.audio.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                {/* Quality Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Video Quality
                  </label>
                  <select
                    value={quality}
                    onChange={(e) => setQuality(e.target.value)}
                    className="w-full p-3 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                    disabled={downloading}
                  >
                    {videoInfo.available_qualities?.length > 0
                      ? videoInfo.available_qualities.map((q) => (
                        <option key={q} value={q}>
                          {getQualityLabel(q)}
                        </option>
                      ))
                      : getResolutionOptions().map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))
                    }
                  </select>
                </div>

                {/* Max Items for Playlist */}
                {downloadType === 'playlist' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Max Items
                    </label>
                    <select
                      value={maxItems}
                      onChange={(e) => setMaxItems(parseInt(e.target.value))}
                      className="w-full p-3 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                      disabled={downloading}
                    >
                      <option value={10}>10 videos</option>
                      <option value={25}>25 videos</option>
                      <option value={50}>50 videos</option>
                      <option value={100}>100 videos</option>
                      <option value={250}>250 videos</option>
                      <option value={500}>500 videos</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Download Button */}
              <button
                onClick={handleDownload}
                disabled={downloading || !quality || serverStatus === 'disconnected'}
                className={`w-full font-bold py-4 px-6 rounded-lg transform transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 flex items-center justify-center space-x-2 ${downloading || !quality || serverStatus === 'disconnected'
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-green-600 to-blue-600 text-white hover:shadow-lg hover:-translate-y-0.5'
                  }`}
              >
                {downloading ? (
                  <>
                    <Loader className="w-5 h-5 animate-spin" />
                    <span>DOWNLOADING...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5" />
                    <span>
                      DOWNLOAD {format.toUpperCase()}
                      {downloadType === 'playlist' ? ' PLAYLIST' : ''}
                    </span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Features Footer */}
        <div className="bg-gray-50 px-8 py-4 border-t">
          <div className="flex flex-wrap items-center justify-center space-x-6 text-sm text-gray-600">
            <span className="flex items-center">
              <CheckCircle className="w-4 h-4 mr-1 text-green-500" />
              Real Video Data
            </span>
            <span className="flex items-center">
              <CheckCircle className="w-4 h-4 mr-1 text-green-500" />
              Up to 4K Quality
            </span>
            <span className="flex items-center">
              <CheckCircle className="w-4 h-4 mr-1 text-green-500" />
              Multiple Formats
            </span>
            <span className="flex items-center">
              <CheckCircle className="w-4 h-4 mr-1 text-green-500" />
              Playlist Support
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DownloaderForm;