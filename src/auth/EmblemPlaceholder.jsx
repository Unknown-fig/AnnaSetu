import React from 'react';

export function EmblemPlaceholder({ className = "h-12 w-12", title = "National Portal Emblem Placeholder" }) {
  // 24 spokes for Ashoka wheel style placeholder
  const spokes = Array.from({ length: 24 }, (_, i) => {
    const angle = (i * 360) / 24;
    return (
      <line
        key={i}
        x1="50"
        y1="50"
        x2="50"
        y2="18"
        stroke="#1e3a8a"
        strokeWidth="1.75"
        transform={`rotate(${angle} 50 50)`}
      />
    );
  });

  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      {/* Outer Golden/Amber Ring */}
      <circle cx="50" cy="50" r="47" fill="#ffffff" stroke="#f59e0b" strokeWidth="2.5" />
      {/* Inner Navy Ring */}
      <circle cx="50" cy="50" r="43" fill="none" stroke="#1e3a8a" strokeWidth="2" strokeDasharray="3 2" />
      <circle cx="50" cy="50" r="34" fill="#f8fafc" stroke="#1e3a8a" strokeWidth="2.5" />
      {/* Center Wheel Hub */}
      {spokes}
      <circle cx="50" cy="50" r="8" fill="#1e3a8a" stroke="#f59e0b" strokeWidth="1.5" />
      <circle cx="50" cy="50" r="3.5" fill="#ffffff" />
    </svg>
  );
}
