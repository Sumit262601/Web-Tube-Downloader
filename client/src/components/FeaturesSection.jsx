import React from 'react';
import FeatureCard from './FeatureCard';
import { FiFastForward, FiPackage, FiZap, FiLock, FiCpu, FiLayers } from 'react-icons/fi';

const featuresData = [
    { icon: <FiFastForward size={24} />, title: 'High Speed Downloads', description: 'Concurrent downloads with optimized performance and retry mechanisms for reliable transfers' },
    { icon: <FiCpu size={24} />, title: 'Cookie Support', description: 'Automatic browser cookie detection to bypass login requirements and access private content' },
    { icon: <FiLayers size={24} />, title: 'Multiple Formats', description: 'Support for MP4, MP3, WAV formats with quality selection up to 4K resolution' },
    { icon: <FiPackage size={24} />, title: 'Batch Processing', description: 'Download multiple videos, entire playlists, or custom batches with automatic ZIP packaging' },
    { icon: <FiLock size={24} />, title: 'Privacy Focused', description: 'No data logging, temporary file cleanup, and secure processing of your downloads' },
    { icon: <FiZap size={24} />, title: 'Smart Technology', description: 'Advanced yt-dlp integration with user-agent rotation and anti-detection features' },
];

function FeaturesSection() {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuresData.map((feature, index) => (
                <FeatureCard
                    key={index}
                    icon={feature.icon}
                    title={feature.title}
                    description={feature.description}
                />
            ))}
        </div>
    );
}

export default FeaturesSection;