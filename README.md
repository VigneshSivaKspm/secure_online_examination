# Secure Online Examination System

A comprehensive AI-powered online examination platform with real-time proctoring, teacher monitoring, and secure session management.

## Features

### For Students
- 📝 **Secure Exam Interface** - Write exams in a controlled environment
- 👁️ **AI Proctoring** - Real-time face detection with behavioral monitoring
- 🔒 **Screen Lock** - Teachers can lock screens to prevent cheating
- 💬 **Live Messaging** - Receive messages and warnings from teachers
- ⚠️ **3-Strike Warning System** - Visual warnings for suspicious behavior

### For Teachers
- 📊 **Real-time Monitoring Dashboard** - Watch all active exam sessions live
- 🎮 **Student Controls** - Lock/unlock exams, send warnings and messages
- 📈 **Exam Management** - Create, publish, and review exams
- 📋 **Results Analytics** - Detailed scoring and performance tracking
- 🚀 **AI Features** - AI-powered exam generation and automated testing

## Tech Stack

- **Frontend**: React 19 + TypeScript
- **Build Tool**: Vite 7
- **Styling**: Tailwind CSS + PostCSS
- **Backend**: Firebase Firestore (Real-time DB)
- **Face Detection**: MediaPipe Face Landmarker
- **Routing**: React Router v7
- **Linting**: ESLint 9

## Prerequisites

- Node.js 18+ and npm
- Firebase project with Firestore enabled
- Firebase Authentication configured
- Modern browser with webcam support

## Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/VigneshSivaKspm/secure_online_examination.git
   cd secure_online_examination
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Firebase**
   - Copy `.env.example` to `.env.local`
   - Fill in your Firebase credentials:
     ```bash
     VITE_FIREBASE_API_KEY=your_api_key
     VITE_FIREBASE_AUTH_DOMAIN=your_domain.firebaseapp.com
     VITE_FIREBASE_PROJECT_ID=your_project_id
     VITE_FIREBASE_STORAGE_BUCKET=your_bucket
     VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
     VITE_FIREBASE_APP_ID=your_app_id
     ```

4. **Start development server**
   ```bash
   npm run dev
   ```
   Open [http://localhost:5173](http://localhost:5173)

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build optimized production bundle |
| `npm run preview` | Preview production build locally (port 4173) |
| `npm run lint` | Run ESLint to check code quality |
| `npm run type-check` | Check TypeScript types without building |

## Project Structure

```
src/
├── components/          # Reusable React components
│   ├── AIQuestionGenerator.tsx
│   ├── ChatComponent.tsx
│   ├── ExamRoom.tsx
│   ├── ProctoringMonitor.tsx
│   ├── TeacherPanel.tsx
│   └── ...
├── pages/               # Page components (routes)
│   ├── LoginPage.tsx
│   ├── StudentDashboard.tsx
│   ├── ExamPage.tsx
│   ├── ResultsPage.tsx
│   └── ...
├── services/            # API & Firebase services
│   ├── aiService.ts
│   ├── examService.ts
│   └── ...
├── hooks/               # Custom React hooks
│   ├── useProctoring.ts
│   ├── useNotifications.ts
│   └── ...
├── context/             # React Context providers
│   └── AuthContext.tsx
├── types/               # TypeScript type definitions
└── App.tsx             # Main app component
```

## Proctoring System

### Head Yaw Detection
- Detects suspicious head movements (>60° threshold)
- Monitors looking away from screen
- 5-second debounce to prevent false positives

### 3-Strike Warning System
1. First violation → Warning count: 1
2. Second violation → Warning count: 2
3. Third violation → **Auto Lock + Popup Alert**

### Teacher Controls
- Manual screen lock/unlock per student
- Send messages and warnings in real-time
- Monitor all active exam sessions live
- View student behavior and alert history

## Deployment to Vercel

### Quick Start
1. Push code to GitHub
2. Connect repository to [Vercel](https://vercel.com)
3. Configure environment variables in Vercel Dashboard
4. Deploy! (automatic on push)

### Environment Variables
Set these in Vercel Project Settings:
```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
```

### Route Handling
✅ **Fixed 404 on Direct Routes** - `vercel.json` rewrites all routes to `index.html`

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment guide.

## Building for Production

```bash
# Build optimized bundle
npm run build

# Preview production build locally
npm run preview

# Check for TypeScript errors
npm run type-check
```

The `dist/` folder is ready for production deployment.

## Configuration Files

- **vite.config.ts** - Vite build configuration with optimizations
- **vercel.json** - Vercel deployment settings (routes, env variables)
- **tsconfig.json** - TypeScript configuration
- **tailwind.config.js** - Tailwind CSS customization
- **eslint.config.js** - Code quality rules

## API Routes

All API calls are handled by Firebase Firestore. No backend server needed!

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Requires webcam access for proctoring

## Security

- 🔐 Firebase Authentication with role-based access control
- 🔒 Firestore rules for data protection
- 🎥 Face detection runs locally in browser
- ✅ No sensitive data stored in localStorage
- 🛡️ HTTPS enforced in production

## Troubleshooting

### 404 Errors on Direct Route Access
**Solution**: Already fixed with `vercel.json` configuration

### Firebase Not Connecting
- Check `.env.local` has correct credentials
- Verify Firebase project has Firestore enabled
- Check browser console for errors

### Proctoring Not Working
- Allow webcam permissions
- Check browser console for MediaPipe errors
- Ensure camera device is connected

### Build Failing
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
npm run build
```

## Contributing

1. Create feature branch: `git checkout -b feature/your-feature`
2. Commit changes: `git commit -m "Add your feature"`
3. Push to branch: `git push origin feature/your-feature`
4. Open Pull Request

## License

This project is proprietary and confidential.

## Contact

For support and inquiries, contact the development team.

---

**Status**: ✅ Ready for Production & Vercel Deployment
