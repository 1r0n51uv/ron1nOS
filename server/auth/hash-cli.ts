// npm run auth:hash: chiede la password e stampa la riga per il .env.
import { createInterface } from 'node:readline'

import { hashPassword } from './password.ts'

async function ask(question: string) {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY })
  // Non ripete a schermo quello che si scrive.
  const muted = rl as unknown as { _writeToOutput: (s: string) => void; output: NodeJS.WriteStream }
  const answer = new Promise<string>((resolve) => rl.question(question, resolve))
  muted._writeToOutput = (s) => {
    if (s.startsWith(question)) muted.output.write(question)
  }
  const value = await answer
  rl.close()
  process.stdout.write('\n')
  return value
}

const password = await ask('Password della dashboard: ')
if (password.length < 12) {
  console.error('Serve una password di almeno 12 caratteri.')
  process.exit(1)
}
if ((await ask('Ripeti la password: ')) !== password) {
  console.error('Le due password non coincidono.')
  process.exit(1)
}
// Gli $ vanno tra apici singoli nel .env, così Docker non li espande.
process.stdout.write(`AUTH_PASSWORD_HASH='${await hashPassword(password)}'\n`)
