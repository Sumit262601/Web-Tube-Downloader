import React, { useState } from 'react';

function DownloaderForm() {
  const [url, setUrl] = useState('');
  const [showOptions, setShowOptions] = useState(false);

  const handleChange = (e) => {
    const value = e.target.value;
    setUrl(value);

    // Basic YouTube URL check (can be improved as needed)
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/;
    if (youtubeRegex.test(value)) {
      setShowOptions(true);
    } else {
      setShowOptions(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Logic for submitting goes here
  };

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden mb-10 bg-white shadow-xl p-6 sm:p-10">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="youtube-url" className="block text-sm font-medium text-gray-700 mb-2">
            YouTube URL
          </label>
          <input
            type="text"
            id="youtube-url"
            value={url}
            onChange={handleChange}
            className="block w-full p-3 bg-gray-100 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition"
            placeholder="Paste your video link here"
          />
        </div>

        {showOptions && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label htmlFor="format" className="block text-sm font-medium text-gray-700 mb-2">
                  Format
                </label>
                <select id="format" className="block w-full p-3 bg-gray-100 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition">
                  <option>MP4 (Video)</option>
                  <option>MP3 (Audio)</option>
                  <option>WAV (Audio)</option>
                </select>
              </div>
              <div>
                <label htmlFor="quality" className="block text-sm font-medium text-gray-700 mb-2">
                  Quality
                </label>
                <select id="quality" className="block w-full p-3 bg-gray-100 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition">
                  <option>240p</option>
                  <option>360p</option>
                  <option>480p</option>
                  <option>720p</option>
                  <option>1080p</option>
                  <option>1440p 2k</option>
                  <option>2160p 4K</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-[#667eea] to-[#764ba2] 
                text-white font-bold py-3 px-4 
                rounded-lg hover:shadow-lg 
                hover:-translate-y-0.5 
                transform transition-all 
                duration-200 focus:outline-none 
                focus:ring-2 focus:ring-offset-2 
                focus:ring-purple-500"
            >
              DOWNLOAD VIDEO
            </button>
          </>
        )}
      </form>
    </div>
  );
}

export default DownloaderForm;
