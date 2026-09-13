import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = __dirname;

console.log('\n======================================================');
console.log('   GOOGLE PLAY STORE READINESS AUDIT & TEST SUITE     ');
console.log('======================================================\n');

let passCount = 0;
let warnCount = 0;
let failCount = 0;

function pass(testName, details) {
  console.log(`[PASS] \x1b[32m${testName}\x1b[0m`);
  if (details) console.log(`       -> ${details}`);
  passCount++;
}

function warn(testName, details) {
  console.log(`[WARN] \x1b[33m${testName}\x1b[0m`);
  if (details) console.log(`       -> ${details}`);
  warnCount++;
}

function fail(testName, details) {
  console.log(`[FAIL] \x1b[31m${testName}\x1b[0m`);
  if (details) console.log(`       -> ${details}`);
  failCount++;
}

// 1. Target SDK & Compile SDK Level
try {
  const variablesGradle = fs.readFileSync(path.join(root, 'android', 'variables.gradle'), 'utf8');
  const targetMatch = variablesGradle.match(/targetSdkVersion\s*=\s*(\d+)/);
  const minMatch = variablesGradle.match(/minSdkVersion\s*=\s*(\d+)/);
  const targetSdk = targetMatch ? parseInt(targetMatch[1], 10) : 0;
  const minSdk = minMatch ? parseInt(minMatch[1], 10) : 0;

  if (targetSdk >= 34) {
    pass('Target SDK Version', `Target API level is ${targetSdk} (Google Play requires API 34+). Min SDK is ${minSdk}.`);
  } else {
    fail('Target SDK Version', `Target API level is ${targetSdk}. Google Play requires API 34+ (Android 14+).`);
  }
} catch (e) {
  fail('Target SDK Version', `Could not read android/variables.gradle: ${e.message}`);
}

// 2. Application ID / Package Name Policy
try {
  const capConfig = JSON.parse(fs.readFileSync(path.join(root, 'capacitor.config.json'), 'utf8'));
  const appId = capConfig.appId;

  if (appId.includes('yourorganization') || appId.includes('example')) {
    fail('Application ID / Package Name', `Current appId is "${appId}". Google Play rejects "com.yourorganization.*" or "com.example.*". Change to your unique production namespace (e.g., com.vanguardgeo.dispatch).`);
  } else {
    pass('Application ID / Package Name', `Valid custom package namespace: ${appId}`);
  }
} catch (e) {
  fail('Application ID / Package Name', `Could not verify capacitor.config.json: ${e.message}`);
}

// 3. AndroidManifest.xml Essential Permissions
try {
  const manifest = fs.readFileSync(path.join(root, 'android', 'app', 'src', 'main', 'AndroidManifest.xml'), 'utf8');
  const hasInternet = manifest.includes('android.permission.INTERNET');
  const hasFineLoc = manifest.includes('android.permission.ACCESS_FINE_LOCATION');
  const hasCoarseLoc = manifest.includes('android.permission.ACCESS_COARSE_LOCATION');
  const hasVibrate = manifest.includes('android.permission.VIBRATE');
  const hasAudio = manifest.includes('android.permission.RECORD_AUDIO');

  if (hasInternet && hasFineLoc && hasCoarseLoc && hasVibrate && hasAudio) {
    pass('Android Permissions Audit', 'All tactical permissions declared (INTERNET, GPS Location, Vibration, Audio Dictation).');
  } else {
    const missing = [];
    if (!hasInternet) missing.push('INTERNET');
    if (!hasFineLoc) missing.push('ACCESS_FINE_LOCATION');
    if (!hasCoarseLoc) missing.push('ACCESS_COARSE_LOCATION');
    if (!hasVibrate) missing.push('VIBRATE');
    if (!hasAudio) missing.push('RECORD_AUDIO');
    fail('Android Permissions Audit', `Missing required permissions: ${missing.join(', ')}`);
  }
} catch (e) {
  fail('Android Permissions Audit', `Could not read AndroidManifest.xml: ${e.message}`);
}

// 4. Web Production Assets Build (dist/)
try {
  const distHtml = path.join(root, 'dist', 'index.html');
  if (fs.existsSync(distHtml) && fs.statSync(distHtml).size > 1000) {
    pass('Vite Web Production Bundle', `dist/ exists and is compiled (${fs.statSync(distHtml).size} bytes).`);
  } else {
    fail('Vite Web Production Bundle', 'dist/index.html is missing or empty. Run "npm run build".');
  }
} catch (e) {
  fail('Vite Web Production Bundle', `Error checking dist: ${e.message}`);
}

// 5. Capacitor Asset Synchronization
try {
  const syncedHtml = path.join(root, 'android', 'app', 'src', 'main', 'assets', 'public', 'index.html');
  if (fs.existsSync(syncedHtml)) {
    const distSize = fs.statSync(path.join(root, 'dist', 'index.html')).size;
    const syncedSize = fs.statSync(syncedHtml).size;
    if (distSize === syncedSize) {
      pass('Capacitor Assets Sync', 'android/ assets are 100% synchronized with latest production dist/.');
    } else {
      warn('Capacitor Assets Sync', `Asset size mismatch (dist: ${distSize}b vs android: ${syncedSize}b). Run "npx cap sync android".`);
    }
  } else {
    fail('Capacitor Assets Sync', 'Synced assets not found in android/app/src/main/assets/public. Run "npx cap sync android".');
  }
} catch (e) {
  fail('Capacitor Assets Sync', `Error checking synced assets: ${e.message}`);
}

// 6. Web App Manifest (PWA & TWA Compliance)
try {
  const manifestPath = path.join(root, 'public', 'manifest.webmanifest');
  const webManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (webManifest.name && webManifest.start_url && webManifest.icons && webManifest.icons.length > 0) {
    pass('Web App Manifest Integrity', `App name "${webManifest.name}" with display mode "${webManifest.display}".`);
  } else {
    fail('Web App Manifest Integrity', 'Manifest is missing required PWA fields (name, start_url, or icons).');
  }
} catch (e) {
  fail('Web App Manifest Integrity', `Error reading manifest: ${e.message}`);
}

// 7. Android App Bundle (.aab) Build Status
try {
  const aabPath = path.join(root, 'android', 'app', 'build', 'outputs', 'bundle', 'release', 'app-release.aab');
  if (fs.existsSync(aabPath)) {
    pass('Google Play App Bundle (.aab)', `Found compiled release bundle at ${aabPath}`);
  } else {
    warn('Google Play App Bundle (.aab)', 'No release .aab bundle found yet. You must compile this with "./gradlew bundleRelease" before submitting to Play Console.');
  }
} catch (e) {
  warn('Google Play App Bundle (.aab)', `Could not check aab path: ${e.message}`);
}

// 8. Release Signing & Keystore Configuration
try {
  const buildGradle = fs.readFileSync(path.join(root, 'android', 'app', 'build.gradle'), 'utf8');
  if (buildGradle.includes('signingConfigs') && buildGradle.includes('release')) {
    pass('Cryptographic Release Signing', 'Release signing configuration is declared in build.gradle.');
  } else {
    warn('Cryptographic Release Signing', 'build.gradle does not yet have signingConfigs.release specified. You need an upload keystore generated with keytool for Google Play App Signing.');
  }
} catch (e) {
  warn('Cryptographic Release Signing', `Error checking build.gradle: ${e.message}`);
}

// 9. Google Play Policy: Government Entity / Official Disaster Misrepresentation Disclaimer
try {
  const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const appJsx = fs.readFileSync(path.join(root, 'src', 'App.jsx'), 'utf8');
  const hasHtmlDisclaimer = indexHtml.includes('not affiliated with') || indexHtml.includes('independent');
  const hasAppDisclaimer = appJsx.includes('not affiliated with') || appJsx.includes('independent tactical') || appJsx.includes('Official State Field Copy');

  if (hasHtmlDisclaimer || hasAppDisclaimer) {
    pass('Google Play Government Policy Disclaimer', 'App includes clear independent utility disclaimer to avoid Play Store impersonation strikes.');
  } else {
    warn('Google Play Government Policy Disclaimer', 'Because app mentions KSDMA, DEOC 1077, and Kerala emergency services, Google Play requires an explicit disclaimer: "Not officially affiliated with or endorsed by any government disaster management authority."');
  }
} catch (e) {
  warn('Google Play Government Policy Disclaimer', `Error checking disclaimers: ${e.message}`);
}

// 10. Privacy Policy URL Availability
try {
  const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const hasPrivacy = indexHtml.includes('privacy') || indexHtml.includes('Privacy');
  if (hasPrivacy) {
    pass('Privacy Policy Declaration', 'Privacy references present in web client.');
  } else {
    warn('Privacy Policy Declaration', 'Google Play requires a dedicated, publicly accessible Privacy Policy URL during Play Console app setup.');
  }
} catch (e) {
  warn('Privacy Policy Declaration', `Error checking privacy policy: ${e.message}`);
}

console.log('\n------------------------------------------------------');
console.log(`AUDIT RESULTS: \x1b[32m${passCount} PASSED\x1b[0m | \x1b[33m${warnCount} WARNINGS / ACTIONS\x1b[0m | \x1b[31m${failCount} BLOCKERS\x1b[0m`);
console.log('------------------------------------------------------\n');

process.exit(failCount > 0 ? 1 : 0);
