'use client';
import { useEffect, useState } from 'react';

interface Props {
  src: string;
  alt: string;
  onClose: () => void;
}

export function ImageLightbox({ src, alt, onClose }: Props) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => { setLoaded(false); }, [src]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const handleDownload = async () => {
    try {
      const res = await fetch(src, { mode: 'cors' });
      const blob = await res.blob();
      const ext = blob.type.split('/')[1] || 'jpg';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${alt.replace(/\s+/g, '_')}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      const a = document.createElement('a');
      a.href = src;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.click();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[500] bg-black flex flex-col"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {/* Toolbar */}
      <div className="shrink-0 flex justify-between items-center px-4 py-3 bg-black/80 backdrop-blur">
        <button
          onClick={onClose}
          className="flex items-center gap-2 text-white/80 hover:text-white active:text-white/60 transition-colors"
        >
          <i className="fa-solid fa-arrow-left text-lg" />
          <span className="text-sm font-semibold">Cerrar</span>
        </button>
        <span className="text-white/50 text-xs font-medium truncate max-w-[40%] text-center">{alt}</span>
        <button
          onClick={handleDownload}
          className="flex items-center gap-2 bg-white/10 hover:bg-white/20 active:bg-white/30 text-white px-3 py-2 rounded-xl text-sm font-semibold transition-colors"
        >
          <i className="fa-solid fa-download" />
          <span className="hidden sm:inline">Descargar</span>
        </button>
      </div>

      {/* Image - fills all remaining space */}
      <div
        className="flex-1 flex items-center justify-center overflow-hidden p-2 relative"
        onClick={onClose}
      >
        {!loaded && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 pointer-events-none">
            <div className="w-10 h-10 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            <p className="text-white/50 text-xs">Cargando imagen...</p>
          </div>
        )}
        <img
          key={src}
          src={src}
          alt={alt}
          className="max-w-full max-h-full object-contain select-none transition-opacity duration-300"
          style={{ opacity: loaded ? 1 : 0 }}
          onClick={e => e.stopPropagation()}
          onLoad={() => setLoaded(true)}
          onError={() => setLoaded(true)}
        />
      </div>
    </div>
  );
}
