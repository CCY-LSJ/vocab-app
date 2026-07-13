// Deno Deploy - serves static frontend + Baidu OCR proxy
import { serveDir } from "jsr:@std/http/file-server";

const API_KEY = "UIvmY7Qbb5HDpjl4t1yCO6H6";
const SECRET_KEY = "r7ARzJbV60FyKtvGeE7jzJ7RJCAeYWiY";

Deno.serve(async (req) => {
  const url = new URL(req.url);

  // CORS for API routes
  if (url.pathname === "/api/ocr") {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "POST only" }), {
        status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    try {
      const { image } = await req.json();
      if (!image) throw new Error("No image");

      // 1. Get Baidu token
      const tokenRes = await fetch(
        `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${API_KEY}&client_secret=${SECRET_KEY}`
      );
      const tokenJson = await tokenRes.json();
      if (!tokenJson.access_token) throw new Error(tokenJson.error_description || "token failed");

      // 2. Call Baidu OCR
      const cleanB64 = image.replace(/^data:image\/\w+;base64,/, "");
      const ocrRes = await fetch("https://aip.baidubce.com/rest/2.0/ocr/v1/accurate_basic", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `access_token=${tokenJson.access_token}&image=${encodeURIComponent(cleanB64)}&language_type=CHN_ENG&detect_direction=false&paragraph=false&probability=false`
      });
      const result = await ocrRes.json();
      if (result.error_code) throw new Error(result.error_msg);

      // 3. Parse words
      const words = [];
      const seen = new Set();
      (result.words_result || []).forEach((item) => {
        (item.words || "").trim().split(/[\s,.;:!?()\[\]{}""''<>\/\\|@#$%^&*+=~\u3000-\u303F\u2000-\u206F]+/).forEach((token) => {
          token = token.trim();
          if (token.length < 2 || !/^[a-zA-Z][a-zA-Z-]*[a-zA-Z]$/.test(token)) return;
          const lower = token.toLowerCase();
          if (seen.has(lower)) return;
          seen.add(lower);
          words.push({ word: token, selected: true, meaning: "" });
        });
      });

      return new Response(JSON.stringify({ success: true, words }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
  }

  // Serve static files
  return serveDir(req, { fsRoot: ".", urlRoot: "" });
});