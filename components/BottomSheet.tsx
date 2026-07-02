'use client';
import { useRef, ReactNode } from 'react';

export default function BottomSheet({
  onClose,
  children,
  maxHeight = '92dvh',
  bg = 'bg-white',
  handleColor = 'bg-gray-300',
  overlayBg = 'bg-black/50 backdrop-blur-sm',
  sheetZ = 111,
  overlayZ = 110,
}: {
  onClose: () => void;
  children: ReactNode;
  maxHeight?: string;
  bg?: string;
  handleColor?: string;
  overlayBg?: string;
  sheetZ?: number;
  overlayZ?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const y0 = useRef(0);

  const onStart = (e: React.TouchEvent) => {
    y0.current = e.touches[0].clientY;
    if (ref.current) ref.current.style.transition = 'none';
  };
  const onMove = (e: React.TouchEvent) => {
    const d = e.touches[0].clientY - y0.current;
    if (d > 0 && ref.current) ref.current.style.transform = `translateY(${d}px)`;
  };
  const onEnd = (e: React.TouchEvent) => {
    const d = e.changedTouches[0].clientY - y0.current;
    if (!ref.current) return;
    ref.current.style.transition = 'transform 0.25s ease';
    if (d > 80) {
      ref.current.style.transform = 'translateY(110%)';
      setTimeout(onClose, 230);
    } else {
      ref.current.style.transform = 'translateY(0)';
    }
  };

  return (
    <>
      <div
        className={`fixed inset-0 ${overlayBg}`}
        style={{ zIndex: overlayZ }}
        onClick={onClose}
      />
      <div
        ref={ref}
        className={`fixed inset-x-0 bottom-0 rounded-t-3xl flex flex-col overflow-hidden ${bg}`}
        style={{ maxHeight, zIndex: sheetZ, paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* Handle — zona de deslizamiento */}
        <div
          className="flex justify-center pt-3 pb-2 shrink-0 touch-none select-none"
          onTouchStart={onStart}
          onTouchMove={onMove}
          onTouchEnd={onEnd}
        >
          <div className={`w-10 h-1 rounded-full ${handleColor}`} />
        </div>
        {children}
      </div>
    </>
  );
}
