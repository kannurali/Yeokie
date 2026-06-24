/* Yeokie — доступ по коду. Две роли:
     • EDITOR (код 07092005) — владелец: пишет/отправляет письма, правит весь сайт.
     • READER (код 07121109) — только читает письма на странице «Нурри».
   Остальные посетители видят галерею, но страницу «Нурри» и владельческие кнопки — нет.

   ВАЖНО про защиту: это клиентская защита. Она прячет управление и блокирует
   действия в интерфейсе — обычному гостю мимо неё не пройти. Но технически
   подкованный человек теоретически может записать в базу в обход сайта.
   Полную серверную защиту даёт только Firebase Auth + правила Firestore
   (здесь выбран простой общий код — этого сознательно нет).

   Коды хранятся как SHA-256-хэши, поэтому сами пароли НЕ видны в исходниках на GitHub.

   ─── КАК СМЕНИТЬ КОД ───
   1) Откройте сайт, нажмите F12 → вкладка Console.
   2) Выполните:  await YeokieAccess.hashFor('новый-код')
   3) Скопируйте строку и вставьте её ниже в EDITOR_HASH или READER_HASH.
   4) Закоммитьте и запушьте изменение — новый код вступит в силу.
   ───────────────────────
*/
(function(){
  /* Два кода доступа (хранятся как SHA-256 — сами пароли в коде не видны):
       • EDITOR — полный владелец: пишет и отправляет письма, правит весь сайт.
       • READER — только читает существующие письма на странице «Нурри».
     Сменить любой код: в консоли  await YeokieAccess.hashFor('новый-код')
     и вставьте полученную строку в нужную переменную ниже. */
  var EDITOR_HASH = "90d25a6f03b58fd604fb06bbce506a2b97a6d429c8efaefb2820f60219aede5d"; /* 07092005 — пишет письма */
  var READER_HASH = "dc74df13a2ecd7685e58f792cbbede5312c5a9b4416cbc919a96bc3d4861ef5c"; /* 07121109 — только читает */

  var STORE_KEY  = "yeokie:role";     /* "editor" | "reader" */
  var LEGACY_KEY = "yeokie:editor";   /* старый ключ входа — переносим в роль */

  function role(){
    try {
      var r = localStorage.getItem(STORE_KEY);
      if (r) return r;
      if (localStorage.getItem(LEGACY_KEY) === "1") return "editor";  /* совместимость со старым входом */
    } catch(e){}
    return null;
  }
  function isEditor(){ return role() === "editor"; }
  function isReader(){ return role() === "reader"; }
  /* любой, кто вошёл по коду (любой роли), видит страницу «Нурри» */
  function canSeeLetters(){ var r = role(); return r === "editor" || r === "reader"; }

  /* SHA-256 → hex. Требует защищённый контекст (https или localhost) — на боевом
     сайте и при локальной проверке это так. */
  function sha256Hex(str){
    var data = new TextEncoder().encode(String(str));
    return crypto.subtle.digest("SHA-256", data).then(function(buf){
      return Array.prototype.map.call(new Uint8Array(buf), function(b){
        return ("0" + b.toString(16)).slice(-2);
      }).join("");
    });
  }

  /* какая вкладка какой роли видна */
  function tabAllowed(tab){
    if (tab === "nurri") return canSeeLetters();   /* и читатель, и владелец */
    if (tab === "date")  return isEditor();        /* только владелец */
    return true;                                    /* остальные — всем */
  }

  function applyState(){
    document.body.classList.toggle("is-editor", isEditor());
    document.body.classList.toggle("is-reader", isReader());
    /* Если открыта вкладка, недоступная текущей роли — уводим на «Галерею»,
       чтобы её контент не остался виден. */
    var active = document.querySelector(".tab-panel.active");
    var activeTab = active ? active.id.replace("tab-", "") : "gallery";
    if (!tabAllowed(activeTab)){
      document.querySelectorAll(".htab").forEach(function(b){ b.classList.toggle("active", b.dataset.tab === "gallery"); });
      document.querySelectorAll(".tab-panel").forEach(function(p){ p.classList.toggle("active", p.id === "tab-gallery"); });
      document.body.classList.remove("theme-autumn");   /* лето снова, осень спрятана */
    }
  }

  /* Возвращает роль ("editor"/"reader") при успехе, иначе false. */
  function unlock(code){
    return sha256Hex(code).then(function(h){
      var r = (h === EDITOR_HASH) ? "editor" : (h === READER_HASH) ? "reader" : null;
      if (r){
        try { localStorage.setItem(STORE_KEY, r); localStorage.removeItem(LEGACY_KEY); } catch(e){}
        applyState();
        return r;
      }
      return false;
    }).catch(function(){ return false; });
  }

  function lock(){
    try { localStorage.removeItem(STORE_KEY); localStorage.removeItem(LEGACY_KEY); } catch(e){}
    applyState();
  }

  /* ── UI: кнопка-замок в шапке + всплывающее окно ── */
  function buildUI(){
    var bar = document.getElementById("hotbar");
    if (!bar) return;

    var lockIcon =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<rect x="3" y="11" width="18" height="11" rx="2"></rect>' +
        '<path d="M7 11V7a5 5 0 0 1 10 0v4"></path>' +
      '</svg>';

    var btn = document.createElement("button");
    btn.className = "hotbar__lock";
    btn.type = "button";
    btn.id = "accessLock";
    btn.setAttribute("aria-label", "Режим редактирования");
    btn.innerHTML = lockIcon;
    bar.appendChild(btn);

    var pop = document.createElement("div");
    pop.className = "access-pop";
    pop.id = "accessPop";
    pop.hidden = true;
    pop.innerHTML =
      '<div data-when="locked">' +
        '<div class="access-pop__title">Вход по коду</div>' +
        '<p class="access-pop__sub">Введите код доступа. Один код открывает чтение писем, другой — позволяет их писать и править сайт.</p>' +
        '<form class="access-pop__form" id="accessForm">' +
          '<input type="password" id="accessInput" placeholder="Код доступа" autocomplete="off" autocapitalize="off" spellcheck="false">' +
          '<button type="submit">Войти</button>' +
        '</form>' +
        '<div class="access-pop__err" id="accessErr" hidden>Неверный код</div>' +
      '</div>' +
      '<div data-when="editor">' +
        '<div class="access-pop__title">Вы — владелец 💚</div>' +
        '<p class="access-pop__sub">Можно писать и отправлять письма, добавлять и удалять контент. Код сохранён на этом устройстве.</p>' +
        '<div class="access-pop__signout"><span>Полный доступ</span><button type="button" class="js-signout">Выйти</button></div>' +
      '</div>' +
      '<div data-when="reader">' +
        '<div class="access-pop__title">Чтение писем 🍂</div>' +
        '<p class="access-pop__sub">Вы можете открывать и читать письма на странице «Нурри». Код сохранён на этом устройстве.</p>' +
        '<div class="access-pop__signout"><span>Только чтение</span><button type="button" class="js-signout">Выйти</button></div>' +
      '</div>';
    document.body.appendChild(pop);

    var input = pop.querySelector("#accessInput");
    var err   = pop.querySelector("#accessErr");

    function openPop(){
      pop.hidden = false;
      if (!role()){ if (err) err.hidden = true; if (input){ input.value = ""; setTimeout(function(){ input.focus(); }, 30); } }
    }
    function closePop(){ pop.hidden = true; }
    function togglePop(){ pop.hidden ? openPop() : closePop(); }

    btn.addEventListener("click", function(e){ e.stopPropagation(); togglePop(); });

    pop.querySelector("#accessForm").addEventListener("submit", function(e){
      e.preventDefault();
      var code = input.value;
      unlock(code).then(function(ok){
        if (ok){ closePop(); }
        else { if (err) err.hidden = false; input.value = ""; input.focus(); }
      });
    });

    pop.querySelectorAll(".js-signout").forEach(function(b){
      b.addEventListener("click", function(){ lock(); closePop(); });
    });

    /* Один обработчик кликов по документу:
         — клик по ссылке «Ввести код» открывает окно;
         — клик мимо окна закрывает его.
       Объединено намеренно: два отдельных слушателя на document ловили один и тот
       же клик, из-за чего окно открывалось и в ту же секунду закрывалось. */
    document.addEventListener("click", function(e){
      if (e.target.closest("[data-access-open]")){ e.preventDefault(); openPop(); return; }
      if (!pop.hidden && !pop.contains(e.target) && e.target !== btn && !btn.contains(e.target)){
        closePop();
      }
    });
    document.addEventListener("keydown", function(e){ if (e.key === "Escape") closePop(); });

    window.YeokieAccess.openPrompt = openPop;
  }

  /* публичный API: app.js спрашивает isEditor() перед добавлением/удалением */
  window.YeokieAccess = {
    isEditor: isEditor,
    isReader: isReader,
    role: role,
    unlock: unlock,
    lock: lock,
    hashFor: sha256Hex   /* помощник для смены кода из консоли */
  };

  buildUI();
  applyState();
})();
