// Currency formatting and calculation utilities

// Format currency values
export const formatCurrency = (value: number, currency: string = "NGN"): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

// Format currency pairs
export const formatCurrencyPair = (base: string, quote: string): string => {
  return `${base}/${quote}`;
};

// Calculate USD cost price based on new formula: USD/NGN = USDT/NGN × (1 + USD_margin)
export const calculateUsdPrice = (
  usdtNgnRate: number,
  usdMargin: number
): number => {
  if (!usdtNgnRate) return 0;
  
  // Convert margin from percentage to decimal (e.g., 1% -> 0.01)
  const marginDecimal = usdMargin / 100;
  
  // Apply formula: USD/NGN = USDT/NGN × (1 + USD_margin)
  return usdtNgnRate * (1 + marginDecimal);
};

// Calculate EUR, GBP, CAD cost price based on new formula:
// TARGET/NGN = (USDT/NGN × (1 - usdt_to_usd_fee)) ÷ (TARGET/USD) × (1 + target_margin)
export const calculateOtherCurrencyPrice = (
  usdtNgnRate: number,
  currencyFxRate: number, // This is TARGET/USD from API
  otherCurrenciesMargin: number,
  usdtToUsdFee: number = 0.001 // 0.10% as decimal
): number => {
  if (!usdtNgnRate || !currencyFxRate) return 0;
  
  // Convert margin from percentage to decimal (e.g., 3% -> 0.03)
  const marginDecimal = otherCurrenciesMargin / 100;
  
  // Apply formula: TARGET/NGN = (USDT/NGN × (1 - usdt_to_usd_fee)) ÷ (TARGET/USD) × (1 + target_margin)
  return (usdtNgnRate * (1 - usdtToUsdFee)) / currencyFxRate * (1 + marginDecimal);
};

// Apply margin to cost price - keeping this for backward compatibility
export const applyMargin = (costPrice: number, marginPercent: number): number => {
  if (!costPrice) return 0;
  
  return costPrice * (1 + marginPercent / 100);
};

// Compare rates and determine if ours is better
export const compareRates = (ourRate: number, competitorRate: number, isBuy: boolean): boolean => {
  if (isBuy) {
    // For buy rates, lower is better (customer pays less)
    return ourRate < competitorRate;
  } else {
    // For sell rates, higher is better (customer gets more)
    return ourRate > competitorRate;
  }
};

// Calculate percentage difference between rates
export const calculateDifference = (ourRate: number, competitorRate: number): number => {
  if (!ourRate || !competitorRate) return 0;
  
  return ((ourRate - competitorRate) / competitorRate) * 100;
};

// Currency codes map
export const currencyCodes: Record<string, string> = {
  USD: "USD",
  EUR: "EUR",
  GBP: "GBP",
  CAD: "CAD",
  NGN: "NGN",
  USDT: "USDT",
};
