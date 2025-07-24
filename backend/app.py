import re
import os
import ssl
import uuid
import shutil
import logging
import tempfile
import zipfile
from datetime import datetime, timedelta
from threading import Thread
from io import BytesIO
import random

import certifi
import requests
from PIL import Image
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from yt_dlp import YoutubeDL

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('youtube_downloader.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# URL validation patterns
VIDEO_REGEX = r'^(https?:\/\/)?(www\.)?(m\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[A-Za-z0-9_-]{11}.*$'
PLAYLIST_REGEX = r'^(https?:\/\/)?(www\.)?(m\.)?(youtube\.com\/playlist\?list=)[A-Za-z0-9_-]+.*$'

# SSL context configuration
ssl._create_default_https_context = ssl.create_default_context(cafile=certifi.where())

# User agents for rotation
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15"
]

def get_random_user_agent():
    return random.choice(USER_AGENTS)

app = Flask(__name__)
CORS(app, origins="*")  # Restrict CORS origins

# Configuration
THUMBNAIL_DIR = "thumbnails"
DOWNLOAD_DIR = "downloads"
MAX_FILE_SIZE = 500 * 1024 * 1024  # 500MB limit
CLEANUP_INTERVAL = 3600  # 1 hour
FILE_EXPIRY = 24 * 3600  # 24 hours

# Create directories
os.makedirs(THUMBNAIL_DIR, exist_ok=True)
os.makedirs(DOWNLOAD_DIR, exist_ok=True)

class YouTubeDownloader:
    def __init__(self):
        # Initialize with default options
        self.base_ydl_opts = {
            "quiet": True,
            "skip_download": True,
            "nocheckcertificate": True,
            "extract_flat": False,
            "noplaylist": False,
            "socket_timeout": 30,
            "retries": 3,
            "extractor_args": {
                "youtube": {
                    "skip": ["dash", "hls"]
                }
            },
            "force_ipv4": True,
            "compat_opts": ["no-youtube-unavailable-videos"],
            "verbose": False,
            "http_headers": {"User-Agent": get_random_user_agent()},
            "proxy": os.environ.get("YT_PROXY") or None
        }
        self._configure_cookies()
    
    def _configure_cookies(self):
        """Configure cookies file if it exists"""
        cookies_path = os.path.expanduser('~/.config/yt-cookies.txt')
        try:
            if os.path.exists(cookies_path):
                self.base_ydl_opts["cookiefile"] = cookies_path
                logger.info("Using YouTube cookies from %s", cookies_path)
            else:
                logger.warning("No YouTube cookies file found at %s - some functionality may be limited", cookies_path)
        except Exception as e:
            logger.error(f"Error configuring cookies: {str(e)}")

    def get_info_opts(self):
        opts = self.base_ydl_opts.copy()
        opts["http_headers"]["User-Agent"] = get_random_user_agent()  # Rotate UA for each request
        return opts
    
    def get_download_opts(self, format_type, quality, output_path, audio_only=False):
        opts = self.base_ydl_opts.copy()
        opts.update({
            "skip_download": False,
            "outtmpl": os.path.join(output_path, '%(title)s.%(ext)s'),
            "writesubtitles": False,
            "writeautomaticsub": False,
            "http_headers": {"User-Agent": get_random_user_agent()}
        })
        
        if audio_only:
            opts.update({
                "format": "bestaudio/best",
                "postprocessors": [{
                    'key': 'FFmpegExtractAudio',
                    'preferredcodec': format_type,
                    'preferredquality': quality if quality.isdigit() else '192',
                }],
                "extractaudio": True,
                "keepvideo": False
            })
        else:
            opts.update({
                "format": self._get_format_selector(quality),
                "merge_output_format": format_type,
            })
            
        return opts
    
    def _get_format_selector(self, quality):
        """Get format selector based on quality preference"""
        if quality == "best":
            return "bestvideo+bestaudio/best"
        elif quality == "worst":
            return "worstvideo+worstaudio/worst"
        else:
            return f"bestvideo[height<={quality}]+bestaudio/best[height<={quality}]"

downloader = YouTubeDownloader()

def validate_url(url):
    """Validate YouTube URL"""
    if not url or not isinstance(url, str):
        return False, "Invalid URL format"
    
    url = url.strip()
    is_video = re.match(VIDEO_REGEX, url)
    is_playlist = re.match(PLAYLIST_REGEX, url)
    
    if not (is_video or is_playlist):
        return False, "Not a valid YouTube URL"
    
    return True, "valid"

def save_thumbnail(info):
    """Save video thumbnail with error handling"""
    try:
        thumbnail_url = info.get("thumbnail")
        video_id = info.get("id")
        
        if not thumbnail_url or not video_id:
            logger.warning(f"Missing thumbnail URL or video ID for {video_id}")
            return None
        
        # Check if thumbnail already exists
        thumbnail_path = os.path.join(THUMBNAIL_DIR, f"{video_id}.jpg")
        if os.path.exists(thumbnail_path):
            return thumbnail_path
        
        response = requests.get(thumbnail_url, timeout=10, headers={"User-Agent": get_random_user_agent()})
        response.raise_for_status()
        
        # Validate image
        image = Image.open(BytesIO(response.content))
        image.verify()  # Verify it's a valid image
        
        # Reopen for processing (verify() closes the file)
        image = Image.open(BytesIO(response.content))
        
        # Resize if too large
        if image.size[0] > 1280 or image.size[1] > 720:
            image.thumbnail((1280, 720), Image.Resampling.LANCZOS)
        
        # Convert to RGB if necessary
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        image.save(thumbnail_path, "JPEG", quality=85, optimize=True)
        logger.info(f"Saved thumbnail for {video_id}")
        return thumbnail_path
        
    except Exception as e:
        logger.error(f"Error saving thumbnail for {info.get('id', 'unknown')}: {str(e)}")
        return None

def get_available_qualities(info, audio_only=False):
    """Extract available video or audio qualities"""
    try:
        if audio_only:
            formats = info.get("formats", [])
            audio_qualities = set()
            
            for f in formats:
                abr = f.get("abr")
                if abr and isinstance(abr, (int, float)):
                    audio_qualities.add(str(int(abr)))
            
            standard_audio_qualities = ["64", "128", "192", "256", "320"]
            available_qualities = sorted([q for q in standard_audio_qualities if q in audio_qualities], 
                                       key=int, reverse=True)
            
            return ["best"] + available_qualities + ["worst"]
        else:
            formats = info.get("formats", [])
            qualities = set()
            
            for f in formats:
                height = f.get("height")
                if height and isinstance(height, int):
                    qualities.add(str(height))
            
            # Add standard quality options
            standard_qualities = ["144", "240", "360", "480", "720", "1080"]
            available_qualities = sorted([q for q in standard_qualities if q in qualities], 
                                       key=int, reverse=True)
            
            # Add "best" and "worst" options
            if available_qualities:
                return ["best"] + available_qualities + ["worst"]
            
            return ["best", "worst"]
        
    except Exception as e:
        logger.error(f"Error getting qualities: {str(e)}")
        return ["best", "worst"]

def cleanup_old_files():
    """Clean up old downloaded files and thumbnails"""
    try:
        current_time = datetime.now()
        
        # Clean download directory
        for item in os.listdir(DOWNLOAD_DIR):
            item_path = os.path.join(DOWNLOAD_DIR, item)
            if os.path.isfile(item_path):
                file_time = datetime.fromtimestamp(os.path.getctime(item_path))
                if (current_time - file_time).total_seconds() > FILE_EXPIRY:
                    os.remove(item_path)
                    logger.info(f"Cleaned up old file: {item}")
            elif os.path.isdir(item_path):
                dir_time = datetime.fromtimestamp(os.path.getctime(item_path))
                if (current_time - dir_time).total_seconds() > FILE_EXPIRY:
                    shutil.rmtree(item_path)
                    logger.info(f"Cleaned up old directory: {item}")
        
        # Clean thumbnail directory
        for item in os.listdir(THUMBNAIL_DIR):
            item_path = os.path.join(THUMBNAIL_DIR, item)
            if os.path.isfile(item_path):
                file_time = datetime.fromtimestamp(os.path.getctime(item_path))
                if (current_time - file_time).total_seconds() > FILE_EXPIRY * 7:  # Keep thumbnails longer
                    os.remove(item_path)
                    logger.info(f"Cleaned up old thumbnail: {item}")
                    
    except Exception as e:
        logger.error(f"Error during cleanup: {str(e)}")

def format_duration(seconds):
    """Format duration from seconds to readable format"""
    if not seconds:
        return "Unknown"
    
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    seconds = seconds % 60
    
    if hours > 0:
        return f"{hours:02d}:{minutes:02d}:{seconds:02d}"
    else:
        return f"{minutes:02d}:{seconds:02d}"

def is_video_available(url):
    """Check if video is available before downloading"""
    try:
        with YoutubeDL({"quiet": True, "skip_download": True}) as ydl:
            ydl.extract_info(url, download=False)
            return True
    except Exception as e:
        logger.error(f"Video availability check failed: {str(e)}")
        return False

@app.route("/api/health", methods=["GET"])
def health_check():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "version": "2.1"
    })

@app.route("/api/info", methods=["POST"])
def get_video_info():
    """Get video or playlist information"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No JSON data provided"}), 400
        
        url = data.get("url", "").strip()
        audio_only = data.get("audio_only", False)
        
        # Validate URL
        is_valid, message = validate_url(url)
        if not is_valid:
            return jsonify({"error": message}), 400
        
        is_video = re.match(VIDEO_REGEX, url)
        is_playlist = re.match(PLAYLIST_REGEX, url)
        
        ydl_opts = downloader.get_info_opts()
        
        with YoutubeDL(ydl_opts) as ydl:
            try:
                info = ydl.extract_info(url, download=False)
            except Exception as e:
                if "HTTP Error 429" in str(e):
                    return jsonify({"error": "YouTube is rate limiting requests. Please try again later."}), 429
                elif "Private video" in str(e):
                    return jsonify({"error": "This is a private video and cannot be accessed"}), 403
                elif "Unavailable" in str(e):
                    return jsonify({"error": "Video is unavailable"}), 404
                raise
            
            if is_playlist or ("entries" in info and info.get("_type") == "playlist"):
                videos = []
                processed_count = 0
                
                for entry in info.get("entries", []):
                    if entry is None:
                        continue
                    
                    processed_count += 1
                    if processed_count > 100:  # Limit playlist size
                        break
                    
                    save_thumbnail(entry)
                    qualities = get_available_qualities(entry, audio_only)
                    
                    videos.append({
                        "id": entry.get("id"),
                        "title": entry.get("title", "Unknown Title"),
                        "duration": format_duration(entry.get("duration")),
                        "duration_seconds": entry.get("duration"),
                        "channel": entry.get("uploader", "Unknown Channel"),
                        "thumbnail": f"/api/thumbnail/{entry.get('id')}" if entry.get('id') else None,
                        "available_qualities": qualities,
                        "view_count": entry.get("view_count"),
                        "upload_date": entry.get("upload_date")
                    })
                
                return jsonify({
                    "type": "playlist",
                    "title": info.get("title", "Unknown Playlist"),
                    "description": info.get("description", ""),
                    "uploader": info.get("uploader", "Unknown"),
                    "video_count": len(videos),
                    "total_entries": info.get("playlist_count", len(videos)),
                    "videos": videos
                })
            
            elif is_video:
                save_thumbnail(info)
                qualities = get_available_qualities(info, audio_only)
                
                return jsonify({
                    "type": "video",
                    "id": info.get("id"),
                    "title": info.get("title", "Unknown Title"),
                    "description": info.get("description", ""),
                    "duration": format_duration(info.get("duration")),
                    "duration_seconds": info.get("duration"),
                    "channel": info.get("uploader", "Unknown Channel"),
                    "view_count": info.get("view_count"),
                    "like_count": info.get("like_count"),
                    "upload_date": info.get("upload_date"),
                    "thumbnail": f"/api/thumbnail/{info.get('id')}" if info.get('id') else None,
                    "available_qualities": qualities
                })
            
        return jsonify({"error": "Invalid URL type"}), 400
        
    except Exception as e:
        logger.error(f"Error in get_video_info: {str(e)}")
        return jsonify({"error": f"Failed to extract video information: {str(e)}"}), 500

@app.route("/api/download", methods=["POST"])
def download_video():
    """Download video or playlist (video or audio)"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No JSON data provided"}), 400
        
        url = data.get("url", "").strip()
        format_type = data.get("format", "mp4").lower()
        quality = data.get("quality", "720")
        audio_only = data.get("audio_only", False)
        
        # Validate inputs
        is_valid, message = validate_url(url)
        if not is_valid:
            return jsonify({"error": message}), 400
        
        if audio_only:
            if format_type not in ["mp3", "aac", "m4a", "wav", "opus"]:
                return jsonify({"error": "Invalid audio format. Supported: mp3, aac, m4a, wav, opus"}), 400
        else:
            if format_type not in ["mp4", "webm", "mkv"]:
                return jsonify({"error": "Invalid format. Supported: mp4, webm, mkv"}), 400
        
        # Check video availability
        if not is_video_available(url):
            return jsonify({"error": "Video is unavailable or private"}), 404
        
        is_playlist = re.match(PLAYLIST_REGEX, url)
        
        # Create session directory
        session_id = str(uuid.uuid4())
        session_dir = os.path.join(DOWNLOAD_DIR, session_id)
        os.makedirs(session_dir, exist_ok=True)
        
        try:
            ydl_opts = downloader.get_download_opts(format_type, quality, session_dir, audio_only)
            
            with YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=True)
            
            # Handle playlist downloads
            if is_playlist or ("entries" in info and info.get("_type") == "playlist"):
                zip_filename = f"playlist_{session_id}.zip"
                zip_path = os.path.join(DOWNLOAD_DIR, zip_filename)
                
                with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                    for root, _, files in os.walk(session_dir):
                        for file in files:
                            file_path = os.path.join(root, file)
                            arcname = os.path.relpath(file_path, session_dir)
                            zipf.write(file_path, arcname)
                
                # Cleanup session directory
                shutil.rmtree(session_dir, ignore_errors=True)
                
                # Check file size
                if os.path.getsize(zip_path) > MAX_FILE_SIZE:
                    os.remove(zip_path)
                    return jsonify({"error": "Downloaded file exceeds size limit"}), 413
                
                return send_file(
                    zip_path,
                    as_attachment=True,
                    download_name=f"{info.get('title', 'playlist')}.zip"
                )
            
            # Handle single video/audio download
            else:
                files = [f for f in os.listdir(session_dir) if os.path.isfile(os.path.join(session_dir, f))]
                if not files:
                    return jsonify({"error": "No file was downloaded"}), 500
                
                downloaded_file = os.path.join(session_dir, files[0])
                
                # Check file size
                if os.path.getsize(downloaded_file) > MAX_FILE_SIZE:
                    shutil.rmtree(session_dir, ignore_errors=True)
                    return jsonify({"error": "Downloaded file exceeds size limit"}), 413
                
                # Move file to downloads directory for serving
                final_filename = f"{session_id}_{files[0]}"
                final_path = os.path.join(DOWNLOAD_DIR, final_filename)
                shutil.move(downloaded_file, final_path)
                shutil.rmtree(session_dir, ignore_errors=True)
                
                return send_file(
                    final_path,
                    as_attachment=True,
                    download_name=files[0]
                )
                
        except Exception as e:
            # Cleanup on error
            if os.path.exists(session_dir):
                shutil.rmtree(session_dir, ignore_errors=True)
            raise e
            
    except Exception as e:
        logger.error(f"Error in download_video: {str(e)}")
        return jsonify({"error": f"Download failed: {str(e)}"}), 500

@app.route("/api/thumbnail/<video_id>")
def serve_thumbnail(video_id):
    """Serve video thumbnail"""
    try:
        # Validate video_id
        if not re.match(r'^[A-Za-z0-9_-]+$', video_id):
            return "Invalid video ID", 400
        
        thumbnail_path = os.path.join(THUMBNAIL_DIR, f"{video_id}.jpg")
        if os.path.exists(thumbnail_path):
            return send_file(thumbnail_path, mimetype='image/jpeg')
        
        return "Thumbnail not found", 404
        
    except Exception as e:
        logger.error(f"Error serving thumbnail {video_id}: {str(e)}")
        return "Server error", 500

@app.route("/api/formats/<video_id>")
def get_video_formats(video_id):
    """Get detailed format information for a video"""
    try:
        if not re.match(r'^[A-Za-z0-9_-]+$', video_id):
            return jsonify({"error": "Invalid video ID"}), 400
        
        url = f"https://www.youtube.com/watch?v={video_id}"
        ydl_opts = downloader.get_info_opts()
        
        with YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            formats = info.get("formats", [])
            
            processed_formats = []
            for f in formats:
                processed_formats.append({
                    "format_id": f.get("format_id"),
                    "ext": f.get("ext"),
                    "height": f.get("height"),
                    "width": f.get("width"),
                    "fps": f.get("fps"),
                    "filesize": f.get("filesize"),
                    "acodec": f.get("acodec", "none"),
                    "vcodec": f.get("vcodec", "none"),
                    "abr": f.get("abr"),  # Audio bitrate
                    "asr": f.get("asr"),  # Audio sample rate
                    "audio_channels": f.get("audio_channels"),
                    "format_note": f.get("format_note"),
                    "url": f.get("url"),
                })
            
            return jsonify({
                "video_id": video_id,
                "formats": processed_formats
            })
            
    except Exception as e:
        logger.error(f"Error getting formats for {video_id}: {str(e)}")
        return jsonify({"error": str(e)}), 500

# Error handlers
@app.errorhandler(404)
def not_found(error):
    return jsonify({"error": "Endpoint not found"}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({"error": "Internal server error"}), 500

@app.errorhandler(413)
def request_entity_too_large(error):
    return jsonify({"error": "Request too large"}), 413

# Startup cleanup and periodic cleanup
def start_cleanup_scheduler():
    """Start background cleanup task"""
    def cleanup_worker():
        import time
        while True:
            time.sleep(CLEANUP_INTERVAL)
            cleanup_old_files()
    
    cleanup_thread = Thread(target=cleanup_worker, daemon=True)
    cleanup_thread.start()

if __name__ == "__main__":
    # Initial cleanup
    cleanup_old_files()
    
    # Start cleanup scheduler
    start_cleanup_scheduler()
    
    logger.info("Starting YouTube Downloader Backend v2.1")
    app.run(
        debug=False,  # Set to False in production
        host='0.0.0.0',
        port=5000,
        threaded=True
    )