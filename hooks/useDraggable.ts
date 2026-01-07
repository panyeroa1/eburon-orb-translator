
import React, { useState, useCallback, useEffect } from 'react';
import { ORB_SIZE } from '../constants';

export const useDraggable = (initialX: number, initialY: number) => {
  const [position, setPosition] = useState({ x: initialX, y: initialY });
  const [isDragging, setIsDragging] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  /**
   * Clamps a coordinate within the viewport boundaries
   * accounting for the fixed ORB_SIZE.
   */
  const clampPosition = useCallback((x: number, y: number) => {
    const maxX = window.innerWidth - ORB_SIZE;
    const maxY = window.innerHeight - ORB_SIZE;
    
    // Ensure we don't return negative limits if viewport is smaller than ORB_SIZE
    const safeMaxX = Math.max(0, maxX);
    const safeMaxY = Math.max(0, maxY);

    return {
      x: Math.max(0, Math.min(x, safeMaxX)),
      y: Math.max(0, Math.min(y, safeMaxY))
    };
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    setIsDragging(true);

    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    
    setOffset({
      x: clientX - position.x,
      y: clientY - position.y
    });
  }, [position]);

  const handleMouseMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDragging) return;

    const clientX = 'touches' in e ? (e as TouchEvent).touches[0].clientX : (e as MouseEvent).clientX;
    const clientY = 'touches' in e ? (e as TouchEvent).touches[0].clientY : (e as MouseEvent).clientY;

    const newPos = clampPosition(clientX - offset.x, clientY - offset.y);
    setPosition(newPos);
  }, [isDragging, offset, clampPosition]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Clamp initial position and handle edge cases on mount
  useEffect(() => {
    setPosition(prev => clampPosition(prev.x, prev.y));
  }, [clampPosition]);

  // Handle window resize to keep Orb in bounds if viewport shrinks
  useEffect(() => {
    const handleResize = () => {
      setPosition(prev => clampPosition(prev.x, prev.y));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [clampPosition]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleMouseMove, { passive: false });
      window.addEventListener('touchend', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleMouseMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return { position, isDragging, handleMouseDown };
};
