"use client";

import React, { useState, useEffect } from "react";
import { getStaffToken, API_BASE_URL } from "./api-client";

/**
 * Fetches a private file using the authenticated staff token and returns a local Blob URL.
 */
export async function fetchPrivateAssetBlobUrl(endpointOrPath: string): Promise<string> {
  const token = getStaffToken();
  const url = endpointOrPath.startsWith("http")
    ? endpointOrPath
    : `${API_BASE_URL}${endpointOrPath.startsWith("/") ? "" : "/"}${endpointOrPath}`;

  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error(`Failed to load private document: HTTP ${res.status}`);
  }

  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

/**
 * Downloads a private file with authorization headers.
 */
export async function downloadPrivateAsset(
  endpointOrPath: string,
  filename = "document",
): Promise<void> {
  const blobUrl = await fetchPrivateAssetBlobUrl(endpointOrPath);
  try {
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } finally {
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
  }
}

/**
 * React hook to fetch and memoize a Blob URL for private documents.
 * Automatically handles cleanup and URL revocation.
 */
export function usePrivateAsset(endpointOrPath?: string | null) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!endpointOrPath) {
      setBlobUrl(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    let active = true;
    let createdUrl: string | null = null;
    setIsLoading(true);
    setError(null);

    fetchPrivateAssetBlobUrl(endpointOrPath)
      .then((url) => {
        if (!active) {
          URL.revokeObjectURL(url);
          return;
        }
        createdUrl = url;
        setBlobUrl(url);
        setIsLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message || "Failed to load document");
        setIsLoading(false);
      });

    return () => {
      active = false;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [endpointOrPath]);

  return { blobUrl, isLoading, error };
}

/**
 * Image component that loads an authenticated private document via blob URL.
 */
export function PrivateImage({
  endpointOrPath,
  alt,
  className,
  fallback,
}: {
  endpointOrPath?: string | null;
  alt?: string;
  className?: string;
  fallback?: React.ReactNode;
}) {
  const { blobUrl, isLoading, error } = usePrivateAsset(endpointOrPath);

  if (isLoading) {
    return <div className={`animate-pulse bg-slate-200 dark:bg-slate-700 ${className || ""}`} />;
  }

  if (error || !blobUrl) {
    return fallback ? <>{fallback}</> : null;
  }

  return (
    <img
      src={blobUrl}
      alt={alt || "Private document"}
      className={className}
    />
  );
}
