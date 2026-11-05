/**
 * Riwaq Main Application Logic (منطق تطبيق رواق)
 * إدارة الواجهة، المفضلة، البحث، التبويبات، وربط مشغل الصوت مع الـ PWA.
 */

document.addEventListener("DOMContentLoaded", () => {
  // تهيئة الحالة
  let currentTab = "all"; // 'all', 'tunis', 'favs', 'settings'
  let currentCategory = "all"; // 'all', 'tunis', 'history', 'literature', 'philosophy'
  let searchQuery = "";
  let favorites = JSON.parse(localStorage.getItem("riwaq_favorites") || "[]");
  let deferredPrompt = null;

  // تهيئة مشغل الصوت
  const player = new RiwaqPlayer();

  // عناصر واجهة المستخدم
  const libraryContainer = document.getElementById("library");
  const searchInput = document.getElementById("searchInput");
  const clearSearchBtn = document.getElementById("clearSearch");
  const categoryPills = document.querySelectorAll(".category-pill");
  const navTabs = document.querySelectorAll(".nav-tab-btn");
  const settingsPanel = document.getElementById("settingsPanel");
  const emptyState = document.getElementById("emptyState");
  const resumeBanner = document.getElementById("resumeBanner");
  const resumeTitle = document.getElementById("resumeTitle");
  const resumeBtn = document.getElementById("resumeBtn");
  const installBtn = document.getElementById("installBtn");

  // عناصر المشغل العائم
  const miniPlayer = document.getElementById("miniPlayer");
  const miniProgress = document.getElementById("miniProgress");
  const miniTitle = document.getElementById("miniTitle");
  const miniAuthor = document.getElementById("miniAuthor");
  const miniPlayBtn = document.getElementById("miniPlayBtn");
  const miniStopBtn = document.getElementById("miniStopBtn");
  const miniSpeedBtn = document.getElementById("miniSpeedBtn");

  // عناصر الإعدادات
  const voiceSelect = document.getElementById("voiceSelect");
  const speedButtons = document.querySelectorAll(".speed-btn-choice");

  // ==================== فلترة وعرض الكتب ====================

  function normalizeArabic(text) {
    if (!text) return "";
    return text
      .toString()
      .toLowerCase()
      .replace(/[إأآا]/g, "ا")
      .replace(/ة/g, "ه")
      .replace(/ي/g, "ى")
      .replace(/[\u064B-\u065F]/g, ""); // إزالة التشكيل
  }

  function getFilteredBooks() {
    return RIWAQ_BOOKS.filter((book) => {
      // فلترة التبويب الرئيسي
      if (currentTab === "tunis" && book.tag !== "tunis") return false;
      if (currentTab === "favs" && !favorites.includes(book.id)) return false;

      // فلترة التصنيف المحدد
      if (currentCategory !== "all" && book.tag !== currentCategory) return false;

      // فلترة البحث
      if (searchQuery.trim() !== "") {
        const query = normalizeArabic(searchQuery.trim());
        const target = normalizeArabic(
          `${book.title} ${book.author} ${book.category} ${book.era || ""} ${book.quote || ""} ${book.summary}`
        );
        if (!target.includes(query)) return false;
      }

      return true;
    });
  }

  function renderBooks() {
    if (currentTab === "settings") {
      libraryContainer.style.display = "none";
      settingsPanel.classList.add("active");
      emptyState.style.display = "none";
      return;
    } else {
      libraryContainer.style.display = "flex";
      settingsPanel.classList.remove("active");
    }

    const books = getFilteredBooks();
    libraryContainer.innerHTML = "";

    if (books.length === 0) {
      emptyState.style.display = "block";
      const emptyMsg = document.getElementById("emptyMsg");
      if (currentTab === "favs") {
        emptyMsg.textContent = "لم تُضف أي كتب إلى مفضلتك بعد. اضغط على رمز النجمة لحفظ ملخصاتك المفضلة.";
      } else {
        emptyMsg.textContent = "لا توجد نتائج تطابق بحثك الحالي.";
      }
      return;
    }

    emptyState.style.display = "none";

    books.forEach((book) => {
      const isFav = favorites.includes(book.id);
      const isCurrent = player.currentBook && player.currentBook.id === book.id;
      const isPlaying = isCurrent && player.isPlaying;

      const card = document.createElement("article");
      card.className = `book-card ${isPlaying ? "is-playing" : ""}`;
      card.id = `card-${book.id}`;

      card.innerHTML = `
        <div class="card-top">
          <div class="card-header-info">
            <div class="card-book-icon">${book.icon || "📚"}</div>
            <div>
              <h2 class="card-title">${book.title}</h2>
              <p class="card-author">✍️ ${book.author}</p>
            </div>
          </div>
          <button class="card-fav-btn ${isFav ? "active" : ""}" data-id="${book.id}" title="${isFav ? "إزالة من المفضلة" : "إضافة إلى المفضلة"}" aria-label="تفضيل">
            ${isFav ? "★" : "☆"}
          </button>
        </div>

        <div class="card-meta-tags">
          <span class="meta-badge ${book.tag === "tunis" ? "tunis-badge" : ""}">${book.category}</span>
          ${book.era ? `<span class="meta-badge">${book.era}</span>` : ""}
          <span class="meta-badge">⏱️ ${book.readTime || "3 دقائق"}</span>
        </div>

        ${book.quote ? `<blockquote class="card-quote">« ${book.quote} »</blockquote>` : ""}

        <p class="card-summary selectable">${book.summary}</p>

        <div class="card-actions">
          <button class="play-action-btn ${isPlaying ? "playing" : ""}" data-id="${book.id}">
            ${isPlaying 
              ? `<span class="sound-waves"><span></span><span></span><span></span></span> إيقاف مؤقت` 
              : `▶ استمع للملخص`}
          </button>
          <button class="btn-secondary-action share-btn" data-id="${book.id}">
            🔗 مشاركة
          </button>
        </div>
      `;

      // أحداث أزرار البطاقة
      const favBtn = card.querySelector(".card-fav-btn");
      favBtn.addEventListener("click", () => toggleFavorite(book.id));

      const playBtn = card.querySelector(".play-action-btn");
      playBtn.addEventListener("click", () => {
        if (isCurrent) {
          player.togglePlayPause(book);
        } else {
          player.play(book);
        }
      });

      const shareBtn = card.querySelector(".share-btn");
      shareBtn.addEventListener("click", () => shareBook(book));

      libraryContainer.appendChild(card);
    });
  }

  // ==================== المفضلة ====================

  function toggleFavorite(bookId) {
    if (favorites.includes(bookId)) {
      favorites = favorites.filter((id) => id !== bookId);
    } else {
      favorites.push(bookId);
    }
    localStorage.setItem("riwaq_favorites", JSON.stringify(favorites));
    renderBooks();
  }

  // ==================== المشاركة ====================

  function shareBook(book) {
    const textToShare = `📚 ملخص «${book.title}» تأليف ${book.author}:\n\n${book.summary}\n\n- تطبيق رواق للكتب المسموعة`;
    if (navigator.share) {
      navigator.share({
        title: `رواق | ${book.title}`,
        text: textToShare,
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(textToShare).then(() => {
        alert("تم نسخ الملخص إلى الحافظة بنجاح!");
      }).catch(() => {
        alert("تعذر النسخ إلى الحافظة.");
      });
    }
  }

  // ==================== استئناف الاستماع ====================

  function checkResumeBanner() {
    const lastPlayed = player.getLastPlayed();
    if (lastPlayed && (!player.currentBook || !player.isPlaying)) {
      const book = RIWAQ_BOOKS.find((b) => b.id === lastPlayed.id);
      if (book) {
        resumeTitle.textContent = `${book.title} — ${book.author}`;
        resumeBanner.style.display = "flex";
        resumeBtn.onclick = () => {
          player.play(book);
          resumeBanner.style.display = "none";
        };
      }
    } else {
      resumeBanner.style.display = "none";
    }
  }

  // ==================== تكامل مشغل الصوت ====================

  player.onStateChange = (state) => {
    // تحديث المشغل العائم
    if (state.currentBook && (state.isPlaying || state.isPaused)) {
      miniPlayer.style.display = "block";
      miniTitle.textContent = state.currentBook.title;
      miniAuthor.textContent = state.currentBook.author;
      miniPlayBtn.textContent = state.isPlaying ? "⏸" : "▶";
      miniPlayBtn.title = state.isPlaying ? "إيقاف مؤقت" : "استئناف";
      miniSpeedBtn.textContent = `${state.speed}x`;
      resumeBanner.style.display = "none";
    } else {
      miniPlayer.style.display = "none";
      checkResumeBanner();
    }

    // تحديث بطاقات الكتب لتزامن حالة التشغيل
    renderBooks();
  };

  player.onProgress = (percent) => {
    miniProgress.style.width = `${percent}%`;
  };

  player.onVoicesLoaded = (arVoices, allVoices) => {
    voiceSelect.innerHTML = "";
    if (arVoices.length === 0) {
      voiceSelect.innerHTML = '<option value="">الصوت العربي الافتراضي للنظام</option>';
      allVoices.forEach((v) => {
        const opt = document.createElement("option");
        opt.value = v.voiceURI;
        opt.textContent = `${v.name} (${v.lang})`;
        voiceSelect.appendChild(opt);
      });
    } else {
      arVoices.forEach((v) => {
        const opt = document.createElement("option");
        opt.value = v.voiceURI;
        opt.textContent = `🇸🇦 ${v.name} (${v.lang})`;
        if (v.voiceURI === player.selectedVoiceURI) {
          opt.selected = true;
        }
        voiceSelect.appendChild(opt);
      });
    }
  };

  // أحداث المشغل العائم
  miniPlayBtn.addEventListener("click", () => {
    player.togglePlayPause();
  });

  miniStopBtn.addEventListener("click", () => {
    player.stop();
  });

  miniSpeedBtn.addEventListener("click", () => {
    const speeds = [0.8, 1.0, 1.25, 1.5];
    let nextIdx = (speeds.indexOf(player.speed) + 1) % speeds.length;
    if (nextIdx === -1) nextIdx = 1;
    player.setSpeed(speeds[nextIdx]);
    updateSpeedButtonsUI(speeds[nextIdx]);
  });

  // أحداث الإعدادات
  voiceSelect.addEventListener("change", (e) => {
    player.setVoice(e.target.value);
  });

  speedButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const val = parseFloat(btn.dataset.speed);
      player.setSpeed(val);
      updateSpeedButtonsUI(val);
    });
  });

  function updateSpeedButtonsUI(speedVal) {
    speedButtons.forEach((b) => {
      if (parseFloat(b.dataset.speed) === speedVal) {
        b.classList.add("active");
      } else {
        b.classList.remove("active");
      }
    });
  }

  // ==================== البحث ====================

  searchInput.addEventListener("input", (e) => {
    searchQuery = e.target.value;
    clearSearchBtn.style.display = searchQuery.length > 0 ? "block" : "none";
    renderBooks();
  });

  clearSearchBtn.addEventListener("click", () => {
    searchInput.value = "";
    searchQuery = "";
    clearSearchBtn.style.display = "none";
    searchInput.focus();
    renderBooks();
  });

  // ==================== التصنيفات ====================

  categoryPills.forEach((pill) => {
    pill.addEventListener("click", () => {
      categoryPills.forEach((p) => p.classList.remove("active"));
      pill.classList.add("active");
      currentCategory = pill.dataset.category;
      renderBooks();
    });
  });

  // ==================== شريط التنقل السفلي ====================

  navTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      navTabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      currentTab = tab.dataset.tab;
      
      // إخفاء/إظهار عناصر البحث حسب التبويب
      const searchBox = document.querySelector(".search-box");
      const categoriesScroll = document.querySelector(".categories-scroll");
      if (currentTab === "settings") {
        searchBox.style.display = "none";
        categoriesScroll.style.display = "none";
        resumeBanner.style.display = "none";
      } else {
        searchBox.style.display = "block";
        categoriesScroll.style.display = "flex";
        checkResumeBanner();
      }

      renderBooks();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });

  // ==================== PWA تثبيت والـ Service Worker ====================

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("./sw.js")
        .then((reg) => {
          console.log("رواق: تم تسجيل Service Worker بنجاح", reg.scope);
        })
        .catch((err) => {
          console.warn("رواق: فشل تسجيل Service Worker", err);
        });
    });
  }

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installBtn.style.display = "inline-flex";
  });

  installBtn.addEventListener("click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      installBtn.style.display = "none";
    }
    deferredPrompt = null;
  });

  window.addEventListener("appinstalled", () => {
    installBtn.style.display = "none";
    deferredPrompt = null;
    console.log("رواق: تم تثبيت التطبيق على الجهاز.");
  });

  // ==================== الإقلاع الأولي ====================
  updateSpeedButtonsUI(player.speed);
  checkResumeBanner();
  renderBooks();
});
