// Cifratura a riposo del modulo Documenti (DOC-015). Busta:
// formato (1 byte) ‖ versione della chiave (1) ‖ nonce (12) ‖ dati ‖ tag (16),
// AES-256-GCM con l'id del record come dati associati (AAD): una busta
// spostata su un altro record non si apre. La chiave è DOCUMENTS_KEY nel
// .env, 32 byte in base64; il database non la vede mai.
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const FORMAT = 1
const NONCE = 12
const TAG = 16

export class EnvelopeError extends Error {}

export type Vault = {
  keyVersion: number
  seal(plain: Buffer, aad: string): Buffer
  open(envelope: Buffer, aad: string): Buffer
  sealJson(value: unknown, aad: string): Buffer
  openJson<T>(envelope: Buffer, aad: string): T
}

// null se la chiave manca o non è di 32 byte: il modulo resta spento.
export function parseKey(value: string | undefined): Buffer | null {
  if (!value) return null
  const key = Buffer.from(value.trim(), 'base64')
  return key.length === 32 ? key : null
}

export function createVault(key: Buffer, keyVersion = 1): Vault {
  if (key.length !== 32) throw new Error('DOCUMENTS_KEY deve essere di 32 byte')

  const seal = (plain: Buffer, aad: string) => {
    const nonce = randomBytes(NONCE)
    const cipher = createCipheriv('aes-256-gcm', key, nonce)
    cipher.setAAD(Buffer.from(aad, 'utf8'))
    const data = Buffer.concat([cipher.update(plain), cipher.final()])
    return Buffer.concat([Buffer.from([FORMAT, keyVersion]), nonce, data, cipher.getAuthTag()])
  }

  const open = (envelope: Buffer, aad: string) => {
    if (envelope.length < 2 + NONCE + TAG || envelope[0] !== FORMAT) {
      throw new EnvelopeError('busta non valida')
    }
    if (envelope[1] !== keyVersion) throw new EnvelopeError(`chiave versione ${envelope[1]} non disponibile`)
    const nonce = envelope.subarray(2, 2 + NONCE)
    const tag = envelope.subarray(envelope.length - TAG)
    const data = envelope.subarray(2 + NONCE, envelope.length - TAG)
    try {
      const decipher = createDecipheriv('aes-256-gcm', key, nonce)
      decipher.setAAD(Buffer.from(aad, 'utf8'))
      decipher.setAuthTag(tag)
      return Buffer.concat([decipher.update(data), decipher.final()])
    } catch {
      // Chiave sbagliata, AAD di un altro record o dati manomessi.
      throw new EnvelopeError('busta non decifrabile')
    }
  }

  return {
    keyVersion,
    seal,
    open,
    sealJson: (value, aad) => seal(Buffer.from(JSON.stringify(value), 'utf8'), aad),
    openJson: <T>(envelope: Buffer, aad: string) => JSON.parse(open(envelope, aad).toString('utf8')) as T,
  }
}

export const documentAad = (id: string) => `document:${id}`
export const fileAad = (documentId: string, fileId: string) => `file:${documentId}:${fileId}`
export const thumbAad = (documentId: string, fileId: string) => `thumb:${documentId}:${fileId}`
