if (typeof WScript !== 'undefined') {
  WScript.Echo("PerioVoice AI™ Appium Mobile E2E Test Suite\n\nTo run these tests on Windows:\nPlease double-click 'run-appium-tests.bat' in this folder!");
  WScript.Quit();
}

/**
 * app-login-tests.js — PerioVoice AI™ Appium Mobile E2E Test Suite
 * Fully automated end-to-end testing for App Frontend & Android App Flow
 */

var webdriverio = require('webdriverio');
var remote = webdriverio.remote;
var assert = require('assert');
var path = require('path');

var APPIUM_OPTS = {
  path: '/wd/hub',
  port: 723,
  capabilities: {
    platformName: 'Android',
    'appium:automationName': 'UiAutomator2',
    'appium:deviceName': 'Android_Device_or_Emulator',
    'appium:app': path.join(__dirname, '../../android app/periovoice-ai-app.apk'),
    'appium:appPackage': 'com.periovoice.ai',
    'appium:appActivity': 'com.periovoice.ai.MainActivity',
    'appium:autoGrantPermissions': true,
    'appium:newCommandTimeout': 180
  }
};

describe('PerioVoice AI™ Mobile Appium E2E Test Suite', function () {
  this.timeout(120000);
  var client;

  before(function () {
    return remote(APPIUM_OPTS).then(function (c) {
      client = c;
    });
  });

  after(function () {
    if (client) {
      return client.deleteSession();
    }
  });

  // ==========================================
  // MODULE 1: APP LAUNCH & PERMISSIONS
  // ==========================================
  describe('Module 1: Android App Launch & Native Permissions', function () {
    it('TC001: Should launch Android APK MainActivity successfully', function () {
      return client.isAppInstalled('com.periovoice.ai').then(function (isAppInstalled) {
        assert.strictEqual(isAppInstalled, true);
      });
    });

    it('TC002: Should auto-grant Camera and Record Audio permissions', function () {
      return client.$('~Camera').then(function (cameraBtn) {
        return cameraBtn.isExisting();
      }).then(function (exists) {
        assert.strictEqual(exists, true);
      });
    });

    it('TC003: Should render WebView interface inside Capacitor container', function () {
      return client.getContexts().then(function (contexts) {
        assert.strictEqual(contexts.some(function (c) { return c.indexOf('WEBVIEW') !== -1; }), true);
      });
    });
  });

  // ==========================================
  // MODULE 2: NATIVE AUTHENTICATION
  // ==========================================
  describe('Module 2: Native Authentication & Guest Session', function () {
    it('TC041: Should log in as Guest Patient on Android WebView', function () {
      return client.switchContext('WEBVIEW_com.periovoice.ai').then(function () {
        return client.$('.btn-guest');
      }).then(function (guestBtn) {
        return guestBtn.click();
      }).then(function () {
        return client.$('input[placeholder*="Describe your tooth"]');
      }).then(function (chatInput) {
        return chatInput.waitForExist({ timeout: 10000 });
      }).then(function () {
        return client.$('input[placeholder*="Describe your tooth"]');
      }).then(function (chatInput) {
        return chatInput.isDisplayed();
      }).then(function (isDisplayed) {
        assert.strictEqual(isDisplayed, true);
      });
    });
  });

  // ==========================================
  // MODULE 3: MOBILE TRIAGE CHAT & NEGATIVE parsing
  // ==========================================
  describe('Module 3: Mobile Triage Chat & Negative Parsing', function () {
    it('TC081: Should process tooth pain message and ask location', function () {
      return client.$('input[placeholder*="Describe your tooth"]').then(function (chatInput) {
        return chatInput.setValue('I have severe tooth pain');
      }).then(function () {
        return client.$('.btn-send');
      }).then(function (sendBtn) {
        return sendBtn.click();
      }).then(function () {
        return client.$('.chat-bubble-bot:last-child');
      }).then(function (lastReply) {
        return lastReply.getText();
      }).then(function (text) {
        assert.strictEqual(text.toLowerCase().indexOf('location') !== -1 || text.toLowerCase().indexOf('tooth') !== -1, true);
      });
    });

    it('TC201: Should handle negative location "no where" cleanly on Android', function () {
      return client.$('input[placeholder*="Describe your tooth"]').then(function (chatInput) {
        return chatInput.setValue('no where');
      }).then(function () {
        return client.$('.btn-send');
      }).then(function (sendBtn) {
        return sendBtn.click();
      }).then(function () {
        return client.$('.chat-bubble-bot:last-child');
      }).then(function (lastReply) {
        return lastReply.getText();
      }).then(function (text) {
        assert.strictEqual(text.indexOf('no where is noted') === -1, true);
        assert.strictEqual(text.indexOf('no specific') !== -1 || text.indexOf('going on') !== -1, true);
      });
    });
  });
});
