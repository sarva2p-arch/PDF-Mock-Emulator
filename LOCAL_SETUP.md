# Local setup for the CBT mock test app

This project has two local parts:

- Frontend website: `artifacts/mock-test`
- Backend API server: `artifacts/api-server`

## 1. Install the required tools

Install Node.js LTS from:

https://nodejs.org

After installing Node.js, open a new PowerShell window and run:

```powershell
node --version
npm.cmd --version
corepack.cmd enable
corepack.cmd prepare pnpm@latest --activate
pnpm.cmd --version
```

On some Windows systems, plain `npm` or `pnpm` may be blocked by PowerShell script policy. Use `npm.cmd` and `pnpm.cmd` instead.

## 2. Install project dependencies

From the project folder:

```powershell
cd C:\Users\sarva\Downloads\Exam-Simulator
pnpm.cmd install
```

## 3. Add at least one AI key

The PDF extraction feature needs an AI provider. For a free backup, use either Groq or Gemini.

Recommended long-term method: copy `.env.example` to `.env`, then paste your real key values into `.env`.

Example `.env`:

```text
GROQ_API_KEY=paste-your-groq-key-here
GEMINI_API_KEY=paste-your-gemini-key-here
OPENAI_API_KEY=
```

The `.env` file is ignored by git, so it will stay private on your computer.

Temporary method: in the same PowerShell window where you start the backend, set one or more keys:

```powershell
$env:GROQ_API_KEY="paste-your-groq-key-here"
$env:GEMINI_API_KEY="paste-your-gemini-key-here"
$env:OPENAI_API_KEY="paste-your-openai-key-here"
```

You do not need all three. One working key is enough.

## 4. Start the backend

Open PowerShell terminal 1:

```powershell
cd C:\Users\sarva\Downloads\Exam-Simulator
pnpm.cmd run dev:api
```

The API runs at:

```text
http://localhost:8080
```

## 5. Start the website

Open PowerShell terminal 2:

```powershell
cd C:\Users\sarva\Downloads\Exam-Simulator
pnpm.cmd run dev:web
```

The website runs at:

```text
http://localhost:19055
```

## Notes

- Keep both terminals open while using the app.
- The website sends `/api` requests to the backend automatically during local development.
- If PDF upload works but AI extraction fails, check that at least one API key is set in the backend terminal.
