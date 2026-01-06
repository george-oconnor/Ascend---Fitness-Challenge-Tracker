#!/usr/bin/env node

const readline = require('readline');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function setup() {
  console.log('\n🚀 Expo + Appwrite Template Setup\n');
  console.log('This script will configure your new app.\n');

  // Gather information
  const appName = await question('App Name (e.g., "My Awesome App"): ');
  const slug = await question('App Slug (e.g., "my-awesome-app"): ');
  const bundleId = await question('Bundle Identifier (e.g., "com.yourcompany.app"): ');
  const appwriteEndpoint = await question('Appwrite Endpoint (e.g., "https://cloud.appwrite.io/v1"): ');
  const appwriteProjectId = await question('Appwrite Project ID: ');
  const sentryDsn = await question('Sentry DSN (optional, press Enter to skip): ');

  console.log('\n📝 Updating configuration files...\n');

  // Update app.json
  const appJsonPath = path.join(__dirname, '..', 'app.json');
  const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
  
  appJson.expo.name = appName;
  appJson.expo.slug = slug;
  appJson.expo.description = `${appName} - Built with Expo and Appwrite`;
  appJson.expo.ios.bundleIdentifier = bundleId;
  appJson.expo.ios.buildNumber = "1";
  appJson.expo.android = appJson.expo.android || {};
  appJson.expo.android.package = bundleId;
  appJson.expo.android.versionCode = 1;
  
  fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2));
  console.log('✅ Updated app.json');

  // Update package.json
  const packageJsonPath = path.join(__dirname, '..', 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  
  packageJson.name = slug;
  packageJson.version = "1.0.0";
  
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
  console.log('✅ Updated package.json');

  // Create .env file
  const envPath = path.join(__dirname, '..', '.env');
  const envContent = `# Appwrite Configuration
EXPO_PUBLIC_APPWRITE_ENDPOINT=${appwriteEndpoint}
EXPO_PUBLIC_APPWRITE_PROJECT_ID=${appwriteProjectId}

# Sentry Configuration (optional)
${sentryDsn ? `EXPO_PUBLIC_SENTRY_DSN=${sentryDsn}` : '# EXPO_PUBLIC_SENTRY_DSN=your-sentry-dsn'}
`;
  
  fs.writeFileSync(envPath, envContent);
  console.log('✅ Created .env file');

  // Initialize git
  console.log('\n🔧 Initializing git repository...\n');
  try {
    execSync('git init', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });
    execSync('git add .', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });
    execSync(`git commit -m "Initial commit: ${appName}"`, { cwd: path.join(__dirname, '..'), stdio: 'inherit' });
    console.log('✅ Git repository initialized');
  } catch (error) {
    console.log('⚠️  Git initialization skipped (may already exist)');
  }

  console.log('\n✨ Setup complete!\n');
  console.log('Next steps:');
  console.log('1. npm install');
  console.log('2. npx expo start');
  console.log('3. Start building your app!\n');
  console.log('📚 Check TEMPLATE.md for more information.\n');

  rl.close();
}

setup().catch(error => {
  console.error('Setup failed:', error);
  rl.close();
  process.exit(1);
});
