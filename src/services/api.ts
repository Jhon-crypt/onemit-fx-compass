
import { fetchExchangeRates } from './currency-rates-service';
import { getAllNgnRates, VertoFxRate } from './vertofx';
import { saveVertoFxHistoricalRates } from './vertofx-historical-service';
import { toast } from "sonner";
import { cacheWithExpiration } from '@/utils/cacheUtils';

// Type for currency rates
export type CurrencyRates = Record<string, number>;

// Type for VertoFX rates
export type VertoFXRates = Record<string, { buy: number; sell: number }>;

// Global variable to store current cost prices for the API endpoint
let currentCostPrices: CurrencyRates = {};

// Cache keys
const FX_RATES_CACHE_KEY = 'fx_rates_cache';
const VERTOFX_RATES_CACHE_KEY = 'formatted_vertofx_rates';

// Update current cost prices (called by the cost price calculator)
export const updateCurrentCostPrices = (costPrices: CurrencyRates) => {
  currentCostPrices = { ...costPrices };
};

// Get current cost prices (used by the API endpoint)
export const getCurrentCostPrices = (): CurrencyRates => {
  return { ...currentCostPrices };
};

// Fetch FX rates from currency-rates-service with improved caching
export const fetchFxRates = async (): Promise<CurrencyRates> => {
  // Check cache first
  const cachedRates = cacheWithExpiration.get(FX_RATES_CACHE_KEY);
  if (cachedRates) {
    console.log("[API] Using cached FX rates");
    return cachedRates;
  }
  
  const supportedCurrencies = ['USD', 'EUR', 'GBP', 'CAD'];
  try {
    const rates = await fetchExchangeRates(supportedCurrencies);
    // Cache for 10 minutes
    cacheWithExpiration.set(FX_RATES_CACHE_KEY, rates, 10 * 60 * 1000);
    return rates;
  } catch (error) {
    console.error("[API] Error fetching FX rates:", error);
    throw error;
  }
};

// Default VertoFX rates to use as fallback
const DEFAULT_VERTOFX_RATES: VertoFXRates = {
  USD: { buy: 1635, sell: 1600 },
  EUR: { buy: 1870, sell: 1805 },
  GBP: { buy: 2150, sell: 2080 },
  CAD: { buy: 1190, sell: 1140 }
};

// In-memory cache for VertoFX rates to use if API calls fail
let cachedVertoFxRates: VertoFXRates = { ...DEFAULT_VERTOFX_RATES };

// Fetch VertoFX rates - optimized with smarter caching
export const fetchVertoFXRates = async (): Promise<VertoFXRates> => {
  // Check cache first for faster responses
  const cachedRates = cacheWithExpiration.get(VERTOFX_RATES_CACHE_KEY);
  if (cachedRates) {
    console.log("[API] Using cached VertoFX rates");
    return cachedRates;
  }
  
  try {
    console.log("[API] Fetching live VertoFX rates...");
    
    // Add a shorter 5 second timeout (reduced from 10s)
    const timeoutPromise = new Promise<Record<string, VertoFxRate>>((_resolve, reject) => {
      setTimeout(() => reject(new Error("VertoFX API request timed out")), 5000);
    });
    
    // Race between the API call and the timeout
    const vertoRates = await Promise.race([getAllNgnRates(), timeoutPromise]);
    
    // Convert the API response format to our app's expected format
    const formattedRates: VertoFXRates = {
      USD: { buy: 0, sell: 0 },
      EUR: { buy: 0, sell: 0 },
      GBP: { buy: 0, sell: 0 },
      CAD: { buy: 0, sell: 0 }
    };
    
    // Process rates
    for (const currency of ['USD', 'EUR', 'GBP', 'CAD']) {
      // Process NGN-XXX rates (NGN to foreign currency - this is our "buy" rate)
      const ngnToForeignKey = `NGN-${currency}`;
      if (vertoRates[ngnToForeignKey]) {
        // Convert the inverse rate to the actual rate in NGN
        if (vertoRates[ngnToForeignKey].rate > 0) {
          formattedRates[currency].buy = 1 / vertoRates[ngnToForeignKey].rate;
        }
      }
      
      // Process XXX-NGN rates (foreign currency to NGN - this is our "sell" rate)
      const foreignToNgnKey = `${currency}-NGN`;
      if (vertoRates[foreignToNgnKey]) {
        formattedRates[currency].sell = vertoRates[foreignToNgnKey].rate;
      }
    }
    
    // Verify we have valid rates before updating the cache
    const hasValidRates = Object.values(formattedRates).some(rate => 
      (rate.buy > 0 || rate.sell > 0)
    );
    
    if (hasValidRates) {
      // Update the cache with new valid rates
      cachedVertoFxRates = { ...formattedRates };
      
      // Cache in the browser for 5 minutes
      cacheWithExpiration.set(VERTOFX_RATES_CACHE_KEY, formattedRates, 5 * 60 * 1000);
      
      // Save historical VertoFX rates to database in background
      Promise.resolve().then(async () => {
        try {
          await saveVertoFxHistoricalRates(vertoRates);
        } catch (error) {
          console.error("[API] Error saving historical VertoFX rates:", error);
        }
      });
      
      return formattedRates;
    } else {
      console.warn("[API] No valid rates found in API response, using cached rates");
      return { ...cachedVertoFxRates };
    }
  } catch (error) {
    console.error("[API] Error fetching VertoFX rates:", error);
    
    // Only show toast when not silent refresh
    if (!cacheWithExpiration.get(VERTOFX_RATES_CACHE_KEY)) {
      toast.warning("Using cached VertoFX rates - couldn't connect to provider");
    }
    
    return { ...cachedVertoFxRates };
  }
};
