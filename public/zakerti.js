(() => {
  "use strict";

  const DB_NAME = "zakerti-memory";
  const DB_VERSION = 1;
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const $ = (id) => document.getElementById(id);

  let db;
  let items = [];
  let folders = ["غير مصنف"];
  let activeFolder = "all";
  let activeFilter = "all";
  let searchTerm = "";
  let editingId = null;
  let installPrompt = null;
  let toastTimer = null;
  let pendingShare = null;
  const objectUrls = new Map();

  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains("items")) database.createObjectStore("items", { keyPath: "id" });
        if (!database.objectStoreNames.contains("meta")) database.createObjectStore("meta", { keyPath: "key" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("تعذر فتح مساحة التخزين"));
    });
  }

  function requestValue(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Storage request failed"));
    });
  }

  function getAllRecords() {
    return requestValue(db.transaction("items", "readonly").objectStore("items").getAll());
  }

  async function getMeta(key) {
    const row = await requestValue(db.transaction("meta", "readonly").objectStore("meta").get(key));
    return row ? row.value : null;
  }

  function putMeta(key, value) {
    return requestValue(db.transaction("meta", "readwrite").objectStore("meta").put({ key, value }));
  }

  function putRecord(record) {
    return requestValue(db.transaction("items", "readwrite").objectStore("items").put(record));
  }

  function removeRecord(id) {
    return requestValue(db.transaction("items", "readwrite").objectStore("items").delete(id));
  }

  function replaceRecords(records, options) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(["items", "meta"], "readwrite");
      const store = tx.objectStore("items");
      const meta = tx.objectStore("meta");
      store.clear();
      records.forEach((record) => store.put(record));
      if (options && options.folders) meta.put({ key: "folders", value: options.folders });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error("تعذر تحديث الخزنة"));
      tx.onabort = () => reject(tx.error || new Error("تم إلغاء تحديث الخزنة"));
    });
  }

  async function readItems() {
    const records = await getAllRecords();
    return records.filter((record) => !record.secure);
  }

  async function storeItem(item) {
    await putRecord(item);
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[char]);
  }

  function normalizeUrl(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    const candidate = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : "https://" + raw;
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("الرابط لازم يبدأ بـ http أو https");
    return parsed.href;
  }

  function extractUrl(text) {
    const match = String(text || "").match(/https?:\/\/[^\s<>"']+/i);
    if (!match) return "";
    return match[0].replace(/[),.،؛!?]+$/, "");
  }

  function showToast(message) {
    const node = $("toast");
    node.textContent = message;
    node.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => node.classList.remove("show"), 2600);
  }

  function formatDate(value) {
    try {
      return new Intl.DateTimeFormat("ar-EG", { day: "numeric", month: "short" }).format(new Date(value));
    } catch (_) {
      return "";
    }
  }

  function getFolderCount(name) {
    return items.filter((item) => item.folder === name).length;
  }

  function renderFolderButton(name, value, count, active) {
    return '<button class="folder-btn' + (active ? " active" : "") + '" type="button" data-folder="' + escapeHtml(value) + '" aria-pressed="' + (active ? "true" : "false") + '">' +
      '<span class="folder-name"><span class="folder-glyph">' + (value === "all" ? "▦" : "▱") + '</span>' + escapeHtml(name) + '</span>' +
      '<span class="folder-count">' + count + '</span></button>';
  }

  function renderFolders() {
    const allCount = items.length;
    const allButton = renderFolderButton("كل المحفوظات", "all", allCount, activeFolder === "all");
    const favoriteButton = renderFolderButton("المفضلة", "favorites", items.filter((item) => item.favorite).length, activeFolder === "favorites");
    const folderButtons = folders.map((folder) => renderFolderButton(folder, folder, getFolderCount(folder), activeFolder === folder)).join("");
    $("folderNav").innerHTML = allButton + favoriteButton + folderButtons;
    $("mobileFolders").innerHTML = allButton + favoriteButton + folderButtons;
    $("folderCount").textContent = String(folders.length);
    $("itemFolder").innerHTML = folders.map((folder) => '<option value="' + escapeHtml(folder) + '">' + escapeHtml(folder) + '</option>').join("");
    if (activeFolder === "all") {
      $("currentFolderTitle").textContent = "كل المحفوظات";
      $("currentFolderLabel").textContent = "مكتبتك";
    } else if (activeFolder === "favorites") {
      $("currentFolderTitle").textContent = "المفضلة";
      $("currentFolderLabel").textContent = "المحفوظات المهمة";
    } else {
      $("currentFolderTitle").textContent = activeFolder;
      $("currentFolderLabel").textContent = "مجلدك";
    }
  }

  function getVisibleItems() {
    const query = searchTerm.trim().toLocaleLowerCase("ar");
    return items.filter((item) => {
      if (activeFolder === "favorites" && !item.favorite) return false;
      if (activeFolder !== "all" && activeFolder !== "favorites" && item.folder !== activeFolder) return false;
      if (activeFilter === "favorite" && !item.favorite) return false;
      if (activeFilter !== "all" && activeFilter !== "favorite" && item.type !== activeFilter) return false;
      if (!query) return true;
      const haystack = [item.title, item.url, item.note, item.folder, item.fileName].join(" ").toLocaleLowerCase("ar");
      return haystack.includes(query);
    }).sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
  }

  function getObjectUrl(item) {
    if (!(item.blob instanceof Blob)) return "";
    if (!objectUrls.has(item.id)) objectUrls.set(item.id, URL.createObjectURL(item.blob));
    return objectUrls.get(item.id);
  }

  function typeName(type) {
    return ({ link: "رابط", image: "صورة", video: "فيديو", audio: "صوت", file: "ملف", note: "ملاحظة" })[type] || "محفوظ";
  }

  function previewMarkup(item) {
    if (item.type === "image" && item.blob) return '<div class="card-preview"><img src="' + getObjectUrl(item) + '" alt="' + escapeHtml(item.title) + '" loading="lazy"></div>';
    if (item.type === "video" && item.blob) return '<div class="card-preview"><video src="' + getObjectUrl(item) + '" controls preload="metadata"></video></div>';
    if (item.type === "audio" && item.blob) return '<div class="card-preview"><span class="file-symbol">♫</span><audio src="' + getObjectUrl(item) + '" controls preload="metadata"></audio></div>';
    if (item.type === "link") {
      let host = "";
      try { host = new URL(item.url).hostname; } catch (_) { host = item.url || ""; }
      return '<div class="card-preview"><a class="link-preview" href="' + escapeHtml(item.url) + '" target="_blank" rel="noopener noreferrer"><span class="link-glyph">↗</span><span><strong>رابط محفوظ</strong><small>' + escapeHtml(host) + '</small></span></a></div>';
    }
    if (item.type === "file" && item.blob) return '<div class="card-preview"><span class="file-symbol">▤</span></div>';
    return '<div class="card-preview"><span class="file-symbol">' + (item.type === "note" ? "✎" : "▱") + '</span></div>';
  }

  function renderCard(item) {
    const note = item.note ? '<p class="card-note">' + escapeHtml(item.note) + '</p>' : "";
    const domain = item.type === "link" ? "" : (item.fileName ? '<p class="card-domain">' + escapeHtml(item.fileName) + '</p>' : "");
    const openLink = item.type === "link" ? '<a class="open-item" href="' + escapeHtml(item.url) + '" target="_blank" rel="noopener noreferrer">فتح الرابط ↗</a>' :
      (item.blob ? '<a class="open-item" href="' + getObjectUrl(item) + '" download="' + escapeHtml(item.fileName || item.title) + '">تحميل ↓</a>' : "");
    return '<article class="memory-card" data-card="' + escapeHtml(item.id) + '">' +
      previewMarkup(item) +
      '<div class="card-body">' +
        '<div class="card-type"><span>' + typeName(item.type) + '</span><span>' + escapeHtml(item.folder || "غير مصنف") + '</span></div>' +
        '<h3 class="card-title">' + escapeHtml(item.title) + '</h3>' + note + domain +
        '<div class="card-bottom"><span>' + formatDate(item.updatedAt || item.createdAt) + '</span>' +
          '<div class="card-actions">' +
            '<button class="mini-action ' + (item.favorite ? "favorite" : "") + '" type="button" data-action="favorite" data-id="' + escapeHtml(item.id) + '" aria-label="' + (item.favorite ? "إزالة من المفضلة" : "إضافة للمفضلة") + '">' + (item.favorite ? "♥" : "♡") + '</button>' +
            openLink +
            '<button class="mini-action" type="button" data-action="edit" data-id="' + escapeHtml(item.id) + '" aria-label="تعديل">✎</button>' +
            '<button class="mini-action" type="button" data-action="delete" data-id="' + escapeHtml(item.id) + '" aria-label="حذف">×</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</article>';
  }

  function renderAll() {
    renderFolders();
    $("totalCount").textContent = String(items.length);
    $("favoriteCount").textContent = String(items.filter((item) => item.favorite).length);
    const visible = getVisibleItems();
    $("resultCount").textContent = visible.length + " عنصر";
    $("itemsGrid").innerHTML = visible.map(renderCard).join("");
    $("emptyState").classList.toggle("visible", visible.length === 0);
    if (items.length === 0) {
      $("emptyState").querySelector("h3").textContent = "لسه ذاكرتك فاضية؟";
      $("emptyState").querySelector("p").textContent = "ابدأ بحفظ أول رابط أو صورة أو فكرة، وارجعلها وقت ما تحتاجها.";
    } else if (visible.length === 0) {
      $("emptyState").querySelector("h3").textContent = "ملقيناش حاجة هنا";
      $("emptyState").querySelector("p").textContent = "جرّب كلمة بحث مختلفة أو اختار مجلدًا أو نوعًا آخر.";
    }
  }

  function openDialog(dialogId) {
    const dialog = $(dialogId);
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "open");
  }

  function closeDialog(dialogId) {
    const dialog = $(dialogId);
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
  }

  function openItemDialog(item) {
    editingId = item ? item.id : null;
    $("itemDialogTitle").textContent = item ? "تعديل المحفوظ" : "أضف إلى ذاكرتي";
    $("itemId").value = item ? item.id : "";
    $("itemTitle").value = item ? item.title : "";
    $("itemUrl").value = item ? (item.url || "") : "";
    $("itemNote").value = item ? (item.note || "") : "";
    $("itemFolder").value = item ? (item.folder || folders[0]) : (activeFolder !== "all" && activeFolder !== "favorites" ? activeFolder : folders[0]);
    $("itemFile").value = "";
    $("fileLabel").textContent = item && item.fileName ? item.fileName : "اضغط لاختيار ملف أو اسحبه هنا";
    $("fileHint").textContent = item && item.blob ? "اتركه كما هو للاحتفاظ بالملف الحالي، أو اختر ملفًا بديلًا" : "الملفات تحفظ داخل متصفحك على هذا الجهاز";
    openDialog("itemDialog");
    setTimeout(() => $("itemTitle").focus(), 50);
  }

  function detectFileType(file) {
    if (file.type.startsWith("image/")) return "image";
    if (file.type.startsWith("video/")) return "video";
    if (file.type.startsWith("audio/")) return "audio";
    return "file";
  }

  async function saveForm(event) {
    event.preventDefault();
    const file = $("itemFile").files[0] || null;
    const existing = editingId ? items.find((item) => item.id === editingId) : null;
    const rawUrl = $("itemUrl").value.trim();
    let url = "";
    try {
      url = normalizeUrl(rawUrl);
    } catch (error) {
      showToast(error.message || "راجع الرابط الذي أدخلته");
      $("itemUrl").focus();
      return;
    }
    let type = file ? detectFileType(file) : (url ? "link" : (existing && existing.blob ? existing.type : "note"));
    const title = $("itemTitle").value.trim() || (file ? file.name : (url ? new URL(url).hostname : ""));
    if (!title) {
      showToast("اكتب عنوانًا أو أضف رابطًا أو ملفًا");
      return;
    }
    const now = new Date().toISOString();
    const item = {
      id: existing ? existing.id : (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2)),
      title,
      type,
      url,
      note: $("itemNote").value.trim(),
      folder: $("itemFolder").value || folders[0],
      fileName: file ? file.name : (existing ? existing.fileName || "" : ""),
      mime: file ? file.type : (existing ? existing.mime || "" : ""),
      size: file ? file.size : (existing ? existing.size || 0 : 0),
      blob: file ? file : (existing ? existing.blob || null : null),
      favorite: existing ? !!existing.favorite : false,
      createdAt: existing ? existing.createdAt : now,
      updatedAt: now
    };
    try {
      await storeItem(item);
      if (existing && existing.blob && file && objectUrls.has(existing.id)) {
        URL.revokeObjectURL(objectUrls.get(existing.id));
        objectUrls.delete(existing.id);
      }
      if (existing) items = items.map((old) => old.id === item.id ? item : old);
      else items.unshift(item);
      closeDialog("itemDialog");
      $("itemForm").reset();
      renderAll();
      showToast(existing ? "تم تحديث المحفوظ" : "اتحفظ في ذاكرتك");
    } catch (error) {
      showToast("تعذر الحفظ. قد تكون مساحة المتصفح ممتلئة.");
    }
  }

  async function toggleFavorite(id) {
    const item = items.find((entry) => entry.id === id);
    if (!item) return;
    item.favorite = !item.favorite;
    item.updatedAt = new Date().toISOString();
    await storeItem(item);
    renderAll();
  }

  async function deleteItem(id) {
    const item = items.find((entry) => entry.id === id);
    if (!item || !confirm("تحب تحذف «" + item.title + "» من ذاكرتك؟")) return;
    await removeRecord(id);
    if (objectUrls.has(id)) {
      URL.revokeObjectURL(objectUrls.get(id));
      objectUrls.delete(id);
    }
    items = items.filter((entry) => entry.id !== id);
    renderAll();
    showToast("اتحذف من ذاكرتك");
  }

  async function quickSaveClipboard() {
    let text = "";
    try {
      text = await navigator.clipboard.readText();
    } catch (_) {
      text = prompt("الصق الرابط أو النص الذي تريد حفظه:") || "";
    }
    text = text.trim();
    if (!text) {
      showToast("مفيش نص في الحافظة");
      return;
    }
    const url = extractUrl(text);
    if (url) {
      const normalized = normalizeUrl(url);
      const existing = items.find((item) => item.url === normalized);
      if (existing) {
        activeFolder = "all";
        activeFilter = "all";
        searchTerm = "";
        $("searchInput").value = "";
        renderAll();
        showToast("الرابط محفوظ بالفعل في ذاكرتك");
        return;
      }
      openItemDialog(null);
      $("itemUrl").value = normalized;
      $("itemTitle").value = text.replace(url, "").trim() || new URL(normalized).hostname;
    } else {
      openItemDialog(null);
      $("itemTitle").value = text.slice(0, 100);
      $("itemNote").value = text;
    }
  }

  function openFolderDialog() {
    $("folderName").value = "";
    openDialog("folderDialog");
    setTimeout(() => $("folderName").focus(), 40);
  }

  async function addFolder(event) {
    event.preventDefault();
    const name = $("folderName").value.trim();
    if (!name) return;
    if (folders.some((folder) => folder.toLocaleLowerCase("ar") === name.toLocaleLowerCase("ar"))) {
      showToast("المجلد موجود بالفعل");
      return;
    }
    folders.push(name);
    await putMeta("folders", folders);
    activeFolder = name;
    closeDialog("folderDialog");
    renderAll();
    showToast("اتعمل مجلد جديد");
  }

  async function backupData() {
    const backupItems = [];
    for (const item of items) {
      const copy = { ...item };
      if (copy.blob instanceof Blob) copy.fileData = await blobToBase64(copy.blob);
      delete copy.blob;
      backupItems.push(copy);
    }
    const payload = { format: "zakerti-backup", version: 1, exportedAt: new Date().toISOString(), folders, items: backupItems };
    const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "zakerti-backup-" + new Date().toISOString().slice(0, 10) + ".json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    showToast("تم تصدير النسخة الاحتياطية");
  }

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  async function importBackup(file) {
    if (!file) return;
    try {
      let payload = JSON.parse(await file.text());
      if (payload.format === "zakerti-encrypted-backup") throw new Error("النسخ الاحتياطية المشفّرة القديمة تحتاج رمز المرور السابق.");
      if (payload.format !== "zakerti-backup" || payload.version !== 1 || !Array.isArray(payload.items)) throw new Error("صيغة النسخة الاحتياطية غير مدعومة");
      if (!confirm("سيتم استبدال المحفوظات الحالية بمحتويات النسخة الاحتياطية. هل تريد المتابعة؟")) return;
      const imported = payload.items.map((entry) => {
        const item = { ...entry };
        if (item.fileData) {
          item.blob = new Blob([fromBase64(item.fileData)], { type: item.mime || "application/octet-stream" });
          delete item.fileData;
        }
        return item;
      });
      const records = imported;
      folders = Array.isArray(payload.folders) && payload.folders.length ? payload.folders : ["غير مصنف"];
      await replaceRecords(records, { folders });
      items = imported;
      activeFolder = "all";
      renderAll();
      showToast("تم استيراد النسخة الاحتياطية بنجاح");
    } catch (error) {
      showToast(error.message || "تعذر استيراد النسخة. تأكد من الملف.");
    } finally {
      $("importFile").value = "";
    }
  }

  function processPendingShare() {
    if (!pendingShare || $("appShell").hidden) return;
    const shared = pendingShare;
    pendingShare = null;
    openItemDialog(null);
    if (shared.url) {
      $("itemUrl").value = shared.url;
      $("itemTitle").value = shared.title || new URL(shared.url).hostname;
    } else {
      $("itemTitle").value = (shared.title || shared.text || "ملاحظة مشتركة").slice(0, 140);
      $("itemNote").value = shared.text || shared.title || "";
    }
    showToast("راجع التفاصيل ثم احفظ المشاركة في ذاكرتك");
  }

  function readShareTarget() {
    const params = new URLSearchParams(location.search);
    const urlValue = params.get("url") || extractUrl(params.get("text") || "");
    const text = params.get("text") || "";
    const title = params.get("title") || "";
    if (urlValue || text || title) {
      let url = "";
      try { url = urlValue ? normalizeUrl(urlValue) : ""; } catch (_) {}
      pendingShare = { url, text, title };
      history.replaceState({}, "", location.pathname);
    }
  }

  function setFilter(value) {
    activeFilter = value;
    document.querySelectorAll("[data-filter]").forEach((button) => {
      button.classList.toggle("active", button.dataset.filter === value);
    });
    renderAll();
  }

  function attachEvents() {
    $("addItemBtn").addEventListener("click", () => openItemDialog(null));
    $("emptyAddBtn").addEventListener("click", () => openItemDialog(null));
    $("floatingAdd").addEventListener("click", () => openItemDialog(null));
    $("quickSaveBtn").addEventListener("click", quickSaveClipboard);
    $("newFolderBtn").addEventListener("click", openFolderDialog);
    $("folderForm").addEventListener("submit", addFolder);
    $("itemForm").addEventListener("submit", saveForm);
    $("typeFilters").addEventListener("click", (event) => {
      const button = event.target.closest("[data-filter]");
      if (button) setFilter(button.dataset.filter);
    });
    $("folderNav").addEventListener("click", (event) => {
      const button = event.target.closest("[data-folder]");
      if (button) { activeFolder = button.dataset.folder; renderAll(); }
    });
    $("mobileFolders").addEventListener("click", (event) => {
      const button = event.target.closest("[data-folder]");
      if (button) { activeFolder = button.dataset.folder; renderAll(); }
    });
    $("itemsGrid").addEventListener("click", async (event) => {
      const button = event.target.closest("[data-action]");
      if (!button) return;
      const id = button.dataset.id;
      if (button.dataset.action === "favorite") await toggleFavorite(id);
      if (button.dataset.action === "edit") {
        const item = items.find((entry) => entry.id === id);
        if (item) openItemDialog(item);
      }
      if (button.dataset.action === "delete") await deleteItem(id);
    });
    $("searchInput").addEventListener("input", (event) => {
      searchTerm = event.target.value;
      renderAll();
    });
    $("itemFile").addEventListener("change", () => {
      const file = $("itemFile").files[0];
      if (file) {
        $("fileLabel").textContent = file.name;
        $("fileHint").textContent = (file.size / 1024 / 1024).toFixed(2) + " MB · " + (file.type || "ملف");
      }
    });
    document.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", () => closeDialog(button.dataset.close)));
    $("backupBtn").addEventListener("click", backupData);
    $("importBtn").addEventListener("click", () => $("importFile").click());
    $("importFile").addEventListener("change", (event) => importBackup(event.target.files[0]));
    $("installBtn").addEventListener("click", async () => {
      if (!installPrompt) return;
      installPrompt.prompt();
      await installPrompt.userChoice;
      installPrompt = null;
      $("installBtn").hidden = true;
    });
    $("itemDialog").addEventListener("click", (event) => {
      if (event.target === $("itemDialog")) closeDialog("itemDialog");
    });
  }

  async function boot() {
    readShareTarget();
    attachEvents();
    try {
      db = await openDatabase();
      try {
        if (navigator.storage && navigator.storage.persist) await navigator.storage.persist();
      } catch (_) {}
      const savedFolders = await getMeta("folders");
      if (Array.isArray(savedFolders) && savedFolders.length) folders = savedFolders;
      const legacyLock = await getMeta("lock");
      items = await readItems();
      $("appShell").hidden = false;
      renderAll();
      processPendingShare();
      if (legacyLock) showToast("توجد محفوظات قديمة مشفّرة بالقفل السابق؛ لن تظهر دون فك تشفيرها بالرمز القديم.");
    } catch (error) {
      $("appShell").hidden = false;
      showToast("التخزين المحلي غير متاح. جرّب فتح الموقع في متصفح عادي.");
    }
    if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
      navigator.serviceWorker.register("/zakerti-sw.js").catch(() => {});
    }
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event;
    $("installBtn").hidden = false;
  });
  window.addEventListener("appinstalled", () => {
    $("installBtn").hidden = true;
    showToast("ذاكرتي بقت على جهازك");
  });
  window.addEventListener("pagehide", () => {
    for (const url of objectUrls.values()) URL.revokeObjectURL(url);
    objectUrls.clear();
  });

  document.addEventListener("DOMContentLoaded", boot);
})();