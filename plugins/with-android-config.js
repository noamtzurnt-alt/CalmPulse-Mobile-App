const { withAndroidManifest, withGradleProperties, withStringsXml } = require('@expo/config-plugins');

const withAndroidConfig = (config) => {
  // Add AD_ID permission to manifest
  config = withAndroidManifest(config, (config) => {
    const { manifest } = config.modResults;

    console.log('🔍 Checking manifest for AD_ID permission...');

    // Ensure uses-permission array exists
    if (!manifest['uses-permission']) {
      manifest['uses-permission'] = [];
    }

    const permission = 'com.google.android.gms.permission.AD_ID';
    
    // Check if permission already exists
    let alreadyExists = false;
    if (manifest['uses-permission']) {
      alreadyExists = manifest['uses-permission'].some((item) => {
        return item.$ && item.$['android:name'] === permission;
      });
    }

    console.log('Permission already exists:', alreadyExists);

    if (!alreadyExists) {
      const newPermission = {
        $: {
          'android:name': permission,
        },
      };
      
      manifest['uses-permission'] = [
        ...(manifest['uses-permission'] || []),
        newPermission
      ];
      
      console.log('✅ Added AD_ID permission to manifest');
    }

    // Add windowSoftInputMode to activity
    if (manifest.application && manifest.application[0] && manifest.application[0].activity) {
      const activities = manifest.application[0].activity;
      activities.forEach(activity => {
        if (activity.$ && activity.$['android:name'] === '.MainActivity') {
          activity.$['android:windowSoftInputMode'] = 'adjustResize';
          console.log('✅ Added windowSoftInputMode to MainActivity');
        }
      });
    }

    return config;
  });

  // Add targetSdkVersion to gradle properties
  config = withGradleProperties(config, (config) => {
    // Remove existing entries first
    config.modResults = config.modResults.filter(item => 
      item.key !== 'android.targetSdkVersion' && 
      item.key !== 'android.compileSdkVersion'
    );

    // Add new entries
    config.modResults.push({
      type: 'property',
      key: 'android.targetSdkVersion',
      value: '35',
    });
    
    config.modResults.push({
      type: 'property',
      key: 'android.compileSdkVersion',
      value: '35',
    });

    return config;
  });

  // Add Google Sign-In configuration
  config = withStringsXml(config, (config) => {
    const { resources } = config.modResults;
    
    if (!resources.string) {
      resources.string = [];
    }

    // Add Google Sign-In web client ID
    const webClientId = {
      $: {
        name: 'default_web_client_id',
      },
      _: '652258881378-gkaaifailj07aba337590vf1umkmg1to.apps.googleusercontent.com',
    };

    // Check if already exists
    const exists = resources.string.some(item => 
      item.$ && item.$.name === 'default_web_client_id'
    );

    if (!exists) {
      resources.string.push(webClientId);
      console.log('✅ Added Google Sign-In web client ID to strings.xml');
    }

    return config;
  });

  return config;
};

module.exports = withAndroidConfig; 