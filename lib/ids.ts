import * as Crypto from 'expo-crypto';

/** Unique ID generation — UUIDs are valid CloudKit recordNames. */
export const ID = {
  unique(): string {
    return Crypto.randomUUID();
  },
};

/** First 16 hex chars of SHA-256 — used to derive safe, deterministic recordNames. */
export async function shortHash(input: string): Promise<string> {
  const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, input);
  return digest.slice(0, 16);
}
