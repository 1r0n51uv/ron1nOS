// npm run auth:hash: chiede il codice a 4 cifre e stampa la riga per il .env.
import { createInterface } from 'node:readline'

import { hashPassword, isAccessCode } from './password.ts'

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

const password = await ask('Codice della dashboard (4 cifre): ')
if (!isAccessCode(password)) {
  console.error('Servono esattamente 4 cifre.')
  process.exit(1)
}
if ((await ask('Ripeti il codice: ')) !== password) {
  console.error('I due codici non coincidono.')
  process.exit(1)
}
// Gli $ vanno tra apici singoli nel .env, così Docker non li espande.
process.stdout.write(`AUTH_PASSWORD_HASH='${await hashPassword(password)}'\n`)
