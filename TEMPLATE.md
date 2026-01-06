# Expo + Appwrite Template

A production-ready React Native template with Expo, Appwrite authentication, Sentry error tracking, and a complete authentication flow.

## 🚀 Features

- ✅ **Appwrite Authentication** - Complete auth flow (login, signup, password reset)
- ✅ **Expo Router** - File-based navigation
- ✅ **TypeScript** - Type-safe development
- ✅ **NativeWind (Tailwind CSS)** - Utility-first styling
- ✅ **Sentry** - Error tracking and monitoring
- ✅ **Session Management** - Zustand-based state management
- ✅ **Deep Linking** - Password reset via email
- ✅ **Production Ready** - EAS Build configuration included

## 📦 What's Included

### Core Files
- `app/(auth)/` - Complete authentication flow
  - Login screen
  - Signup screen
  - Password reset flow
- `app/_layout.tsx` - Base app navigation with session management
- `app/index.tsx` - Starter home screen
- `lib/appwrite.ts` - Appwrite client configuration
- `lib/sentry.ts` - Sentry error tracking setup
- `store/useSessionStore.ts` - Authentication state management
- `components/` - Reusable UI components (Header, LoadingSplash)

### Configuration
- `app.json` - Expo configuration
- `eas.json` - EAS Build profiles
- `tailwind.config.js` - Tailwind CSS configuration
- `tsconfig.json` - TypeScript configuration

## 🛠️ Setup Instructions

### 1. Clone or Download This Template

```bash
git clone <your-template-repo-url> my-new-app
cd my-new-app
```

### 2. Run Setup Script

```bash
node scripts/setup-new-app.js
```

The script will prompt you for:
- App name
- App slug
- Bundle identifier
- Appwrite endpoint and project ID
- Sentry DSN (optional)

### 3. Set Up Appwrite Project

1. Create a new project at [Appwrite Cloud](https://cloud.appwrite.io)
2. In your Appwrite project:
   - Create a **Users** collection (or use built-in auth)
   - Set up **Email/Password** authentication
   - Configure **Password Recovery** with your app's deep link:
     - Format: `yourappscheme://reset-password`
   - Add your app's platform (iOS/Android/Web)

### 4. Install Dependencies

```bash
npm install
```

### 5. Start Development

```bash
npx expo start
```

## 📱 Building for Production

### iOS

```bash
# Development build
eas build --profile development --platform ios

# Production build  
eas build --profile production --platform ios --auto-submit
```

### Android

```bash
# Development build
eas build --profile development --platform android

# Production build
eas build --profile production --platform android
```

## 🏗️ Project Structure

```
my-app/
├── app/
│   ├── (auth)/              # Authentication screens
│   │   ├── index.tsx        # Login
│   │   ├── signup.tsx       # Sign up
│   │   ├── forgot-password.tsx
│   │   └── reset-password.tsx
│   ├── _layout.tsx          # Root navigation
│   ├── index.tsx            # Home screen (CUSTOMIZE THIS)
│   └── globals.css          # Global styles
├── components/
│   ├── Header.tsx           # App header
│   └── LoadingSplash.tsx    # Loading screen
├── lib/
│   ├── appwrite.ts          # Appwrite configuration
│   └── sentry.ts            # Sentry configuration
├── store/
│   └── useSessionStore.ts   # Auth state management
├── assets/                  # Images, fonts, icons
├── constants/               # App constants
└── types/                   # TypeScript types
```

## 🎨 Customization Guide

### 1. Home Screen
Edit `app/index.tsx` to build your main app interface.

### 2. Add New Screens
Create new files in `app/` folder:
```tsx
// app/profile.tsx
export default function ProfileScreen() {
  return <View>...</View>
}
```

### 3. Add App Logo/Icons
Replace files in `assets/images/`:
- `icon.png` - App icon (1024x1024)
- `splash-icon.png` - Splash screen icon
- `adaptive-icon.png` - Android adaptive icon
- `favicon.png` - Web favicon

### 4. Update Colors/Theme
Edit `tailwind.config.js` to customize your color scheme.

### 5. Add Appwrite Collections
Create collections in Appwrite dashboard, then add helper functions in `lib/appwrite.ts`:

```typescript
export async function getItems(userId: string) {
  return await databases.listDocuments(
    DATABASE_ID,
    'your-collection-id',
    [Query.equal('userId', userId)]
  );
}
```

## 🔐 Environment Variables

Required environment variables (created by setup script):

```env
EXPO_PUBLIC_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
EXPO_PUBLIC_APPWRITE_PROJECT_ID=your-project-id
EXPO_PUBLIC_SENTRY_DSN=your-sentry-dsn  # Optional
```

## 📝 Common Tasks

### Update App Name
Edit `app.json`:
```json
{
  "expo": {
    "name": "Your New Name",
    ...
  }
}
```

### Change Bundle ID
Edit `app.json`:
```json
{
  "expo": {
    "ios": {
      "bundleIdentifier": "com.yourcompany.newapp"
    }
  }
}
```

### Add Deep Linking
Update `app.json` scheme:
```json
{
  "expo": {
    "scheme": "yournewscheme"
  }
}
```

## 🚨 Troubleshooting

### Appwrite Connection Issues
- Check your `.env` file has correct endpoint and project ID
- Verify platform is added in Appwrite dashboard
- Check network connectivity

### Build Errors
- Run `npm install` to ensure all dependencies are installed
- Clear cache: `npx expo start -c`
- Check EAS Build logs for specific errors

### Authentication Not Working
- Verify Appwrite project has email/password auth enabled
- Check email/password validation in Appwrite settings
- Ensure proper error handling in auth screens

## 📚 Resources

- [Expo Documentation](https://docs.expo.dev/)
- [Appwrite Documentation](https://appwrite.io/docs)
- [NativeWind Documentation](https://www.nativewind.dev/)
- [Expo Router Documentation](https://docs.expo.dev/router/introduction/)

## 🤝 Contributing

This is your template - customize it however you need! Common improvements:
- Add biometric authentication
- Implement social auth (Google, Apple)
- Add offline support
- Create custom component library
- Add analytics
- Implement push notifications

## 📄 License

This template is free to use for your projects.

---

**Happy Building! 🎉**

Start by running `npx expo start` and editing `app/index.tsx` to create your app.
