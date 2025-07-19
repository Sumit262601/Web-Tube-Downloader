import React from 'react';

function FeatureCard({ icon, title, description }) {
    return (
        <div className="bg-white border border-gray-200 rounded-xl p-6 text-left transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:border-gray-300">
            <div className="text-[#764ba2] mb-4">
                {icon}
            </div>
            <h3 className="font-bold text-gray-800 mb-2 text-base">
                {title}
            </h3>
            <p className="text-sm text-gray-600 leading-relaxed">
                {description}
            </p>
        </div>
    );
}

export default FeatureCard;