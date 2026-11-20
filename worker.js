
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
}

async function askOpenAI(message, env) {
  const response = await fetch(
    "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are AIVORA, a helpful, intelligent AI assistant. Answer clearly and accurately."
          },
          { role: "user", content: message }
        ]
      })
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error("OpenAI request failed");
  }

  return data.choices?.[0]?.message?.content || "";
}

async function askGemini(message, env) {
  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": env.GEMINI_API_KEY
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: message }]
        }]
      })
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error("Gemini request failed");
  }

  return data.candidates?.[0]?.content?.parts
    ?.map(part => part.text || "")
    .join("") || "";
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: corsHeaders
      });
    }

    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    try {
      const body = await request.json();
      const message = body.message?.trim();
      const provider = body.provider || "auto";

      if (!message || message.length > 12000) {
        return json({ error: "Invalid message" }, 400);
      }

      let answer;
      let usedProvider;

      if (provider === "openai") {
        answer = await askOpenAI(message, env);
        usedProvider = "OpenAI";
      } else if (provider === "gemini") {
        answer = await askGemini(message, env);
        usedProvider = "Gemini";
      } else if (provider === "auto") {
        try {
          answer = await askOpenAI(message, env);
          usedProvider = "OpenAI";
        } catch {
          answer = await askGemini(message, env);
          usedProvider = "Gemini";
        }
      } else {
        return json({ error: "Unknown provider" }, 400);
      }

      return json({
        success: true,
        assistant: "AIVORA",
        provider: usedProvider,
        answer
      });

    } catch (error) {
      return json({
        success: false,
        error: "AI service unavailable. Check server configuration."
      }, 500);
    }
  }
};
