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

## Learn more

- [Expo documentation](https://docs.expo.dev/)
- [Appwrite documentation](https://appwrite.io/docs)
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
