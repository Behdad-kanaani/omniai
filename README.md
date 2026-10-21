<div align="center">

# OmniAI

### One workspace. Every model.

Chat, compare, and build with your favorite AI providers — from one local-first workspace.

[![Next.js](https://img.shields.io/badge/Next.js-16-111827?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-64748B)](./LICENSE)

[Get started](#get-started) · [Features](#what-you-can-do) · [Security](#security)

</div>

## What you can do

- **Chat across providers** in one clean interface, with streaming responses and configurable model settings.
- **Compare models** side by side in Arena and find the right answer for the task.
- **Keep your work organized** with conversation history, saved prompts, and usage analytics.
- **Work with your codebase** using Agent mode to inspect and edit files in a selected folder.
- **Stay in control** with provider credentials encrypted locally and data stored in SQLite.

### Providers

OpenAI · Anthropic · Google Gemini · Groq · Mistral · OpenRouter · xAI · DeepSeek · Ollama · Cerebras · Together AI · Fireworks AI · Perplexity · SambaNova · OpenAI-compatible APIs

## Get started

**Requirements:** Node.js 20.9+ and npm. Add provider credentials in the app after setup; Ollama can run locally without a cloud API key.

```bash
git clone https://github.com/Behdad-kanaani/omniai.git
cd omniai
npm ci
```

Create your local environment file:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Generate an encryption key:

```bash
node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))"
```

Replace the `ENCRYPTION_KEY` placeholder in `.env` with the generated value. Then set up the database and launch OmniAI:

```bash
npx prisma generate
npm run db:setup
npm run dev
```

Open [127.0.0.1:3000](http://127.0.0.1:3000). Your SQLite database is created at `prisma/dev.db`.

## Security

OmniAI has no authentication. Use it on a trusted machine only; do not expose it to a network or public tunnel. Prompts sent to hosted providers are subject to their privacy policies.

Provider keys are encrypted at rest with `ENCRYPTION_KEY`. Keep the key private and back it up with your database. If you lose the key, saved credentials cannot be recovered. See [SECURITY.md](./SECURITY.md).

## Development

```bash
npm run lint
npm run typecheck
npm run build
```

## License

MIT — see [LICENSE](./LICENSE).
