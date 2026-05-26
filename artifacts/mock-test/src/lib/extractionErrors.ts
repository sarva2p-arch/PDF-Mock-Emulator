export function friendlyExtractionError(message: string) {
  const lower = message.toLowerCase();

  if (lower.includes("429") || lower.includes("quota")) {
    return "Gemini quota is finished for now. The app also tried the fallback providers. You can retry later, use a smaller PDF, or import a saved test file from the homepage to use zero AI quota.";
  }

  if (lower.includes("503") || lower.includes("unavailable") || lower.includes("high demand")) {
    return "Gemini is temporarily busy right now. Please retry after some time. If you already exported this test earlier, import the saved test file from the homepage to avoid using AI again.";
  }

  if (lower.includes("413") || lower.includes("too large") || lower.includes("tokens per minute")) {
    return "This PDF is too large for the free fallback model right now. Try a smaller/cleaner PDF, wait for Gemini quota to reset, or use a saved test file after one successful extraction.";
  }

  if (lower.includes("no ai provider") || lower.includes("api key")) {
    return "No working AI provider was available. Check your .env keys and restart the API server.";
  }

  if (lower.includes("failed to fetch") || lower.includes("network")) {
    return "Could not reach the local AI server. Make sure the backend is running, then try again.";
  }

  if (message.length > 320) {
    return "Extraction failed because the AI provider returned a long technical error. Try again later, use a cleaner PDF, or import a saved test file if you already exported one.";
  }

  return message;
}
