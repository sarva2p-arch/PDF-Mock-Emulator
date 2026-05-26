import { Router } from "express";
import { getProvidersStatus, getActiveProvider } from "../services/aiProvider.js";

const router = Router();

router.get("/ai-status", (_req, res) => {
  const providers = getProvidersStatus();
  const active = getActiveProvider();
  const availableCount = providers.filter((p) => p.available).length;

  res.json({
    providers,
    activeProvider: active,
    availableCount,
    healthy: availableCount > 0,
    setupInstructions: {
      OPENAI_API_KEY: "Your own OpenAI key from platform.openai.com - optional paid provider",
      GROQ_API_KEY: "Free key from console.groq.com - fast Llama 3.3 model",
      GEMINI_API_KEY: "Free key from aistudio.google.com/apikey - Google Gemini Flash",
    },
  });
});

export default router;
