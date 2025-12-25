import { useState, useCallback, useEffect } from 'react';
import { useMobileDetection } from './useMobileDetection';

interface BiometricCredential {
  id: string;
  email: string;
  userId: string;
}

// Helper function to convert base64url to Uint8Array
function base64UrlToUint8Array(base64Url: string): Uint8Array {
  // Convert base64url to base64
  let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  
  // Add padding if needed
  while (base64.length % 4) {
    base64 += '=';
  }
  
  // Decode base64 to binary string
  const binaryString = atob(base64);
  
  // Convert binary string to Uint8Array
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  return bytes;
}

/**
 * Hook to handle biometric authentication (fingerprint/face ID) for mobile devices only
 * Uses Web Authentication API (WebAuthn)
 */
export function useBiometricAuth() {
  const isMobile = useMobileDetection();
  const [isSupported, setIsSupported] = useState(false);
  const [hasCredentials, setHasCredentials] = useState(false);

  // Check if WebAuthn is supported and mobile
  useEffect(() => {
    const checkSupport = () => {
      const webauthnSupported = 
        typeof window !== 'undefined' &&
        typeof window.PublicKeyCredential !== 'undefined';
      
      const supported = webauthnSupported && isMobile;
      setIsSupported(supported);
      
      // Check if credentials exist
      if (supported) {
        const stored = localStorage.getItem('biometric_credential');
        setHasCredentials(!!stored);
      }
    };

    checkSupport();
  }, [isMobile]);

  // Register biometric credential (after successful password login)
  const registerBiometric = useCallback(async (email: string, userId: string): Promise<boolean> => {
    if (!isMobile || !isSupported) {
      console.log('Biometric not supported on this device');
      return false;
    }

    try {
      // Generate a random challenge (in production, get from server)
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);

      // Create credential
      const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
        challenge: challenge,
        rp: {
          name: "Manager Pro",
          id: window.location.hostname,
        },
        user: {
          id: new TextEncoder().encode(userId),
          name: email,
          displayName: email,
        },
        pubKeyCredParams: [
          { alg: -7, type: "public-key" }, // ES256
          { alg: -257, type: "public-key" } // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform", // Use device biometric
          userVerification: "required",
        },
        timeout: 60000,
        attestation: "none" // Don't need attestation for basic biometric
      };

      const credential = await navigator.credentials.create({
        publicKey: publicKeyCredentialCreationOptions
      }) as PublicKeyCredential;

      if (credential) {
        // Store credential ID and email
        const credentialData: BiometricCredential = {
          id: credential.id,
          email: email,
          userId: userId
        };
        
        localStorage.setItem('biometric_credential', JSON.stringify(credentialData));
        setHasCredentials(true);
        return true;
      }
    } catch (error: any) {
      console.error('Biometric registration error:', error);
      // User cancelled or error occurred
      if (error.name !== 'NotAllowedError' && error.name !== 'AbortError') {
        console.error('Unexpected error:', error);
      }
      return false;
    }

    return false;
  }, [isMobile, isSupported]);

  // Authenticate with biometric
  const authenticateBiometric = useCallback(async (): Promise<string | null> => {
    if (!isMobile || !isSupported || !hasCredentials) {
      return null;
    }

    try {
      const stored = localStorage.getItem('biometric_credential');
      if (!stored) {
        return null;
      }

      const credentialData: BiometricCredential = JSON.parse(stored);

      // Generate a random challenge (in production, get from server)
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);

      // Convert credential ID from base64url string to Uint8Array
      // The credential ID from WebAuthn is stored as base64url string
      let credentialId: Uint8Array;
      try {
        credentialId = base64UrlToUint8Array(credentialData.id);
      } catch (e) {
        // If base64url decoding fails, try comma-separated format (legacy)
        if (credentialData.id.includes(',')) {
          credentialId = Uint8Array.from(
            credentialData.id.split(',').map(Number)
          );
        } else {
          throw new Error('Invalid credential ID format');
        }
      }

      const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
        challenge: challenge,
        allowCredentials: [{
          id: credentialId,
          type: 'public-key',
          transports: ['internal'],
        }],
        userVerification: "required",
        timeout: 60000,
      };

      const assertion = await navigator.credentials.get({
        publicKey: publicKeyCredentialRequestOptions
      }) as PublicKeyCredential;

      if (assertion) {
        // Return the email associated with the credential
        return credentialData.email;
      }
    } catch (error: any) {
      console.error('Biometric authentication error:', error);
      // User cancelled, authentication failed, or error occurred
      if (error.name === 'NotAllowedError' || error.name === 'AbortError') {
        // User cancelled - don't show error
        return null;
      }
      return null;
    }

    return null;
  }, [isMobile, isSupported, hasCredentials]);

  // Remove biometric credential
  const removeBiometric = useCallback(() => {
    localStorage.removeItem('biometric_credential');
    setHasCredentials(false);
  }, []);

  return {
    isSupported,
    hasCredentials,
    registerBiometric,
    authenticateBiometric,
    removeBiometric,
  };
}

