from flask import Flask, request, jsonify, send_file, make_response
from flask_cors import CORS
from yt_dlp import YoutubeDL
from PIL import Image
import os
import requests
from io import BytesIO
import ffmpeg
import logging
import json
import time
import random
import re
import tempfile
import shutil
import zipfile
from urllib.parse import urlparse, parse_qs
from concurrent.futures import ThreadPoolExecutor

# Enhanced logging configuration
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('youtube_downloader.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

# Configuration with enhanced settings
CONFIG = {
    'DOWNLOAD_DIR': 'downloads',
    'THUMBNAIL_DIR': 'thumbnails',
    'COOKIES_DIR': 'cookies',
    'TEMP_DIR': 'temp',
    'MAX_CONCURRENT_DOWNLOADS': 3,
    'DOWNLOAD_TIMEOUT': 300,
    'MAX_RETRIES': 3,
    'CHUNK_SIZE': 1024 * 1024,  # 1MB chunks for download
    'MAX_PLAYLIST_ITEMS': 100,
    'MAX_BATCH_SIZE': 50,
    'USER_AGENT_ROTATION': True,
    'USE_PROXY': False,
    'PROXY_LIST': [],
}

# Create necessary directories
for dir_name in [CONFIG['DOWNLOAD_DIR'], CONFIG['THUMBNAIL_DIR'], 
                 CONFIG['COOKIES_DIR'], CONFIG['TEMP_DIR']]:
    os.makedirs(dir_name, exist_ok=True)

# Enhanced user agents with mobile, TV, and smart device variants
USER_AGENTS = [
    # Desktop browsers (updated versions)
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:122.0) Gecko/20100101 Firefox/122.0',
    
    # Mobile browsers
    'Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
    
    # Smart TVs and devices
    'Mozilla/5.0 (SMART-TV; Linux; Tizen 6.5) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/5.0 Chrome/85.0.4183.93 TV Safari/537.36',
    'Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.79 Safari/537.36 WebAppManager',
    
    # Game consoles
    'Mozilla/5.0 (PlayStation 5; PlayStation 5/6.00) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.4 Safari/605.1.15',
    
    # Legacy browsers (for compatibility)
    'Mozilla/5.0 (Windows NT 6.1; WOW64; Trident/7.0; AS; rv:11.0) like Gecko',
]

# Thread pool for concurrent downloads
executor = ThreadPoolExecutor(max_workers=CONFIG['MAX_CONCURRENT_DOWNLOADS'])

def get_random_user_agent():
    """Return a random user agent from the list"""
    return random.choice(USER_AGENTS) if CONFIG['USER_AGENT_ROTATION'] else USER_AGENTS[0]

def clean_filename(filename):
    """Sanitize filename to remove invalid characters"""
    return re.sub(r'[\\/*?:"<>|]', "", filename)

def is_playlist_url(url):
    """Check if URL is a playlist, channel, or multi-video content"""
    if not url:
        return False
    
    patterns = [
        r'list=', r'playlist\?', r'/playlist/', r'/playlists/',
        r'/channel/', r'/user/', r'/c/', r'/@', r'/videos',
        r'/streams', r'/shorts', r'/featured'
    ]
    
    return any(re.search(p, url.lower()) for p in patterns)

def get_browser_cookie_path(browser):
    """Get cookie path for different browsers"""
    if browser == 'chrome':
        return ('chrome', None, None, None)
    elif browser == 'firefox':
        return ('firefox', None, None, None)
    elif browser == 'edge':
        return ('edge', None, None, None)
    elif browser == 'safari':
        return ('safari', None, None, None)
    elif browser == 'opera':
        return ('opera', None, None, None)
    elif browser == 'brave':
        return ('brave', None, None, None)
    return None

def get_ydl_opts(use_cookies=True, format_selector=None, download=True):
    """Generate yt-dlp options with enhanced settings"""
    opts = {
        'quiet': True,
        'no_warnings': False,
        'ignoreerrors': True,
        'retries': CONFIG['MAX_RETRIES'],
        'fragment_retries': CONFIG['MAX_RETRIES'],
        'extractor_retries': CONFIG['MAX_RETRIES'],
        'socket_timeout': 30,
        'source_address': '0.0.0.0',
        'force_ipv4': True,
        'nocheckcertificate': True,
        'verbose': False,
        'http_chunk_size': CONFIG['CHUNK_SIZE'],
        'extract_flat': False,
        'concurrent_fragment_downloads': True,
        'throttledratelimit': 1000000,  # 1MB/s minimum
        'sleep_interval': 1,
        'max_sleep_interval': 5,
        'user_agent': get_random_user_agent(),
        'http_headers': {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Referer': 'https://www.youtube.com/',
            'Origin': 'https://www.youtube.com',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'same-origin',
            'Pragma': 'no-cache',
            'Cache-Control': 'no-cache'
        }
    }
    
    # Format selection
    if format_selector:
        opts['format'] = format_selector
    else:
        opts['format'] = 'bestvideo[height<=2160]+bestaudio/best[height<=2160]'
    
    # Cookie handling
    if use_cookies:
        # Try browser cookies first
        for browser in ['chrome', 'firefox', 'edge', 'safari', 'opera', 'brave']:
            try:
                cookie_path = get_browser_cookie_path(browser)
                if cookie_path:
                    test_opts = opts.copy()
                    test_opts['cookiesfrombrowser'] = [cookie_path]
                    with YoutubeDL(test_opts) as ydl:
                        ydl.extract_info('https://www.youtube.com', download=False)
                    opts['cookiesfrombrowser'] = [cookie_path]
                    logger.info(f"Using cookies from {browser}")
                    break
            except Exception as e:
                logger.debug(f"Failed to use {browser} cookies: {e}")
        
        # Fallback to cookies.txt
        if 'cookiesfrombrowser' not in opts:
            cookies_file = os.path.join(CONFIG['COOKIES_DIR'], 'cookies.txt')
            if os.path.exists(cookies_file):
                opts['cookiefile'] = cookies_file
                logger.info("Using cookies.txt file")
    
    # Download-specific options
    if download:
        opts.update({
            'outtmpl': os.path.join(CONFIG['DOWNLOAD_DIR'], '%(title)s.%(ext)s'),
            'noprogress': True,
            'continuedl': True,
            'nopart': False,
            'updatetime': False,
            'merge_output_format': 'mp4',
            'postprocessors': [{
                'key': 'FFmpegVideoConvertor',
                'preferedformat': 'mp4',
            }],
        })
    
    return opts

def download_video(url, format='mp4', quality='1080p', retry=0):
    """Download a single video with enhanced error handling"""
    try:
        quality_num = int(''.join(filter(str.isdigit, quality)))
        format_selector = f"bestvideo[height<={quality_num}]+bestaudio/best[height<={quality_num}]"
        
        ydl_opts = get_ydl_opts(format_selector=format_selector)
        ydl_opts['outtmpl'] = os.path.join(CONFIG['DOWNLOAD_DIR'], '%(title)s.%(ext)s')
        
        if format in ['mp3', 'wav']:
            ydl_opts['postprocessors'] = [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': format,
                'preferredquality': '192',
            }]
        
        with YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            filename = ydl.prepare_filename(info)
            
            if format in ['mp3', 'wav']:
                filename = os.path.splitext(filename)[0] + f'.{format}'
            
            return filename
    
    except Exception as e:
        logger.error(f"Download failed (attempt {retry + 1}): {str(e)}")
        if retry < CONFIG['MAX_RETRIES']:
            time.sleep(2 ** retry)  # Exponential backoff
            return download_video(url, format, quality, retry + 1)
        raise

# API Endpoints
@app.route('/api/download', methods=['POST'])
def api_download():
    """Download single video endpoint"""
    try:
        data = request.json
        url = data.get('url')
        format = data.get('format', 'mp4')
        quality = data.get('quality', '1080p')
        
        if not url:
            return jsonify({'error': 'URL is required'}), 400
        
        future = executor.submit(download_video, url, format, quality)
        filename = future.result(timeout=CONFIG['DOWNLOAD_TIMEOUT'])
        
        return send_file(filename, as_attachment=True)
    
    except Exception as e:
        logger.error(f"Download error: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/playlist/download', methods=['POST'])
def api_playlist_download():
    """Download playlist endpoint"""
    try:
        data = request.json
        url = data.get('url')
        format = data.get('format', 'mp4')
        quality = data.get('quality', '1080p')
        max_items = min(data.get('max_items', 25), CONFIG['MAX_PLAYLIST_ITEMS'])
        
        if not url:
            return jsonify({'error': 'URL is required'}), 400
        
        # First get playlist info
        ydl_opts = get_ydl_opts(download=False)
        ydl_opts['extract_flat'] = True
        ydl_opts['playlistend'] = max_items
        
        with YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            
            if 'entries' not in info:
                return jsonify({'error': 'No videos found in playlist'}), 400
            
            # Create temp directory for playlist
            temp_dir = tempfile.mkdtemp(dir=CONFIG['TEMP_DIR'])
            results = []
            
            # Download each video
            for entry in info['entries']:
                if entry:
                    try:
                        video_url = entry.get('url') or f"https://www.youtube.com/watch?v={entry.get('id')}"
                        future = executor.submit(download_video, video_url, format, quality)
                        filename = future.result(timeout=CONFIG['DOWNLOAD_TIMEOUT'])
                        results.append(filename)
                    except Exception as e:
                        logger.error(f"Failed to download {entry.get('title')}: {str(e)}")
            
            # Create zip file
            zip_filename = os.path.join(CONFIG['DOWNLOAD_DIR'], f"playlist_{int(time.time())}.zip")
            with zipfile.ZipFile(zip_filename, 'w') as zipf:
                for file in results:
                    zipf.write(file, os.path.basename(file))
            
            # Clean up
            for file in results:
                try:
                    os.remove(file)
                except:
                    pass
            
            return send_file(zip_filename, as_attachment=True)
    
    except Exception as e:
        logger.error(f"Playlist download error: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/batch/download', methods=['POST'])
def api_batch_download():
    """Batch download endpoint"""
    try:
        data = request.json
        urls = data.get('urls', [])
        format = data.get('format', 'mp4')
        quality = data.get('quality', '1080p')
        
        if not urls or len(urls) > CONFIG['MAX_BATCH_SIZE']:
            return jsonify({'error': f'URLs list required (max {CONFIG["MAX_BATCH_SIZE"]} items)'}), 400
        
        # Create temp directory for batch
        temp_dir = tempfile.mkdtemp(dir=CONFIG['TEMP_DIR'])
        results = []
        futures = []
        
        # Submit all downloads
        for url in urls:
            futures.append(executor.submit(download_video, url, format, quality))
        
        # Collect results
        for future in futures:
            try:
                filename = future.result(timeout=CONFIG['DOWNLOAD_TIMEOUT'])
                results.append(filename)
            except Exception as e:
                logger.error(f"Batch download failed for a URL: {str(e)}")
        
        # Create zip file
        zip_filename = os.path.join(CONFIG['DOWNLOAD_DIR'], f"batch_{int(time.time())}.zip")
        with zipfile.ZipFile(zip_filename, 'w') as zipf:
            for file in results:
                zipf.write(file, os.path.basename(file))
        
        # Clean up
        for file in results:
            try:
                os.remove(file)
            except:
                pass
        
        return send_file(zip_filename, as_attachment=True)
    
    except Exception as e:
        logger.error(f"Batch download error: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/status', methods=['GET'])
def api_status():
    """Service status endpoint"""
    return jsonify({
        'status': 'running',
        'config': CONFIG,
        'statistics': {
            'downloads_dir_size': f"{sum(os.path.getsize(f) for f in os.listdir(CONFIG['DOWNLOAD_DIR']) if os.path.isfile(f)) / (1024*1024):.2f} MB",
            'thumbnails_count': len(os.listdir(CONFIG['THUMBNAIL_DIR'])),
            'active_downloads': executor._work_queue.qsize(),
            'max_concurrent_downloads': CONFIG['MAX_CONCURRENT_DOWNLOADS']
        }
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, threaded=True)