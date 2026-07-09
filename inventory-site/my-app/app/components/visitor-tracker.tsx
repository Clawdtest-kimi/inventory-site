'use client';

import { useEffect } from 'react';

export default function VisitorTracker() {
  useEffect(() => {
    // Fire and forget — notify backend of visitor
    fetch('/api/visitor-notify', {
      method: 'GET',
    }).catch(() => {
      // Silent fail — don't affect UX
    });
  }, []);

  return null;
}