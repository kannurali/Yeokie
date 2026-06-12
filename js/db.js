/* Shared persistence layer for Yeokie.

   When FIREBASE_CONFIG is filled in, photo notes / comments / collection are
   stored in Cloud Firestore and streamed live to every visitor. When it isn't
   (empty config or offline), window.YeokieDBReady resolves to null and the app
   silently falls back to localStorage — so the site never breaks.

   The Firebase SDK is imported lazily (dynamic import) only when configured,
   so an unconfigured site makes zero network calls to Google. */
(function(){
  var cfg = window.FIREBASE_CONFIG || {};
  var enabled = !!(cfg.apiKey && cfg.projectId);

  window.YeokieDBReady = (async function(){
    if(!enabled) return null;
    try{
      var BASE = "https://www.gstatic.com/firebasejs/10.12.5/";
      var appMod = await import(BASE + "firebase-app.js");
      var fs     = await import(BASE + "firebase-firestore.js");

      var app = appMod.initializeApp(cfg);
      var db  = fs.getFirestore(app);
      var col = fs.collection, doc = fs.doc, setDoc = fs.setDoc, addDoc = fs.addDoc,
          deleteDoc = fs.deleteDoc, onSnapshot = fs.onSnapshot, query = fs.query, orderBy = fs.orderBy;

      return {
        /* photo notes — one document per photo index ("1".."18") */
        photoNotes: {
          subscribe: function(cb){
            return onSnapshot(col(db,'photoNotes'), function(snap){
              var map = {};
              snap.forEach(function(d){ map[d.id] = d.data(); });
              cb(map);
            }, function(err){ console.warn('[Yeokie] photoNotes listen error', err); });
          },
          save:   function(idx, data){ return setDoc(doc(db,'photoNotes', String(idx)), data); },
          remove: function(idx){ return deleteDoc(doc(db,'photoNotes', String(idx))); }
        },

        /* comments — single collection; filtered per section client-side */
        comments: {
          subscribe: function(section, cb){
            return onSnapshot(query(col(db,'comments'), orderBy('ts','desc')), function(snap){
              var arr = [];
              snap.forEach(function(d){ var v = d.data(); if(v.section === section){ v.id = d.id; arr.push(v); } });
              cb(arr);
            }, function(err){ console.warn('[Yeokie] comments listen error', err); });
          },
          add:    function(c){ return addDoc(col(db,'comments'), c); },
          remove: function(id){ return deleteDoc(doc(db,'comments', id)); }
        },

        /* collection (Сборник) — newest first */
        collection: {
          subscribe: function(cb){
            return onSnapshot(query(col(db,'collection'), orderBy('ts','desc')), function(snap){
              var arr = [];
              snap.forEach(function(d){ var v = d.data(); v.id = d.id; arr.push(v); });
              cb(arr);
            }, function(err){ console.warn('[Yeokie] collection listen error', err); });
          },
          add:    function(item){ return addDoc(col(db,'collection'), item); },
          remove: function(id){ return deleteDoc(doc(db,'collection', id)); }
        }
      };
    }catch(e){
      console.warn('[Yeokie] Firebase unavailable — using localStorage only.', e);
      return null;
    }
  })();
})();
