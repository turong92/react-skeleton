export type PushWorkerOptions = {
  /** 알림 아이콘의 주소(앱 안 경로) */
  icon?: string
}

/**
 * 서비스 워커 소스 — 의존이 없는 작은 파일 하나(빌드 도구를 거치지 않고 그대로 나간다).
 * - `push`: JSON `{ v: 1, title, body, tag, link }` 를 읽어 **항상** 알림을 띄운다(Chrome 은 `userVisibleOnly` 라 안 띄우면 기본 문구를 대신 띄운다).
 * - `notificationclick`: `link` 가 앱 안 경로일 때만 따라간다(`/` 로 시작, `//` · `\` · 제어 문자 없음, 같은 출처로 풀림). 열린 같은 출처 창이 있으면 앞으로 + 이동, 없으면 새 창.
 * - `open` 토큰(서버의 `open-report.secret` 을 켠 경우 페이로드에 있다)이 있으면 `data` 에 `id` · `open` 을 두었다가, 클릭하면 창 열기와 **나란히** `POST /api/v1/push/opened { id, open }` 을 `keepalive` 로 보낸다 - 인증은 토큰이 한다(쿠키 · CSRF 없음). 실패해도 창은 열리고 기다리지 않는다.
 * - `pushsubscriptionchange` 는 다루지 않는다 — 워커에는 로그인이 없어 서버에 알릴 수 없고, 다음 `usePushSync` 가 고친다.
 */
export function pushWorkerSource({ icon }: PushWorkerOptions = {}): string {
  return String.raw`'use strict';
var ICON = ${JSON.stringify(icon ?? null)};
var ORIGIN = self.location.origin;

function appPath(link) {
  if (typeof link !== 'string' || link.charAt(0) !== '/' || link.charAt(1) === '/') return null;
  if (/[\\\u0000-\u001f\u007f]/.test(link)) return null;
  try {
    return new URL(link, ORIGIN).origin === ORIGIN ? link : null;
  } catch (error) {
    return null;
  }
}

function text(value) {
  return typeof value === 'string' && value ? value : undefined;
}

self.addEventListener('push', function (event) {
  var data = {};
  try {
    data = (event.data && event.data.json()) || {};
  } catch (error) {
    data = {};
  }
  if (typeof data !== 'object') data = {};
  var options = {
    body: text(data.body),
    tag: text(data.tag),
    data: { link: appPath(data.link), id: text(data.id), open: text(data.open) }
  };
  if (ICON) options.icon = ICON;
  event.waitUntil(self.registration.showNotification(text(data.title) || 'New notification', options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var info = event.notification.data || {};
  var link = appPath(info.link);
  if (text(info.open) && text(info.id)) {
    try {
      self.fetch('/api/v1/push/opened', {
        method: 'POST',
        keepalive: true,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: info.id, open: info.open })
      }).catch(function () {});
    } catch (error) {}
  }
  var target = new URL(link || '/', ORIGIN).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (windows) {
      var open = windows.filter(function (w) {
        try {
          return new URL(w.url).origin === ORIGIN;
        } catch (error) {
          return false;
        }
      })[0];
      if (!open) return self.clients.openWindow(target);
      return open
        .focus()
        .then(function () {
          return link ? open.navigate(target) : undefined;
        })
        .catch(function () {
          return self.clients.openWindow(target);
        });
    })
  );
});
`
}
