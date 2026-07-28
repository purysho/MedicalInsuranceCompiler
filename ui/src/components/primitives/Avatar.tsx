import React from "react";

export interface AvatarProps {
  name: string;
  src?: string;
  size?: number;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Avatar with initials fallback when no image is provided. */
export function Avatar({ name, src, size = 36 }: AvatarProps) {
  return (
    <span className="alc-avatar" style={{ width: size, height: size }} role="img" aria-label={name}>
      {src ? <img src={src} alt="" /> : <span aria-hidden="true">{initials(name)}</span>}
    </span>
  );
}
