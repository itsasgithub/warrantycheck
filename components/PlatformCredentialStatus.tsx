'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Platform } from '@/types/platform';
import { getPlatformCredentials } from '@/lib/storage';

interface PlatformCredentialStatusProps {
  platform: Platform;
}

export default function PlatformCredentialStatus({ platform }: PlatformCredentialStatusProps) {
  const [hasPlatformCredentials, setHasPlatformCredentials] = useState(true);
  
  useEffect(() => {
    const platformCreds = getPlatformCredentials();
    let hasCredentials = true;
    
    if (platform === Platform.DATTO_RMM) {
      hasCredentials = Boolean(
        platformCreds[Platform.DATTO_RMM]?.url && 
        platformCreds[Platform.DATTO_RMM]?.apiKey && 
        platformCreds[Platform.DATTO_RMM]?.secretKey
      );
    } else if (platform === Platform.NCENTRAL) {
      hasCredentials = Boolean(
        platformCreds[Platform.NCENTRAL]?.serverUrl && 
        platformCreds[Platform.NCENTRAL]?.apiToken
      );
    } else if (platform === Platform.HALOPSA) {
      hasCredentials = Boolean(
        platformCreds[Platform.HALOPSA]?.url && 
        platformCreds[Platform.HALOPSA]?.clientId && 
        platformCreds[Platform.HALOPSA]?.clientSecret
      );
    }
    // CSV does not require credentials in this context.
    else if (platform === Platform.CSV) {
        hasCredentials = true; 
    }
    
    setHasPlatformCredentials(hasCredentials);
  }, [platform]);
  
  if (hasPlatformCredentials || platform === Platform.CSV) { // Don't show message for CSV or if creds exist
    return null;
  }
  
  return (
    <p className="mt-2 text-sm text-amber-600">
      No credentials configured for {platform}.{' '}
      <Link href="/config" className="underline">
        Go to the Configuration page to add them.
      </Link>
    </p>
  );
} 