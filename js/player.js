/**
 * Riwaq Audio Player (مشغل الصوت لرواق)
 * يدعم تشغيل وإيقاف مؤقت واستئناف وتغيير السرعة واختيار الأصوات العربية،
 * مع حفظ آخر موضع استماع لاستئنافه في أي وقت.
 */

class RiwaqPlayer {
  constructor() {
    this.synth = ('speechSynthesis' in window) ? window.speechSynthesis : null;
    this.voices = [];
    this.arabicVoices = [];
    this.currentBook = null;
    this.currentUtterance = null;
    this.isPlaying = false;
    this.isPaused = false;
    this.speed = parseFloat(localStorage.getItem('riwaq_speed') || '1.0');
    this.selectedVoiceURI = localStorage.getItem('riwaq_voice_uri') || '';
    this.keepAliveTimer = null;
    this.progressInterval = null;
    this.startTime = null;
    this.estimatedDurationMs = 0;

    this.onStateChange = null;
    this.init();
  }

  init() {
    if (!this.synth) {
      console.warn("SpeechSynthesis غير مدعوم في هذا المتصفح.");
      return;
    }

    this.loadVoices();
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = () => this.loadVoices();
    }
  }

  loadVoices() {
    if (!this.synth) return;
    this.voices = this.synth.getVoices();
    
    // فلترة الأصوات العربية (سامسونج، غوغل، أو النظام)
    this.arabicVoices = this.voices.filter(v => {
      const lang = (v.lang || '').toLowerCase();
      const name = (v.name || '').toLowerCase();
      return lang.startsWith('ar') || name.includes('arabic') || name.includes('عربي');
    });

    if (this.onVoicesLoaded) {
      this.onVoicesLoaded(this.arabicVoices, this.voices);
    }
  }

  getSelectedVoice() {
    if (this.selectedVoiceURI) {
      const match = this.voices.find(v => v.voiceURI === this.selectedVoiceURI || v.name === this.selectedVoiceURI);
      if (match) return match;
    }
    // اختيار أول صوت عربي متاح أو الافتراضي
    if (this.arabicVoices.length > 0) {
      return this.arabicVoices[0];
    }
    return null;
  }

  setVoice(voiceURI) {
    this.selectedVoiceURI = voiceURI;
    localStorage.setItem('riwaq_voice_uri', voiceURI);
  }

  setSpeed(speedVal) {
    this.speed = parseFloat(speedVal);
    localStorage.setItem('riwaq_speed', this.speed);
    
    // إذا كان يعمل حالياً، أعد تشغيل الملخص بالسرعة الجديدة
    if (this.isPlaying && this.currentBook) {
      const current = this.currentBook;
      this.stop();
      this.play(current);
    } else {
      this.notifyState();
    }
  }

  play(book) {
    if (!this.synth) {
      alert("عذراً، محرك الصوت غير مدعوم في متصفحك.");
      return;
    }

    // إذا كان نفس الكتاب ومتوقفاً مؤقتاً، استأنف
    if (this.isPaused && this.currentBook && this.currentBook.id === book.id) {
      this.resume();
      return;
    }

    this.stop();

    this.currentBook = book;
    localStorage.setItem('riwaq_last_played', JSON.stringify({
      id: book.id,
      title: book.title,
      author: book.author,
      timestamp: Date.now()
    }));

    // تجهيز النص المتكامل للقراءة: العنوان، المؤلف، ثم الخلاصة
    const fullText = `${book.title}. للمؤلف: ${book.author}. ${book.summary}`;

    const utterance = new SpeechSynthesisUtterance(fullText);
    utterance.lang = 'ar-SA';
    utterance.rate = this.speed;
    utterance.pitch = 1.0;

    const voice = this.getSelectedVoice();
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang || 'ar-SA';
    }

    // تقدير المدة الزمنية تقريبياً (كل كلمة ~0.35 ثانية بالسرعة 1x)
    const wordCount = fullText.split(/\s+/).length;
    this.estimatedDurationMs = (wordCount * 360 / this.speed) * 1000;
    this.startTime = Date.now();

    utterance.onstart = () => {
      this.isPlaying = true;
      this.isPaused = false;
      this.startKeepAlive();
      this.startProgress();
      this.notifyState();
    };

    utterance.onpause = () => {
      this.isPaused = true;
      this.isPlaying = false;
      this.clearTimers();
      this.notifyState();
    };

    utterance.onresume = () => {
      this.isPlaying = true;
      this.isPaused = false;
      this.startKeepAlive();
      this.startProgress();
      this.notifyState();
    };

    utterance.onend = () => {
      this.isPlaying = false;
      this.isPaused = false;
      this.clearTimers();
      this.notifyState();
    };

    utterance.onerror = (e) => {
      console.warn("خطأ تشغيل الصوت:", e);
      this.isPlaying = false;
      this.isPaused = false;
      this.clearTimers();
      this.notifyState();
    };

    this.currentUtterance = utterance;
    this.synth.speak(utterance);
    this.notifyState();
  }

  pause() {
    if (this.synth && this.isPlaying) {
      this.synth.pause();
      this.isPaused = true;
      this.isPlaying = false;
      this.clearTimers();
      this.notifyState();
    }
  }

  resume() {
    if (this.synth && this.isPaused) {
      this.synth.resume();
      this.isPlaying = true;
      this.isPaused = false;
      this.startKeepAlive();
      this.startProgress();
      this.notifyState();
    } else if (this.currentBook) {
      this.play(this.currentBook);
    }
  }

  togglePlayPause(book) {
    if (this.isPlaying) {
      if (book && this.currentBook && book.id === this.currentBook.id) {
        this.pause();
      } else if (book) {
        this.play(book);
      } else {
        this.pause();
      }
    } else if (this.isPaused) {
      if (!book || (this.currentBook && book.id === this.currentBook.id)) {
        this.resume();
      } else {
        this.play(book);
      }
    } else {
      if (book) {
        this.play(book);
      } else if (this.currentBook) {
        this.play(this.currentBook);
      }
    }
  }

  stop() {
    if (this.synth) {
      this.synth.cancel();
    }
    this.isPlaying = false;
    this.isPaused = false;
    this.clearTimers();
    this.notifyState();
  }

  // معالجة مشكلة التوقف التلقائي بعد 15 ثانية على متصفحات سامسونغ وكروم المحمولة
  startKeepAlive() {
    this.clearTimers();
    this.keepAliveTimer = setInterval(() => {
      if (this.synth && this.isPlaying) {
        this.synth.pause();
        this.synth.resume();
      }
    }, 12000);
  }

  startProgress() {
    if (this.progressInterval) clearInterval(this.progressInterval);
    this.progressInterval = setInterval(() => {
      if (!this.isPlaying) return;
      const elapsed = Date.now() - (this.startTime || Date.now());
      const percent = Math.min(100, Math.round((elapsed / this.estimatedDurationMs) * 100));
      if (this.onProgress) {
        this.onProgress(percent, elapsed);
      }
    }, 500);
  }

  clearTimers() {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
  }

  notifyState() {
    if (this.onStateChange) {
      this.onStateChange({
        isPlaying: this.isPlaying,
        isPaused: this.isPaused,
        currentBook: this.currentBook,
        speed: this.speed,
        selectedVoiceURI: this.selectedVoiceURI
      });
    }
  }

  getLastPlayed() {
    try {
      const data = localStorage.getItem('riwaq_last_played');
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  }
}

window.RiwaqPlayer = RiwaqPlayer;
