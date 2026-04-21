import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface CopyPopupNotificationProps {
  anchorElement: HTMLElement | null;
  text: string;
  columnName?: string;
  columnNumber?: number;
  isActive: boolean;
  onClose: () => void;
}

export const CopyPopupNotification: React.FC<CopyPopupNotificationProps> = ({
  anchorElement,
  text,
  columnName,
  columnNumber,
  isActive,
  onClose,
}) => {
  const [popupStyle, setPopupStyle] = useState<React.CSSProperties>({ visibility: 'hidden', opacity: 0 });
  const [timeLeft, setTimeLeft] = useState(2.0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const onCloseRef = useRef(onClose);

  // Update ref when onClose changes
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const updatePosition = () => {
    if (anchorElement) {
      const rect = anchorElement.getBoundingClientRect();
      const isTooCloseToLeft = rect.left < 290;
      const isOutOfView = rect.bottom < 0 || rect.top > window.innerHeight;

      setPopupStyle({
        position: 'fixed',
        bottom: window.innerHeight - rect.top + 8,
        ...(isTooCloseToLeft 
            ? { left: Math.max(10, rect.left), right: 'auto' } 
            : { right: window.innerWidth - rect.right, left: 'auto' }),
        zIndex: 999999,
        opacity: isOutOfView ? 0 : 1,
        visibility: isOutOfView ? 'hidden' : 'visible',
        transition: 'opacity 0.2s ease',
      });
    }
  };

  useEffect(() => {
    if (isActive && anchorElement) {
      updatePosition();
      
      // Add listeners for scroll and resize
      const handleUpdate = () => updatePosition();
      window.addEventListener('scroll', handleUpdate, true);
      window.addEventListener('resize', handleUpdate);
      
      setTimeLeft(2.0);
      
      intervalRef.current = setInterval(() => {
        setTimeLeft(prev => Math.max(0, prev - 0.1));
      }, 100);

      timerRef.current = setTimeout(() => {
        onCloseRef.current();
      }, 2000);

      return () => {
        window.removeEventListener('scroll', handleUpdate, true);
        window.removeEventListener('resize', handleUpdate);
        if (timerRef.current) clearTimeout(timerRef.current);
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    }
  }, [isActive, anchorElement]);

  if (!isActive || !anchorElement) return null;

  return createPortal(
    <div 
      style={popupStyle} 
      className="w-max min-w-[140px] max-w-[90vw] sm:max-w-[280px] bg-[#2b579a] border-[3px] border-[#4facfe] p-2.5 rounded-[12px] shadow-2xl flex flex-col items-center relative overflow-hidden"
    >
      <div className="w-full text-center tracking-wider flex flex-col items-center z-10">
        {columnName && (
          <>
            <span className="text-[11px] font-bold text-[#141414] uppercase leading-tight">
              {columnNumber ? `${columnNumber}. ` : ''}{columnName}
            </span>
            <div className="my-1 w-full h-[1px] bg-[#4facfe]/30"></div>
          </>
        )}
        <span className="uppercase text-white text-[10px] font-extrabold opacity-80">Copied</span>
      </div>
      
      <div className="text-[16px] font-[800] text-[#fac800] leading-snug break-words text-center mt-1 mb-2 z-10">
        {text}
      </div>

      <div className="text-[10px] font-bold text-white absolute bottom-1 left-2 z-20">
        {timeLeft.toFixed(1)}s
      </div>
      
      <div 
        className="absolute bottom-0 left-0 h-[3px] bg-[#4facfe]" 
        style={{ animation: 'shrinkBar 2s linear forwards' }}
      ></div>
      <style>{`
        @keyframes shrinkBar {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>,
    document.body
  );
};
