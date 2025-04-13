
import axios from "axios";
import { supabase } from '@/integrations/supabase/client';
import { toast } from "sonner";

export interface P2PTrader {
  price: number;
  nickname: string;
  completion_rate: number;
  orders: number;
  available_quantity: number;
  min_amount: number;
  max_amount: number;
  verified: boolean;
  payment_methods: string[];
  order_completion_time: string;
}

export interface P2PMarketSummary {
  total_traders: number;
  price_range: {
    min: number;
    max: number;
    average: number;
    median: number;
    mode: number;
  };
}

export interface BybitP2PResponse {
  traders: P2PTrader[];
  market_summary: P2PMarketSummary;
  timestamp: string;
  success: boolean;
  error?: string;
}

export const getBybitP2PRate = async (
  currencyId: string = "NGN",
  tokenId: string = "USDT",
  verifiedOnly: boolean = true
): Promise<BybitP2PResponse | null> => {
  console.log("[BybitAPI] Initiating request for", tokenId, "to", currencyId);

  try {
    console.log("[BybitAPI] Calling Supabase Edge Function proxy");
    
    // Call our Supabase Edge Function instead of directly calling the Bybit API
    const { data, error } = await supabase.functions.invoke('bybit-proxy', {
      body: {
        currencyId,
        tokenId,
        verifiedOnly
      }
    });
    
    if (error) {
      console.error("[BybitAPI] Edge function error:", error);
      return {
        traders: [],
        market_summary: {
          total_traders: 0,
          price_range: {
            min: 0,
            max: 0,
            average: 0,
            median: 0,
            mode: 0,
          },
        },
        timestamp: new Date().toISOString(),
        success: false,
        error: `Edge function error: ${error.message || "Unknown error"}`
      };
    }
    
    console.log("[BybitAPI] Received response from Edge Function:", data);
    
    // The Edge Function returns the data in the same format we expect
    if (data && data.success && data.market_summary && data.traders) {
      return data as BybitP2PResponse;
    }
    
    // Handle unsuccessful responses from the Edge Function
    return {
      traders: [],
      market_summary: {
        total_traders: 0,
        price_range: {
          min: 0,
          max: 0,
          average: 0,
          median: 0,
          mode: 0,
        },
      },
      timestamp: new Date().toISOString(),
      success: false,
      error: data?.error || "Invalid response from Edge Function"
    };
  } catch (error: any) {
    console.error("❌ Error fetching Bybit P2P rate:", error);
    console.error("[BybitAPI] Error details:", {
      message: error.message,
      code: error.code,
      status: error.response?.status,
      statusText: error.response?.statusText,
      responseData: error.response?.data
    });
    
    // Determine if it's a network error, timeout, or other issue
    let errorMessage = "Unknown error occurred";
    
    if (error.code === "ECONNABORTED") {
      errorMessage = "Request timed out";
    } else if (error.code === "ERR_NETWORK") {
      errorMessage = "Network error - check your internet connection";
    } else if (error.response) {
      // The request was made and the server responded with a status code
      errorMessage = `Server responded with error ${error.response.status}: ${error.response.statusText}`;
    } else if (error.request) {
      // The request was made but no response was received
      errorMessage = "No response received from server";
    } else {
      // Something happened in setting up the request that triggered an Error
      errorMessage = error.message || "Error setting up request";
    }
    
    return {
      traders: [],
      market_summary: {
        total_traders: 0,
        price_range: {
          min: 0,
          max: 0,
          average: 0,
          median: 0,
          mode: 0,
        },
      },
      timestamp: new Date().toISOString(),
      success: false,
      error: errorMessage
    };
  }
};

export const saveBybitRate = async (rate: number): Promise<boolean> => {
  try {
    console.log("[BybitAPI] Saving rate to Supabase:", rate);
    
    const { error } = await supabase.from("usdt_ngn_rates").insert([
      {
        rate,
        source: "bybit",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]);

    if (error) {
      console.error("❌ Failed to save Bybit rate:", error);
      return false;
    } else {
      console.log("✅ Bybit rate saved:", rate);
      return true;
    }
  } catch (error) {
    console.error("❌ Error in saveBybitRate:", error);
    return false;
  }
};

// Function to fetch with retry logic
export const fetchBybitRateWithRetry = async (
  maxRetries: number = 2,
  delayMs: number = 2000
): Promise<{rate: number | null, error?: string}> => {
  let lastError = "";
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`[BybitAPI] Attempt ${attempt}/${maxRetries} to fetch P2P rate`);
    
    try {
      const response = await getBybitP2PRate();
      
      if (response && response.success && response.market_summary.total_traders > 0) {
        // Use median price as it's more stable against outliers
        const rate = response.market_summary.price_range.median;
        
        if (rate && rate > 0) {
          console.log(`[BybitAPI] Successfully fetched rate on attempt ${attempt}: ${rate}`);
          
          // Save successful rate to database
          await saveBybitRate(rate);
          
          return { rate };
        } else {
          lastError = "Received invalid rate value (zero or negative)";
          console.warn(`[BybitAPI] ${lastError}`);
        }
      } else {
        lastError = response?.error || "No traders found or empty response";
        console.warn(`[BybitAPI] ${lastError}`);
      }
    } catch (error: any) {
      lastError = error.message || "Unknown error";
      console.error(`[BybitAPI] Error on attempt ${attempt}: ${lastError}`);
    }
    
    // Don't wait after the last attempt
    if (attempt < maxRetries) {
      console.log(`[BybitAPI] Waiting ${delayMs}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  console.error(`[BybitAPI] All ${maxRetries} attempts failed. Last error: ${lastError}`);
  return { rate: null, error: lastError };
};
