import './style.css'
import {
  createQuestion,
  createUserWithPredictions,
  deleteQuestion,
  deleteUser,
  firebaseConfigured,
  getPredictions,
  getQuestions,
  getUsers,
  updateQuestion,
} from './firebase'

const app = document.querySelector<HTMLDivElement>('#app')!
const adminSessionKey = 'superBowlAdminSessionExpires'
const adminSessionDuration = 15 * 60 * 1000
let adminSessionTimer: number | undefined
const defaultQuestions = [
  ['Coin Toss Result?', ['Heads', 'Tails']],
  ['Gatorade Color poured on winning coach?', ['Orange', 'Blue', 'Red', 'Purple', 'Clear/Water', 'None']],
  ['Length of National Anthem?', ['Over 2:00', 'Under 2:00']],
  ['Who will win MVP?', ['Quarterback (Winning Team)', 'Defensive Player', 'Running Back', 'Wide Receiver', 'Kicker']],
  ['First Commercial Brand?', ['Beer/Alcohol', 'Car/Auto', 'Movie Trailer', 'Food/Snack', 'Tech/Phone']],
] as const

const escapeHtml = (value: unknown) => String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]!)
const page = (content: string) => { const view = location.hash.slice(1) || 'home'; const navLink = (route: string, icon: string, label: string) => `<a class="${view === route ? 'active' : ''}" href="#${route}"${view === route ? ' aria-current="page"' : ''}><span class="nav-icon">${icon}</span>${label}</a>`; return `<main class="shell"><nav class="topbar"><a class="brand" href="#home"><span class="brand-mark">SB</span><strong>PREDICTOR</strong> <b>'26</b></a><div class="nav-links">${navLink('home', '♜', 'Leaderboard')}${navLink('join', '♧', 'Join Now')}${navLink('admin', '♢', 'Admin')}</div></nav>${content}<footer><span>Built for the big game</span><span>${firebaseConfigured ? 'Firebase connected' : 'Demo mode'}</span></footer></main>` }
const loading = (message: string) => page(`<div class="loading"><span class="spinner"></span>${message}</div>`)

async function seedQuestions() {
  const questions = await getQuestions()
  if (!questions.length) for (const [text, options] of defaultQuestions) await createQuestion(text, [...options])
  return questions.length ? questions : getQuestions()
}

async function renderHome() {
  app.innerHTML = loading('Loading the leaderboard...')
  try {
    const [users, questions] = await Promise.all([getUsers(), getQuestions()])
    const sorted = [...users].sort((a, b) => b.score - a.score)
    app.innerHTML = page(`<section class="intro-block"><p class="eyebrow">Live standings</p><h1>WHO WILL TAKE THE <em>CROWN?</em></h1><p>Track predictions in real-time as the big game unfolds.</p>${!sorted.length ? '<a class="button button-primary" href="#join">Submit your predictions <span>-></span></a>' : ''}</section>
      <section class="board"><div class="board-heading"><div>Rank</div><div>Player</div><div>Score</div></div>${sorted.length ? sorted.map((user, index) => `<button class="player-row" data-user="${user.id}" data-name="${escapeHtml(user.name)}"><strong class="rank rank-${index + 1}"><span>${index < 3 ? ['♛', '♙', '♙'][index] : `#${index + 1}`}</span></strong><span class="player-name">${escapeHtml(user.name)}</span><b>${user.score}<small> PTS</small></b></button>`).join('') : '<div class="empty">No players yet. Be the first to join.</div>'}</section>
      <p class="data-note">${questions.length} prediction questions are active.</p>`)
    document.querySelectorAll<HTMLElement>('[data-user]').forEach((row) => row.addEventListener('click', () => showUser(row.dataset.user!, row.dataset.name!)))
  } catch (error) { renderError(error) }
}

async function showUser(id: string, name: string) {
  const [predictions, questions] = await Promise.all([getPredictions(id), getQuestions()])
  const questionText = new Map(questions.map((question) => [question.id, question.text]))
  const modal = document.createElement('dialog')
  modal.innerHTML = `<form method="dialog" class="modal"><button class="close" aria-label="Close">x</button><p class="eyebrow">Prediction card</p><h2>${escapeHtml(name)}</h2>${predictions.length ? predictions.map((prediction) => `<div class="answer"><span>${escapeHtml(questionText.get(prediction.questionId) ?? 'Question')}</span><strong>${escapeHtml(prediction.selectedAnswer)}</strong></div>`).join('') : '<p>No predictions found.</p>'}</form>`
  document.body.append(modal); modal.showModal(); modal.addEventListener('close', () => modal.remove())
}

async function renderJoin() {
  app.innerHTML = loading('Loading questions...')
  try {
    const questions = await seedQuestions()
    app.innerHTML = page(`<section class="join-page">
      <h1>MAKE YOUR PREDICTIONS</h1>
      <p class="join-subtitle">Enter your name and predict the outcomes. Each correct answer earns you points.</p>
      <form id="join-form" class="join-form">
        <div class="join-name-card">
          <label class="field-label" for="player-name">Player Name</label>
          <input id="player-name" name="name" minlength="2" required placeholder="Your Name" />
        </div>

        <div class="join-question-list">
          ${questions.map((question, index) => `
            <div class="join-question">
              <div class="question-header">
                <span class="question-index">${index + 1}</span>
                <span class="question-title">${escapeHtml(question.text)}</span>
              </div>
              <div class="select-wrap">
                <select name="${question.id}" required>
                  <option value="" selected disabled>Select an option...</option>
                  ${question.options.map((option) => `<option value="${escapeHtml(option)}">${escapeHtml(option)}</option>`).join('')}
                </select>
              </div>
            </div>
          `).join('')}
        </div>

        <p class="form-error" id="form-error"></p>
        <button class="join-submit" type="submit">Submit Predictions <span>→</span></button>
      </form>
    </section>`)
    document.querySelector<HTMLFormElement>('#join-form')!.addEventListener('submit', async (event) => {
      event.preventDefault(); const form = new FormData(event.currentTarget as HTMLFormElement); const name = String(form.get('name')).trim(); const answers: Record<string, string> = {}
      questions.forEach((question) => { const answer = form.get(question.id); if (answer) answers[question.id] = String(answer) })
      const error = document.querySelector('#form-error')!; error.textContent = ''
      if (!name || Object.keys(answers).length !== questions.length) { error.textContent = 'Please complete every field.'; return }
      try { await createUserWithPredictions(name, answers); location.hash = '#home' } catch (submissionError) { error.textContent = submissionError instanceof Error ? submissionError.message : 'Submission failed.' }
    })
  } catch (error) { renderError(error) }
}

async function renderAdminPanel() {
  app.innerHTML = page(`<section class="admin-page"><div id="admin-content" class="admin-content">Loading controls...</div></section>`)
  const content = document.querySelector('#admin-content')!
  try {
    const [questions, users] = await Promise.all([getQuestions(), getUsers()])
    content.innerHTML = `<form id="new-question" class="new-question" hidden><div><label for="new-question-text">Question</label><input id="new-question-text" name="text" required placeholder="Question text"></div><div><label for="new-question-options">Answer options</label><input id="new-question-options" name="options" required placeholder="Options, separated by commas"></div><div class="new-question-actions"><button class="admin-cancel-button" id="cancel-question-form" type="button">Cancel</button><button class="admin-add-button" type="submit">Save Question</button></div></form><section class="admin-section admin-questions"><div class="admin-question-list">${questions.map((question, index) => `<article class="admin-question"><header class="admin-question-header"><div><span class="question-badge">Q${index + 1}</span><strong>${escapeHtml(question.text)}</strong></div><div class="admin-question-actions"><button class="icon-button" type="button" aria-label="Edit question" title="Edit question" data-edit-question="${question.id}">✎</button><button class="icon-button delete-icon" type="button" aria-label="Delete question" title="Delete question" data-delete-question="${question.id}">♧</button></div></header><div class="admin-answer-list">${question.options.map((option) => `<button class="answer-button ${question.correctAnswer === option ? 'correct' : ''}" data-question="${question.id}" data-answer="${escapeHtml(option)}"><span>${escapeHtml(option)}</span><span class="answer-check" aria-hidden="true">${question.correctAnswer === option ? '✓' : '○'}</span></button>`).join('')}</div><p class="admin-question-hint">Tap an option to mark it as the correct answer.</p></article>`).join('') || '<p class="empty">No questions yet.</p>'}</div></section><section class="admin-section admin-players"><h2>Players</h2>${users.map((user) => `<div class="admin-row"><span>${escapeHtml(user.name)} <small>${user.score} pts</small></span><button data-delete-user="${user.id}">Delete</button></div>`).join('') || '<p class="empty">No players yet.</p>'}</section>`
    content.querySelector('.admin-players')?.remove()
    content.insertAdjacentHTML('afterbegin', `<section class="admin-section admin-users"><h1 class="admin-section-title">Manage Users</h1>${users.map((user) => `<div class="admin-row"><span>${escapeHtml(user.name)} <small>${user.score} pts</small></span><button data-delete-user="${user.id}">Delete</button></div>`).join('') || '<p class="empty">No players yet.</p>'}</section>`)
    content.querySelector('.admin-users')?.insertAdjacentHTML('afterend', `<header class="admin-page-header"><div><h1 class="admin-section-title">GAME CONTROL</h1><p>Manage questions and set results.</p></div><button class="admin-add-button" id="show-question-form" type="button"><span aria-hidden="true">+</span> Add Question</button></header>`)
    let editingQuestionId: string | undefined
    const questionForm = document.querySelector<HTMLFormElement>('#new-question')!
    const questionText = document.querySelector<HTMLInputElement>('#new-question-text')!
    const questionOptions = document.querySelector<HTMLInputElement>('#new-question-options')!
    const openQuestionForm = () => { questionForm.hidden = false; questionText.focus() }
    document.querySelector<HTMLButtonElement>('#show-question-form')!.addEventListener('click', openQuestionForm)
    document.querySelector<HTMLButtonElement>('#cancel-question-form')!.addEventListener('click', () => { editingQuestionId = undefined; questionForm.reset(); questionForm.hidden = true })
    document.querySelectorAll<HTMLButtonElement>('[data-edit-question]').forEach((button) => button.addEventListener('click', () => { const question = questions.find((item) => item.id === button.dataset.editQuestion); if (!question) return; editingQuestionId = question.id; questionText.value = question.text; questionOptions.value = question.options.join(', '); openQuestionForm() }))
    document.querySelectorAll<HTMLElement>('[data-delete-user]').forEach((button) => button.addEventListener('click', async () => { await deleteUser(button.dataset.deleteUser!); renderAdminPanel() }))
    document.querySelectorAll<HTMLElement>('[data-delete-question]').forEach((button) => button.addEventListener('click', async () => { await deleteQuestion(button.dataset.deleteQuestion!); renderAdminPanel() }))
    document.querySelectorAll<HTMLElement>('[data-question]').forEach((button) => button.addEventListener('click', async () => { await updateQuestion(button.dataset.question!, { correctAnswer: button.dataset.answer }); renderAdminPanel() }))
    questionForm.addEventListener('submit', async (event) => { event.preventDefault(); const form = new FormData(event.currentTarget as HTMLFormElement); const text = String(form.get('text')); const options = String(form.get('options')).split(',').map((option) => option.trim()).filter(Boolean); if (editingQuestionId) await updateQuestion(editingQuestionId, { text, options }); else await createQuestion(text, options); renderAdminPanel() })
  } catch (error) { renderError(error) }
}

function clearAdminSession() {
  sessionStorage.removeItem(adminSessionKey)
  if (adminSessionTimer !== undefined) window.clearTimeout(adminSessionTimer)
  adminSessionTimer = undefined
}

function scheduleAdminSessionExpiry(expiresAt: number) {
  if (adminSessionTimer !== undefined) window.clearTimeout(adminSessionTimer)
  adminSessionTimer = window.setTimeout(() => {
    clearAdminSession()
    if (location.hash === '#admin') renderAdmin()
  }, Math.max(0, expiresAt - Date.now()))
}

function hasActiveAdminSession() {
  const expiresAt = Number(sessionStorage.getItem(adminSessionKey))
  if (!expiresAt || expiresAt <= Date.now()) { clearAdminSession(); return false }
  scheduleAdminSessionExpiry(expiresAt)
  return true
}

async function renderAdmin() {
  const configuredPassword = import.meta.env.VITE_SUPER_BOWL_ADMIN_PASSWORD?.trim()

  if (!configuredPassword) {
    app.innerHTML = page(`<section class="admin-auth">
      <div class="admin-auth-card">
        <div class="admin-lock" aria-hidden="true">
          <svg viewBox="0 0 24 24" role="img" aria-label="Admin lock icon">
            <path d="M7.5 10V7.75A4.5 4.5 0 0 1 12 3.25a4.5 4.5 0 0 1 4.5 4.5V10m-9 0h9a2 2 0 0 1 2 2v6.5a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2V12a2 2 0 0 1 2-2Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <h1>ADMIN ACCESS</h1>
        <p class="admin-config-message">Set VITE_SUPER_BOWL_ADMIN_PASSWORD in your local environment before enabling admin access.</p>
        <a href="#home" class="admin-back-link">Back to leaderboard</a>
      </div>
    </section>`)
    return
  }

  if (hasActiveAdminSession()) { await renderAdminPanel(); return }

  app.innerHTML = page(`<section class="admin-auth">
    <div class="admin-auth-card">
      <div class="admin-lock" aria-hidden="true">
        <svg viewBox="0 0 24 24" role="img" aria-label="Admin lock icon">
          <path d="M7.5 10V7.75A4.5 4.5 0 0 1 12 3.25a4.5 4.5 0 0 1 4.5 4.5V10m-9 0h9a2 2 0 0 1 2 2v6.5a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2V12a2 2 0 0 1 2-2Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <h1>ADMIN ACCESS</h1>
      <form id="admin-login-form" class="admin-login-form">
        <div class="admin-password-wrap">
          <input id="admin-password" type="password" name="password" placeholder="Enter password" required />
          <button type="button" class="admin-password-toggle" aria-label="Toggle password visibility">⋯</button>
        </div>
        <p class="admin-error" id="admin-form-error"></p>
        <button class="admin-login-button" type="submit">Login</button>
      </form>
    </div>
  </section>`)

  const form = document.querySelector<HTMLFormElement>('#admin-login-form')!
  const input = document.querySelector<HTMLInputElement>('#admin-password')!
  const error = document.querySelector<HTMLElement>('#admin-form-error')!
  const toggle = document.querySelector<HTMLButtonElement>('.admin-password-toggle')!

  toggle.addEventListener('click', () => {
    const showPassword = input.type === 'password'
    input.type = showPassword ? 'text' : 'password'
    toggle.textContent = showPassword ? '◉' : '⋯'
  })

  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    const enteredPassword = String(new FormData(form).get('password') ?? '').trim()
    error.textContent = ''

    if (enteredPassword !== configuredPassword) {
      error.textContent = 'Invalid password.'
      input.focus()
      return
    }

    const expiresAt = Date.now() + adminSessionDuration
    sessionStorage.setItem(adminSessionKey, String(expiresAt))
    scheduleAdminSessionExpiry(expiresAt)
    await renderAdminPanel()
  })
}

function renderError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Please try again.'
  const authSetup = message.includes('auth/configuration-not-found')
  app.innerHTML = page(`<div class="error-state"><p class="eyebrow">${authSetup ? 'Firebase setup' : 'Connection issue'}</p><h1>${authSetup ? 'Turn on anonymous sign-in.' : "We couldn't load the pool."}</h1><p>${authSetup ? 'In Firebase Console, open Authentication, choose Sign-in method, enable Anonymous, and publish the change.' : escapeHtml(message)}</p><a class="button button-primary" href="#home">Try again</a></div>`)
}
function route() { const view = location.hash.slice(1) || 'home'; if (!firebaseConfigured) { app.innerHTML = page(`<section class="error-state"><p class="eyebrow">Setup required</p><h1>Connect your <em>Firebase project.</em></h1><p>Add the six VITE_FIREBASE values from .env.example to .env.local, then reload this page.</p></section>`); return } if (view === 'join') renderJoin(); else if (view === 'admin') renderAdmin(); else renderHome() }
window.addEventListener('hashchange', route)
route()
