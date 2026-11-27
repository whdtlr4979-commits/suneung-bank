/* 카카오톡 등 앱 안의 브라우저에서 열리면 휴대폰 기본 브라우저로 다시 열어요.
   (앱 안의 브라우저는 저장 공간이 따로라 풀이 기록이 이어지지 않아요)
   - 카카오톡: kakaotalk://web/openExternal 로 기본 브라우저(크롬 · 삼성인터넷 · 사파리)에서 열기
   - 라인: openExternalBrowser=1
   - 그 밖의 앱(안드로이드): intent:// 로 크롬에서 열기
   - 넘길 수 없으면 화면 위에 안내 */
(function(){
  var ua = navigator.userAgent || '';
  var isAndroid = /Android/i.test(ua), isIOS = /iPhone|iPad|iPod/i.test(ua);
  var isKakao = /KAKAOTALK/i.test(ua);
  var isLine = /\bLine\//i.test(ua);
  var isOtherInApp = /NAVER\(inapp|Instagram|FBAN|FBAV|everytimeApp|DaumApps|SamsungBrowser\/[^ ]+ \(inapp|; wv\)/i.test(ua) && !isKakao && !isLine;
  if (!isKakao && !isLine && !isOtherInApp) return;

  var url = location.href;
  var KEY = 'qbank.inapp.tried';
  var tried = false;
  try { tried = sessionStorage.getItem(KEY) === url; sessionStorage.setItem(KEY, url); } catch (e) {}

  function go(u){ if (window.__inappGo) return window.__inappGo(u); location.href = u; }   // __inappGo: 시험용
  function openExternal(){
    if (isKakao) { go('kakaotalk://web/openExternal?url=' + encodeURIComponent(url)); return true; }
    if (isLine) {
      var u = new URL(url); u.searchParams.set('openExternalBrowser', '1'); go(u.toString()); return true;
    }
    if (isAndroid) {
      go('intent://' + url.replace(/^https?:\/\//, '') + '#Intent;scheme=' + location.protocol.replace(':', '') +
        ';package=com.android.chrome;S.browser_fallback_url=' + encodeURIComponent(url) + ';end');
      return true;
    }
    return false;
  }

  if (!tried) setTimeout(openExternal, 0);

  // 안내 띠 (자동으로 넘어가지 않았거나, 이 창이 그대로 남은 경우)
  function banner(){
    if (document.getElementById('inappBar')) return;
    var bar = document.createElement('div');
    bar.id = 'inappBar'; bar.className = 'inapp-bar';
    var canOpen = isKakao || isLine || isAndroid;
    bar.innerHTML = '<div class="inapp-txt"><b>다른 브라우저에서 열어 주세요</b><span>' +
      (canOpen ? '이 화면은 앱 안의 브라우저라 풀이 기록이 따로 저장돼요.' :
        '오른쪽 위 메뉴(⋯)에서 ‘Safari로 열기’ 또는 ‘다른 브라우저로 열기’를 눌러 주세요.') + '</span></div>' +
      (canOpen ? '<button type="button" class="inapp-btn">브라우저로 열기</button>' : '') +
      '<button type="button" class="inapp-x" aria-label="닫기">×</button>';
    document.body.insertBefore(bar, document.body.firstChild);
    var b = bar.querySelector('.inapp-btn'); if (b) b.onclick = openExternal;
    bar.querySelector('.inapp-x').onclick = function(){ bar.parentNode.removeChild(bar); };
  }
  if (document.body) banner(); else document.addEventListener('DOMContentLoaded', banner);
})();
