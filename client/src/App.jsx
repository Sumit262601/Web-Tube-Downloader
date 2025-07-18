import React, { useState, useEffect } from 'react';
import {
  Download,
  Video,
  Music,
  Settings,
  AlertCircle,
  CheckCircle,
  Loader,
  Play,
  List,
  Clock,
  Eye,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

const API_BASE = 'http://localhost:5000/api';

const validateYouTubeUrl = (url) => {
  const regex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/;
  return regex.test(url);
};

const isPlaylistUrl = (url) => {
  return url.includes('playlist?list=') || url.includes('&list=');
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

const ProgressBar = ({ progress }) => {
  return (
    <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
      <div 
        className="bg-red-600 h-2.5 rounded-full" 
        style={{ width: `${progress}%` }}
      ></div>
    </div>
  );
};

const VideoCard = ({ video, format, quality, onDownload, isDownloading, downloadingId, downloadProgress }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex gap-4">
        <div className="relative flex-shrink-0">
          <img
            src={video.thumbnail}
            alt="Video thumbnail"
            className="w-32 h-20 object-cover rounded-lg"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-black bg-opacity-50 rounded-full p-1.5">
              <Play className="w-4 h-4 text-white" />
            </div>
          </div>
        </div>
        
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-gray-800 mb-2 text-sm leading-tight line-clamp-2">
            {video.title}
          </h4>
          <div className="flex items-center gap-4 text-xs text-gray-600 mb-3">
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>{video.duration}</span>
            </div>
            <div className="flex items-center gap-1">
              <Eye className="w-3 h-3" />
              <span>{video.views}</span>
            </div>
          </div>
          
          {isDownloading && downloadingId === video.id ? (
            <div className="w-full">
              <div className="flex items-center justify-between text-xs mb-1">
                <span>Downloading {format.toUpperCase()} - {quality}</span>
                <span>{downloadProgress}%</span>
              </div>
              <ProgressBar progress={downloadProgress} />
              <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                <Loader className="w-3 h-3 animate-spin" />
                <span>Processing...</span>
              </div>
            </div>
          ) : (
            <button
              onClick={() => onDownload(video.id)}
              disabled={isDownloading}
              className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
            >
              <Download className="w-4 h-4" />
              Download {format.toUpperCase()} - {quality}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const YouTubeDownloader = () => {
  const [url, setUrl] = useState('');
  const [format, setFormat] = useState('mp4');
  const [quality, setQuality] = useState('1080p');
  const [isLoading, setIsLoading] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [videoInfo, setVideoInfo] = useState(null);
  const [playlistInfo, setPlaylistInfo] = useState(null);
  const [isPlaylist, setIsPlaylist] = useState(false);
  const [showDownloadOptions, setShowDownloadOptions] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadStatus, setDownloadStatus] = useState('');

  const showToast = (message, type = 'info') => {
    // Simple toast implementation
    console.log(`${type}: ${message}`);
  };

  useEffect(() => {
    const detectContent = async () => {
      if (!url || !validateYouTubeUrl(url)) {
        setVideoInfo(null);
        setPlaylistInfo(null);
        setShowDownloadOptions(false);
        setError('');
        setIsPlaylist(false);
        return;
      }

      setIsDetecting(true);
      setError('');
      const playlist = isPlaylistUrl(url);
      setIsPlaylist(playlist);
      setStatus(playlist ? 'Detecting playlist...' : 'Detecting video...');

      try {
        const endpoint = playlist ? '/playlist-info' : '/info';
        const res = await fetch(`${API_BASE}${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url })
        });

        const data = await res.json();

        if (data.error) {
          showToast(data.error, 'error');
          setVideoInfo(null);
          setPlaylistInfo(null);
          setShowDownloadOptions(false);
          return;
        }

        if (playlist) {
          setPlaylistInfo({
            title: data.title,
            videoCount: data.videoCount,
            videos: data.videos.map(video => ({
              id: video.id,
              title: video.title,
              duration: `${Math.floor(video.duration / 60)}:${String(video.duration % 60).padStart(2, '0')}`,
              views: `${video.views} views`,
              thumbnail: `${API_BASE}/thumbnail/${video.id}`
            }))
          });
          setVideoInfo(null);
        } else {
          setVideoInfo({
            id: data.id,
            thumbnail: `${API_BASE}/thumbnail/${data.id}`,
            title: data.title,
            duration: `${Math.floor(data.duration / 60)}:${String(data.duration % 60).padStart(2, '0')}`,
            views: `${data.views} views`
          });
          setPlaylistInfo(null);
        }

        setShowDownloadOptions(true);
        showToast(playlist ? 'Playlist detected successfully!' : 'Video detected successfully!', 'success');
        setStatus('');
      } catch (error) {
        showToast(`Failed to detect content: ${error.message}`, 'error');
        setVideoInfo(null);
        setPlaylistInfo(null);
        setShowDownloadOptions(false);
      } finally {
        setIsDetecting(false);
      }
    };

    const timeoutId = setTimeout(detectContent, 800);
    return () => clearTimeout(timeoutId);
  }, [url]);

  const handleUrlChange = (e) => {
    const newUrl = e.target.value;
    setUrl(newUrl);
    setStatus('');
    setError('');
  };

  const handleSingleVideoDownload = async () => {
    if (!url || !validateYouTubeUrl(url) || !videoInfo) {
      showToast('Please enter a valid YouTube URL', 'error');
      return;
    }

    setIsLoading(true);
    setStatus('Preparing download...');
    setError('');
    setDownloadProgress(0);
    setDownloadStatus('Starting download...');

    try {
      const res = await fetch(`${API_BASE}/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, format, quality })
      });

      if (!res.ok) throw new Error('Download failed');

      const reader = res.body.getReader();
      const contentLength = +res.headers.get('Content-Length');
      let receivedLength = 0;
      let chunks = [];
      
      while(true) {
        const {done, value} = await reader.read();
        
        if (done) break;
        
        chunks.push(value);
        receivedLength += value.length;
        const progress = Math.round((receivedLength / contentLength) * 100);
        setDownloadProgress(progress);
        setDownloadStatus(`Downloading... ${progress}%`);
      }
      
      const blob = new Blob(chunks);
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `${videoInfo.title}.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);

      showToast('Download completed successfully!', 'success');
      setStatus('');
      setDownloadStatus('');
    } catch (error) {
      showToast(`Download failed: ${error.message}`, 'error');
      setError(error.message);
    } finally {
      setIsLoading(false);
      setDownloadProgress(0);
    }
  };

  const handlePlaylistVideoDownload = async (videoId) => {
    setDownloadingId(videoId);
    setDownloadProgress(0);
    setDownloadStatus('Starting download...');
    
    try {
      const video = playlistInfo.videos.find(v => v.id === videoId);
      const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
      
      const res = await fetch(`${API_BASE}/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: videoUrl, format, quality })
      });

      if (!res.ok) throw new Error('Download failed');

      const reader = res.body.getReader();
      const contentLength = +res.headers.get('Content-Length');
      let receivedLength = 0;
      let chunks = [];
      
      while(true) {
        const {done, value} = await reader.read();
        
        if (done) break;
        
        chunks.push(value);
        receivedLength += value.length;
        const progress = Math.round((receivedLength / contentLength) * 100);
        setDownloadProgress(progress);
        setDownloadStatus(`Downloading... ${progress}%`);
      }
      
      const blob = new Blob(chunks);
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `${video.title}.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);

      showToast('Download completed successfully!', 'success');
    } catch (error) {
      showToast(`Download failed: ${error.message}`, 'error');
    } finally {
      setDownloadingId(null);
      setDownloadProgress(0);
      setDownloadStatus('');
    }
  };

  const getInputIcon = () => {
    if (isDetecting) {
      return <Loader className="w-5 h-5 text-blue-500 animate-spin" />;
    }
    if (url && validateYouTubeUrl(url)) {
      if (videoInfo || playlistInfo) {
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      }
      return <Loader className="w-5 h-5 text-blue-500 animate-spin" />;
    }
    if (url) {
      return <AlertCircle className="w-5 h-5 text-red-500" />;
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 bg-red-600 rounded-full">
              <Download className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-gray-800">NextTube - YouTube Downloader</h1>
          </div>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Paste a YouTube URL (video or playlist) and download in your preferred format.
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
          {/* URL Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              YouTube URL (Video or Playlist)
            </label>
            <div className="relative">
              <input
                type="url"
                value={url}
                onChange={handleUrlChange}
                placeholder="Paste your video link here..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 pr-12"
              />
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                {getInputIcon()}
              </div>
            </div>
            {status && (
              <p className="mt-2 text-sm text-blue-600 flex items-center gap-2">
                <Loader className="w-4 h-4 animate-spin" />
                {status}
              </p>
            )}
          </div>

          {/* Single Video Preview */}
          {videoInfo && !isPlaylist && (
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
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      <span>{videoInfo.duration}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Eye className="w-4 h-4" />
                      <span>{videoInfo.views}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Playlist Preview */}
          {playlistInfo && isPlaylist && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg border-2 border-green-200">
              <div className="flex items-center gap-3 mb-4">
                <List className="w-6 h-6 text-red-600" />
                <div>
                  <h3 className="font-semibold text-gray-800 text-lg">{playlistInfo.title}</h3>
                  <p className="text-sm text-gray-600">{playlistInfo.videoCount} videos</p>
                </div>
              </div>
            </div>
          )}

          {/* Download Options */}
          {showDownloadOptions && (videoInfo || playlistInfo) && (
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

              {/* Single Video Download Button */}
              {videoInfo && !isPlaylist && (
                <div className="space-y-4">
                  {isLoading && (
                    <div className="w-full">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span>{downloadStatus || 'Downloading...'}</span>
                        <span>{downloadProgress}%</span>
                      </div>
                      <ProgressBar progress={downloadProgress} />
                    </div>
                  )}
                  <button
                    onClick={handleSingleVideoDownload}
                    disabled={isLoading}
                    className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-semibold py-4 px-6 rounded-lg transition-colors flex items-center justify-center gap-3 text-lg"
                  >
                    {isLoading ? (
                      <>
                        <Loader className="w-5 h-5 animate-spin" />
                        Downloading...
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

              {/* Playlist Videos List */}
              {playlistInfo && isPlaylist && (
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold text-gray-800">Playlist Videos</h4>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {playlistInfo.videos.map((video) => (
                      <VideoCard
                        key={video.id}
                        video={video}
                        format={format}
                        quality={quality}
                        onDownload={handlePlaylistVideoDownload}
                        isDownloading={downloadingId === video.id}
                        downloadingId={downloadingId}
                        downloadProgress={downloadingId === video.id ? downloadProgress : 0}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* No Content Message */}
          {!videoInfo && !playlistInfo && !isDetecting && (
            <div className="text-center py-8 text-gray-500">
              <div className="flex items-center justify-center gap-2 mb-4">
                <Video className="w-12 h-12 text-gray-400" />
                <List className="w-12 h-12 text-gray-400" />
              </div>
              <p className="text-lg mb-2">Paste a YouTube URL to get started</p>
              <p className="text-sm">Support for both single videos and playlists</p>
            </div>
          )}
        </div>

        {/* Features Section */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg p-6 text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Video className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="font-semibold text-gray-800 mb-2">Single Videos</h3>
            <p className="text-sm text-gray-600">Download individual YouTube videos</p>
          </div>

          <div className="bg-white rounded-lg p-6 text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <List className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="font-semibold text-gray-800 mb-2">Playlists</h3>
            <p className="text-sm text-gray-600">Download entire playlists with ease</p>
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
            <p className="text-sm text-gray-600">Automatically detects videos and playlists</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default YouTubeDownloader;