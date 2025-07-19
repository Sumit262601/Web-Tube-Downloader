import React from 'react'

const Footer = () => {
    return (
        <div className="bg-[#37583D] border-t-2 border-[#fff] px-4 w-full">
            <div className="text-center text-white text-sm p-12">
                <p>&copy; {new Date().getFullYear()} NextTube. All rights reserved.</p>
                <p className="mt-2">Built with ❤️ by Sumit Kumar</p>
            </div>
        </div>
    )
}

export default Footer