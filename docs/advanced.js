/* ============================================================
 * خَلّد — Enhanced App v3.0
 * منصة ألعاب أبو خالد | Advanced Local-First Architecture
 * With Leaderboards, Achievements, Statistics & More
 * ============================================================ */
'use strict';

// ─── تكوين التطبيق ──────────────────────────────────────────
const APP_CONFIG = {
  version: '3.0',
  appName: 'خَلّد',
  maxPlayers: 999,
  storagePrefix: 'kh_',
  achievements: [
    { id: 'first_game', name: 'البداية الموفقة', icon: '🎮', desc: 'لعب أول لعبة' },
    { id: 'ten_games', name: 'عاشق الألعاب', icon: '🎯', desc: 'لعب 10 ألعاب' },
    { id: 'perfect', name: 'مثالي!', icon: '💯', desc: 'إجابات 100% صحيح' },
    { id: 'speed', name: 'البرق', icon: '⚡', desc: 'إجابة صحيحة في أقل من ثانية' },
    { id: 'king', name: 'ملك خَلّد', icon: '👑', desc: 'صل لـ 1000 نقطة' },
    { id: 'collector', name: 'جامع الأوسمة', icon: '🏆', desc: 'احصل على 5 أوسمة' },
    { id: 'faithful', name: 'الوفي', icon: '📅', desc: 'لعب 7 أيام متتالية' },
    { id: 'streak_10', name: 'لا تُوقفُه', icon: '🔥', desc: '10 إجابات صحيحة متتالية' },
  ]
};

// ─── Advanced Storage System ──────────────────────────────────
class StorageManager {
  constructor(prefix) {
    this.prefix = prefix;
    this.memory = {};
    this.loadAll();
  }
  
  key(k) { return this.prefix + k; }
  
  get(k, defaultValue = null) {
    if (this.memory[k]) return this.memory[k];
    try {
      const raw = localStorage.getItem(this.key(k));
      if (raw === null) return defaultValue;
      const val = JSON.parse(raw);
      this.memory[k] = val;
      return val;
    } catch (e) {
      console.warn(`Storage get error for ${k}:`, e);
      return defaultValue;
    }
  }
  
  set(k, v) {
    this.memory[k] = v;
    try {
      localStorage.setItem(this.key(k), JSON.stringify(v));
      return true;
    } catch (e) {
      console.warn(`Storage set error for ${k}:`, e);
      return false;
    }
  }
  
  remove(k) {
    delete this.memory[k];
    try {
      localStorage.removeItem(this.key(k));
      return true;
    } catch (e) {
      console.warn(`Storage remove error for ${k}:`, e);
      return false;
    }
  }
  
  clear() {
    this.memory = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith(this.prefix)) localStorage.removeItem(key);
      }
      return true;
    } catch (e) {
      console.warn('Storage clear error:', e);
      return false;
    }
  }
  
  loadAll() {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith(this.prefix)) {
          const k = key.slice(this.prefix.length);
          const v = JSON.parse(localStorage.getItem(key));
          this.memory[k] = v;
        }
      }
    } catch (e) {
      console.warn('Storage loadAll error:', e);
    }
  }
  
  export() {
    return { version: APP_CONFIG.version, timestamp: Date.now(), data: this.memory };
  }
  
  import(backup) {
    try {
      if (!backup.data) throw new Error('Invalid backup format');
      Object.entries(backup.data).forEach(([k, v]) => this.set(k, v));
      return true;
    } catch (e) {
      console.warn('Import error:', e);
      return false;
    }
  }
}

const storage = new StorageManager(APP_CONFIG.storagePrefix);

// ─── Player Statistics & Leaderboard System ───────────────────
class PlayerProfile {
  constructor(name) {
    this.name = name;
    this.id = this.generateId();
    this.createdAt = Date.now();
    this.stats = {
      totalGames: 0,
      totalScore: 0,
      totalQuestions: 0,
      correctAnswers: 0,
      streak: 0,
      maxStreak: 0,
      lastPlayedAt: null,
      gamesPlayed: {},
    };
    this.achievements = [];
    this.badges = [];
    this.difficulty = 'medium';
    this.lastUpdated = Date.now();
  }
  
  generateId() {
    return 'player_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
  
  addScore(amount) {
    this.stats.totalScore += amount;
    this.stats.streak++;
    if (this.stats.streak > this.stats.maxStreak) {
      this.stats.maxStreak = this.stats.streak;
    }
  }
  
  recordQuestion(isCorrect, timeMs = 0) {
    this.stats.totalQuestions++;
    if (isCorrect) {
      this.stats.correctAnswers++;
      if (timeMs < 1000) this.unlockAchievement('speed');
    } else {
      this.stats.streak = 0;
    }
    
    if (this.stats.correctAnswers % 10 === 0) {
      this.unlockAchievement('ten_games');
    }
    if (this.stats.maxStreak >= 10) {
      this.unlockAchievement('streak_10');
    }
    if (this.stats.totalScore >= 1000) {
      this.unlockAchievement('king');
    }
  }
  
  recordGame(gameId) {
    this.stats.totalGames++;
    this.stats.lastPlayedAt = Date.now();
    
    if (!this.stats.gamesPlayed[gameId]) {
      this.stats.gamesPlayed[gameId] = 0;
    }
    this.stats.gamesPlayed[gameId]++;
    
    if (this.stats.totalGames === 1) {
      this.unlockAchievement('first_game');
    }
    
    this.lastUpdated = Date.now();
  }
  
  unlockAchievement(id) {
    if (!this.achievements.includes(id)) {
      this.achievements.push(id);
      if (this.achievements.length >= 5) {
        this.unlockAchievement('collector');
      }
    }
  }
  
  getAccuracy() {
    if (this.stats.totalQuestions === 0) return 0;
    return Math.round((this.stats.correctAnswers / this.stats.totalQuestions) * 100);
  }
  
  toJSON() {
    return { ...this };
  }
  
  static fromJSON(data) {
    const p = new PlayerProfile(data.name);
    Object.assign(p, data);
    return p;
  }
}

// ─── Leaderboard Management ──────────────────────────────────
class LeaderboardManager {
  constructor() {
    this.players = this.loadPlayers();
    this.currentPlayer = this.loadCurrentPlayer();
  }
  
  loadPlayers() {
    const raw = storage.get('leaderboard', []);
    return raw.map(p => PlayerProfile.fromJSON(p));
  }
  
  savePlayers() {
    storage.set('leaderboard', this.players.map(p => p.toJSON()));
  }
  
  loadCurrentPlayer() {
    const raw = storage.get('current_player');
    if (!raw) {
      const newPlayer = new PlayerProfile('اللاعب');
      return newPlayer;
    }
    return PlayerProfile.fromJSON(raw);
  }
  
  setCurrentPlayer(name) {
    this.currentPlayer = new PlayerProfile(name);
    storage.set('current_player', this.currentPlayer.toJSON());
  }
  
  updateCurrentPlayer() {
    storage.set('current_player', this.currentPlayer.toJSON());
  }
  
  addPlayerToLeaderboard(player) {
    const existing = this.players.find(p => p.id === player.id);
    if (existing) {
      Object.assign(existing, player);
    } else {
      this.players.push(player);
    }
    this.players.sort((a, b) => b.stats.totalScore - a.stats.totalScore);
    this.savePlayers();
  }
  
  getTopPlayers(limit = 10) {
    return this.players.slice(0, limit);
  }
  
  getPlayerRank(playerId) {
    return this.players.findIndex(p => p.id === playerId) + 1;
  }
}

const leaderboard = new LeaderboardManager();

// ─── DOM utilities ────────────────────────────────────────────
const $ = id => document.getElementById(id);
const esc = s => String(s)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  .replace(/"/g,'&quot;').replace(/'/g,'&#39;');

const show = (id) => {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('on'));
  const el = $(id);
  if (el) {
    el.classList.add('on');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
};

// ─── Sound System ────────────────────────────────────────────
let audioContext = null;
let soundMuted = false;

function getAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioContext;
}

function playTone(frequency, duration, type = 'sine', volume = 0.18, delay = 0) {
  if (soundMuted) return;
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const startTime = ctx.currentTime + delay;
    
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, startTime);
    gain.gain.setValueAtTime(volume, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.02);
  } catch (e) {
    console.warn('Audio error:', e);
  }
}

const sounds = {
  click: () => playTone(640, 0.08, 'triangle', 0.15),
  success: () => { playTone(523, 0.16, 'triangle', 0.2); playTone(659, 0.16, 'triangle', 0.2, 0.08); },
  error: () => { playTone(220, 0.22, 'sawtooth', 0.13); playTone(160, 0.3, 'sawtooth', 0.13, 0.14); },
  win: () => [523,659,784,1046,784,1046,1318].forEach((f,i) => playTone(f, 0.22, 'triangle', 0.22, i*0.13)),
};

// ─── Toast Notification System ────────────────────────────────
let toastTimer = null;

function showToast(message, type = 'info', duration = 3500) {
  let el = $('_toast');
  if (!el) {
    el = document.createElement('div');
    el.id = '_toast';
    el.style.cssText = `
      position: fixed;
      bottom: 80px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 200;
      max-width: 340px;
      width: 90%;
      padding: 13px 20px;
      border-radius: 16px;
      font-weight: 800;
      font-size: 15px;
      text-align: center;
      backdrop-filter: blur(8px);
      transition: opacity 0.35s;
      pointer-events: none;
      font-family: Tajawal, sans-serif;
    `;
    document.body.appendChild(el);
  }
  
  const styles = {
    info:    { bg: '#1f1148', border: '#8b5cf677' },
    success: { bg: '#064e3b', border: '#34d39977' },
    warn:    { bg: '#451a03', border: '#fbbf2477' },
    error:   { bg: '#3b0764', border: '#f472b677' },
  };
  
  const style = styles[type] || styles.info;
  el.style.background = style.bg;
  el.style.border = `1px solid ${style.border}`;
  el.style.color = '#f3f0ff';
  el.style.opacity = '1';
  el.textContent = message;
  
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.style.opacity = '0';
  }, duration);
}

// ─── Confetti Animation ───────────────────────────────────────
function celebrate() {
  const colors = ['#22d3ee','#8b5cf6','#d946ef','#f472b6','#fbbf24','#34d399'];
  for (let i = 0; i < 120; i++) {
    const div = document.createElement('div');
    div.className = 'confetti';
    const s = 6 + Math.random() * 8;
    div.style.cssText = `
      left: ${Math.random() * 100}vw;
      width: ${s}px;
      height: ${s * 1.4}px;
      background: ${colors[i % colors.length]};
      animation-duration: ${2.4 + Math.random() * 2.4}s;
      animation-delay: ${Math.random() * 1.6}s;
    `;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 7000);
  }
}

// ─── Modal System ─────────────────────────────────────────────
function showModal(html) {
  const mbox = $('mbox');
  if (mbox) mbox.innerHTML = html;
  const modal = $('modal');
  if (modal) modal.classList.add('on');
}

function closeModal() {
  const modal = $('modal');
  if (modal) modal.classList.remove('on');
}

// Export for global use
window.leaderboard = leaderboard;
window.PlayerProfile = PlayerProfile;
window.sounds = sounds;
window.showToast = showToast;
window.showModal = showModal;
window.closeModal = closeModal;
window.celebrate = celebrate;
window.storage = storage;
