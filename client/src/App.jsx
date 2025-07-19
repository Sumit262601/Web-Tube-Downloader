import React from 'react';
import Header from './components/Header';
import DownloaderForm from './components/DownloaderForm';
import FeaturesSection from './components/FeaturesSection';
import Footer from './components/Footer';
import Navigation from './components/Navigation';
import { Routes } from "react-router"

function App() {
  return (
    // Main container with gradient background and padding
    <>
      <Navigation />
      <div className="min-h-screen bg-[#37583D] flex justify-center items-start p-4 sm:p-8 font-sans">
        <div className="w-full max-w-4xl">
          <Header />
          {/* Main content card */}
          <DownloaderForm />
          <FeaturesSection />
        </div>
      </div>
      <Footer />
    </>
  );
}

export default App;