import React from 'react'

export const Footer = () => {
    return (
        <div className="border-t-2 border-gray-500 mt-8 px-4 w-full">
            <div className="text-center text-gray-500 text-sm p-12">
                <p>&copy; {new Date().getFullYear()} NextTube. All rights reserved.</p>
                <p className="mt-2">Built with ❤️ by Sumit Kumar</p>
            </div>
        </div>
    )
}
