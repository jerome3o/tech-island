# Chinese Flashcards

> An interactive web application for learning Chinese vocabulary through flashcards.

## What Is This?

A flashcard learning app that helps users study Chinese vocabulary. Features include:
- 25 stock Chinese flashcards covering greetings, basics, food, numbers, emotions, and verbs
- Interactive flip animation (click or press space to flip)
- Category filtering (all, greetings, basics, food, numbers, emotions, verbs)
- Keyboard navigation (arrow keys to navigate, space to flip)
- User info integration via user-service (displays user email/name in corner)
- Responsive design that works on mobile and desktop

## Live URL

**Production**: https://chinese-flashcards.34.142.82.161.nip.io

## Tech Stack

- **Backend**: Node.js with Express
- **Frontend**: Vanilla HTML/CSS/JavaScript
- **User Service**: Integrates with shared user-service for user data
- **Authentication**: Google OAuth via oauth2-proxy (automatic)

## API Endpoints

### Public Endpoints
- `GET /health` - Health check (no auth required)

### Authenticated Endpoints
- `GET /` - Serve the main flashcard UI
- `GET /api/me` - Get current user info (integrates with user-service)
- `GET /api/flashcards` - Get all flashcards
- `GET /api/flashcards/category/:category` - Get flashcards by category
- `GET /api/flashcards/random` - Get a random flashcard
- `GET /api/categories` - Get list of all categories

## Flashcard Data

The app includes 25 stock flashcards covering:

- **Greetings**: 你好 (hello), 谢谢 (thank you), 再见 (goodbye), 对不起 (sorry)
- **Basics**: 是 (yes/to be), 不 (no/not), 我 (I/me), 你 (you), 他/她 (he/she), 好的 (okay/good)
- **Food**: 水 (water), 茶 (tea), 饭 (rice/meal), 面 (noodles)
- **Numbers**: 一 (one), 二 (two), 三 (three), 四 (four), 五 (five)
- **Emotions**: 爱 (love)
- **Verbs**: 学习 (to study), 工作 (work/job), 吃 (to eat), 喝 (to drink)

Each flashcard includes:
- Chinese characters
- Pinyin (romanization)
- English translation
- Category tag

## User Service Integration

The app fetches user information from the shared user-service at:
- Internal URL: `http://user-service.apps.svc.cluster.local/api/users/me`

This displays the user's email (and display name if set) in the top-right corner of the page.

## File Structure

```
chinese-flashcards/
├── src/
│   ├── index.js           # Express server with flashcard API
│   └── public/
│       └── index.html     # Frontend UI with flip animations
├── k8s/                   # Kubernetes manifests
│   ├── deployment.yaml    # App deployment
│   ├── service.yaml       # ClusterIP service
│   ├── ingress.yaml       # Main ingress with auth
│   ├── ingress-oauth2.yaml # OAuth2 paths (no auth)
│   └── oauth2-proxy-service.yaml # OAuth2 proxy reference
├── Dockerfile             # Container build
├── package.json           # Dependencies
├── package-lock.json      # Lock file for reproducible builds
└── CLAUDE.md             # This file
```

## How to Use

1. Visit https://chinese-flashcards.34.142.82.161.nip.io
2. Sign in with Google (automatic redirect)
3. Click on a flashcard to flip it and see the English translation
4. Use category filters to study specific topics
5. Navigate with:
   - **Next/Previous buttons** or **arrow keys** to move between cards
   - **Click** or **spacebar** to flip cards
   - **Random button** to jump to a random card

## Future Enhancements

Potential improvements:
- User-specific progress tracking (cards mastered, study streaks)
- Spaced repetition algorithm
- Audio pronunciation
- User-created custom flashcards
- Quiz mode
- More vocabulary categories and advanced words

## Development

To run locally:
```bash
cd apps/chinese-flashcards
npm install
npm run dev
```

The app expects the `x-auth-request-user` header for authentication, which is provided by oauth2-proxy in production.

## Deployment

Automatically deployed via GitHub Actions when pushed to `main`:
1. Docker image built and pushed to Artifact Registry
2. Kubernetes manifests applied
3. TLS certificate auto-provisioned by cert-manager
4. Available at https://chinese-flashcards.34.142.82.161.nip.io

## Notes

- Health endpoint (`/health`) is excluded from authentication for k8s probes
- User data is fetched from user-service using the authenticated email
- All static files (HTML, CSS, JS) are served from `src/public/`
- Flashcard data is currently hardcoded in `src/index.js` (could be moved to database later)
