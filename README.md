# Super Bowl Predictor

A Vite + TypeScript adaptation of the downloaded Super Bowl Predictor app. It includes the public leaderboard, player prediction form, player detail modal, and password-protected admin controls.

## Local setup

1. Install Node.js LTS.
2. Run `npm.cmd install`.
3. Copy `.env.example` to `.env.local`.
4. Add the Firebase web app configuration values from the Firebase console.
5. Run `npm.cmd run dev`.

The app expects Firebase configuration before loading the pool. Once all six values are present, `src/firebase.ts` initializes Firebase Auth and Firestore. Anonymous Auth is used for client writes.

For admin access, enable Firebase Email/Password authentication, create an administrator account, and assign it the server-side custom claim `{ admin: true }`. The admin form signs in with Firebase Auth; no admin password is bundled into the browser. Assign custom claims only from a trusted Admin SDK environment, never from browser code. If MFA is enabled for the account, add a Firebase multi-factor challenge flow before enforcing MFA for this client.

## Firestore collections

- `questions`: `{ text, options: string[], correctAnswer, createdAt }`
- `users`: `{ name, score, createdAt }`
- `predictions`: `{ userId, questionId, selectedAnswer }`
- `settings/submissions`: `{ enabled: boolean }`

Questions must be created through the admin controls or a trusted Firebase setup step. Admin actions recalculate each player's score whenever a correct answer is selected.

Enable **Anonymous** sign-in in Firebase Authentication for normal visitors. Anonymous users can create submissions, while Firestore rules restrict question, settings, user updates, and prediction updates/deletes to administrators with the custom claim.

## GitHub Pages

The workflow in `.github/workflows/deploy.yml` deploys on pushes to `main`. In the repository settings, set Pages to **GitHub Actions**, then add the six `VITE_FIREBASE_*` values as repository Variables under **Settings > Secrets and variables > Actions**.

The Vite base path is set to `/SuperBowlPredictor/`, matching this repository name. Change it in `vite.config.ts` if the repository name changes.
