
import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Maximize2, X } from 'lucide-react';

interface ProductGalleryProps {
  images: string[];
  autoPlay?: boolean;
}

const ProductGallery: React.FC<ProductGalleryProps> = ({ images, autoPlay = false }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Filter out empty or undefined images
  const validImages = images.filter(Boolean);

  const next = useCallback(() => {
    if (isTransitioning || validImages.length <= 1) return;
    setIsTransitioning(true);
    setCurrentIndex((prev) => (prev + 1) % validImages.length);
    setTimeout(() => setIsTransitioning(false), 500);
  }, [isTransitioning, validImages.length]);

  const prev = useCallback(() => {
    if (isTransitioning || validImages.length <= 1) return;
    setIsTransitioning(true);
    setCurrentIndex((prev) => (prev - 1 + validImages.length) % validImages.length);
    setTimeout(() => setIsTransitioning(false), 500);
  }, [isTransitioning, validImages.length]);

  useEffect(() => {
    if (autoPlay && validImages.length > 1) {
      const interval = setInterval(next, 5000);
      return () => clearInterval(interval);
    }
  }, [autoPlay, validImages.length, next]);

  // Keyboard listeners for navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'Escape' && isFullscreen) setIsFullscreen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [prev, next, isFullscreen]);

  // Sync index if images change
  useEffect(() => {
    if (currentIndex >= validImages.length && validImages.length > 0) {
      setCurrentIndex(validImages.length - 1);
    }
  }, [validImages.length, currentIndex]);

  const goTo = (index: number) => {
    if (index === currentIndex || isTransitioning) return;
    setIsTransitioning(true);
    setCurrentIndex(index);
    setTimeout(() => setIsTransitioning(false), 500);
  };

  if (validImages.length === 0) {
    return (
      <div className="w-full aspect-square bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-300">
        <Maximize2 size={40} className="mb-2 opacity-20" />
        <span className="text-[10px] font-black uppercase tracking-widest">No images available</span>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      {/* Fullscreen Lightbox */}
      {isFullscreen && (
        <div 
          className="fixed inset-0 z-100 bg-black flex items-center justify-center animate-in fade-in duration-300"
          onClick={() => setIsFullscreen(false)}
        >
          <button 
            className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all z-10"
            onClick={() => setIsFullscreen(false)}
          >
            <X size={24} />
          </button>
          
          <div className="relative w-full h-full flex items-center justify-center p-4">
            <img 
              src={validImages[currentIndex]} 
              alt="Fullscreen view" 
              className="max-w-full max-h-full object-contain shadow-2xl animate-in zoom-in-95 duration-300"
              onClick={(e) => e.stopPropagation()}
            />

            {validImages.length > 1 && (
              <>
                <button 
                  onClick={(e) => { e.stopPropagation(); prev(); }}
                  className="absolute left-6 p-4 bg-white/10 hover:bg-white/20 text-white rounded-2xl transition-all"
                >
                  <ChevronLeft size={32} strokeWidth={3} />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); next(); }}
                  className="absolute right-6 p-4 bg-white/10 hover:bg-white/20 text-white rounded-2xl transition-all"
                >
                  <ChevronRight size={32} strokeWidth={3} />
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Main Slider Display */}
      <div className="relative aspect-square group overflow-hidden rounded-3xl bg-white shadow-xl border border-slate-100">
        <div className="absolute inset-0 flex transition-transform duration-700 ease-in-out" style={{ transform: `translateX(-${currentIndex * 100}%)` }}>
          {validImages.map((img, i) => (
            <div key={i} className="min-w-full h-full cursor-zoom-in" onClick={() => setIsFullscreen(true)}>
              <img 
                src={img} 
                alt={`Perspective ${i + 1}`} 
                className="w-full h-full object-cover" 
              />
            </div>
          ))}
        </div>

        {/* Gradient Overlay */}
        <div className="absolute inset-x-0 bottom-0 h-1/4 bg-linear-to-t from-black/30 to-transparent pointer-events-none" />
        
        {validImages.length > 1 && (
          <>
            {/* Nav Controls */}
            <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 px-2">
              <button 
                onClick={(e) => { e.stopPropagation(); prev(); }}
                className="p-2 bg-white/90 backdrop-blur-md rounded-xl text-slate-900 shadow-lg hover:bg-indigo-600 hover:text-white transition-all active:scale-90"
              >
                <ChevronLeft size={18} strokeWidth={3} />
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); next(); }}
                className="p-2 bg-white/90 backdrop-blur-md rounded-xl text-slate-900 shadow-lg hover:bg-indigo-600 hover:text-white transition-all active:scale-90"
              >
                <ChevronRight size={18} strokeWidth={3} />
              </button>
            </div>
            
            {/* Dots */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex space-x-1.5">
              {validImages.map((_, i) => (
                <button 
                  key={i}
                  onClick={() => goTo(i)}
                  className={`h-1.5 rounded-full transition-all duration-500 ${i === currentIndex ? 'bg-white w-5 shadow-sm' : 'bg-white/40 w-1.5 hover:bg-white/60'}`} 
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Thumbnails */}
      {validImages.length > 1 && (
        <div className="flex justify-center gap-2 overflow-x-auto py-1 scrollbar-hide">
          {validImages.map((img, i) => (
            <button 
              key={i} 
              onClick={() => goTo(i)}
              className={`shrink-0 w-12 h-12 rounded-lg overflow-hidden border-2 transition-all ${
                currentIndex === i 
                ? 'border-indigo-600 ring-2 ring-indigo-600/10 scale-105' 
                : 'border-transparent opacity-50 hover:opacity-100'
              }`}
            >
              <img src={img} alt={`thumb ${i}`} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProductGallery;
