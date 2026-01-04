/**
 * Antifraud Client Script Template
 *
 * Генерирует JS-код для встраивания на сайт клиента.
 * Скрипт определяет ботов и отправляет данные в Яндекс.Метрику.
 */

export interface AntifraudConfig {
  metrikaId: string;
  threshold?: number; // Score threshold for bot detection (default: 5)
  enableHoneypot?: boolean;
  enableCrmTracking?: boolean; // Add hidden fields to forms for CRM tracking
  debug?: boolean;
}

/**
 * Generate antifraud script for client's website
 */
export function generateAntifraudScript(config: AntifraudConfig): string {
  const {
    metrikaId,
    threshold = 5,
    enableHoneypot = true,
    enableCrmTracking = true,
    debug = false
  } = config;

  return `
/**
 * Neurodirectolog Antifraud Script v1.0
 * Защита от скликивания и ботов
 *
 * Метрика ID: ${metrikaId}
 * Порог срабатывания: ${threshold}
 */
(function() {
  'use strict';

  var METRIKA_ID = ${metrikaId};
  var THRESHOLD = ${threshold};
  var DEBUG = ${debug};

  // Scoring system
  var score = 0;
  var checks = [];

  function log(msg) {
    if (DEBUG) console.log('[Antifraud]', msg);
  }

  function addScore(points, reason) {
    score += points;
    checks.push({ reason: reason, points: points });
    log(reason + ' (+' + points + '), total: ' + score);
  }

  // ===== ПРОВЕРКИ =====

  // 1. navigator.webdriver (Selenium, Puppeteer, Playwright)
  // Вес: +5, False positive: почти нет
  if (navigator.webdriver === true) {
    addScore(5, 'webdriver_detected');
  }

  // 2. HeadlessChrome в User-Agent
  // Вес: +5, False positive: нет
  if (/HeadlessChrome/i.test(navigator.userAgent)) {
    addScore(5, 'headless_chrome');
  }

  // 3. PhantomJS detection
  // Вес: +5, False positive: нет
  if (window.callPhantom || window._phantom || window.phantom) {
    addScore(5, 'phantomjs_detected');
  }

  // 4. Nightmare.js detection
  // Вес: +5, False positive: нет
  if (window.__nightmare) {
    addScore(5, 'nightmare_detected');
  }

  // 5. Selenium detection (additional)
  // Вес: +3, False positive: почти нет
  if (window.document.documentElement.getAttribute('webdriver') ||
      window.document.documentElement.getAttribute('selenium') ||
      window.document.documentElement.getAttribute('driver')) {
    addScore(3, 'selenium_attributes');
  }

  // 6. Canvas fingerprint test
  // Боты часто не могут рендерить canvas корректно
  // Вес: +3, False positive: старые браузеры (редко)
  try {
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillText('ANTIFRAUD', 2, 2);
      var data = canvas.toDataURL();

      // Пустой или слишком короткий результат = подозрительно
      if (!data || data.length < 1000) {
        addScore(3, 'canvas_empty');
      }
    } else {
      addScore(2, 'canvas_no_context');
    }
  } catch (e) {
    addScore(2, 'canvas_error');
  }

  // 7. Маленькое окно браузера (headless часто запускают с минимальным размером)
  // Вес: +4, False positive: почти нет
  if (window.innerWidth < 300 || window.innerHeight < 100) {
    addScore(4, 'small_window');
  }

  // 8. Нет плагинов И нет языков (подозрительная комбинация)
  // Вес: +2, False positive: редко (privacy mode)
  if (navigator.plugins && navigator.plugins.length === 0 &&
      navigator.languages && navigator.languages.length === 0) {
    addScore(2, 'no_plugins_no_languages');
  }

  // 9. Automation-related properties
  // Вес: +3, False positive: нет
  if (window.domAutomation || window.domAutomationController) {
    addScore(3, 'dom_automation');
  }

  // 10. Chrome specific automation detection
  // Вес: +3, False positive: нет
  if (window.chrome) {
    // Check for automation extension
    if (!window.chrome.runtime || !window.chrome.runtime.id) {
      // Could be headless, but not definitive
      // Only flag if combined with other signals
    }
  }

  // 11. Permissions API anomaly (headless often returns unusual values)
  // Вес: +2, False positive: редко
  if (navigator.permissions) {
    navigator.permissions.query({ name: 'notifications' }).then(function(result) {
      if (result.state === 'denied' && navigator.webdriver) {
        addScore(2, 'permissions_anomaly');
        checkThreshold();
      }
    }).catch(function() {});
  }

  // ===== HONEYPOT =====
  ${enableHoneypot ? `
  // Добавляем скрытое поле в формы - боты его заполняют
  var honeypotStyle = document.createElement('style');
  honeypotStyle.textContent = '.ndf-hp{position:absolute!important;left:-9999px!important;opacity:0!important;pointer-events:none!important}';
  document.head.appendChild(honeypotStyle);

  function addHoneypot(form) {
    if (form.querySelector('input[name="ndf_check"]')) return;
    var hp = document.createElement('input');
    hp.type = 'text';
    hp.name = 'ndf_check';
    hp.className = 'ndf-hp';
    hp.setAttribute('autocomplete', 'off');
    hp.setAttribute('tabindex', '-1');
    form.appendChild(hp);
  }

  // Добавляем в существующие формы
  document.querySelectorAll('form').forEach(addHoneypot);

  // Следим за новыми формами
  var formObserver = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
      mutation.addedNodes.forEach(function(node) {
        if (node.tagName === 'FORM') addHoneypot(node);
        if (node.querySelectorAll) {
          node.querySelectorAll('form').forEach(addHoneypot);
        }
      });
    });
  });
  formObserver.observe(document.body, { childList: true, subtree: true });

  // Перехватываем отправку форм
  document.addEventListener('submit', function(e) {
    var form = e.target;
    var hp = form.querySelector('input[name="ndf_check"]');
    if (hp && hp.value.trim() !== '') {
      addScore(10, 'honeypot_filled');
      log('HONEYPOT TRIGGERED: ' + hp.value);
      checkThreshold();
    }
  }, true);
  ` : '// Honeypot disabled'}

  // ===== CRM TRACKING =====
  ${enableCrmTracking ? `
  // Добавляем скрытые поля для передачи в CRM
  // Эти поля автоматически попадут в CRM вместе с заявкой
  var crmTrackingStyle = document.createElement('style');
  crmTrackingStyle.textContent = '.ndf-crm{position:absolute!important;left:-9999px!important;opacity:0!important;pointer-events:none!important;height:0!important;width:0!important;overflow:hidden!important}';
  document.head.appendChild(crmTrackingStyle);

  function addCrmFields(form) {
    // Не добавляем повторно
    if (form.querySelector('input[name="ndf_bot_score"]')) return;

    // Создаём контейнер для скрытых полей
    var container = document.createElement('div');
    container.className = 'ndf-crm';

    // Поле: bot score (числовой)
    var scoreField = document.createElement('input');
    scoreField.type = 'hidden';
    scoreField.name = 'ndf_bot_score';
    scoreField.value = score.toString();
    container.appendChild(scoreField);

    // Поле: is_bot (да/нет)
    var botField = document.createElement('input');
    botField.type = 'hidden';
    botField.name = 'ndf_is_bot';
    botField.value = score >= THRESHOLD ? 'yes' : 'no';
    container.appendChild(botField);

    // Поле: какие проверки сработали
    var checksField = document.createElement('input');
    checksField.type = 'hidden';
    checksField.name = 'ndf_checks';
    checksField.value = checks.map(function(c) { return c.reason; }).join(',');
    container.appendChild(checksField);

    // Поле: метка времени
    var tsField = document.createElement('input');
    tsField.type = 'hidden';
    tsField.name = 'ndf_timestamp';
    tsField.value = new Date().toISOString();
    container.appendChild(tsField);

    form.appendChild(container);
    log('CRM fields added to form');
  }

  // Функция обновления значений перед отправкой
  function updateCrmFields(form) {
    var scoreField = form.querySelector('input[name="ndf_bot_score"]');
    var botField = form.querySelector('input[name="ndf_is_bot"]');
    var checksField = form.querySelector('input[name="ndf_checks"]');

    if (scoreField) scoreField.value = score.toString();
    if (botField) botField.value = score >= THRESHOLD ? 'yes' : 'no';
    if (checksField) checksField.value = checks.map(function(c) { return c.reason; }).join(',');
  }

  // Добавляем поля во все существующие формы
  document.querySelectorAll('form').forEach(addCrmFields);

  // Следим за новыми формами
  var crmObserver = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
      mutation.addedNodes.forEach(function(node) {
        if (node.tagName === 'FORM') addCrmFields(node);
        if (node.querySelectorAll) {
          node.querySelectorAll('form').forEach(addCrmFields);
        }
      });
    });
  });
  crmObserver.observe(document.body, { childList: true, subtree: true });

  // Обновляем значения перед отправкой (score мог измениться)
  document.addEventListener('submit', function(e) {
    updateCrmFields(e.target);
  }, true);
  ` : '// CRM tracking disabled'}

  // ===== ОТПРАВКА РЕЗУЛЬТАТОВ =====

  function sendToMetrika(isBot) {
    if (typeof ym === 'undefined') {
      log('Metrika not found');
      return;
    }

    // Отправляем параметры посетителя
    ym(METRIKA_ID, 'userParams', {
      ndf_is_bot: isBot,
      ndf_bot_score: score,
      ndf_checks: checks.map(function(c) { return c.reason; }).join(',')
    });

    // Если бот - отправляем цель
    if (isBot) {
      ym(METRIKA_ID, 'reachGoal', 'ndf_bot_detected');
      log('BOT DETECTED! Score: ' + score);
    }
  }

  function checkThreshold() {
    if (score >= THRESHOLD) {
      sendToMetrika(true);
    }
  }

  // Проверяем после загрузки
  if (document.readyState === 'complete') {
    checkThreshold();
  } else {
    window.addEventListener('load', function() {
      // Небольшая задержка для сбора всех данных
      setTimeout(checkThreshold, 100);
    });
  }

  // Отправляем данные и для нормальных пользователей (для статистики)
  window.addEventListener('load', function() {
    setTimeout(function() {
      if (score < THRESHOLD) {
        sendToMetrika(false);
      }
    }, 200);
  });

  log('Initialized. Current score: ' + score);
})();
`.trim();
}

/**
 * Generate minified version of the script
 * (In production, use a proper minifier like terser)
 */
export function generateMinifiedScript(config: AntifraudConfig): string {
  const script = generateAntifraudScript(config);
  // Basic minification - remove comments and extra whitespace
  return script
    .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
    .replace(/\/\/[^\n]*/g, '') // Remove line comments
    .replace(/\n\s*\n/g, '\n') // Remove empty lines
    .replace(/^\s+/gm, '') // Remove leading whitespace
    .trim();
}
