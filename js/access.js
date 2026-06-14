/* Yeokie — доступ к редактированию («режим владельца»).

   Добавлять и удалять фото/видео в «Сборнике» и треки в «Музыке» могут только
   те, кто знает код доступа: вы и тот один человек, кому вы его дадите.
   Остальные посетители всё видят, но кнопок добавления/удаления у них нет.

   ВАЖНО про защиту: это клиентская защита. Она прячет управление и блокирует
   действия в интерфейсе — обычному гостю мимо неё не пройти. Но технически
   подкованный человек теоретически может записать в базу в обход сайта.
   Полную серверную защиту даёт только Firebase Auth + правила Firestore
   (вы выбрали простой общий код — этого здесь сознательно нет).

   Код хранится как SHA-256-хэш, поэтому сам пароль НЕ виден в исходниках на GitHub.

   ─── КАК СМЕНИТЬ КОД ───
   1) Откройте сайт, нажмите F12 → вкладка Console.
   2) Выполните:  await YeokieAccess.hashFor('новый-код')
   3) Скопируйте полученную строку и вставьте её ниже в ACCESS_HASH.
   4) Закоммитьте и запушьте изменение — новый код вступит в силу.
   ───────────────────────
*/
(function(){
  /* SHA-256 кода доступа. Сейчас задан ваш код. Чтобы сменить — см. инструкцию выше. */
  var ACCESS_HASH = "dc74df13a2ecd7685e58f792cbbede5312c5a9b4416cbc919a96bc3d4861ef5c";

  var STORE_KEY = "yeokie:editor";

  function isEditor(){
    try { return localStorage.getItem(STORE_KEY) === "1"; } catch(e){ return false; }
  }

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

  function applyState(){
    document.body.classList.toggle("is-editor", isEditor());
  }

  function unlock(code){
    return sha256Hex(code).then(function(h){
      if (h === ACCESS_HASH){
        try { localStorage.setItem(STORE_KEY, "1"); } catch(e){}
        applyState();
        return true;
      }
      return false;
    }).catch(function(){ return false; });
  }

  function lock(){
    try { localStorage.removeItem(STORE_KEY); } catch(e){}
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
        '<div class="access-pop__title">Режим редактирования</div>' +
        '<p class="access-pop__sub">Введите код, чтобы добавлять и удалять фото, видео и музыку.</p>' +
        '<form class="access-pop__form" id="accessForm">' +
          '<input type="password" id="accessInput" placeholder="Код доступа" autocomplete="off" autocapitalize="off" spellcheck="false">' +
          '<button type="submit">Войти</button>' +
        '</form>' +
        '<div class="access-pop__err" id="accessErr" hidden>Неверный код</div>' +
      '</div>' +
      '<div data-when="editor">' +
        '<div class="access-pop__title">Вы — владелец 💚</div>' +
        '<p class="access-pop__sub">Можно добавлять и удалять контент. Код сохранён на этом устройстве.</p>' +
        '<div class="access-pop__signout"><span>Режим включён</span><button type="button" id="accessSignout">Выйти</button></div>' +
      '</div>';
    document.body.appendChild(pop);

    var input = pop.querySelector("#accessInput");
    var err   = pop.querySelector("#accessErr");

    function openPop(){
      pop.hidden = false;
      if (!isEditor()){ if (err) err.hidden = true; if (input){ input.value = ""; setTimeout(function(){ input.focus(); }, 30); } }
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

    pop.querySelector("#accessSignout").addEventListener("click", function(){
      lock();
      closePop();
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
    unlock: unlock,
    lock: lock,
    hashFor: sha256Hex   /* помощник для смены кода из консоли */
  };

  buildUI();
  applyState();
})();
