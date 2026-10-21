import crypto from "crypto"

const ALGO = "aes-256-gcm"
const IV_LEN = 12

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY
  if (!hex) throw new Error("ENCRYPTION_KEY env var is not set")
  const buf = Buffer.from(hex, "hex")
  if (buf.length !== 32) throw new Error("ENCRYPTION_KEY must be 32 bytes (64 hex chars)")
  return buf
}

export function encrypt(plaintext: string): {
  encrypted: string
  iv: string
  tag: string
} {
  const key = getKey()
  const iv = crypto.randomBytes(IV_LEN)
  const cipher = crypto.createCipheriv(ALGO, key, iv)
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return {
    encrypted: enc.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
  }
}

export function decrypt(encrypted: string, ivB64: string, tagB64: string): string {
  const key = getKey()
  const iv = Buffer.from(ivB64, "base64")
  const tag = Buffer.from(tagB64, "base64")
  const encBuf = Buffer.from(encrypted, "base64")
  const decipher = crypto.createDecipheriv(ALGO, key, iv)
  decipher.setAuthTag(tag)
  const dec = Buffer.concat([decipher.update(encBuf), decipher.final()])
  return dec.toString("utf8")
}
