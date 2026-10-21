import { ProviderAdapter, ProviderDefinition } from "./types"
import { openaiAdapter } from "./adapters/openai"
import { anthropicAdapter } from "./adapters/anthropic"
import { googleAdapter } from "./adapters/google"
import { groqAdapter } from "./adapters/groq"
import { mistralAdapter } from "./adapters/mistral"
import { openrouterAdapter } from "./adapters/openrouter"
import { xaiAdapter } from "./adapters/xai"
import { deepseekAdapter } from "./adapters/deepseek"
import { ollamaAdapter } from "./adapters/ollama"
import { customAdapter } from "./adapters/custom"
import { createOpenAICompatibleAdapter } from "./adapters/openai-compatible"
import { perplexityAdapter } from "./adapters/perplexity"

const cerebrasAdapter = createOpenAICompatibleAdapter({
  id: "cerebras",
  name: "Cerebras",
  baseUrl: "https://api.cerebras.ai/v1",
  iconColor: "#5b5bd6",
  iconInitials: "CB",
  models: [
    { id: "llama-3.3-70b", name: "Llama 3.3 70B", contextWindow: 128000, supportsStreaming: true },
    { id: "llama3.1-8b", name: "Llama 3.1 8B", contextWindow: 128000, supportsStreaming: true },
  ],
  modelFilter: (id) => !/(embed|whisper|tts|moderation)/i.test(id),
})

const togetherAdapter = createOpenAICompatibleAdapter({
  id: "together",
  name: "Together AI",
  baseUrl: "https://api.together.ai/v1",
  iconColor: "#2563eb",
  iconInitials: "TO",
  models: [
    { id: "meta-llama/Llama-3.3-70B-Instruct-Turbo", name: "Llama 3.3 70B Turbo", contextWindow: 128000, supportsStreaming: true },
    { id: "Qwen/Qwen2.5-72B-Instruct-Turbo", name: "Qwen 2.5 72B Turbo", contextWindow: 32768, supportsStreaming: true },
  ],
  modelFilter: (id) => !/(embed|whisper|tts|rerank|moderation)/i.test(id),
})

const fireworksAdapter = createOpenAICompatibleAdapter({
  id: "fireworks",
  name: "Fireworks AI",
  baseUrl: "https://api.fireworks.ai/inference/v1",
  iconColor: "#f97316",
  iconInitials: "FW",
  models: [
    { id: "accounts/fireworks/models/llama-v3p3-70b-instruct", name: "Llama 3.3 70B", contextWindow: 128000, supportsStreaming: true },
    { id: "accounts/fireworks/models/deepseek-v3", name: "DeepSeek V3", contextWindow: 64000, supportsStreaming: true },
  ],
  modelFilter: (id) => !/(embed|whisper|tts|moderation)/i.test(id),
})

const sambanovaAdapter = createOpenAICompatibleAdapter({
  id: "sambanova",
  name: "SambaNova",
  baseUrl: "https://api.sambanova.ai/v1",
  iconColor: "#ec4899",
  iconInitials: "SN",
  models: [
    { id: "Meta-Llama-3.3-70B-Instruct", name: "Llama 3.3 70B", contextWindow: 128000, supportsStreaming: true },
    { id: "DeepSeek-R1", name: "DeepSeek R1", contextWindow: 64000, supportsStreaming: true },
  ],
  modelFilter: (id) => !/(embed|whisper|tts|moderation)/i.test(id),
})

export const PROVIDER_DEFINITIONS: Record<string, ProviderDefinition> = {
  openai: {
    id: "openai",
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    docsUrl: "https://platform.openai.com/docs",
    iconColor: "#10a37f",
    iconInitials: "OA",
    apiKeyPlaceholder: "sk-...",
    apiKeyUrl: "https://platform.openai.com/api-keys",
    requiresBaseUrl: false,
    requiresApiKey: true,
  },
  anthropic: {
    id: "anthropic",
    name: "Anthropic",
    baseUrl: "https://api.anthropic.com",
    docsUrl: "https://docs.anthropic.com",
    iconColor: "#d97757",
    iconInitials: "AN",
    apiKeyPlaceholder: "sk-ant-...",
    apiKeyUrl: "https://console.anthropic.com/settings/keys",
    requiresBaseUrl: false,
    requiresApiKey: true,
  },
  google: {
    id: "google",
    name: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    docsUrl: "https://ai.google.dev/docs",
    iconColor: "#4285f4",
    iconInitials: "G",
    apiKeyPlaceholder: "AIza...",
    apiKeyUrl: "https://aistudio.google.com/app/apikey",
    requiresBaseUrl: false,
    requiresApiKey: true,
  },
  groq: {
    id: "groq",
    name: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    docsUrl: "https://console.groq.com/docs",
    iconColor: "#f55036",
    iconInitials: "GQ",
    apiKeyPlaceholder: "gsk_...",
    apiKeyUrl: "https://console.groq.com/keys",
    requiresBaseUrl: false,
    requiresApiKey: true,
  },
  mistral: {
    id: "mistral",
    name: "Mistral AI",
    baseUrl: "https://api.mistral.ai/v1",
    docsUrl: "https://docs.mistral.ai",
    iconColor: "#ff7000",
    iconInitials: "MI",
    apiKeyPlaceholder: "...",
    apiKeyUrl: "https://console.mistral.ai/api-keys",
    requiresBaseUrl: false,
    requiresApiKey: true,
  },
  openrouter: {
    id: "openrouter",
    name: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    docsUrl: "https://openrouter.ai/docs",
    iconColor: "#8b5cf6",
    iconInitials: "OR",
    apiKeyPlaceholder: "sk-or-...",
    apiKeyUrl: "https://openrouter.ai/keys",
    requiresBaseUrl: false,
    requiresApiKey: true,
  },
  xai: {
    id: "xai",
    name: "xAI Grok",
    baseUrl: "https://api.x.ai/v1",
    docsUrl: "https://docs.x.ai",
    iconColor: "#000000",
    iconInitials: "xAI",
    apiKeyPlaceholder: "xai-...",
    apiKeyUrl: "https://console.x.ai",
    requiresBaseUrl: false,
    requiresApiKey: true,
  },
  deepseek: {
    id: "deepseek",
    name: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    docsUrl: "https://platform.deepseek.com/docs",
    iconColor: "#4f46e5",
    iconInitials: "DS",
    apiKeyPlaceholder: "sk-...",
    apiKeyUrl: "https://platform.deepseek.com/api_keys",
    requiresBaseUrl: false,
    requiresApiKey: true,
  },
  ollama: {
    id: "ollama",
    name: "Ollama (Local)",
    baseUrl: "http://localhost:11434",
    docsUrl: "https://ollama.com/docs",
    iconColor: "#000000",
    iconInitials: "OL",
    apiKeyPlaceholder: "(no key required)",
    requiresBaseUrl: true,
    requiresApiKey: false,
  },
  custom: {
    id: "custom",
    name: "Custom (OpenAI-compatible)",
    baseUrl: "",
    docsUrl: "",
    iconColor: "#6b7280",
    iconInitials: "CU",
    apiKeyPlaceholder: "Your API key (if required)",
    requiresBaseUrl: true,
    requiresApiKey: false,
    optionalApiKey: true,
  },
  cerebras: {
    id: "cerebras",
    name: "Cerebras",
    baseUrl: "https://api.cerebras.ai/v1",
    docsUrl: "https://inference-docs.cerebras.ai",
    iconColor: "#5b5bd6",
    iconInitials: "CB",
    apiKeyPlaceholder: "csk-...",
    apiKeyUrl: "https://cloud.cerebras.ai/",
    requiresBaseUrl: false,
    requiresApiKey: true,
  },
  together: {
    id: "together",
    name: "Together AI",
    baseUrl: "https://api.together.ai/v1",
    docsUrl: "https://docs.together.ai/docs/openai-api-compatibility",
    iconColor: "#2563eb",
    iconInitials: "TO",
    apiKeyPlaceholder: "...",
    apiKeyUrl: "https://api.together.ai/settings/api-keys",
    requiresBaseUrl: false,
    requiresApiKey: true,
  },
  fireworks: {
    id: "fireworks",
    name: "Fireworks AI",
    baseUrl: "https://api.fireworks.ai/inference/v1",
    docsUrl: "https://docs.fireworks.ai/api-reference",
    iconColor: "#f97316",
    iconInitials: "FW",
    apiKeyPlaceholder: "fw_...",
    apiKeyUrl: "https://fireworks.ai/account/api-keys",
    requiresBaseUrl: false,
    requiresApiKey: true,
  },
  perplexity: {
    id: "perplexity",
    name: "Perplexity",
    baseUrl: "https://api.perplexity.ai/v1",
    docsUrl: "https://docs.perplexity.ai",
    iconColor: "#20808d",
    iconInitials: "PX",
    apiKeyPlaceholder: "pplx-...",
    apiKeyUrl: "https://www.perplexity.ai/account/api/keys",
    requiresBaseUrl: false,
    requiresApiKey: true,
  },
  sambanova: {
    id: "sambanova",
    name: "SambaNova",
    baseUrl: "https://api.sambanova.ai/v1",
    docsUrl: "https://docs.sambanova.ai/docs/en/get-started/overview",
    iconColor: "#ec4899",
    iconInitials: "SN",
    apiKeyPlaceholder: "...",
    apiKeyUrl: "https://cloud.sambanova.ai/",
    requiresBaseUrl: false,
    requiresApiKey: true,
  },
}

export const ADAPTERS: Record<string, ProviderAdapter> = {
  openai: openaiAdapter,
  anthropic: anthropicAdapter,
  google: googleAdapter,
  groq: groqAdapter,
  mistral: mistralAdapter,
  openrouter: openrouterAdapter,
  xai: xaiAdapter,
  deepseek: deepseekAdapter,
  ollama: ollamaAdapter,
  custom: customAdapter,
  cerebras: cerebrasAdapter,
  together: togetherAdapter,
  fireworks: fireworksAdapter,
  perplexity: perplexityAdapter,
  sambanova: sambanovaAdapter,
}

export function getAdapter(providerId: string): ProviderAdapter {
  const adapter = ADAPTERS[providerId]
  if (!adapter) throw new Error(`Unknown provider: ${providerId}`)
  return adapter
}

export function getAllProviders(): ProviderDefinition[] {
  return Object.values(PROVIDER_DEFINITIONS)
}

export function getProviderDefinition(providerId: string): ProviderDefinition {
  const def = PROVIDER_DEFINITIONS[providerId]
  if (!def) throw new Error(`Unknown provider definition: ${providerId}`)
  return def
}

// Prices are approximate and may be outdated.
export const MODEL_PRICING: Record<string, { input: number; output: number }> = {}

export function estimateCost(
  providerId: string,
  model: string,
  usage: { promptTokens: number; completionTokens: number; totalTokens?: number }
): number {
  const adapter = ADAPTERS[providerId]
  const fullUsage = {
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    totalTokens: usage.totalTokens ?? usage.promptTokens + usage.completionTokens,
  }
  if (adapter?.estimateCost) return adapter.estimateCost(fullUsage, model)
  const m = adapter?.models.find((mm) => mm.id === model)
  if (!m?.inputPricePer1M || !m.outputPricePer1M) return 0
  return (fullUsage.promptTokens * m.inputPricePer1M + fullUsage.completionTokens * m.outputPricePer1M) / 1_000_000
}
