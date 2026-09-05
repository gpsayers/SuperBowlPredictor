import { getApps, initializeApp } from 'firebase/app'
import { getAuth, signInAnonymously, signInWithEmailAndPassword, signOut, type Auth } from 'firebase/auth'
import {
	addDoc,
	collection,
	doc,
	getDoc,
	getDocs,
	getFirestore,
	limit,
	orderBy,
	query,
	serverTimestamp,
	setDoc,
	updateDoc,
	writeBatch,
	type Firestore,
} from 'firebase/firestore'

const firebaseConfig = {
	apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
	authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
	projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
	storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
	messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
	appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const firebaseConfigured = Object.values(firebaseConfig).every(Boolean)
const app = firebaseConfigured ? getApps()[0] ?? initializeApp(firebaseConfig) : null
export const db: Firestore | null = app ? getFirestore(app) : null
export const auth: Auth | null = app ? getAuth(app) : null

export type Question = { id: string; text: string; options: string[]; correctAnswer: string | null }
export type User = { id: string; name: string; score: number }
export type Prediction = { id: string; userId: string; questionId: string; selectedAnswer: string }

const submissionSettingsRef = () => doc(requireDb(), 'settings', 'submissions')

const requireDb = () => {
	if (!db) throw new Error('Firebase is not configured. Add the values in .env.local.')
	return db
}

async function ensureSignedIn() {
	if (auth && !auth.currentUser) await signInAnonymously(auth)
}

export async function signInAdmin(email: string, password: string) {
	if (!auth) throw new Error('Firebase is not configured.')
	await signInWithEmailAndPassword(auth, email, password)
	const token = await auth.currentUser?.getIdTokenResult(true)
	if (token?.claims.admin !== true) {
		await signOut(auth)
		throw new Error('This account is not authorized for admin access.')
	}
}

export async function signOutAdmin() {
	if (auth) await signOut(auth)
}

export async function getQuestions(): Promise<Question[]> {
	const snapshot = await getDocs(query(collection(requireDb(), 'questions'), orderBy('createdAt')))
	return snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as Question))
}

export async function getUsers(): Promise<User[]> {
	const snapshot = await getDocs(query(collection(requireDb(), 'users'), orderBy('score', 'desc'), limit(100)))
	return snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as User))
}

export async function getPredictions(userId: string): Promise<Prediction[]> {
	const snapshot = await getDocs(query(collection(requireDb(), 'predictions')))
	return snapshot.docs
		.map((item) => ({ id: item.id, ...item.data() } as Prediction))
		.filter((prediction) => prediction.userId === userId)
}

export async function getSubmissionsEnabled(): Promise<boolean> {
	const snapshot = await getDoc(submissionSettingsRef())
	return snapshot.exists() ? snapshot.data().enabled !== false : true
}

export async function setSubmissionsEnabled(enabled: boolean) {
	await ensureSignedIn()
	await setDoc(submissionSettingsRef(), { enabled })
}

export async function createUserWithPredictions(name: string, answers: Record<string, string>) {
	await ensureSignedIn()
	const database = requireDb()
	if (!(await getSubmissionsEnabled())) throw new Error('No new submissions at this time')
	const existing = await getDocs(query(collection(database, 'users')))
	if (existing.docs.some((item) => String(item.data().name).toLowerCase() === name.toLowerCase())) {
		throw new Error(`A player with the name "${name}" already exists.`)
	}

	const user = await addDoc(collection(database, 'users'), { name, score: 0, createdAt: serverTimestamp() })
	const batch = writeBatch(database)
	Object.entries(answers).forEach(([questionId, selectedAnswer]) => {
		batch.set(doc(collection(database, 'predictions')), { userId: user.id, questionId, selectedAnswer })
	})
	await batch.commit()
}

export async function createQuestion(text: string, options: string[]) {
	await ensureSignedIn()
	await addDoc(collection(requireDb(), 'questions'), { text, options, correctAnswer: null, createdAt: serverTimestamp() })
}

export async function updateQuestion(id: string, values: Partial<Pick<Question, 'text' | 'options' | 'correctAnswer'>>) {
	await ensureSignedIn()
	await updateDoc(doc(requireDb(), 'questions', id), values)
	if (values.correctAnswer !== undefined) await recalculateScores()
}

export async function deleteQuestion(id: string) {
	await ensureSignedIn()
	const database = requireDb()
	const predictions = await getDocs(query(collection(database, 'predictions')))
	const batch = writeBatch(database)
	predictions.docs.filter((item) => item.data().questionId === id).forEach((item) => batch.delete(item.ref))
	batch.delete(doc(database, 'questions', id))
	await batch.commit()
	await recalculateScores()
}

export async function deleteUser(id: string) {
	await ensureSignedIn()
	const database = requireDb()
	const predictions = await getDocs(query(collection(database, 'predictions')))
	const batch = writeBatch(database)
	predictions.docs.filter((item) => item.data().userId === id).forEach((item) => batch.delete(item.ref))
	batch.delete(doc(database, 'users', id))
	await batch.commit()
}

export async function recalculateScores() {
	const database = requireDb()
	const [questions, users, predictions] = await Promise.all([
		getQuestions(),
		getDocs(query(collection(database, 'users'))),
		getDocs(query(collection(database, 'predictions'))),
	])
	const correct = new Map(questions.filter((question) => question.correctAnswer).map((question) => [question.id, question.correctAnswer]))
	const batch = writeBatch(database)
	users.docs.forEach((user) => {
		const score = predictions.docs.filter((item) => item.data().userId === user.id && correct.get(item.data().questionId) === item.data().selectedAnswer).length
		batch.update(user.ref, { score })
	})
	await batch.commit()
}
