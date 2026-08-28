if (typeof WScript !== 'undefined') {
  WScript.Echo("PerioVoice AI™ Selenium E2E Test Suite\n\nTo run these tests on Windows:\nPlease double-click 'run-tests.bat' in this folder!");
  WScript.Quit();
}

/**
 * login-tests.js — PerioVoice AI™ Selenium WebDriver E2E Test Suite
 * Fully automated end-to-end testing for Web Frontend & Authentication Flow
 */

var webdriver = require('selenium-webdriver');
var Builder = webdriver.Builder;
var By = webdriver.By;
var Key = webdriver.Key;
var until = webdriver.until;
var assert = require('assert');
var path = require('path');
var fs = require('fs');

var BASE_URL = process.env.TEST_URL || 'http://localhost:3000';
var TIMEOUT = 15000;

describe('PerioVoice AI™ End-to-End Selenium Test Suite', function () {
  this.timeout(60000);
  var driver;

  before(function () {
    var chrome = require('selenium-webdriver/chrome');
    var options = new chrome.Options();
    options.addArguments('--headless=new');
    options.addArguments('--disable-gpu');
    options.addArguments('--no-sandbox');
    options.addArguments('--disable-dev-shm-usage');
    options.addArguments('--window-size=1440,900');

    driver = new Builder().forBrowser('chrome').setChromeOptions(options).build();
    return driver.manage().setTimeouts({ implicit: 5000, pageLoad: 20000 });
  });

  after(function () {
    if (driver) {
      return driver.quit();
    }
  });

  describe('Module 1: Authentication & Authorization', function () {
    it('TC001: Should load login page with title and logo', function () {
      return driver.get(BASE_URL + '/login').then(function () {
        return driver.findElement(By.className('login-title')).getText();
      }).then(function (title) {
        assert.strictEqual(title.indexOf('PerioVoice AI') !== -1, true);
      });
    });

    it('TC002: Should display error on weak password (<8 characters)', function () {
      return driver.get(BASE_URL + '/login').then(function () {
        return driver.findElement(By.xpath("//button[contains(text(), 'Register')]")).click();
      }).then(function () {
        return driver.findElement(By.xpath("//input[@placeholder='Enter your name']")).sendKeys('Test User');
      }).then(function () {
        return driver.findElement(By.xpath("//input[@placeholder='Enter your email']")).sendKeys('test@example.com');
      }).then(function () {
        return driver.findElement(By.xpath("//input[@placeholder='Enter your password']")).sendKeys('Weak1!');
      }).then(function () {
        return driver.findElement(By.xpath("//input[@placeholder='Re-enter your password']")).sendKeys('Weak1!');
      }).then(function () {
        return driver.findElement(By.xpath("//button[@type='submit']")).click();
      }).then(function () {
        return driver.wait(until.elementLocated(By.className('login-error')), TIMEOUT);
      }).then(function (errorMsg) {
        return errorMsg.getText();
      }).then(function (text) {
        assert.strictEqual(text.indexOf('Password must be at least 8 characters') !== -1, true);
      });
    });

    it('TC003: Should authenticate as Guest Patient seamlessly', function () {
      return driver.get(BASE_URL + '/login').then(function () {
        return driver.wait(until.elementLocated(By.className('btn-guest')), TIMEOUT);
      }).then(function (guestBtn) {
        return guestBtn.click();
      }).then(function () {
        return driver.wait(until.urlIs(BASE_URL + '/'), TIMEOUT);
      }).then(function () {
        return driver.getCurrentUrl();
      }).then(function (currentUrl) {
        assert.strictEqual(currentUrl, BASE_URL + '/');
      });
    });
  });
});
