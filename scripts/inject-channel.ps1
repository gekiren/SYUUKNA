# Build configuration injection script (inject-channel.ps1)

$projectRoot = Get-Location
$manifestPath = Join-Path $projectRoot "android/app/src/main/AndroidManifest.xml"
$propertiesPath = Join-Path $projectRoot "android/app/src/main/assets/expo-updates.properties"
$buildGradlePath = Join-Path $projectRoot "android/app/build.gradle"

Write-Host "Starting build configuration injection..." -ForegroundColor Cyan

# 1. Sync expo-updates.properties and inject channel
if (Test-Path $manifestPath) {
    Write-Host "Found AndroidManifest.xml at $manifestPath" -ForegroundColor Green
    
    [xml]$xml = Get-Content $manifestPath
    
    $nsUri = "http://schemas.android.com/apk/res/android"
    $applicationNode = $xml.manifest.application
    $metaDataNodes = $applicationNode.'meta-data'
    
    # Search for existing node using namespace-aware check
    $channelNode = $null
    foreach ($node in $metaDataNodes) {
        $nameAttr = $node.Attributes['name', $nsUri]
        if ($null -ne $nameAttr -and $nameAttr.Value -eq "expo.modules.updates.EXPO_RELEASE_CHANNEL") {
            $channelNode = $node
            break
        }
    }
    
    if ($null -eq $channelNode) {
        $newNode = $xml.CreateElement("meta-data")
        
        # Create namespace-aware 'android:name' attribute
        $nameAttr = $xml.CreateAttribute("android", "name", $nsUri)
        $nameAttr.Value = "expo.modules.updates.EXPO_RELEASE_CHANNEL"
        [void]$newNode.Attributes.Append($nameAttr)
        
        # Create namespace-aware 'android:value' attribute
        $valueAttr = $xml.CreateAttribute("android", "value", $nsUri)
        $valueAttr.Value = "production"
        [void]$newNode.Attributes.Append($valueAttr)
        
        [void]$applicationNode.AppendChild($newNode)
        Write-Host "Injected EXPO_RELEASE_CHANNEL=production into AndroidManifest.xml" -ForegroundColor Yellow
    } else {
        $valueAttr = $channelNode.Attributes['value', $nsUri]
        if ($null -ne $valueAttr) {
            $valueAttr.Value = "production"
        } else {
            $valueAttr = $xml.CreateAttribute("android", "value", $nsUri)
            $valueAttr.Value = "production"
            [void]$channelNode.Attributes.Append($valueAttr)
        }
        Write-Host "Updated EXPO_RELEASE_CHANNEL to production in AndroidManifest.xml" -ForegroundColor Yellow
    }
    
    $xml.Save($manifestPath)
} else {
    Write-Host "Warning: AndroidManifest.xml not found. Run 'npx expo prebuild' first." -ForegroundColor Red
}

# 2. Generate and write expo-updates.properties file
$assetsDir = Split-Path $propertiesPath -Parent
if (!(Test-Path $assetsDir)) {
    New-Item -ItemType Directory -Force -Path $assetsDir > $null
}

$propertiesContent = 'expo.modules.updates.EXPO_UPDATE_URL=https://u.expo.dev/default
expo.modules.updates.EXPO_SDK_VERSION=56.0.0
expo.modules.updates.EXPO_RELEASE_CHANNEL=production'

Set-Content -Path $propertiesPath -Value $propertiesContent -Force
Write-Host "Generated expo-updates.properties at $propertiesPath" -ForegroundColor Green

# 3. Add signingConfigs.release to build.gradle
if (Test-Path $buildGradlePath) {
    Write-Host "Found build.gradle at $buildGradlePath" -ForegroundColor Green
    $gradleContent = Get-Content $buildGradlePath -Raw

    if ($gradleContent -notlike "*signingConfigs.release*") {
        $releaseSigningConfig = '    signingConfigs {
        release {
            if (project.hasProperty("MYAPP_RELEASE_STORE_FILE")) {
                storeFile file(MYAPP_RELEASE_STORE_FILE)
                storePassword MYAPP_RELEASE_STORE_PASSWORD
                keyAlias MYAPP_RELEASE_KEY_ALIAS
                keyPassword MYAPP_RELEASE_KEY_PASSWORD
            }
        }
        debug {'

        $gradleContent = $gradleContent -replace 'signingConfigs\s*\{\s*debug\s*\{', $releaseSigningConfig
        $gradleContent = $gradleContent -replace 'signingConfig\s+signingConfigs\.debug(\s+def\s+enableShrinkResources)', 'signingConfig signingConfigs.release$1'
        
        Set-Content -Path $buildGradlePath -Value $gradleContent -Force
        Write-Host "Successfully injected release signing config into build.gradle" -ForegroundColor Green
    } else {
        Write-Host "Release signing config is already present in build.gradle" -ForegroundColor Yellow
    }
} else {
    Write-Host "Warning: build.gradle not found at $buildGradlePath" -ForegroundColor Red
}

Write-Host "Injection process completed successfully!" -ForegroundColor Cyan
