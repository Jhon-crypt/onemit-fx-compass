import { VertoFXRates, fetchVertoFXRates } from '@/services/api';
import { cacheWithExpiration } from '../cacheUtils';
import { raceWithTimeout } from '../apiUtils';
import { toast } from 'sonner';
import { logger } from '../logUtils';

// Storage key for the last API attempt timestamp
const LAST_API_ATTEMPT_STORAGE_KEY = 'lastVertoFxApiAttempt';

// Default rates that will always be used as fallback
const DEFAULT_VERTOFX_RATES: VertoFXRates = {
  USD: { buy: 1635, sell: 1600 },
  EUR: { buy: 1870, sell: 1805 },
  GBP: { buy: 2150, sell: 2080 },
  CAD: { buy: 1190, sell: 1140 }
};

// Local cache for last successful rate data
let lastSuccessfulVertoFxRates: VertoFXRates = { ...DEFAULT_VERTOFX_RATES };
let lastApiAttemptTimestamp: number = 0;
let lastApiSuccess: boolean = false;

/**
 * Get the last API attempt timestamp, checking both memory and localStorage
 */
export const getLastApiAttemptTimestamp = (): number => {
  // First check localStorage
  const storedTimestamp = window.localStorage.getItem(LAST_API_ATTEMPT_STORAGE_KEY);
  if (storedTimestamp) {
    const parsedTimestamp = parseInt(storedTimestamp, 10);
    if (!isNaN(parsedTimestamp)) {
      // Use the most recent timestamp (either in-memory or localStorage)
      lastApiAttemptTimestamp = Math.max(lastApiAttemptTimestamp, parsedTimestamp);
      return lastApiAttemptTimestamp;
    }
  }
  
  return lastApiAttemptTimestamp;
};

/**
 * Set the last API attempt timestamp in both memory and localStorage
 */
export const setLastApiAttemptTimestamp = (timestamp: number): void => {
  // Update both in-memory and localStorage values
  lastApiAttemptTimestamp = timestamp;
  window.localStorage.setItem(LAST_API_ATTEMPT_STORAGE_KEY, timestamp.toString());
};

/**
 * Force bypass the rate limiting cooldown
 */
export const bypassRateLimitingCooldown = (): void => {
  // Set timestamp to 1 minute ago to force a new API call
  const bypassTimestamp = Date.now() - 60000;
  setLastApiAttemptTimestamp(bypassTimestamp);
  logger.debug("[vertoRateLoader] Bypassing rate limiting cooldown");
};

/**
 * Load VertoFX rates with fallbacks
 */
export const loadVertoFxRates = async (
  isMobile: boolean = false,
  setVertoFxRates: (rates: VertoFXRates) => void,
  forceRefresh: boolean = false
): Promise<VertoFXRates> => {
  // Start by setting default rates immediately for faster UI response
  setVertoFxRates({ ...DEFAULT_VERTOFX_RATES });
  
  // Force bypass the rate limiting if requested
  if (forceRefresh) {
    bypassRateLimitingCooldown();
  }
  
  // On mobile, use cached values for immediate display
  if (isMobile && Object.keys(lastSuccessfulVertoFxRates).length > 0) {
    const cachedRates = cacheWithExpiration.get('vertoRates');
    
    if (cachedRates) {
      // Use the cached rates for UI
      setVertoFxRates(cachedRates);
      
      // In the background, try to load fresh rates
      setTimeout(async () => {
        try {
          const freshRates = await raceWithTimeout(
            fetchVertoFXRates(),
            3000,
            "VertoFX background update timeout"
          );
          
          if (freshRates && Object.keys(freshRates).length > 0) {
            setVertoFxRates(freshRates);
            lastSuccessfulVertoFxRates = { ...freshRates };
            lastApiSuccess = true;
            cacheWithExpiration.set('vertoRates', freshRates, 600000);
          } else {
            lastApiSuccess = false;
          }
        } catch (error) {
          console.error("[vertoRateLoader] Background update of VertoFX rates failed:", error);
          lastApiSuccess = false;
          // Ensure we use default rates if fetch fails
          setVertoFxRates({ ...lastSuccessfulVertoFxRates });
        } finally {
          setLastApiAttemptTimestamp(Date.now());
        }
      }, 100);
      
      return cachedRates;
    }
  }
  
  // Regular path - fetch directly
  try {
    const timeout = isMobile ? 3000 : 10000;
    
    // Only attempt API call if we haven't tried in the last 30 seconds OR if force refresh
    const lastAttemptTime = getLastApiAttemptTimestamp();
    const shouldCallApi = forceRefresh || (Date.now() - lastAttemptTime > 30000);
    
    if (shouldCallApi) {
      logger.debug("[vertoRateLoader] Fetching fresh VertoFX rates");
      const vertoRates = await raceWithTimeout(
        fetchVertoFXRates(),
        timeout,
        "VertoFX rates request timed out"
      );
      
      // Check if we got valid rates
      const hasValidRates = vertoRates && Object.keys(vertoRates).length > 0 && 
        Object.values(vertoRates).some(rate => 
          (rate.buy > 0 || rate.sell > 0)
        );
      
      if (hasValidRates) {
        lastSuccessfulVertoFxRates = { ...vertoRates };
        lastApiSuccess = true;
        cacheWithExpiration.set(
          'vertoRates', 
          vertoRates, 
          isMobile ? 600000 : 300000
        );
        setVertoFxRates(vertoRates);
        
        // If we had previously shown an error toast, show a success toast
        const isFirstSuccess = !lastApiSuccess;
        if (isFirstSuccess || forceRefresh) {
          toast.success("Market comparison data refreshed", {
            id: "vertofx-api-status",
          });
        }
        
        setLastApiAttemptTimestamp(Date.now());
        return vertoRates;
      } else {
        // If API returned no valid rates, use default values
        lastApiSuccess = false;
        
        // Show toast about API failure
        toast.error("Market data API connection failed", {
          id: "vertofx-api-status",
          description: "Using default comparison rates"
        });
        
        setVertoFxRates({ ...DEFAULT_VERTOFX_RATES });
        setLastApiAttemptTimestamp(Date.now());
        return { ...DEFAULT_VERTOFX_RATES };
      }
    } else {
      // If we recently tried and failed, don't spam the API
      logger.debug(`[vertoRateLoader] Rate limiting active, last attempt was ${(Date.now() - lastAttemptTime) / 1000}s ago`);
      if (Object.keys(lastSuccessfulVertoFxRates).length > 0 && 
          JSON.stringify(lastSuccessfulVertoFxRates) !== JSON.stringify(DEFAULT_VERTOFX_RATES)) {
        setVertoFxRates({ ...lastSuccessfulVertoFxRates });
        return { ...lastSuccessfulVertoFxRates };
      } else {
        setVertoFxRates({ ...DEFAULT_VERTOFX_RATES });
        return { ...DEFAULT_VERTOFX_RATES };
      }
    }
  } catch (error) {
    console.error("[vertoRateLoader] Error fetching market comparison rates:", error);
    lastApiSuccess = false;
    
    // Show toast about API failure
    toast.error("Market data API connection failed", {
      id: "vertofx-api-status",
      description: "Using default comparison rates"
    });
    
    // Always return valid default rates on error
    setVertoFxRates({ ...DEFAULT_VERTOFX_RATES });
    setLastApiAttemptTimestamp(Date.now());
    return { ...DEFAULT_VERTOFX_RATES };
  }
};

/**
 * Get the last successfully loaded VertoFX rates
 */
export const getLastSuccessfulVertoFxRates = (): VertoFXRates => {
  return { ...lastSuccessfulVertoFxRates };
};

/**
 * Reset the last successful VertoFX rates
 */
export const resetLastSuccessfulVertoFxRates = (): void => {
  // Don't completely empty, just reset to defaults
  lastSuccessfulVertoFxRates = { ...DEFAULT_VERTOFX_RATES };
};

/**
 * Check if we are currently using default rates
 */
export const isUsingDefaultVertoFxRates = (): boolean => {
  return JSON.stringify(lastSuccessfulVertoFxRates) === JSON.stringify(DEFAULT_VERTOFX_RATES) || !lastApiSuccess;
};

/**
 * Get the time since the last API attempt
 */
export const getLastApiAttemptTime = (): number => {
  return getLastApiAttemptTimestamp();
};
