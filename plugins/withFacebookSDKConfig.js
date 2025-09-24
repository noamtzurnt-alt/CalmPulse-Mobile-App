const { withInfoPlist, withAndroidManifest, withStringsXml } = require("expo/config-plugins");

module.exports = function withFacebookSDKConfig(config) {
  const FB_APP_ID = process.env.FB_APP_ID || config.extra?.FB_APP_ID || config.extra?.facebookAppId;
  const FB_DISPLAY_NAME = process.env.FB_DISPLAY_NAME || config.extra?.FB_DISPLAY_NAME || config.extra?.facebookDisplayName;
  const FB_CLIENT_TOKEN = process.env.FB_CLIENT_TOKEN || config.extra?.FB_CLIENT_TOKEN || config.extra?.facebookClientToken;

  if (!FB_APP_ID || !FB_DISPLAY_NAME) {
    console.warn("⚠️ Missing FB_APP_ID / FB_DISPLAY_NAME (env or config.extra).");
  }

  // iOS: Info.plist
  config = withInfoPlist(config, (cfg) => {
    const plist = cfg.modResults;

    // Facebook identifiers
    if (FB_APP_ID) plist.FacebookAppID = FB_APP_ID;
    if (FB_DISPLAY_NAME) plist.FacebookDisplayName = FB_DISPLAY_NAME;
    if (FB_CLIENT_TOKEN) plist.FacebookClientToken = FB_CLIENT_TOKEN;

    // iOS: Optional recommended flags
    if (plist.FacebookAutoInitEnabled === undefined) plist.FacebookAutoInitEnabled = true;
    if (plist.FacebookAutoLogAppEventsEnabled === undefined) plist.FacebookAutoLogAppEventsEnabled = true;
    if (plist.FacebookAdvertiserIDCollectionEnabled === undefined) plist.FacebookAdvertiserIDCollectionEnabled = true;

    // URL Schemes fb<APP_ID>
    if (FB_APP_ID) {
      const scheme = `fb${FB_APP_ID}`;
      const urlTypes = plist.CFBundleURLTypes || [];
      const hasScheme = urlTypes.some((t) => (t.CFBundleURLSchemes || []).includes(scheme));
      if (!hasScheme) {
        urlTypes.push({ CFBundleURLSchemes: [scheme] });
      }
      plist.CFBundleURLTypes = urlTypes;
    }

    // Login/Share queries
    const queries = new Set(plist.LSApplicationQueriesSchemes || []);
    ["fbapi", "fb-messenger-share-api", "fbauth2", "fbshareextension"].forEach((q) => queries.add(q));
    plist.LSApplicationQueriesSchemes = Array.from(queries);

    return cfg;
  });

  // Android: strings.xml
  config = withStringsXml(config, (cfg) => {
    const res = cfg.modResults.resources;
    res.string = res.string || [];
    const setString = (name, value) => {
      if (!value) return;
      const i = res.string.findIndex((s) => s.$.name === name);
      if (i >= 0) res.string[i]._ = value;
      else res.string.push({ $: { name }, _: value });
    };
    setString("facebook_app_id", FB_APP_ID);
    setString("fb_app_name", FB_DISPLAY_NAME);
    if (FB_CLIENT_TOKEN) setString("facebook_client_token", FB_CLIENT_TOKEN);
    return cfg;
  });

  // Android: AndroidManifest – meta-data
  config = withAndroidManifest(config, (cfg) => {
    const app = cfg.modResults.manifest.application?.[0];
    if (!app) return cfg;

    app["meta-data"] = app["meta-data"] || [];

    const ensureMeta = (name, value) => {
      const i = app["meta-data"].findIndex((m) => m.$["android:name"] === name);
      if (i >= 0) app["meta-data"][i].$["android:value"] = value;
      else app["meta-data"].push({ $: { "android:name": name, "android:value": value } });
      // Ensure correct value set
      const idx = app["meta-data"].findIndex((m) => m.$["android:name"] === name);
      if (idx >= 0) app["meta-data"][idx].$["android:value"] = value;
    };

    // Required by Facebook SDK
    ensureMeta("com.facebook.sdk.ApplicationId", "@string/facebook_app_id");
    ensureMeta("com.facebook.sdk.AutoInitEnabled", "true");
    ensureMeta("com.facebook.sdk.AdvertiserIDCollectionEnabled", "true");
    ensureMeta("com.facebook.sdk.AutoLogAppEventsEnabled", "true");
    if (FB_CLIENT_TOKEN) ensureMeta("com.facebook.sdk.ClientToken", "@string/facebook_client_token");

    return cfg;
  });

  return config;
}; 