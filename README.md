# Super Bowl Predictor

A Vite + TypeScript adaptation of the downloaded Super Bowl Predictor app. It includes the public leaderboard, player prediction form, player detail modal, and password-protected admin controls.

## Local setup

1. Install Node.js LTS.
2. Run `npm.cmd install`.
3. Copy `.env.example` to `.env.local`.
4. Add the Firebase web app configuration values from the Firebase console.
5. Run `npm.cmd run dev`.

The app expects Firebase configuration before loading the pool. Once all six values are present, `src/firebase.ts` initializes Firebase Auth and Firestore. Anonymous Auth is used for client writes.

For admin access, set a separate app-specific password in `.env.local` with `SUPER_BOWL_ADMIN_PASSWORD=your-strong-password`. This should be unrelated to the Vite app config values and should only be used for managing the Super Bowl predictions site. Do not commit a default or hardcoded secret. In a production app, the stronger pattern is to move admin authentication behind a trusted backend or Firebase custom claims rather than a browser-exposed env value.

## Firestore collections

- `questions`: `{ text, options: string[], correctAnswer, createdAt }`
- `users`: `{ name, score, createdAt }`
- `predictions`: `{ userId, questionId, selectedAnswer }`

The first visit to **Join** seeds the five questions from the original project when the `questions` collection is empty. Admin actions recalculate each player's score whenever a correct answer is selected.

Enable **Anonymous** sign-in in Firebase Authentication. For a production deployment, add Firestore security rules that allow public reads and restrict writes to authenticated users or a trusted admin path. The browser-side admin password is a convenience port of the original app, not a security boundary, so keep it in local or deployment secrets instead of source control.

## GitHub Pages

The workflow in `.github/workflows/deploy.yml` deploys on pushes to `main`. In the repository settings, set Pages to **GitHub Actions**, then add the six `VITE_FIREBASE_*` values as repository Variables under **Settings > Secrets and variables > Actions**.

The Vite base path is set to `/SuperBowlPredictor/`, matching this repository name. Change it in `vite.config.ts` if the repository name changes.
