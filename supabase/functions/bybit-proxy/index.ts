
// Follow Deno Deploy runtime compatibility
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

// Import CORS headers from shared module
import { corsHeaders } from "../_shared/cors.ts";

// Define the Bybit API URL
const BYBIT_API_URL = "https://api2.bybit.com/fiat/otc/item/online";

serve(async (req) => {
  console.log("Bybit proxy request received:", req.method);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log("Handling CORS preflight request");
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }
  
  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      console.log("Invalid method:", req.method);
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Parse the request body from the client
    const requestData = await req.json();
    console.log("Received request parameters:", JSON.stringify(requestData));
    
    // Default values if not provided
    const tokenId = requestData.tokenId || "USDT";
    const currencyId = requestData.currencyId || "NGN";
    const verifiedOnly = requestData.verifiedOnly !== undefined ? requestData.verifiedOnly : true;
    
    // Prepare headers for Bybit API request
    const headers = {
      "Accept": "application/json",
      "Accept-Encoding": "gzip, deflate, br, zstd",
      "Accept-Language": "en",
      "Content-Type": "application/json;charset=UTF-8",
      "Origin": "https://www.bybit.com",
      "Host": "api2.bybit.com",
      "Referer": "https://www.bybit.com/",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    };
    
    // Prepare the payload for Bybit API with updated parameters
    const payload = {
      userId: "",
      tokenId,
      currencyId,
      payment: [],
      side: "0", // Changed from "1" to "0"
      size: "10",
      page: "2", // Changed from "1" to "2"
      rows: "10", 
      amount: "",
      canTrade: true,
      bulkMaker: false, // Added parameter
      sortType: "TRADE_PRICE",
      vaMaker: verifiedOnly,
      verificationFilter: 0, // Added parameter
      itemRegion: 1, // Added parameter
      paymentPeriod: [] // Added parameter
    };
    
    console.log("Sending request to Bybit API:", JSON.stringify(payload));
    
    // Make request to Bybit API
    const response = await fetch(BYBIT_API_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    
    // Handle API response
    if (!response.ok) {
      console.error(`Bybit API error: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.error("Error response:", errorText);
      return new Response(JSON.stringify({ 
        success: false, 
        error: `API responded with status: ${response.status}`,
        details: errorText
      }), {
        status: 502, // Bad Gateway
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    
    // Parse and process the successful response
    const data = await response.json();
    console.log("Bybit API response status code:", response.status);
    console.log("Bybit API response ret_code:", data.ret_code);
    
    // Process the response similarly to the frontend code
    if (data.ret_code === 0 && data.result && data.result.items && data.result.items.length > 0) {
      const items = data.result.items;
      
      const traders = items.map((item: any) => ({
        price: parseFloat(item.price),
        nickname: item.nickName,
        completion_rate: item.recentExecuteRate,
        orders: item.recentOrderNum,
        available_quantity: parseFloat(item.lastQuantity),
        min_amount: parseFloat(item.minAmount),
        max_amount: parseFloat(item.maxAmount),
        verified: !!item.authTag,
        payment_methods: item.payments ?? [],
        order_completion_time: item.orderFinishTime ?? "15Min(s)",
      }));
      
      const prices = traders.map((t: any) => t.price);
      const sortedPrices = [...prices].sort((a: number, b: number) => a - b);
      const medianPrice = sortedPrices[Math.floor(sortedPrices.length / 2)];
      
      const average =
        prices.reduce((sum: number, p: number) => sum + p, 0) / (prices.length || 1);
      
      // Find most common price (mode)
      const priceFrequency: Record<number, number> = {};
      let maxFreq = 0;
      let modePrice = prices[0] || 0;
      
      prices.forEach((price: number) => {
        priceFrequency[price] = (priceFrequency[price] || 0) + 1;
        if (priceFrequency[price] > maxFreq) {
          maxFreq = priceFrequency[price];
          modePrice = price;
        }
      });
      
      // Return the processed data with the same structure as the frontend expects
      return new Response(JSON.stringify({
        traders,
        market_summary: {
          total_traders: prices.length,
          price_range: {
            min: Math.min(...prices),
            max: Math.max(...prices),
            average,
            median: medianPrice,
            mode: modePrice,
          },
        },
        timestamp: new Date().toISOString(),
        success: true
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    
    // Handle unsuccessful or empty responses
    console.warn("Invalid or empty response from Bybit API");
    return new Response(JSON.stringify({
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
      error: `Invalid response from Bybit API: ${data?.ret_msg || "No traders found"}`
    }), {
      status: 200, // Still return 200 to allow frontend to handle gracefully
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error) {
    // Handle any unexpected errors
    console.error("Error in bybit-proxy function:", error.message);
    return new Response(JSON.stringify({
      success: false,
      error: `Server error: ${error.message}`,
      timestamp: new Date().toISOString(),
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
