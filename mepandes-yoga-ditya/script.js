/* ============================================================
   MEPANDES INVITATION V.2 — INTERACTIONS
   ============================================================ */

(function () {
  "use strict";

  document.documentElement.classList.add("js");

  const CONFIG = {
    ceremonyDate: "2026-11-15T08:00:00+08:00",

    // Isi dari Supabase Dashboard → Project Settings → API.
    // Anon key memang boleh publik selama RLS aktif (lihat supabase-schema.sql).
    supabaseUrl: "https://yudbobiqhqzljoigvehg.supabase.co",
    supabaseAnonKey: "sb_publishable_zKifQso4aRusH3R5xFOmnA_I7S8FXeb",
    table: "rsvp_comments",
    fetchLimit: 500,

    // Email admin (disimpan di sini, tidak ditampilkan di form).
    adminEmail: "sangputudarmasutha17@gmail.com",

    // Token rahasia untuk mengakses panel admin.
    // Gunakan URL: ?panel=yds-mpdns-7Kx9Qw2
    // Hak hapus tetap ditentukan oleh Supabase Auth + RLS.
    adminSecret: "yds-mpdns-7Kx9Qw2",
    adminRequested:
      new URLSearchParams(window.location.search).get("panel") ===
      "yds-mpdns-7Kx9Qw2",
  };

  const WISH_COLUMNS = "id, name, attendance, message, created_at";

  // ?motion=on → pratinjau animasi walau sistem meminta pengurangan animasi.
  // Tanpa parameter ini, preferensi sistem pengunjung tetap dihormati.
  const forceMotion =
    new URLSearchParams(window.location.search).get("motion") === "on";
  const motionQuery = forceMotion
    ? { matches: false, addEventListener() {} }
    : window.matchMedia("(prefers-reduced-motion: reduce)");

  // Aturan CSS dibatasi media query, jadi untuk pratinjau aturannya
  // dipindahkan keluar dari @media "no-preference" dan blok "reduce" dibuang.
  function unlockMotionCss() {
    const tag =
      /\s*(?:and\s*)?\(prefers-reduced-motion:\s*no-preference\)\s*(?:and\s*)?/;
    for (const sheet of document.styleSheets) {
      let rules;
      try {
        rules = Array.from(sheet.cssRules);
      } catch (error) {
        continue;
      }
      for (let i = rules.length - 1; i >= 0; i--) {
        const rule = rules[i];
        if (!(rule instanceof CSSMediaRule)) continue;
        const cond = rule.conditionText || rule.media.mediaText;
        if (/prefers-reduced-motion:\s*reduce/.test(cond)) {
          sheet.deleteRule(i);
        } else if (tag.test(cond)) {
          const rest = cond.replace(tag, " ").trim();
          const texts = Array.from(rule.cssRules).map((r) => r.cssText);
          sheet.deleteRule(i);
          if (rest) {
            sheet.insertRule(`@media ${rest} { ${texts.join("\n")} }`, i);
          } else {
            texts.forEach((text, k) => sheet.insertRule(text, i + k));
          }
        }
      }
    }
  }
  if (forceMotion) unlockMotionCss();

  const DOM = {
    gate: document.getElementById("gate"),
    gateTitle: document.getElementById("gateTitle"),
    openInvitation: document.getElementById("openInvitation"),
    musicControl: document.getElementById("musicControl"),
    musicLabel: document.getElementById("musicLabel"),
    invitation: document.getElementById("invitation"),
    openingTitle: document.getElementById("openingTitle"),
    bgMusic: document.getElementById("bgMusic"),
    rsvpForm: document.getElementById("rsvpForm"),
    rsvpName: document.getElementById("rsvpName"),
    rsvpNameError: document.getElementById("rsvpNameError"),
    rsvpAttendanceError: document.getElementById("rsvpAttendanceError"),
    rsvpMessage: document.getElementById("rsvpMessage"),
    rsvpMessageError: document.getElementById("rsvpMessageError"),
    btnSubmit: document.getElementById("btnSubmit"),
    btnSubmitLabel: document.getElementById("btnSubmitLabel"),
    formStatus: document.getElementById("formStatus"),
    wishesList: document.getElementById("wishesList"),
    showAllWishes: document.getElementById("showAllWishes"),
    rsvpSummary: document.getElementById("rsvpSummary"),
    countAll: document.getElementById("countAll"),
    countHadir: document.getElementById("countHadir"),
    countTidak: document.getElementById("countTidak"),
    guestCount: document.getElementById("guestCount"),
    guestCountNumber: document.getElementById("guestCountNumber"),
    showAllLabel: document.getElementById("showAllLabel"),
    adminPanel: document.getElementById("adminPanel"),
    adminLoginForm: document.getElementById("adminLoginForm"),

    adminPassword: document.getElementById("adminPassword"),
    adminLoginBtn: document.getElementById("adminLoginBtn"),
    adminSession: document.getElementById("adminSession"),
    adminSignOut: document.getElementById("adminSignOut"),
    adminStatus: document.getElementById("adminStatus"),
    days: document.getElementById("days"),
    hours: document.getElementById("hours"),
    minutes: document.getElementById("minutes"),
    seconds: document.getElementById("seconds"),
    countdownStatus: document.getElementById("countdownStatus"),
    sortToggle: document.getElementById("sortToggle"),
    sortLabel: document.getElementById("sortLabel"),
  };

  let bgMusic = DOM.bgMusic;
  let isMusicPlaying = false;
  let musicLabelTimer = null;
  let countdownInterval = null;
  let countdownAnnounced = false;
  let isOpen = false;
  let wishes = [];
  let wishesStatus = "loading"; // "loading" | "ready" | "error"
  let visibleCount = 4;
  let attendanceFilter = "semua"; // "semua" | "hadir" | "tidak"
  let sortOrder = "newest"; // "newest" | "oldest"
  let counts = null; // { hadir, tidak } dari server, atau dihitung dari daftar
  let revealObserver = null;
  let supabaseClient = null;
  let isAdminSession = false;
  let isSubmitting = false;
  let submitLabelTimer = null;

  /* ============================================================
       MUSIC
       ============================================================ */

  function setMusicUI(playing) {
    isMusicPlaying = playing;
    DOM.musicControl.setAttribute("aria-pressed", String(playing));
    DOM.musicLabel.textContent = playing ? "MUSIK ON" : "MUSIK OFF";
  }

  function playMusic() {
    if (!bgMusic) return;
    bgMusic.volume = 0.55;
    bgMusic
      .play()
      .then(() => setMusicUI(true))
      .catch(() => setMusicUI(false));
  }

  function revealMusicLabel() {
    DOM.musicControl.classList.add("is-revealed");
    if (musicLabelTimer) window.clearTimeout(musicLabelTimer);
    musicLabelTimer = window.setTimeout(() => {
      DOM.musicControl.classList.remove("is-revealed");
      musicLabelTimer = null;
    }, 2500);
  }

  function toggleMusic() {
    if (!bgMusic) return;
    if (isMusicPlaying) {
      bgMusic.pause();
      setMusicUI(false);
    } else {
      playMusic();
    }
  }

  /* ============================================================
       GATE
       ============================================================ */

  function openInvitation() {
    if (isOpen) return;
    isOpen = true;

    document.body.classList.remove("is-locked");
    DOM.invitation.removeAttribute("inert");
    DOM.musicControl.hidden = false;
    window.scrollTo(0, 0);

    DOM.openingTitle.setAttribute("tabindex", "-1");
    DOM.openingTitle.focus({ preventScroll: true });
    DOM.gate.classList.add("is-closing");
    DOM.gate.setAttribute("aria-hidden", "true");
    DOM.gate.inert = true;

    playMusic();
    startCountdown();

    const delay = motionQuery.matches ? 320 : 720;
    window.setTimeout(() => {
      DOM.gate.hidden = true;
    }, delay);

    document.removeEventListener("keydown", trapGateFocus);
  }

  function trapGateFocus(event) {
    if (event.key !== "Tab") return;
    const focusable = [DOM.openInvitation];
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (!focusable.includes(document.activeElement)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  /* ============================================================
       COUNTDOWN
       ============================================================ */

  function startCountdown() {
    if (countdownInterval) return;
    updateCountdown();
    countdownInterval = window.setInterval(updateCountdown, 1000);
  }

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function updateCountdown() {
    const target = new Date(CONFIG.ceremonyDate).getTime();
    const diff = target - Date.now();

    if (diff <= 0) {
      DOM.days.textContent = "00";
      DOM.hours.textContent = "00";
      DOM.minutes.textContent = "00";
      DOM.seconds.textContent = "00";
      window.clearInterval(countdownInterval);
      countdownInterval = null;
      if (!countdownAnnounced) {
        countdownAnnounced = true;
        DOM.countdownStatus.textContent =
          "Hari upacara telah tiba. Om Shanti Shanti Shanti Om.";
      }
      return;
    }

    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);

    DOM.days.textContent = pad(days);
    DOM.hours.textContent = pad(hours);
    DOM.minutes.textContent = pad(minutes);
    DOM.seconds.textContent = pad(seconds);
  }

  /* ============================================================
       GUESTBOOK · SUPABASE
       ============================================================ */

  function initSupabase() {
    const { supabaseUrl, supabaseAnonKey } = CONFIG;
    const isConfigured =
      supabaseUrl &&
      supabaseAnonKey &&
      !supabaseUrl.includes("YOUR-PROJECT") &&
      !supabaseAnonKey.includes("YOUR-ANON-KEY");

    if (!isConfigured) {
      console.warn("Supabase belum dikonfigurasi di CONFIG (script.js).");
      return null;
    }
    if (
      !window.supabase ||
      typeof window.supabase.createClient !== "function"
    ) {
      console.warn("Library supabase-js gagal dimuat.");
      return null;
    }
    return window.supabase.createClient(supabaseUrl, supabaseAnonKey);
  }

  // Memetakan baris database (created_at) ke bentuk yang dipakai UI (createdAt).
  function normaliseWish(raw) {
    if (!raw || typeof raw !== "object") return null;
    const name = String(raw.name || "").trim();
    if (!name) return null;

    let createdAt = raw.created_at || raw.createdAt || new Date().toISOString();
    if (Number.isNaN(new Date(createdAt).getTime())) {
      createdAt = new Date().toISOString();
    }

    return {
      id: String(raw.id),
      name,
      attendance: raw.attendance === "tidak" ? "tidak" : "hadir",
      message: String(raw.message || "").trim(),
      createdAt,
    };
  }

  async function fetchWishes() {
    const { data, error } = await supabaseClient
      .from(CONFIG.table)
      .select(WISH_COLUMNS)
      .order("created_at", { ascending: false })
      .limit(CONFIG.fetchLimit);

    if (error) throw error;
    return (data || []).map(normaliseWish).filter(Boolean);
  }

  // Hitungan akurat dari server (tidak terpengaruh batas fetchLimit).
  // Jika gagal (mis. RLS menolak count), kembali ke hitungan dari daftar.
  async function fetchCounts() {
    try {
      const ask = (value) =>
        supabaseClient
          .from(CONFIG.table)
          .select("id", { count: "exact", head: true })
          .eq("attendance", value);
      const [hadir, tidak] = await Promise.all([ask("hadir"), ask("tidak")]);
      if (hadir.error || tidak.error) return null;
      if (typeof hadir.count !== "number" || typeof tidak.count !== "number") {
        return null;
      }
      return { hadir: hadir.count, tidak: tidak.count };
    } catch (error) {
      return null;
    }
  }

  function countFromList(list) {
    return {
      hadir: list.filter((wish) => wish.attendance === "hadir").length,
      tidak: list.filter((wish) => wish.attendance === "tidak").length,
    };
  }

  function updateCounts() {
    const ready = wishesStatus === "ready" && counts;
    DOM.countHadir.textContent = ready ? String(counts.hadir) : "–";
    DOM.countTidak.textContent = ready ? String(counts.tidak) : "–";
    DOM.countAll.textContent = ready
      ? String(counts.hadir + counts.tidak)
      : "–";

    // Jumlah komentar untuk tampilan tamu
    DOM.guestCountNumber.textContent = ready
      ? String(counts.hadir + counts.tidak)
      : "–";
  }

  function setAttendanceFilter(value) {
    attendanceFilter = value;
    visibleCount = 4;
    DOM.rsvpSummary.querySelectorAll(".rsvp-filter").forEach((button) => {
      const active = button.dataset.filter === value;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    renderWishes();
  }

  async function refreshWishes() {
    if (!supabaseClient) {
      wishesStatus = "error";
      renderWishes();
      return;
    }

    try {
      wishes = await fetchWishes();
      counts = (await fetchCounts()) || countFromList(wishes);
      wishesStatus = "ready";
    } catch (error) {
      console.error("Gagal memuat ucapan:", error);
      wishesStatus = "error";
    }
    renderWishes();
  }

  function formatRelative(isoDate) {
    const date = new Date(isoDate);
    if (Number.isNaN(date.getTime())) return "";

    const diff = Date.now() - date.getTime();
    if (diff < 60000) return "baru saja";

    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes} menit lalu`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} jam lalu`;

    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} hari lalu`;

    return date.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  function buildWish(wish) {
    const article = document.createElement("article");
    article.className = "wish";
    article.dataset.id = wish.id;

    const quote = document.createElement("p");
    quote.className = "wish__quote";
    quote.textContent = wish.message || "Turut berbahagia atas upacara ini.";

    const meta = document.createElement("div");
    meta.className = "wish__meta";

    const name = document.createElement("span");
    name.className = "wish__name";
    name.textContent = wish.name;

    const time = document.createElement("time");
    time.className = "wish__time";
    time.dateTime = wish.createdAt;
    time.textContent = formatRelative(wish.createdAt);

    meta.append(name, time);

    const status = document.createElement("p");
    status.className = `wish__status wish__status--${wish.attendance}`;
    status.textContent = wish.attendance === "hadir" ? "HADIR" : "TIDAK HADIR";

    article.append(meta, quote, status);

    if (isAdminSession) {
      const remove = document.createElement("button");
      remove.className = "wish__delete";
      remove.type = "button";
      remove.setAttribute("aria-label", `Hapus ucapan dari ${wish.name}`);
      remove.title = "Hapus ucapan";
      remove.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg><span>HAPUS</span>`;
      remove.addEventListener("click", () => deleteWish(wish.id));
      article.append(remove);
    }

    return article;
  }

  function renderNotice(text) {
    const notice = document.createElement("p");
    notice.className = "guestbook__empty";
    notice.textContent = text;
    DOM.wishesList.replaceChildren(notice);
    DOM.showAllWishes.hidden = true;
  }

  function renderWishes() {
    updateCounts();

    if (wishesStatus === "loading") {
      renderNotice("Memuat ucapan…");
      return;
    }

    if (wishesStatus === "error") {
      renderNotice(
        "Ucapan belum dapat dimuat. Silakan muat ulang halaman beberapa saat lagi.",
      );
      return;
    }

    const ordered = [...wishes]
      .filter(
        (wish) =>
          attendanceFilter === "semua" || wish.attendance === attendanceFilter,
      )
      .sort((a, b) =>
        sortOrder === "newest"
          ? new Date(b.createdAt) - new Date(a.createdAt)
          : new Date(a.createdAt) - new Date(b.createdAt),
      );
    const allShown = visibleCount >= ordered.length;
    const visible = allShown ? ordered : ordered.slice(0, visibleCount);

    if (visible.length === 0) {
      renderNotice(
        attendanceFilter === "hadir"
          ? "Belum ada tamu yang menyatakan hadir."
          : attendanceFilter === "tidak"
            ? "Belum ada tamu yang menyatakan tidak hadir."
            : "Belum ada ucapan. Anda dapat menjadi yang pertama berbagi doa dan harapan.",
      );
      return;
    }

    DOM.wishesList.replaceChildren(...visible.map(buildWish));

    // Aktifkan scroll jika komentar yang ditampilkan sudah banyak (> 8).
    DOM.wishesList.classList.toggle("is-scrollable", visible.length > 8);

    if (ordered.length <= 4) {
      DOM.showAllWishes.hidden = true;
    } else if (allShown) {
      DOM.showAllWishes.hidden = false;
      DOM.showAllLabel.textContent = "TAMPILKAN LEBIH SEDIKIT ←";
      DOM.showAllWishes.setAttribute("aria-expanded", "true");
    } else {
      const remaining = ordered.length - visibleCount;
      DOM.showAllWishes.hidden = false;
      DOM.showAllLabel.textContent = `MUAT ${remaining} UCAPAN LAGI →`;
      DOM.showAllWishes.setAttribute("aria-expanded", "false");
    }
  }

  async function deleteWish(id) {
    if (!isAdminSession || !supabaseClient) return;

    const target = wishes.find((wish) => wish.id === id);
    if (!target) return;
    if (!window.confirm(`Hapus ucapan dari ${target.name}?`)) return;

    // RLS yang menolak penghapusan tidak mengembalikan error,
    // melainkan 0 baris — karena itu hasilnya diperiksa lewat .select().
    const { data, error } = await supabaseClient
      .from(CONFIG.table)
      .delete()
      .eq("id", id)
      .select("id");

    if (error || !data || data.length === 0) {
      console.error("Gagal menghapus ucapan:", error);
      setAdminStatus(
        "Ucapan gagal dihapus. Pastikan Anda masuk dengan akun admin yang benar.",
        true,
      );
      return;
    }

    wishes = wishes.filter((wish) => wish.id !== id);
    if (counts && counts[target.attendance] > 0) counts[target.attendance] -= 1;
    renderWishes();
    setAdminStatus("Ucapan telah dihapus.", false);
  }

  /* ============================================================
       ADMIN · SUPABASE AUTH
       ============================================================ */

  function setAdminStatus(message, isError) {
    DOM.adminStatus.textContent = message;
    DOM.adminStatus.classList.toggle("is-error", Boolean(isError));
  }

  function applyAdminSession(session) {
    isAdminSession = Boolean(session);
    DOM.adminLoginForm.hidden = isAdminSession;
    DOM.adminSession.hidden = !isAdminSession;

    // Filter (Semua/Hadir/Tidak Hadir) hanya untuk admin yang login.
    // Tamu hanya melihat jumlah komentar total.
    DOM.rsvpSummary.hidden = !isAdminSession;
    DOM.guestCount.hidden = isAdminSession;

    // Reset filter ke "semua" saat keluar dari admin.
    if (!isAdminSession) {
      attendanceFilter = "semua";
    }

    renderWishes();
  }

  async function handleAdminLogin(event) {
    event.preventDefault();
    const password = DOM.adminPassword.value;

    if (!password) {
      setAdminStatus("Masukkan kata sandi admin.", true);
      return;
    }

    DOM.adminLoginBtn.disabled = true;
    setAdminStatus("", false);

    const { error } = await supabaseClient.auth.signInWithPassword({
      email: CONFIG.adminEmail,
      password,
    });

    DOM.adminLoginBtn.disabled = false;

    if (error) {
      setAdminStatus("Kata sandi salah.", true);
      return;
    }

    DOM.adminPassword.value = "";
    setAdminStatus("Berhasil masuk sebagai admin.", false);
  }

  async function handleAdminSignOut() {
    await supabaseClient.auth.signOut();
    setAdminStatus("Anda telah keluar.", false);
  }

  async function initAdmin() {
    if (!CONFIG.adminRequested) return;

    DOM.adminPanel.hidden = false;

    if (!supabaseClient) {
      DOM.adminLoginForm.hidden = true;
      setAdminStatus("Supabase belum dikonfigurasi.", true);
      return;
    }

    DOM.adminLoginForm.addEventListener("submit", handleAdminLogin);
    DOM.adminSignOut.addEventListener("click", handleAdminSignOut);

    // Callback onAuthStateChange sengaja hanya merender ulang,
    // tanpa memanggil method Supabase lain di dalamnya.
    supabaseClient.auth.onAuthStateChange((_event, session) => {
      applyAdminSession(session);
    });

    const { data } = await supabaseClient.auth.getSession();
    applyAdminSession(data ? data.session : null);
  }

  /* ============================================================
       RSVP FORM
       ============================================================ */

  // isValidation: pesan hanya dibacakan screen reader (disembunyikan secara
  // visual), karena pesan yang sama sudah tampil di bawah kolom yang kosong.
  function setFormStatus(message, isError, isValidation) {
    DOM.formStatus.textContent = message;
    DOM.formStatus.classList.toggle("is-error", Boolean(isError));
    DOM.formStatus.classList.toggle("is-validation", Boolean(isValidation));
  }

  function clearFieldError(input, errorNode) {
    input.removeAttribute("aria-invalid");
    if (errorNode) errorNode.hidden = true;
  }

  // Getar singkat pada kolom yang bermasalah (dilewati jika pengguna
  // memilih pengurangan animasi).
  function shakeField(node) {
    if (!node || motionQuery.matches) return;
    const wrapper = node.closest(".field") || node;

    wrapper.classList.remove("is-shaking");
    void wrapper.offsetWidth; // paksa animasi mulai ulang
    wrapper.classList.add("is-shaking");

    const onEnd = (event) => {
      if (event.target !== wrapper) return;
      wrapper.classList.remove("is-shaking");
      wrapper.removeEventListener("animationend", onEnd);
    };
    wrapper.addEventListener("animationend", onEnd);
  }

  function showFieldError(input, errorNode) {
    input.setAttribute("aria-invalid", "true");
    if (errorNode) errorNode.hidden = false;
    shakeField(input);
  }

  function setAttendanceError(isInvalid) {
    const group = DOM.rsvpForm.querySelector(".field--choice");
    DOM.rsvpAttendanceError.hidden = !isInvalid;
    if (!group) return;
    group.classList.toggle("is-invalid", isInvalid);
    if (isInvalid) shakeField(group);
  }

  // Gulir halus ke kolom lalu fokuskan, agar pengguna langsung melihatnya.
  function focusField(element) {
    const target = element.closest(".field") || element;
    target.scrollIntoView({
      behavior: motionQuery.matches ? "auto" : "smooth",
      block: "center",
    });
    element.focus({ preventScroll: true });
  }

  function setSubmitting(active) {
    isSubmitting = active;
    DOM.btnSubmit.disabled = active;
    DOM.btnSubmit.setAttribute("aria-busy", String(active));
  }

  function setSubmitLabel(text, resetAfterMs) {
    if (submitLabelTimer) {
      window.clearTimeout(submitLabelTimer);
      submitLabelTimer = null;
    }
    DOM.btnSubmitLabel.textContent = text;
    if (resetAfterMs) {
      submitLabelTimer = window.setTimeout(() => {
        DOM.btnSubmitLabel.textContent = "KIRIM KONFIRMASI";
        submitLabelTimer = null;
      }, resetAfterMs);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (isSubmitting) return;
    setFormStatus("", false);

    const name = DOM.rsvpName.value.trim();
    const attendanceInput = DOM.rsvpForm.querySelector(
      'input[name="attendance"]:checked',
    );
    const message = DOM.rsvpMessage.value.trim();

    clearFieldError(DOM.rsvpName, DOM.rsvpNameError);
    clearFieldError(DOM.rsvpMessage, DOM.rsvpMessageError);
    setAttendanceError(false);

    if (!name) {
      showFieldError(DOM.rsvpName, DOM.rsvpNameError);
    }

    if (!attendanceInput) {
      setAttendanceError(true);
    }

    // Ucapan & doa wajib diisi.
    if (!message) {
      showFieldError(DOM.rsvpMessage, DOM.rsvpMessageError);
    }

    if (!name || !attendanceInput || !message) {
      const missing = [];
      if (!name) missing.push("nama");
      if (!attendanceInput) missing.push("konfirmasi kehadiran");
      if (!message) missing.push("ucapan dan doa");

      let status = `Mohon lengkapi: ${missing.join(", ")}.`;
      if (missing.length === 1) {
        if (!name) status = "Mohon isi nama Anda.";
        else if (!attendanceInput)
          status = "Mohon pilih konfirmasi kehadiran Anda.";
        else status = "Mohon isi ucapan dan doa Anda.";
      }
      setFormStatus(status, true, true);

      if (!name) {
        focusField(DOM.rsvpName);
      } else if (!attendanceInput) {
        focusField(DOM.rsvpForm.querySelector('input[name="attendance"]'));
      } else {
        focusField(DOM.rsvpMessage);
      }
      return;
    }

    if (!supabaseClient) {
      setFormStatus(
        "Layanan konfirmasi belum aktif. Silakan coba beberapa saat lagi.",
        true,
      );
      return;
    }

    setSubmitting(true);
    setSubmitLabel("MENGIRIM…");

    try {
      const { data, error } = await supabaseClient
        .from(CONFIG.table)
        .insert({
          name,
          attendance: attendanceInput.value,
          message,
        })
        .select(WISH_COLUMNS)
        .single();

      if (error) throw error;

      // Tampilkan langsung ucapan yang baru tersimpan (tanpa realtime).
      const saved = normaliseWish(data);
      if (saved) {
        wishes.unshift(saved);
        counts = counts || countFromList(wishes.slice(1));
        counts[saved.attendance] += 1;
      }
      wishesStatus = "ready";
      visibleCount = 4;
      renderWishes();

      DOM.rsvpForm.reset();
      setFormStatus(`Konfirmasi terkirim. Terima kasih, ${name}.`, false);
      setSubmitLabel("TERKIRIM ✓", 3000);
    } catch (error) {
      console.error("Gagal mengirim konfirmasi:", error);
      setFormStatus(
        "Konfirmasi belum terkirim. Periksa koneksi Anda lalu coba lagi.",
        true,
      );
      setSubmitLabel("KIRIM KONFIRMASI");
    } finally {
      setSubmitting(false);
    }
  }

  // Nama tamu dari ?kepada=Nama+Tamu (link lama ?to=, ?guest= dan ?nama= tetap didukung). URLSearchParams
  // sudah mengubah "+" dan %20 menjadi spasi. Ditulis lewat textContent,
  // jadi aman dari injeksi HTML.
  function getGuestName() {
    const params = new URLSearchParams(window.location.search);
    const raw =
      params.get("kepada") ||
      params.get("to") ||
      params.get("guest") ||
      params.get("nama");
    return (raw || "").replace(/\s+/g, " ").trim().slice(0, 80);
  }

  function prefillGuest() {
    const guest = getGuestName();
    if (!guest) return;
    DOM.rsvpName.value = guest;
    const gateGuest = document.getElementById("gateGuest");
    const gateInvitee = document.getElementById("gateInvitee");
    if (gateGuest && gateInvitee) {
      gateGuest.textContent = guest;
      gateInvitee.hidden = false;
    }
  }

  /* ============================================================
       REVEAL
       ============================================================ */

  function showAllReveals() {
    document.querySelectorAll(".reveal").forEach((element) => {
      element.classList.add("is-visible");
    });
  }

  function initReveal() {
    const elements = Array.from(document.querySelectorAll(".reveal"));
    if (!elements.length) return;

    if (!("IntersectionObserver" in window)) {
      showAllReveals();
      return;
    }

    revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        });
      },
      {
        threshold: 0.12,
        rootMargin: "0px 0px -40px 0px",
      },
    );

    elements.forEach((element) => {
      const siblings = Array.from(element.parentElement?.children || []).filter(
        (sibling) => sibling.classList.contains("reveal"),
      );
      const index = siblings.indexOf(element);
      element.style.setProperty(
        "--reveal-delay",
        `${Math.min(Math.max(index, 0), 3) * 100}ms`,
      );
      revealObserver.observe(element);
    });

    motionQuery.addEventListener("change", (event) => {
      if (event.matches) {
        revealObserver?.disconnect();
        showAllReveals();
      }
    });
  }

  /* ============================================================
       MOTION · ANIMASI INTERAKTIF PER SECTION
       ============================================================ */

  const fine = matchMedia("(hover: hover) and (pointer: fine)");
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const root = document.documentElement;
  const EASE = "cubic-bezier(0.2, 0, 0, 1)";

  // Naik + blur; di bawah reduced motion hanya cross-fade opacity.
  const rise = (el, delay = 0, y = "12px") =>
    el.animate(
      motionQuery.matches
        ? [{ opacity: 0 }, { opacity: 1 }]
        : [
            { opacity: 0, transform: `translateY(${y})`, filter: "blur(4px)" },
            { opacity: 1, transform: "none", filter: "blur(0)" },
          ],
      {
        duration: motionQuery.matches ? 150 : 300,
        delay,
        easing: EASE,
        fill: "backwards",
      },
    );

  const once = (el, fn, threshold) => {
    if (!el) return;
    new IntersectionObserver(
      (es, o) =>
        es.forEach((e) => {
          if (e.isIntersecting) {
            o.disconnect();
            fn();
          }
        }),
      { threshold },
    ).observe(el);
  };

  function initMotion() {
    const sync = () => root.classList.toggle("motion", !motionQuery.matches);
    sync();
    motionQuery.addEventListener("change", sync);

    // Mode lite: hemat data atau HP berspek rendah -> tanpa parallax, blur, dan animasi ambient
    const small = matchMedia("(max-width: 720px)");
    const lite =
      navigator.connection?.saveData ||
      (small.matches && (navigator.deviceMemory || 8) <= 4);
    if (lite) root.classList.add("lite");
    const io = new IntersectionObserver((es) =>
      es.forEach((e) => e.target.classList.toggle("is-off", !e.isIntersecting)),
    );
    $$(".butterfly, .scroll-cue span[aria-hidden]").forEach((el) =>
      io.observe(el),
    );

    $$(".opening__centre, .closing, .facts").forEach((p) =>
      [...p.children].forEach((c, i) => c.style.setProperty("--i", i)),
    );

    // Pembuka: entrance dimulai saat undangan dibuka
    $("#openInvitation")?.addEventListener("click", () =>
      $("#pembuka")?.classList.add("is-entered"),
    );
    once($(".closing"), () => $(".closing").classList.add("is-visible"), 0.3);

    // Progress scroll, hero out, parallax plate & foto (satu rAF per frame)
    const bar = document.body.appendChild(
      Object.assign(document.createElement("div"), { className: "progress" }),
    );
    bar.setAttribute("aria-hidden", "true");
    const hero = $(".opening__centre");
    const para = [
      ...$$(".plate").map((el) => [el, el.parentElement, 0.05, 50]),
      ...$$(".portrait__arch img").map((el) => [
        el,
        el.parentElement,
        0.04,
        24,
      ]),
    ];
    let queued = false;
    const tick = () => {
      queued = false;
      const vh = innerHeight,
        y = scrollY,
        max = root.scrollHeight - vh;
      bar.style.setProperty("--sp", max > 0 ? Math.min(y / max, 1) : 0);
      root.classList.toggle("is-scrolled", y > 80);

      if (motionQuery.matches) return;
      hero.style.setProperty("--p", Math.min(y / vh, 1));
      for (const [el, ref, k, lim] of lite || small.matches ? [] : para) {
        const r = ref.getBoundingClientRect();
        if (r.bottom < -100 || r.top > vh + 100) continue;
        el.style.setProperty(
          "--py",
          Math.max(-lim, Math.min(lim, -(r.top + r.height / 2 - vh / 2) * k)) +
            "px",
        );
      }
    };
    const onScroll = () =>
      queued || ((queued = true), requestAnimationFrame(tick));
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onScroll);
    tick();

    // Interaksi pointer (hanya mouse/trackpad)
    if (fine.matches) {
      const track = (el, move, leave) => {
        let ev = null; // satu pembaruan per frame
        el.addEventListener("pointermove", (e) => {
          if (motionQuery.matches) return;
          if (!ev)
            requestAnimationFrame(() => {
              if (!ev) return;
              const r = el.getBoundingClientRect();
              move(
                (ev.clientX - r.left) / r.width,
                (ev.clientY - r.top) / r.height,
              );
              ev = null;
            });
          ev = e;
        });
        el.addEventListener("pointerleave", () => {
          ev = null;
          leave();
        });
      };
      const gate = $("#gate");
      track(
        gate,
        (x, y) => {
          gate.style.setProperty("--mx", x * 2 - 1);
          gate.style.setProperty("--my", y * 2 - 1);
        },
        () => {
          gate.style.removeProperty("--mx");
          gate.style.removeProperty("--my");
        },
      );
      $$(".portrait__arch").forEach((a) =>
        track(
          a,
          (x, y) => {
            a.style.setProperty("--ry", (x - 0.5) * 8 + "deg");
            a.style.setProperty("--rx", (0.5 - y) * 8 + "deg");
            a.style.setProperty("--gx", x * 100 + "%");
            a.style.setProperty("--gy", y * 100 + "%");
            a.classList.add("is-hover");
          },
          () => {
            a.style.removeProperty("--rx");
            a.style.removeProperty("--ry");
            a.classList.remove("is-hover");
          },
        ),
      );
      const cd = $(".countdown");
      track(
        cd,
        (x, y) => {
          cd.style.setProperty("--sx", x * 100 + "%");
          cd.style.setProperty("--sy", y * 100 + "%");
          cd.classList.add("is-hover");
        },
        () => cd.classList.remove("is-hover"),
      );
    }

    // Countdown: angka bergulir saat berubah (detik dilewati: terlalu sering), plus gulir awal bertahap
    ["days", "hours", "minutes"].forEach((id) => {
      const el = document.getElementById(id);
      el.dataset.v = el.textContent;
      new MutationObserver(() => {
        if (el.textContent !== el.dataset.v) {
          el.dataset.v = el.textContent;
          rise(el, 0, "40%");
        }
      }).observe(el, { childList: true, characterData: true, subtree: true });
    });
    once(
      $("#countdownTimer"),
      () =>
        $$(".countdown__value").forEach((el, i) =>
          rise(el, 300 + i * 100, "40%"),
        ),
      0.4,
    );

    // Peta: ketuk untuk aktifkan agar scroll halaman tidak tersangkut
    const frame = $(".map__frame");
    if (frame) {
      const hint = Object.assign(document.createElement("span"), {
        className: "map__hint",
        textContent: "KETUK UNTUK MENGGESER PETA",
      });
      hint.setAttribute("aria-hidden", "true");
      frame.append(hint);
      frame.classList.add("is-locked");
      frame.addEventListener("pointerdown", () =>
        frame.classList.remove("is-locked"),
      );
      document.addEventListener("pointerdown", (e) => {
        if (!frame.contains(e.target)) frame.classList.add("is-locked");
      });
    }

    // Ucapan baru masuk bertahap (hanya yang belum pernah tampil)
    const list = $("#wishesList"),
      seen = new Set();
    list &&
      new MutationObserver((ms) =>
        ms.forEach((m) =>
          m.addedNodes.forEach((n, i) => {
            const id = n.dataset && n.dataset.id;
            if (id && !seen.has(id)) {
              seen.add(id);
              rise(n, i * 100);
            }
          }),
        ),
      ).observe(list, { childList: true });

    // Konfirmasi terkirim: kelopak menyebar dari tombol (label "TERKIRIM ✓" tetap jadi penanda statis)
    const burst = (from) => {
      if (motionQuery.matches) return;
      const r = from.getBoundingClientRect(),
        cx = r.left + r.width / 2,
        cy = r.top + r.height / 2;
      for (let i = 0; i < 16; i++) {
        const p = document.createElement("span");
        p.className = "petal";
        p.setAttribute("aria-hidden", "true");
        p.style.cssText = `left:${cx}px;top:${cy}px;--c:${["#b5b19d", "#6b654f", "#e4c9c0"][i % 3]}`;
        document.body.append(p);
        const a = Math.random() * Math.PI * 2,
          d = 50 + Math.random() * 90;
        p.animate(
          [
            { transform: "translate(0,0) rotate(0)", opacity: 1 },
            {
              transform: `translate(${Math.cos(a) * d}px,${Math.sin(a) * d + 70}px) rotate(${Math.random() * 360}deg)`,
              opacity: 0,
            },
          ],
          { duration: 900 + Math.random() * 400, easing: EASE },
        ).onfinish = () => p.remove();
      }
    };
    const label = $("#btnSubmitLabel");
    label &&
      new MutationObserver(
        () => label.textContent.includes("TERKIRIM") && burst($("#btnSubmit")),
      ).observe(label, { childList: true, characterData: true, subtree: true });
  }

  /* ============================================================
       INIT
       ============================================================ */

  function init() {
    supabaseClient = initSupabase();
    renderWishes();
    refreshWishes();
    initAdmin();
    prefillGuest();
    startCountdown();

    DOM.openInvitation.addEventListener("click", openInvitation);
    DOM.musicControl.addEventListener("click", () => {
      toggleMusic();
      revealMusicLabel();
    });
    DOM.rsvpForm.addEventListener("submit", handleSubmit);
    DOM.rsvpSummary.addEventListener("click", (event) => {
      const button = event.target.closest(".rsvp-filter");
      if (button) setAttendanceFilter(button.dataset.filter);
    });
    DOM.sortToggle.addEventListener("click", () => {
      sortOrder = sortOrder === "newest" ? "oldest" : "newest";
      DOM.sortLabel.textContent =
        sortOrder === "newest" ? "TERBARU" : "TERLAMA";
      DOM.sortToggle.classList.toggle("is-flipped", sortOrder === "oldest");
      visibleCount = 4;
      renderWishes();
    });
    DOM.showAllWishes.addEventListener("click", () => {
      const ordered = wishes.filter(
        (w) =>
          attendanceFilter === "semua" || w.attendance === attendanceFilter,
      );
      if (visibleCount >= ordered.length) {
        // Sudah semua tampil → collapse kembali ke 4.
        visibleCount = 4;
      } else {
        // Tambahkan 4 komentar lagi.
        visibleCount += 4;
      }
      renderWishes();
    });

    DOM.gateTitle.focus({ preventScroll: true });

    DOM.rsvpName.addEventListener("input", () => {
      if (DOM.rsvpName.value.trim()) {
        clearFieldError(DOM.rsvpName, DOM.rsvpNameError);
        setFormStatus("", false);
      }
    });

    DOM.rsvpMessage.addEventListener("input", () => {
      if (DOM.rsvpMessage.value.trim()) {
        clearFieldError(DOM.rsvpMessage, DOM.rsvpMessageError);
        setFormStatus("", false);
      }
    });

    DOM.rsvpForm
      .querySelectorAll('input[name="attendance"]')
      .forEach((input) => {
        input.addEventListener("change", () => {
          setAttendanceError(false);
          setFormStatus("", false);
        });
      });

    bgMusic.addEventListener("play", () => setMusicUI(true));
    bgMusic.addEventListener("pause", () => setMusicUI(false));
    bgMusic.addEventListener("error", () => setMusicUI(false));

    document.addEventListener("keydown", trapGateFocus);

    initReveal();
    initMotion();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
