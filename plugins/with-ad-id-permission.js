const { withAndroidManifest } = require('@expo/config-plugins');

const withAdIdPermission = (config) => {
  return withAndroidManifest(config, (config) => {
    const { manifest } = config.modResults;

    // Add the AD_ID permission if it doesn't exist
    const permission = 'com.google.android.gms.permission.AD_ID';
    const alreadyExists = manifest['uses-permission']?.some((item) => {
      return item.$['android:name'] === permission;
    });

    if (!alreadyExists) {
      manifest['uses-permission'] = [
        ...(manifest['uses-permission'] || []),
        {
          $: {
            'android:name': permission,
          },
        },
      ];
    }

    return config;
  });
};

module.exports = withAdIdPermission; 