export interface ModelInfo {
  id: string
  name: string
  contextWindow: number
  maxOutputTokens?: number
  inputPricePer1M?: number  // USD per 1M input tokens
  outputPricePer1M?: number // USD per 1M output tokens
  supportsVision?: boolean
  supportsStreaming?: boolean
  description?: string
}

export interface ChatMessage {
  role: "system" | "user" | "assistant"
  content: string
}

export interface ChatParams {
  model: string
  messages: ChatMessage[]
  temperature?: number
  topP?: number
  maxTokens?: number
  stream?: boolean
  signal?: AbortSignal
  apiKey: string
  baseUrl?: string
}

export interface ChatChunk {
  type: "delta" | "done" | "error" | "usage"
  content?: string
  error?: string
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number }
  model?: string
  finishReason?: string
}

export interface TokenUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

export interface ProviderAdapter {
  id: string
  name: string
  baseUrl: string
  iconColor: string
  iconInitials: string
  models: ModelInfo[]
  requiresBaseUrl: boolean
  requiresApiKey: boolean
  validateKey(key: string, baseUrl?: string): Promise<{ valid: boolean; error?: string }>
  streamChat(params: ChatParams): AsyncIterable<ChatChunk>
  chat?(params: ChatParams): Promise<{ content: string; usage?: TokenUsage }>
  countTokens?(text: string, model: string): Promise<number>
  estimateCost?(usage: TokenUsage, model: string): number
  fetchModels?(key: string, baseUrl?: string): Promise<ModelInfo[]>
}

export interface ProviderDefinition {
  id: string
  name: string
  baseUrl: string
  docsUrl: string
  iconColor: string
  iconInitials: string
  apiKeyPlaceholder: string
  apiKeyUrl?: string
  optionalApiKey?: boolean
  requiresBaseUrl: boolean
  requiresApiKey: boolean
}
