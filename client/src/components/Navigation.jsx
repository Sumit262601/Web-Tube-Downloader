import React from 'react'
import { Link } from 'react-router';
import { Logo } from '../image/index'


const Navigation = () => {
    return (
        <nav className="bg-white dark:bg-emerald-950 w-full z-20 top-0 start-0 border-b border-gray-200 dark:border-gray-600">
            <div className="max-w-screen-xl flex flex-wrap items-center justify-between mx-auto p-4">
                <a href="/" className="flex items-center space-x-3 rtl:space-x-reverse">
                    <img src={Logo} className="h-14" alt="Logo" />
                </a>
                <div className="flex md:order-2 space-x-3 md:space-x-0 rtl:space-x-reverse">
                    <button type="button" className="text-white bg-emerald-700 hover:bg-emerald-800 focus:ring-4 focus:outline-none focus:ring-emerald- font-medium rounded-lg text-sm px-4 py-2 text-center dark:bg-emerald-600 dark:hover:bg-emerald-700 dark:focus:ring-emerald-800">Get started</button>
                </div>
                <div className="items-center justify-between hidden w-full md:flex md:w-auto">
                    <ul className="flex flex-col p-4 md:p-0 mt-4 font-medium border border-gray-100 rounded-lg bg-gray-50 md:space-x-8 rtl:space-x-reverse md:flex-row md:mt-0 md:border-0 md:bg-white dark:bg-emerald-800 md:dark:bg-emerald-950 dark:border-emerald-700">
                        <li>
                            <a href="/" className="block py-2 px-3 text-white text-xl bg-emerald-700 rounded-sm md:bg-transparent md:text-emerald-700 md:p-0 md:dark:text-emerald-500" aria-current="page">Home</a>
                        </li>

                    </ul>
                </div>
            </div>
        </nav>
    )
}

export default Navigation