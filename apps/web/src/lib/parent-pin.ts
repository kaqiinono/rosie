import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCallback)

export const DEFAULT_PARENT_PIN = '666666'

export function isValidParentPin(pin: unknown): pin is string {
  return typeof pin === 'string' && /^\d{6}$/.test(pin)
}

export async function hashParentPin(pin: string): Promise<{ hash: string; salt: string }> {
  const salt = randomBytes(16).toString('hex')
  const derived = (await scrypt(pin, salt, 64)) as Buffer
  return { hash: derived.toString('hex'), salt }
}

export async function verifyParentPin(
  pin: string,
  stored: { pin_hash: string; pin_salt: string } | null,
): Promise<boolean> {
  if (!stored) return pin === DEFAULT_PARENT_PIN
  const derived = (await scrypt(pin, stored.pin_salt, 64)) as Buffer
  const expected = Buffer.from(stored.pin_hash, 'hex')
  return expected.length === derived.length && timingSafeEqual(expected, derived)
}
