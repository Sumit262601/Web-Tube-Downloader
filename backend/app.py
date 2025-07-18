from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from yt_dlp import YoutubeDL
from PIL import Image
import os
import requests
from io import BytesIO
import ffmpeg
import certifi
import darkdetect
import future
import packaging
import logging
import json
import time
import random

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Configuration
DOWNLOAD_DIR = 'downloads'
THUMBNAIL_DIR = 'thumbnails'
COOKIES_DIR = 'cookies'
os.makedirs(DOWNLOAD_DIR, exist_ok=True)
os.makedirs(THUMBNAIL_DIR, exist_ok=True)
os.makedirs(COOKIES_DIR, exist_ok=True)

# Default user agents to rotate
USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0'
]

def get_ydl_opts(use_cookies=True, format_selector=None):
    """Get yt-dlp options with anti-bot measures"""
    
    # Base options
    opts = {
        'quiet': True,
        'no_warnings': True,
        'user_agent': random.choice(USER_AGENTS),
        'sleep_interval': 1,
        'max_sleep_interval': 3,
        'sleep_interval_requests': 1,
        'sleep_interval_subtitles': 1,
        'extractor_retries': 3,
        'fragment_retries': 3,
        'retry_sleep_functions': {
            'http': lambda n: min(4 ** n, 60),
            'fragment': lambda n: min(4 ** n, 60),
            'extractor': lambda n: min(4 ** n, 60)
        }
    }
    
    # Add format selector if provided
    if format_selector:
        opts['format'] = format_selector
    else:
        opts['format'] = 'bestvideo[height<=2160]+bestaudio/best[height<=2160]'
    
    # Add headers to look more like a real browser
    opts['http_headers'] = {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Cache-Control': 'max-age=0'
    }
    
    # Try to use cookies if available and requested
    if use_cookies:
        # First try to use browser cookies
        for browser in ['chrome', 'firefox', 'edge', 'safari']:
            try:
                opts['cookiesfrombrowser'] = (browser, None, None, None)
                # Test if cookies work by creating a temporary YoutubeDL instance
                with YoutubeDL(opts) as ydl:
                    pass
                logger.info(f"Using cookies from {browser}")
                break
            except Exception as e:
                logger.debug(f"Failed to use {browser} cookies: {e}")
                if 'cookiesfrombrowser' in opts:
                    del opts['cookiesfrombrowser']
        
        # If browser cookies don't work, try cookies.txt file
        if 'cookiesfrombrowser' not in opts:
            cookies_file = os.path.join(COOKIES_DIR, 'cookies.txt')
            if os.path.exists(cookies_file):
                opts['cookiefile'] = cookies_file
                logger.info("Using cookies.txt file")
    
    return opts

def extract_with_fallback(url, download=False, format_selector=None):
    """Extract info with multiple fallback strategies"""
    
    strategies = [
        # Strategy 1: Browser cookies + random user agent
        {'use_cookies': True, 'format_selector': format_selector},
        
        # Strategy 2: No cookies, different user agent
        {'use_cookies': False, 'format_selector': format_selector},
        
        # Strategy 3: Simplified format selector
        {'use_cookies': True, 'format_selector': 'best'},
        
        # Strategy 4: Most basic options
        {'use_cookies': False, 'format_selector': 'best'}
    ]
    
    last_error = None
    
    for i, strategy in enumerate(strategies):
        try:
            logger.info(f"Trying extraction strategy {i+1}/{len(strategies)}")
            
            opts = get_ydl_opts(**strategy)
            
            # Add a small delay between attempts
            if i > 0:
                time.sleep(random.uniform(1, 3))
            
            with YoutubeDL(opts) as ydl:
                info = ydl.extract_info(url, download=download)
                logger.info(f"Success with strategy {i+1}")
                return info
                
        except Exception as e:
            last_error = e
            logger.warning(f"Strategy {i+1} failed: {e}")
            
            # If it's a bot detection error, try the next strategy
            if any(keyword in str(e).lower() for keyword in ['bot', 'captcha', 'sign in', 'verify']):
                continue
            else:
                # For other errors, we might want to fail fast
                raise e
    
    # If all strategies failed, raise the last error
    raise last_error

# Health check endpoint
@app.route('/', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy', 'message': 'YouTube Downloader API is running'})

@app.route('/api/upload-cookies', methods=['POST'])
def upload_cookies():
    """Upload cookies.txt file"""
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        if file and file.filename.endswith('.txt'):
            cookies_path = os.path.join(COOKIES_DIR, 'cookies.txt')
            file.save(cookies_path)
            logger.info(f"Cookies file uploaded: {cookies_path}")
            return jsonify({'message': 'Cookies uploaded successfully'})
        
        return jsonify({'error': 'Invalid file format. Please upload a .txt file'}), 400
        
    except Exception as e:
        logger.error(f"Error uploading cookies: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/info', methods=['POST'])
def get_info():
    try:
        url = request.json.get('url')
        if not url:
            return jsonify({'error': 'URL is required'}), 400

        logger.info(f"Getting info for URL: {url}")

        # Use the fallback extraction method
        info = extract_with_fallback(url, download=False)

        # Download and save thumbnail
        thumb_url = info.get('thumbnail')
        if thumb_url:
            try:
                # Use a proper user agent for thumbnail requests too
                headers = {
                    'User-Agent': random.choice(USER_AGENTS),
                    'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Referer': 'https://www.youtube.com/',
                    'DNT': '1',
                    'Connection': 'keep-alive'
                }
                
                response = requests.get(thumb_url, headers=headers, timeout=10)
                response.raise_for_status()
                img = Image.open(BytesIO(response.content))
                thumb_path = os.path.join(THUMBNAIL_DIR, f"{info['id']}.jpg")
                img.save(thumb_path)
                logger.info(f"Thumbnail saved: {thumb_path}")
            except Exception as e:
                logger.error(f"Failed to save thumbnail: {e}")

        return jsonify({
            'id': info['id'],
            'title': info['title'],
            'duration': info.get('duration', 0),
            'views': info.get('view_count', 0),
            'thumbnail': f"/api/thumbnail/{info['id']}"
        })
    except Exception as e:
        logger.error(f"Error in get_info: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/thumbnail/<video_id>', methods=['GET'])
def get_thumbnail(video_id):
    try:
        path = os.path.join(THUMBNAIL_DIR, f"{video_id}.jpg")
        if os.path.exists(path):
            return send_file(path, mimetype='image/jpeg')
        return jsonify({'error': 'Thumbnail not found'}), 404
    except Exception as e:
        logger.error(f"Error serving thumbnail: {e}")
        return jsonify({'error': 'Failed to serve thumbnail'}), 500

@app.route('/api/download', methods=['POST'])
def download():
    try:
        data = request.json
        url = data.get('url')
        format = data.get('format', 'mp4')
        quality_label = data.get('quality', '1080p')

        if not url:
            return jsonify({'error': 'URL is required'}), 400

        logger.info(f"Downloading: {url}, format: {format}, quality: {quality_label}")

        # Extract numeric height from quality (e.g., '2160p 4K' → '2160')
        quality = ''.join(filter(str.isdigit, quality_label))

        # yt-dlp format selector
        if format in ['mp4', 'webm']:
            video_format = f"bestvideo[height<={quality}]+bestaudio/best[height<={quality}]"
        else:
            video_format = "bestaudio"

        # Get base options
        ydl_opts = get_ydl_opts(use_cookies=True, format_selector=video_format)
        
        # Add download-specific options
        ydl_opts.update({
            'outtmpl': os.path.join(DOWNLOAD_DIR, '%(title)s.%(ext)s'),
            'merge_output_format': format if format in ['mp4', 'webm'] else None,
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': format,
                'preferredquality': '192',
            }] if format in ['mp3', 'wav'] else []
        })

        # Use fallback extraction for download
        info = extract_with_fallback(url, download=True, format_selector=video_format)
        
        # Determine the actual filename
        with YoutubeDL(ydl_opts) as ydl:
            filename = ydl.prepare_filename(info)

        # Adjust filename extension for audio-only formats
        if format in ['mp3', 'wav']:
            filename = filename.rsplit('.', 1)[0] + '.' + format

        if os.path.exists(filename):
            return send_file(filename, as_attachment=True)
        else:
            return jsonify({'error': 'Download failed - file not found'}), 500

    except Exception as e:
        logger.error(f"Error in download: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/playlist/info', methods=['POST'])
def get_playlist_info():
    """Get playlist information including all videos"""
    try:
        data = request.json
        url = data.get('url')
        max_videos = data.get('max_videos', 50)  # Limit to prevent overwhelming
        
        if not url:
            return jsonify({'error': 'URL is required'}), 400

        logger.info(f"Getting playlist info for URL: {url}")

        # Check if it's a playlist URL
        if 'playlist' not in url.lower() and 'channel' not in url.lower() and '/c/' not in url and '/@' not in url:
            return jsonify({'error': 'URL does not appear to be a playlist or channel'}), 400

        # Get playlist info without downloading
        opts = get_ydl_opts(use_cookies=True)
        opts.update({
            'extract_flat': True,  # Only get video info, don't extract video details
            'playlistend': max_videos,  # Limit number of videos
        })
        
        info = extract_with_fallback(url, download=False, format_selector=None)
        
        if 'entries' not in info:
            return jsonify({'error': 'No videos found in playlist'}), 400
        
        # Process playlist entries
        videos = []
        for entry in info['entries']:
            if entry:  # Skip unavailable videos
                videos.append({
                    'id': entry.get('id'),
                    'title': entry.get('title', 'Unknown Title'),
                    'duration': entry.get('duration', 0),
                    'url': entry.get('url') or f"https://www.youtube.com/watch?v={entry.get('id')}",
                    'thumbnail': entry.get('thumbnail')
                })
        
        return jsonify({
            'id': info.get('id'),
            'title': info.get('title', 'Unknown Playlist'),
            'description': info.get('description', ''),
            'uploader': info.get('uploader', 'Unknown'),
            'video_count': len(videos),
            'videos': videos
        })
        
    except Exception as e:
        logger.error(f"Error in get_playlist_info: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/playlist/download', methods=['POST'])
def download_playlist():
    """Download entire playlist or selected videos"""
    try:
        data = request.json
        url = data.get('url')
        format = data.get('format', 'mp4')
        quality_label = data.get('quality', '1080p')
        video_indices = data.get('video_indices', None)  # Optional: specific video indices to download
        max_videos = data.get('max_videos', 25)  # Limit to prevent server overload
        create_zip = data.get('create_zip', True)  # Whether to zip the results
        
        if not url:
            return jsonify({'error': 'URL is required'}), 400

        logger.info(f"Downloading playlist: {url}, format: {format}, quality: {quality_label}")

        # Extract numeric height from quality
        quality = ''.join(filter(str.isdigit, quality_label))

        # yt-dlp format selector
        if format in ['mp4', 'webm']:
            video_format = f"bestvideo[height<={quality}]+bestaudio/best[height<={quality}]"
        else:
            video_format = "bestaudio"

        # Create playlist-specific download directory
        playlist_dir = os.path.join(DOWNLOAD_DIR, f"playlist_{int(time.time())}")
        os.makedirs(playlist_dir, exist_ok=True)

        # Get base options
        ydl_opts = get_ydl_opts(use_cookies=True, format_selector=video_format)
        
        # Add playlist-specific options
        ydl_opts.update({
            'outtmpl': os.path.join(playlist_dir, '%(playlist_index)s - %(title)s.%(ext)s'),
            'merge_output_format': format if format in ['mp4', 'webm'] else None,
            'playlistend': max_videos,
            'ignoreerrors': True,  # Continue downloading even if some videos fail
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': format,
                'preferredquality': '192',
            }] if format in ['mp3', 'wav'] else []
        })
        
        # Add video selection if specified
        if video_indices:
            # Convert to playlist item selection
            playlist_items = ','.join(map(str, video_indices))
            ydl_opts['playlist_items'] = playlist_items

        # Download the playlist
        with YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])

        # Get list of downloaded files
        downloaded_files = []
        for file in os.listdir(playlist_dir):
            if os.path.isfile(os.path.join(playlist_dir, file)):
                downloaded_files.append(file)

        if not downloaded_files:
            return jsonify({'error': 'No files were downloaded'}), 500

        # Create zip file if requested
        if create_zip:
            import zipfile
            zip_filename = f"playlist_{int(time.time())}.zip"
            zip_path = os.path.join(DOWNLOAD_DIR, zip_filename)
            
            with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                for file in downloaded_files:
                    file_path = os.path.join(playlist_dir, file)
                    zipf.write(file_path, file)
            
            return send_file(zip_path, as_attachment=True, download_name=zip_filename)
        else:
            # Return info about downloaded files
            return jsonify({
                'message': f'Downloaded {len(downloaded_files)} videos',
                'files': downloaded_files,
                'download_dir': playlist_dir
            })

    except Exception as e:
        logger.error(f"Error in download_playlist: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/channel/info', methods=['POST'])
def get_channel_info():
    """Get channel information and recent videos"""
    try:
        data = request.json
        url = data.get('url')
        max_videos = data.get('max_videos', 20)
        
        if not url:
            return jsonify({'error': 'URL is required'}), 400

        logger.info(f"Getting channel info for URL: {url}")

        # Ensure it's a channel URL
        if not any(keyword in url.lower() for keyword in ['channel', '/c/', '/@', '/user/']):
            return jsonify({'error': 'URL does not appear to be a channel'}), 400

        # Get channel info
        opts = get_ydl_opts(use_cookies=True)
        opts.update({
            'extract_flat': True,
            'playlistend': max_videos,
        })
        
        info = extract_with_fallback(url, download=False, format_selector=None)
        
        # Process channel entries
        videos = []
        if 'entries' in info:
            for entry in info['entries']:
                if entry:
                    videos.append({
                        'id': entry.get('id'),
                        'title': entry.get('title', 'Unknown Title'),
                        'duration': entry.get('duration', 0),
                        'url': entry.get('url') or f"https://www.youtube.com/watch?v={entry.get('id')}",
                        'upload_date': entry.get('upload_date'),
                        'view_count': entry.get('view_count', 0)
                    })
        
        return jsonify({
            'id': info.get('id'),
            'title': info.get('title', 'Unknown Channel'),
            'description': info.get('description', ''),
            'subscriber_count': info.get('subscriber_count', 0),
            'video_count': len(videos),
            'recent_videos': videos
        })
        
    except Exception as e:
        logger.error(f"Error in get_channel_info: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/batch/download', methods=['POST'])
def batch_download():
    """Download multiple individual videos as a batch"""
    try:
        data = request.json
        urls = data.get('urls', [])
        format = data.get('format', 'mp4')
        quality_label = data.get('quality', '1080p')
        create_zip = data.get('create_zip', True)
        
        if not urls or not isinstance(urls, list):
            return jsonify({'error': 'URLs list is required'}), 400

        if len(urls) > 50:  # Limit batch size
            return jsonify({'error': 'Maximum 50 URLs allowed per batch'}), 400

        logger.info(f"Batch downloading {len(urls)} videos")

        # Extract numeric height from quality
        quality = ''.join(filter(str.isdigit, quality_label))

        # yt-dlp format selector
        if format in ['mp4', 'webm']:
            video_format = f"bestvideo[height<={quality}]+bestaudio/best[height<={quality}]"
        else:
            video_format = "bestaudio"

        # Create batch-specific download directory
        batch_dir = os.path.join(DOWNLOAD_DIR, f"batch_{int(time.time())}")
        os.makedirs(batch_dir, exist_ok=True)

        # Get base options
        ydl_opts = get_ydl_opts(use_cookies=True, format_selector=video_format)
        
        # Add batch-specific options
        ydl_opts.update({
            'outtmpl': os.path.join(batch_dir, '%(title)s.%(ext)s'),
            'merge_output_format': format if format in ['mp4', 'webm'] else None,
            'ignoreerrors': True,  # Continue downloading even if some videos fail
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': format,
                'preferredquality': '192',
            }] if format in ['mp3', 'wav'] else []
        })

        # Download all URLs
        successful_downloads = []
        failed_downloads = []
        
        with YoutubeDL(ydl_opts) as ydl:
            for url in urls:
                try:
                    logger.info(f"Downloading: {url}")
                    ydl.download([url])
                    successful_downloads.append(url)
                except Exception as e:
                    logger.error(f"Failed to download {url}: {e}")
                    failed_downloads.append({'url': url, 'error': str(e)})

        # Get list of downloaded files
        downloaded_files = []
        for file in os.listdir(batch_dir):
            if os.path.isfile(os.path.join(batch_dir, file)):
                downloaded_files.append(file)

        if not downloaded_files:
            return jsonify({'error': 'No files were downloaded'}), 500

        # Create zip file if requested
        if create_zip:
            import zipfile
            zip_filename = f"batch_{int(time.time())}.zip"
            zip_path = os.path.join(DOWNLOAD_DIR, zip_filename)
            
            with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                for file in downloaded_files:
                    file_path = os.path.join(batch_dir, file)
                    zipf.write(file_path, file)
            
            return send_file(zip_path, as_attachment=True, download_name=zip_filename)
        else:
            # Return info about downloaded files
            return jsonify({
                'message': f'Downloaded {len(downloaded_files)} out of {len(urls)} videos',
                'successful_downloads': len(successful_downloads),
                'failed_downloads': len(failed_downloads),
                'files': downloaded_files,
                'errors': failed_downloads
            })

    except Exception as e:
        logger.error(f"Error in batch_download: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/status', methods=['GET'])
def get_status():
    """Get API status and available features"""
    try:
        # Check if cookies are available
        cookies_available = []
        for browser in ['chrome', 'firefox', 'edge', 'safari']:
            try:
                opts = {'cookiesfrombrowser': (browser, None, None, None), 'quiet': True}
                with YoutubeDL(opts) as ydl:
                    pass
                cookies_available.append(browser)
            except:
                pass
        
        cookies_file_exists = os.path.exists(os.path.join(COOKIES_DIR, 'cookies.txt'))
        
        return jsonify({
            'status': 'healthy',
            'cookies': {
                'browser_cookies_available': cookies_available,
                'cookies_file_exists': cookies_file_exists
            },
            'features': [
                'Single video download',
                'Playlist download',
                'Channel video download',
                'Batch download',
                'Multiple format support',
                'Quality selection',
                'Zip packaging'
            ],
            'anti_bot_features': [
                'User agent rotation',
                'Request delays',
                'Retry mechanisms',
                'Browser cookie support',
                'Custom headers'
            ]
        })
    except Exception as e:
        logger.error(f"Error in status check: {e}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)