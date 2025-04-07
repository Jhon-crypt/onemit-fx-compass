
// API service for fetching currency data

import { toast } from "sonner";

const BASE_URL = "/api"; // Would be updated to actual API endpoint in production
const API_KEY = 'fca_live_Go01rIgZxHqhRvqFQ2BLi6o5oZGoovGuZk3sQ8nV';

// Interface for currency rates
export interface CurrencyRates {
  [key: string]: number;
}

// Interface for VertoFX rates
export interface VertoFXRates {
  [key: string]: {
    buy: number;
    sell: number;
  };
}

// Mock data for development
const MOCK_FX_RATES: CurrencyRates = {
  EUR: 0.92,
  GBP: 0.79,
  CAD: 1.36,
  USD: 1.0,
};

const MOCK_VERTO_RATES: VertoFXRates = {
  USD: {
    buy: 1420,
    sell: 1400,
  },
  EUR: {
    buy: 1550,
    sell: 1530,
  },
  GBP: {
    buy: 1800,
    sell: 1780,
  },
  CAD: {
    buy: 1050,
    sell: 1030,
  },
};

// Fetch USDT to NGN rate
export const fetchUsdtNgnRate = async (): Promise<number> => {
  try {
    // Mock API call for development
    // In production, this would be an actual API call
    return Promise.resolve(1450);
  } catch (error) {
    toast.error("Failed to fetch USDT/NGN rate");
    console.error("Error fetching USDT/NGN rate:", error);
    return 0;
  }
};

// Update USDT to NGN rate
export const updateUsdtNgnRate = async (rate: number): Promise<boolean> => {
  try {
    // Mock API call for development
    // In production, this would be an actual API call
    console.log("Updating USDT/NGN rate to:", rate);
    return Promise.resolve(true);
  } catch (error) {
    toast.error("Failed to update USDT/NGN rate");
    console.error("Error updating USDT/NGN rate:", error);
    return false;
  }
};

// Fetch FX rates from Free Currency API
export const fetchFxRates = async (currencies: string[] = ["EUR", "GBP", "CAD"]): Promise<CurrencyRates> => {
  try {
    // In production, this would be an actual API call to FreeCurrencyAPI
    // const url = `https://api.freecurrencyapi.com/v1/latest?apikey=${API_KEY}&currencies=${currencies.join(",")}`;
    // const response = await fetch(url);
    // const data = await response.json();
    // return data.data;

    // Mock data for development
    return Promise.resolve(MOCK_FX_RATES);
  } catch (error) {
    toast.error("Failed to fetch FX rates");
    console.error("Error fetching FX rates:", error);
    return {};
  }
};

// Fetch VertoFX rates
export const fetchVertoFXRates = async (): Promise<VertoFXRates> => {
  try {
    // Mock API call for development
    // In production, this would be an actual API call or web scraping
    return Promise.resolve(MOCK_VERTO_RATES);
  } catch (error) {
    toast.error("Failed to fetch VertoFX rates");
    console.error("Error fetching VertoFX rates:", error);
    return {};
  }
};

// Calculate cost prices
export const calculateCostPrices = async (
  usdtNgnRate: number, 
  fxRates: CurrencyRates,
  usdtToUsdFee: number = 0.01,
  usdToTargetFee: number = 0.005
): Promise<CurrencyRates> => {
  try {
    const costPrices: CurrencyRates = {};
    
    // Calculate for USD
    costPrices.USD = (usdtNgnRate * (1 - usdtToUsdFee)) / (1 - usdToTargetFee);
    
    // Calculate for other currencies
    for (const [currency, rate] of Object.entries(fxRates)) {
      if (currency === "USD") continue;
      costPrices[currency] = (usdtNgnRate * (1 - usdtToUsdFee)) / rate / (1 - usdtToUsdFee);
    }
    
    return costPrices;
  } catch (error) {
    toast.error("Failed to calculate cost prices");
    console.error("Error calculating cost prices:", error);
    return {};
  }
};
