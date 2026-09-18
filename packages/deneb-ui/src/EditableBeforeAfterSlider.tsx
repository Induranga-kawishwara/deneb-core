'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { EditableImage } from './EditableImage';
import { EditableText } from './EditableText';

export interface EditableBeforeAfterSliderProps extends React.HTMLAttributes<HTMLDivElement> {
  beforeImageId?: string;
  afterImageId?: string;
  defaultBeforeImage?: string;
  defaultAfterImage?: string;
  beforeLabelId?: string;
  defaultBeforeLabel?: string;
  afterLabelId?: string;
  defaultAfterLabel?: string;
  initialPosition?: number;
  aspectRatio?: string;
  handleColor?: string;
}

export function EditableBeforeAfterSlider({
  beforeImageId = 'home.showcase.beforeImage',
  afterImageId = 'home.showcase.afterImage',
  defaultBeforeImage = 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=1200&q=80',
  defaultAfterImage = 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=1200&q=80',
  beforeLabelId = 'home.showcase.beforeLabel',
  defaultBeforeLabel = 'Before',
  afterLabelId = 'home.showcase.afterLabel',
  defaultAfterLabel = 'After',
  initialPosition = 50,
  aspectRatio = '16 / 9',
  handleColor = '#ffffff',
  className = '',
  style,
  ...props
}: EditableBeforeAfterSliderProps) {
  const [sliderPos, setSliderPos] = useState(initialPosition);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPos(percentage);
  }, []);

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!isDragging || !e.touches[0]) return;
      updatePosition(e.touches[0].clientX);
    },
    [isDragging, updatePosition]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;
      updatePosition(e.clientX);
    },
    [isDragging, updatePosition]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove);
      window.addEventListener('touchend', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp, handleTouchMove]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      setSliderPos((prev) => Math.max(0, prev - 5));
    } else if (e.key === 'ArrowRight') {
      setSliderPos((prev) => Math.min(100, prev + 5));
    }
  };

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className={`editable-before-after-slider relative overflow-hidden select-none cursor-ew-resize rounded-2xl shadow-xl ${className}`.trim()}
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio,
        userSelect: 'none',
        overflow: 'hidden',
        outline: 'none',
        ...style,
      }}
      onMouseDown={(e) => {
        setIsDragging(true);
        updatePosition(e.clientX);
      }}
      onTouchStart={(e) => {
        if (e.touches[0]) {
          setIsDragging(true);
          updatePosition(e.touches[0].clientX);
        }
      }}
      {...props}
    >
      {/* After Image (Full Base) */}
      <div style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        <EditableImage
          id={afterImageId}
          src={defaultAfterImage}
          alt="After transformation"
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
        {/* After Label */}
        <div
          style={{
            position: 'absolute',
            bottom: '1rem',
            right: '1rem',
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(8px)',
            color: '#ffffff',
            padding: '0.25rem 0.75rem',
            borderRadius: '9999px',
            fontSize: '0.75rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            pointerEvents: 'auto',
          }}
        >
          <EditableText id={afterLabelId} defaultValue={defaultAfterLabel} as="span" />
        </div>
      </div>

      {/* Before Image (Clipped Overlay) */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          bottom: 0,
          width: `${sliderPos}%`,
          overflow: 'hidden',
          borderRight: `2px solid ${handleColor}`,
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: containerRef.current ? `${containerRef.current.clientWidth}px` : '100%',
            height: '100%',
          }}
        >
          <EditableImage
            id={beforeImageId}
            src={defaultBeforeImage}
            alt="Before transformation"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>
        {/* Before Label */}
        <div
          style={{
            position: 'absolute',
            bottom: '1rem',
            left: '1rem',
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(8px)',
            color: '#ffffff',
            padding: '0.25rem 0.75rem',
            borderRadius: '9999px',
            fontSize: '0.75rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            pointerEvents: 'auto',
          }}
        >
          <EditableText id={beforeLabelId} defaultValue={defaultBeforeLabel} as="span" />
        </div>
      </div>

      {/* Center Draggable Handle */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: `${sliderPos}%`,
          transform: 'translateX(-50%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            width: '40px',
            height: '40px',
            backgroundColor: handleColor,
            borderRadius: '9999px',
            boxShadow: '0 4px 14px 0 rgba(0, 0, 0, 0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'ew-resize',
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#1e293b"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            data-preview-static="slider-arrows"
          >
            <polyline points="15 18 9 12 15 6" />
            <polyline points="9 18 3 12 9 6" />
          </svg>
        </div>
      </div>
    </div>
  );
}

export const BeforeAfterSlider = EditableBeforeAfterSlider;
