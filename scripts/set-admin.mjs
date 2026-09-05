import { applicationDefault, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

const uid = process.env.FIREBASE_ADMIN_UID

if (!uid) {
  throw new Error('Set FIREBASE_ADMIN_UID first.')
}

initializeApp({
  credential: applicationDefault(),
})

const auth = getAuth()
const user = await auth.getUser(uid)

await auth.setCustomUserClaims(uid, {
  ...(user.customClaims ?? {}),
  admin: true,
})

console.log(`Admin claim assigned to ${user.email ?? uid}`)
