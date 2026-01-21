# 75 Hard Challenge Tracker

A mobile app built with React Native and Expo for tracking the 75 Hard fitness challenge. Track daily tasks, monitor progress, sync with Apple Health, and stay accountable throughout the 75-day journey.

## Features

- **Daily Task Tracking**: Log workouts, water intake, diet compliance, progress photos, and reading
- **Apple Health Integration**: Automatically sync steps, weight, water, and other health metrics
- **Challenge Management**: Set start/end dates and track overall progress
- **Activity Feed**: View your daily logs and completed tasks
- **Analytics Dashboard**: Visualize your progress over time
- **User Authentication**: Secure login with Appwrite backend
- **Offline Support**: Track activities even without internet connection

## Tech Stack

- **Framework**: Expo (React Native)
- **Backend**: Appwrite
- **State Management**: Zustand
- **Styling**: NativeWind (Tailwind CSS)
- **Health Data**: react-native-health (Apple HealthKit)
- **Error Tracking**: Sentry

## Requirements

- Node.js (LTS recommended)
- npm or yarn
- iOS Simulator (Xcode) for iOS development
- Appwrite instance (backend)

## Quick Start

1. Install dependencies

   ```bash
   npm install
   ```

2. Set up environment variables

   Create a `.env` file with:

   ```env
   EXPO_PUBLIC_APPWRITE_ENDPOINT=your-appwrite-endpoint
   EXPO_PUBLIC_APPWRITE_PROJECT_ID=your-project-id
   EXPO_PUBLIC_APPWRITE_DATABASE_ID=your-database-id
   EXPO_PUBLIC_APPWRITE_COLLECTION_ID=your-collection-id
   EXPO_PUBLIC_SENTRY_DSN=your-sentry-dsn
   ```

3. Start the app

   ```bash
   npx expo start
   ```

## Project Structure

- `app/`: Screens and routes (file-based routing with Expo Router)
  - `(tabs)/`: Main tab navigation (Home, Activity, Analytics, Profile)
  - `auth/`: Authentication screens
  - Individual log screens for each activity type
- `components/`: Reusable UI components
- `lib/`: Utility functions and API clients
- `store/`: Zustand state management stores
- `constants/`: App constants and configurations
- `hooks/`: Custom React hooks
- `assets/`: Images, fonts, and icons

## Building for Production

```bash
# iOS TestFlight build
eas build --profile testflight --platform ios --auto-submit

# Production build
eas build --profile production --platform ios
```

## Appwrite Setup

### Collection Permissions (Document Security)

This app uses **document-level permissions** for row-level security. Each document is created with permissions that allow only its owner to read, update, and delete it.

**In your Appwrite Console, configure each collection with these settings:**

1. Go to **Database > Your Database > Collection > Settings**
2. Under **Permissions**, set:
   - **Document Security**: **Enabled** ✅
   - Remove any "Any" or "All Users" permissions
3. Under **Create permission**, add:
   - `Role: Users` → **Create** ✅

This ensures:
- Users can only **create** documents (not read others' data)
- The app sets per-document permissions so each user can only access their own rows
- No user can read, update, or delete another user's data

**Collections to configure:**
| Collection | Create Permission |
|------------|------------------|
| `users` | Users |
| `challenges` | Users |
| `dailyLogs` | Users |
| `cycleLog` | Users |
| `activityLogs` | Users |
| `userBadges` | Users |

### How It Works

When a document is created, the app automatically attaches these permissions:
```ts
Permission.read(Role.user(userId))    // Only this user can read
Permission.update(Role.user(userId))  // Only this user can update
Permission.delete(Role.user(userId))  // Only this user can delete
```

This means even if collection-level permissions were more permissive, the document-level permissions restrict access to the owner only.

## Learn more

- [Expo documentation](https://docs.expo.dev/)
- [Appwrite documentation](https://appwrite.io/docs)
- [Appwrite Permissions](https://appwrite.io/docs/products/databases/permissions)
- [75 Hard Challenge](https://andyfrisella.com/pages/75hard-info)

## Contributing

Work in branches and open pull requests:

```bash
# create a feature branch
git checkout -b feature/your-feature

# stage and commit your changes
git add .
git commit -m "feat: add new feature"

# push and set upstream
git push -u origin feature/your-feature
```

Then open a PR on GitHub for review.

## License

MIT
