# Sarva Build PDF Mock Test

Beta CBT-style mock test app that creates exams from uploaded PDF question papers.

## Features

- Upload a question paper PDF and generate a CBT mock test
- Upload one PDF with questions and answer key
- Upload separate question PDF and answer key PDF
- AI provider fallback with Gemini, Groq, and optional OpenAI
- Manual AI provider selection from the AI badge
- Numerical/integer answer support
- Exam timer, question palette, review marking, and auto-submit
- Result page with correct, wrong, unattempted, and subject analytics
- Previous test history with clear option
- Export extracted tests as JSON and import them later with zero AI quota
- Dark mode

## Local Setup

1. Install Node.js.
2. Enable pnpm:

```bash
corepack enable
corepack prepare pnpm@latest --activate
```

3. Copy `.env.example` to `.env`.
4. Add your API keys in `.env`:

```env
GROQ_API_KEY=
GEMINI_API_KEY=
OPENAI_API_KEY=
```

5. Install packages:

```bash
pnpm install
```

## Start Locally On Windows

Double-click:

```text
START_SARVA_BUILD.bat
```

Then open:

```text
http://localhost:19055/
```

Keep the API server and website server windows open while using the app.

## Important

- Do not upload `.env` to GitHub.
- Do not commit `node_modules`.
- Rotate API keys if they are ever pasted publicly.
- This project is in beta, so test PDFs carefully before sharing widely.

## Deployment Notes

For production, the API server can also serve the built frontend.

Recommended build command:

```bash
pnpm install --frozen-lockfile && pnpm run build
```

Recommended start command:

```bash
pnpm run start
```

Set these environment variables on your hosting provider:

```env
NODE_ENV=production
GEMINI_API_KEY=
GROQ_API_KEY=
```

`OPENAI_API_KEY` is optional. Add it only if you have a paid OpenAI key.

Optional extra fallback providers:

```env
MISTRAL_API_KEY=
MISTRAL_MODEL=mistral-small-latest
OPENROUTER_API_KEY=
OPENROUTER_MODEL=
PUBLIC_APP_URL=https://pdf-mock-emulator.onrender.com
```

For OpenRouter, set `OPENROUTER_MODEL` to a current free model from OpenRouter. Free OpenRouter model IDs usually end with `:free`.
