(function () {
  'use strict';

  const SAVE_KEY = 'pixelPartySave_v1';
  const DEFAULT_SAVE = {
    points: 240,
    rewardTokens: 0,
    streak: 0,
    lastCompletedDate: null,
    tasks: [],
    purchases: {},
    games: {
      wiki: { best: 0, plays: 0 },
      snack: { best: 0, plays: 0 },
      plane: { best: 0, plays: 0 },
      memory: { best: 0, plays: 0 }
    }
  };

  const SHOP_ITEMS = [
    {
      id: 'sparkle-sticker',
      name: 'Sparkle Sticker',
      icon: '✦',
      color: 'pink',
      tag: 'COSMETIC',
      price: 60,
      once: true,
      description: 'A tiny star sticker for your whole arcade identity.',
      effect: 'Adds a sparkle badge to every Pixel Party page.',
      message: 'Your arcade is officially shinier.'
    },
    {
      id: 'score-syrup',
      name: 'Score Syrup',
      icon: '↗',
      color: 'blue',
      tag: 'POWER-UP',
      price: 140,
      once: true,
      description: 'Sweet, sticky, and suspiciously good for scoreboards.',
      effect: 'Earn 1.25x the party points from every game.',
      message: 'Every future score just got a little juicier.'
    },
    {
      id: 'safety-clip',
      name: 'Safety Clip',
      icon: '♡',
      color: 'mint',
      tag: 'PLANE PERK',
      price: 180,
      once: true,
      description: 'Clips directly onto your paper plane. Very responsible.',
      effect: 'Start Paper Plane Panic with 4 lives instead of 3.',
      message: 'Your paper plane has a backup plan now.'
    },
    {
      id: 'rainbow-pass',
      name: 'Rainbow Pass',
      icon: '☼',
      color: 'yellow',
      tag: 'WORLD THEME',
      price: 220,
      once: true,
      description: 'A color pass for players who refuse to pick one vibe.',
      effect: 'Switches the whole arcade to a rainbow colorway.',
      message: 'Color mode activated. Extremely main character.'
    },
    {
      id: 'party-popper',
      name: 'Party Popper',
      icon: '✷',
      color: 'purple',
      tag: 'REPEATABLE',
      price: 45,
      repeatable: true,
      description: 'One tiny celebration for every time you do something cool.',
      effect: 'Adds one confetti pop to your closet for later.',
      message: 'A party popper joined your inventory.'
    }
  ];

  const $ = id => document.getElementById(id);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const random = (min, max) => Math.random() * (max - min) + min;
  const pick = array => array[Math.floor(Math.random() * array.length)];
  const formatScore = value => String(Math.max(0, Math.round(Number(value) || 0))).padStart(3, '0');
  const formatPoints = value => String(Math.max(0, Math.round(Number(value) || 0)));
  const dayKey = date => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
  const dayValue = key => {
    const parts = String(key || '').split('-').map(Number);
    return parts.length === 3 && parts.every(Number.isFinite) ? Date.UTC(parts[0], parts[1] - 1, parts[2]) : NaN;
  };

  function loadSave() {
    try {
      const parsed = JSON.parse(localStorage.getItem(SAVE_KEY) || '{}');
      return {
        points: Number.isFinite(Number(parsed.points)) ? Math.max(0, Number(parsed.points)) : DEFAULT_SAVE.points,
        rewardTokens: Math.max(0, Number(parsed.rewardTokens) || 0),
        streak: Math.max(0, Math.floor(Number(parsed.streak) || 0)),
        lastCompletedDate: typeof parsed.lastCompletedDate === 'string' ? parsed.lastCompletedDate : null,
        tasks: Array.isArray(parsed.tasks) ? parsed.tasks.filter(task => task && task.id && task.title).map(task => ({
          id: String(task.id),
          title: String(task.title).slice(0, 80),
          done: task.done === true,
          createdAt: Number(task.createdAt) || Date.now(),
          completedAt: task.completedAt ? Number(task.completedAt) : null
        })) : [],
        purchases: Object.assign({}, parsed.purchases || {}),
        games: Object.keys(DEFAULT_SAVE.games).reduce((games, id) => {
          const old = parsed.games && parsed.games[id] ? parsed.games[id] : {};
          games[id] = { best: Math.max(0, Number(old.best) || 0), plays: Math.max(0, Number(old.plays) || 0) };
          return games;
        }, {})
      };
    } catch (error) {
      return JSON.parse(JSON.stringify(DEFAULT_SAVE));
    }
  }

  const save = loadSave();

  const store = {
    get points() { return save.points; },
    get rewardTokens() { return save.rewardTokens; },
    get streak() { return save.streak; },
    get tasks() { return save.tasks; },
    has(id) { return Number(save.purchases[id]) > 0 || save.purchases[id] === true; },
    count(id) { return Number(save.purchases[id]) || (save.purchases[id] === true ? 1 : 0); },
    game(id) { return save.games[id] || { best: 0, plays: 0 }; },
    persist() {
      try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (error) {}
      applyPerks();
      updateWallet();
      window.dispatchEvent(new CustomEvent('pixelparty:updated'));
    },
    buy(id) {
      const item = SHOP_ITEMS.find(entry => entry.id === id);
      if (!item) return { ok: false, reason: 'missing' };
      if (item.once && this.has(id)) return { ok: false, reason: 'owned', item };
      if (save.points < item.price) return { ok: false, reason: 'points', item };
      save.points -= item.price;
      save.purchases[id] = item.repeatable ? this.count(id) + 1 : true;
      this.persist();
      return { ok: true, item };
    },
    consume(id) {
      const count = this.count(id);
      if (count < 1) return false;
      save.purchases[id] = count - 1;
      this.persist();
      return true;
    },
    addTask(title) {
      const cleanTitle = String(title || '').trim().slice(0, 80);
      if (!cleanTitle) return false;
      save.tasks.unshift({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, title: cleanTitle, done: false, createdAt: Date.now(), completedAt: null });
      this.persist();
      return true;
    },
    editTask(id, title) {
      const cleanTitle = String(title || '').trim().slice(0, 80);
      const task = save.tasks.find(entry => entry.id === id);
      if (!task || !cleanTitle) return false;
      task.title = cleanTitle;
      this.persist();
      return true;
    },
    completeTask(id) {
      const task = save.tasks.find(entry => entry.id === id);
      if (!task || task.done) return false;
      task.done = true;
      task.completedAt = Date.now();
      save.rewardTokens += 1;
      updateStreak();
      this.persist();
      return true;
    },
    deleteTask(id) {
      const before = save.tasks.length;
      save.tasks = save.tasks.filter(task => task.id !== id);
      if (save.tasks.length === before) return false;
      this.persist();
      return true;
    },
    consumeReward() {
      if (save.rewardTokens < 1) return false;
      save.rewardTokens -= 1;
      this.persist();
      return true;
    },
    award(gameId, baseScore) {
      const game = this.game(gameId);
      const raw = Math.max(0, Math.round(Number(baseScore) || 0));
      const multiplier = this.has('score-syrup') ? 1.25 : 1;
      const earned = Math.max(5, Math.round(raw * multiplier));
      const isNewBest = raw > game.best;
      game.best = Math.max(game.best, raw);
      game.plays += 1;
      save.points += earned;
      this.persist();
      return { earned, raw, multiplier, isNewBest };
    }
  };

  function updateStreak() {
    const today = dayKey(new Date());
    const todayValue = dayValue(today);
    const previousValue = dayValue(save.lastCompletedDate);
    const difference = todayValue - previousValue;
    if (!Number.isFinite(previousValue) || difference > 86400000 || difference < 0) save.streak = 1;
    else if (difference === 86400000) save.streak += 1;
    else save.streak = Math.max(1, save.streak);
    save.lastCompletedDate = today;
  }

  function applyPerks() {
    document.body.classList.toggle('rainbow-mode', store.has('rainbow-pass'));
    document.body.classList.toggle('sparkle-sticker', store.has('sparkle-sticker'));
  }

  function updateWallet() {
    document.querySelectorAll('.wallet-points').forEach(element => { element.textContent = formatPoints(store.points); });
    document.querySelectorAll('.reward-tokens').forEach(element => { element.textContent = formatPoints(store.rewardTokens); });
    document.querySelectorAll('.streak-count').forEach(element => { element.textContent = String(store.streak); });
    document.querySelectorAll('[data-best]').forEach(element => { element.textContent = `BEST ${formatScore(store.game(element.dataset.best).best)}`; });
  }

  function showToast(message, kind) {
    const stack = document.querySelector('.toast-stack');
    if (!stack) return;
    const toast = document.createElement('div');
    toast.className = `toast ${kind || ''}`;
    toast.textContent = message;
    stack.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
    while (stack.children.length > 3) stack.firstChild.remove();
  }

  function burstConfetti(amount) {
    const layer = document.createElement('div');
    layer.className = 'confetti-layer';
    for (let index = 0; index < (amount || 30); index++) {
      const bit = document.createElement('span');
      bit.className = 'confetti-bit';
      bit.style.left = `${random(2, 98)}%`;
      bit.style.animationDelay = `${random(0, .25)}s`;
      bit.style.transform = `rotate(${random(-20, 20)}deg)`;
      layer.appendChild(bit);
    }
    document.body.appendChild(layer);
    setTimeout(() => layer.remove(), 1650);
  }

  function initNavigation() {
    const toggle = document.querySelector('.nav-toggle');
    const nav = document.querySelector('.site-nav');
    if (!toggle || !nav) return;
    toggle.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
    });
    nav.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
      nav.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    }));
  }

  function initHome() {
    updateWallet();
    renderTasks();
    const form = $('task-form');
    const input = $('task-input');
    if (form && input) {
      form.addEventListener('submit', event => {
        event.preventDefault();
        if (!store.addTask(input.value)) return;
        input.value = '';
        renderTasks();
        showToast('Quest added. Tiny steps, huge plot.', 'good');
      });
    }
    const list = $('task-list');
    if (list) {
      list.addEventListener('click', event => {
        const complete = event.target.closest('[data-complete]');
        if (complete) {
          if (!store.completeTask(complete.dataset.complete)) return;
          renderTasks();
          burstConfetti(28);
          showToast(`Task complete. Round unlocked. ${store.streak}-day streak!`, 'good');
          return;
        }
        const edit = event.target.closest('[data-edit]');
        if (edit) {
          renderTasks(edit.dataset.edit);
          const editInput = list.querySelector('.task-edit-input');
          if (editInput) { editInput.focus(); editInput.select(); }
          return;
        }
        const cancelEdit = event.target.closest('[data-cancel-edit]');
        if (cancelEdit) {
          renderTasks();
          return;
        }
        const remove = event.target.closest('[data-delete]');
        if (remove) {
          store.deleteTask(remove.dataset.delete);
          renderTasks();
          showToast('Quest removed from the board.', '');
        }
      });
      list.addEventListener('submit', event => {
        const editForm = event.target.closest('[data-edit-form]');
        if (!editForm) return;
        event.preventDefault();
        const editInput = editForm.querySelector('.task-edit-input');
        if (!store.editTask(editForm.dataset.editForm, editInput.value)) {
          showToast('Give the task a title before saving.', 'bad');
          editInput.focus();
          return;
        }
        renderTasks();
        showToast('Task updated. Back to the board.', 'good');
      });
    }
    const focusButton = document.querySelector('.empty-focus');
    if (focusButton && input) focusButton.addEventListener('click', () => { input.focus(); });
  }

  function renderTasks(editingId) {
    const list = $('task-list');
    if (!list) return;
    const tasks = store.tasks.slice().sort((a, b) => Number(a.done) - Number(b.done) || b.createdAt - a.createdAt);
    const completed = tasks.filter(task => task.done).length;
    const total = tasks.length;
    if ($('task-count')) $('task-count').textContent = `${completed} / ${total}`;
    if ($('completed-task-count')) $('completed-task-count').textContent = completed;
    if ($('task-status-label')) $('task-status-label').textContent = total ? `${total} ${total === 1 ? 'QUEST' : 'QUESTS'} / ${completed} DONE` : 'NO QUESTS YET';
    const rating = $('productivity-rating');
    if (rating) {
      const label = completed >= 5 ? 'LEGENDARY' : completed >= 3 ? 'ON A ROLL' : completed ? 'NICE START' : 'WARMING UP';
      if (rating.firstChild) rating.firstChild.textContent = `${label} `;
    }
    const empty = $('empty-task-state');
    if (empty) empty.hidden = total > 0;
    list.innerHTML = tasks.map(task => `<li class="task-row${task.done ? ' is-done' : ''}">
      <button class="task-check" type="button" data-complete="${task.id}" aria-label="${task.done ? 'Completed' : 'Complete'} task: ${escapeHtml(task.title)}" ${task.done ? 'disabled' : ''}><span>${task.done ? '✓' : ''}</span></button>
      <div class="task-row-copy">${task.id === editingId ? `<form class="task-edit-form" data-edit-form="${task.id}"><input class="task-edit-input" data-edit-input="${task.id}" type="text" maxlength="80" value="${escapeHtml(task.title)}" aria-label="Edit task"><div class="task-edit-actions"><button class="task-edit-save" type="submit">Save</button><button class="task-edit-cancel" type="button" data-cancel-edit>Cancel</button></div></form>` : `<strong>${escapeHtml(task.title)}</strong><small>${task.done ? 'DONE / reward round added' : 'READY TO COMPLETE'}</small>`}</div>
      ${task.done ? '<a class="task-reward-link" href="#arcade">Play reward <span>→</span></a>' : '<span class="task-pending">IN PROGRESS</span>'}
      <div class="task-row-actions"><button class="task-edit" type="button" data-edit="${task.id}" aria-label="Edit task: ${escapeHtml(task.title)}">EDIT</button><button class="task-delete" type="button" data-delete="${task.id}" aria-label="Remove task">×</button></div>
    </li>`).join('');
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
  }

  function renderLoadout() {
    const list = $('loadout-list');
    if (!list) return;
    const owned = SHOP_ITEMS.filter(item => item.once && store.has(item.id));
    if (store.count('party-popper') > 0) owned.push(Object.assign({}, SHOP_ITEMS.find(item => item.id === 'party-popper'), { ownedCount: store.count('party-popper') }));
    if (!owned.length) {
      list.innerHTML = '<p class="empty-loadout">Nothing equipped yet. The shop is right above you.</p>';
      return;
    }
    list.innerHTML = owned.map(item => `<div class="loadout-item"><span>${item.icon}</span><div><strong>${item.name}${item.ownedCount ? ` x${item.ownedCount}` : ''}</strong><small>${item.effect}</small></div></div>`).join('');
  }

  function renderShop() {
    const grid = $('shop-grid');
    if (!grid) return;
    grid.innerHTML = SHOP_ITEMS.map(item => {
      const owned = item.once && store.has(item.id);
      const count = store.count(item.id);
      const buttonText = owned ? 'Owned ✓' : item.repeatable ? `Buy · ${item.price} pts` : `Buy · ${item.price} pts`;
      return `<article class="shop-item item-${item.color}${owned ? ' owned' : ''}">
        <div class="item-visual"><span class="item-icon">${item.icon}</span><span class="item-tag">${item.tag}${item.repeatable && count ? ` · ${count} READY` : ''}</span></div>
        <div class="shop-item-body"><h3>${item.name}</h3><p>${item.description}</p><div class="item-effect">${item.effect}</div><button class="buy-item${owned ? ' owned' : ''}${item.repeatable ? ' repeatable' : ''}" type="button" data-buy="${item.id}" ${owned ? 'disabled' : ''}>${buttonText}</button></div>
      </article>`;
    }).join('');
    const ownedCount = SHOP_ITEMS.filter(item => item.once && store.has(item.id)).length;
    if ($('owned-count')) $('owned-count').textContent = `${ownedCount} / 4 perks`;
    if ($('party-popper-station')) $('party-popper-station').hidden = store.count('party-popper') < 1;
    if ($('popper-count')) $('popper-count').textContent = store.count('party-popper');
    renderLoadout();
  }

  function initShop() {
    renderShop();
    const grid = $('shop-grid');
    grid.addEventListener('click', event => {
      const button = event.target.closest('[data-buy]');
      if (!button) return;
      const result = store.buy(button.dataset.buy);
      if (!result.ok) {
        showToast(result.reason === 'points' ? 'Not enough points yet. Go play a round!' : 'That perk is already in your closet.', 'bad');
        return;
      }
      showToast(`${result.item.name} unlocked! ${result.item.message}`, 'good');
      burstConfetti(34);
      renderShop();
    });
    const popButton = $('pop-party');
    if (popButton) {
      popButton.addEventListener('click', () => {
        if (!store.consume('party-popper')) return;
        burstConfetti(42);
        showToast('Tiny victory lap deployed.', 'good');
        renderShop();
      });
    }
  }

  function initGame(gameId) {
    const canvas = $('game-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const WIDTH = canvas.width;
    const HEIGHT = canvas.height;
    const META = {
      wiki: { duration: 40 },
      snack: { duration: 30 },
      plane: { duration: 35 },
      memory: { duration: 45 }
    }[gameId];
    const WIKI_NODES = {
      start: {
        label: 'START PAGE',
        title: 'I have one important task.',
        note: 'Pick a link. Avoid the rabbit holes.',
        links: [
          { label: 'Choose one task', hint: 'make it tiny', next: 'choose', points: 30 },
          { label: 'Open more tabs', hint: 'classic detour', next: 'tabs', points: 10 },
          { label: 'Check notifications', hint: 'very dangerous', next: 'notifications', points: 8 }
        ]
      },
      choose: {
        label: 'TASK PAGE',
        title: 'The task is small enough now.',
        note: 'Keep moving through the useful links.',
        links: [
          { label: 'Set a focus timer', hint: 'good next step', next: 'focus', points: 35 },
          { label: 'Do the first step', hint: 'skip the drama', next: 'action', points: 25 },
          { label: 'Open more tabs', hint: 'one tiny detour', next: 'tabs', points: 5 }
        ]
      },
      tabs: {
        label: 'DISTRACTION PAGE',
        title: 'There are seventeen tabs open.',
        note: 'The work path is still one click away.',
        links: [
          { label: 'Close the tabs', hint: 'return to the task', next: 'choose', points: 18 },
          { label: 'Check notifications', hint: 'another detour', next: 'notifications', points: 6 },
          { label: 'Find focus mode', hint: 'back on track', next: 'focus', points: 12 }
        ]
      },
      notifications: {
        label: 'DISTRACTION PAGE',
        title: 'Nothing here needs an answer yet.',
        note: 'Choose the link that gets you back to work.',
        links: [
          { label: 'Turn on focus mode', hint: 'quiet the noise', next: 'focus', points: 22 },
          { label: 'Pick the tiny step', hint: 'back to the board', next: 'choose', points: 16 },
          { label: 'Do it anyway', hint: 'brave route', next: 'action', points: 18 }
        ]
      },
      focus: {
        label: 'FOCUS PAGE',
        title: 'The timer is running.',
        note: 'One useful action finishes the race.',
        links: [
          { label: 'Do the first step', hint: 'make the progress', next: 'action', points: 38 },
          { label: 'Pick a smaller step', hint: 'make it easier', next: 'choose', points: 22 },
          { label: 'Check notifications', hint: 'do not do it', next: 'notifications', points: 8 }
        ]
      },
      action: {
        label: 'ACTION PAGE',
        title: 'The task is almost finished.',
        note: 'Take the final link and claim your break.',
        links: [
          { label: 'Mark task done', hint: 'finish the race', next: 'done', points: 60 },
          { label: 'Take one more step', hint: 'stay in motion', next: 'focus', points: 25 },
          { label: 'Re-plan everything', hint: 'tiny detour', next: 'choose', points: 18 }
        ]
      },
      done: {
        label: 'FINISH LINE',
        title: 'Task complete!',
        note: 'You made it through the work path.',
        links: []
      }
    };
    const keys = { left: false, right: false };
    let state = makeGameState(gameId, META.duration);
    let running = false;
    let raf = 0;
    let lastFrame = 0;
    let pendingTimer = null;
    let rewardClaimed = false;

    function makeGameState(id, duration) {
      if (id === 'wiki') return { id, elapsed: 0, timeLeft: duration, score: 0, node: 'start', hops: 0, flash: 0 };
      if (id === 'snack') return { id, elapsed: 0, timeLeft: duration, score: 0, combo: 0, spawnTimer: 0, flash: 0, targets: [] };
      if (id === 'plane') return { id, elapsed: 0, timeLeft: duration, score: 0, playerX: WIDTH / 2, targetX: WIDTH / 2, obstacles: [], stars: [], spawnTimer: .1, starTimer: .8, lives: store.has('safety-clip') ? 4 : 3, invuln: 0, flash: 0 };
      return { id, elapsed: 0, timeLeft: duration, score: 0, cards: makeDeck(), selected: [], moves: 0, lock: false, flash: 0 };
    }

    function makeDeck() {
      const symbols = ['✓', '!', '→', '+', '*', '#'];
      const deck = symbols.concat(symbols).map((symbol, index) => ({ symbol, index, flipped: false, matched: false }));
      for (let index = deck.length - 1; index > 0; index--) {
        const swap = Math.floor(Math.random() * (index + 1));
        [deck[index], deck[swap]] = [deck[swap], deck[index]];
      }
      return deck;
    }

    function updateHud() {
      $('game-score').textContent = formatScore(state.score);
      $('game-time').textContent = `00:${String(Math.max(0, Math.ceil(state.timeLeft))).padStart(2, '0')}`;
      $('game-best').textContent = formatScore(store.game(gameId).best);
      if (gameId === 'plane') $('game-instructions').textContent = `${state.lives} ${state.lives === 1 ? 'life' : 'lives'} left. Use arrows, A / D, or drag across the stage.`;
    }

    function renderActivePerks() {
      const target = $('active-perks');
      if (!target) return;
      const perks = [];
      if (store.has('score-syrup')) perks.push('1.25x points');
      if (gameId === 'plane' && store.has('safety-clip')) perks.push('4 lives');
      if (store.has('rainbow-pass')) perks.push('rainbow mode');
      target.innerHTML = perks.map(perk => `<span class="perk-badge">✦ ${perk}</span>`).join('');
    }

    function renderRewardGate() {
      const gate = $('reward-gate');
      const start = $('game-start');
      const unlocked = store.rewardTokens > 0 || rewardClaimed;
      if (gate) gate.hidden = unlocked;
      if (start) {
        start.disabled = !unlocked;
        start.innerHTML = unlocked ? 'Play reward round <span>→</span>' : 'Complete a task first <span>↗</span>';
      }
      $('game-status').textContent = unlocked ? 'READY TO PLAY' : 'LOCKED / TASK REQUIRED';
    }

    function startGame() {
      clearTimeout(pendingTimer);
      pendingTimer = null;
      if (!rewardClaimed) {
        if (!store.consumeReward()) {
          renderRewardGate();
          showToast('Complete a task to unlock a reward round.', 'bad');
          return;
        }
        rewardClaimed = true;
      }
      state = makeGameState(gameId, META.duration);
      running = true;
      lastFrame = performance.now();
      $('game-result').hidden = true;
      $('game-start').innerHTML = 'Restart round <span>↻</span>';
      $('game-status').textContent = 'IN SESSION';
      renderRewardGate();
      renderActivePerks();
      updateHud();
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(loop);
    }

    function loop(now) {
      if (!running) return;
      const dt = Math.min(.05, (now - lastFrame) / 1000);
      lastFrame = now;
      update(dt);
      draw();
      updateHud();
      if (running) raf = requestAnimationFrame(loop);
    }

    function update(dt) {
      state.elapsed += dt;
      state.timeLeft = Math.max(0, META.duration - state.elapsed);
      if (gameId === 'snack') updateSnack(dt);
      else if (gameId === 'plane') updatePlane(dt);
      else if (gameId === 'memory') updateMemory();
      else updateWiki();
      state.flash = Math.max(0, state.flash - dt * 2.8);
      if (state.timeLeft <= 0 && running) finishGame('time');
    }

    function updateSnack(dt) {
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0 && state.targets.length < 6) { spawnSnack(); state.spawnTimer = random(.5, .9); }
      state.targets.forEach(target => { target.life -= dt; target.phase += dt; });
      const before = state.targets.length;
      state.targets = state.targets.filter(target => target.life > 0);
      if (before !== state.targets.length) state.combo = 0;
    }

    function spawnSnack() {
      const target = { x: random(85, WIDTH - 85), y: random(140, HEIGHT - 72), r: random(34, 46), icon: pick(['✓', '!', '→', '+', '☑', '*']), color: pick(['#ffe273', '#bda5ff', '#93ddff', '#fffdfb']), life: random(2.2, 3.3), phase: random(0, 6) };
      if (state.targets.some(existing => Math.hypot(existing.x - target.x, existing.y - target.y) < 85)) { target.x = random(85, WIDTH - 85); target.y = random(140, HEIGHT - 72); }
      state.targets.push(target);
    }

    function updatePlane(dt) {
      const direction = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
      if (direction) state.playerX += direction * 370 * dt;
      else state.playerX += (state.targetX - state.playerX) * Math.min(1, dt * 8);
      state.playerX = clamp(state.playerX, 45, WIDTH - 45);
      state.invuln = Math.max(0, state.invuln - dt);
      state.spawnTimer -= dt; state.starTimer -= dt;
      if (state.spawnTimer <= 0) { state.obstacles.push({ x: random(45, WIDTH - 45), y: -40, w: random(28, 54), h: random(75, 120), speed: random(180, 265), tilt: random(-.35, .35) }); state.spawnTimer = random(.48, .78); }
      if (state.starTimer <= 0) { state.stars.push({ x: random(40, WIDTH - 40), y: -30, r: 15, speed: random(150, 220), phase: random(0, 6) }); state.starTimer = random(1.2, 1.9); }
      state.obstacles.forEach(obstacle => { obstacle.y += obstacle.speed * dt; });
      state.stars.forEach(star => { star.y += star.speed * dt; star.phase += dt * 4; });
      const player = { x: state.playerX, y: HEIGHT - 74, w: 34, h: 30 };
      state.obstacles = state.obstacles.filter(obstacle => {
        if (obstacle.y > HEIGHT + 80) return false;
        if (state.invuln <= 0 && rectHit(player, { x: obstacle.x - obstacle.w / 2, y: obstacle.y - obstacle.h / 2, w: obstacle.w, h: obstacle.h })) {
          state.lives -= 1; state.invuln = 1.25; state.flash = 1; state.score = Math.max(0, state.score - 15);
          if (state.lives <= 0) finishGame('crash');
          return false;
        }
        return true;
      });
      state.stars = state.stars.filter(star => {
        if (star.y > HEIGHT + 40) return false;
        if (Math.hypot(star.x - state.playerX, star.y - (HEIGHT - 74)) < 34) { state.score += 25; state.flash = .65; return false; }
        return true;
      });
    }

    function rectHit(a, b) { return Math.abs(a.x - (b.x + b.w / 2)) < a.w / 2 + b.w / 2 && Math.abs(a.y - (b.y + b.h / 2)) < a.h / 2 + b.h / 2; }

    function updateMemory() { if (state.cards.every(card => card.matched)) finishGame('cleared'); }

    function updateWiki() {
      if (state.node === 'done') finishGame('cleared');
    }

    function pointerPosition(event) {
      const rect = canvas.getBoundingClientRect();
      return { x: (event.clientX - rect.left) * WIDTH / rect.width, y: (event.clientY - rect.top) * HEIGHT / rect.height };
    }

    function handlePointer(event) {
      if (!running) { if ($('game-result').hidden) startGame(); return; }
      const point = pointerPosition(event);
      if (gameId === 'snack') clickSnack(point.x, point.y);
      else if (gameId === 'plane') state.targetX = point.x;
      else if (gameId === 'memory') clickMemory(point.x, point.y);
      else clickWiki(point.x, point.y);
    }

    function handleMove(event) { if (running && gameId === 'plane') state.targetX = pointerPosition(event).x; }

    function clickSnack(x, y) {
      for (let index = state.targets.length - 1; index >= 0; index--) {
        const target = state.targets[index];
        if (Math.hypot(x - target.x, y - target.y) <= target.r + 10) {
          state.targets.splice(index, 1); state.combo += 1; state.score += 10 + Math.min(30, (state.combo - 1) * 2); state.flash = 1; spawnSnack(); return;
        }
      }
      state.combo = 0;
    }

    function wikiOptionAt(x, y) {
      const optionWidth = 245, optionHeight = 112, gap = 15, startX = 93, startY = 317;
      const node = WIKI_NODES[state.node];
      if (!node) return -1;
      for (let index = 0; index < node.links.length; index++) {
        const left = startX + index * (optionWidth + gap);
        if (x >= left && x <= left + optionWidth && y >= startY && y <= startY + optionHeight) return index;
      }
      return -1;
    }

    function clickWiki(x, y) {
      const index = wikiOptionAt(x, y);
      const node = WIKI_NODES[state.node];
      if (index < 0 || !node || !node.links[index]) return;
      const link = node.links[index];
      state.node = link.next;
      state.hops += 1;
      state.score += link.points;
      state.flash = 1;
      if (state.node === 'done') finishGame('cleared');
    }

    function cardAt(x, y) {
      const cardWidth = 150, cardHeight = 112, gap = 18, startX = 129, startY = 132;
      for (let index = 0; index < state.cards.length; index++) {
        const column = index % 4, row = Math.floor(index / 4), left = startX + column * (cardWidth + gap), top = startY + row * (cardHeight + gap);
        if (x >= left && x <= left + cardWidth && y >= top && y <= top + cardHeight) return index;
      }
      return -1;
    }

    function clickMemory(x, y) {
      if (state.lock) return;
      const index = cardAt(x, y);
      if (index < 0) return;
      const card = state.cards[index];
      if (card.flipped || card.matched) return;
      card.flipped = true; state.selected.push(index);
      if (state.selected.length < 2) return;
      state.moves += 1; state.lock = true;
      const first = state.cards[state.selected[0]], second = state.cards[state.selected[1]];
      if (first.symbol === second.symbol) {
        pendingTimer = setTimeout(() => { first.matched = true; second.matched = true; state.score += 100; state.selected = []; state.lock = false; pendingTimer = null; state.flash = 1; if (state.cards.every(item => item.matched)) finishGame('cleared'); }, 330);
      } else {
        pendingTimer = setTimeout(() => { first.flipped = false; second.flipped = false; state.score = Math.max(0, state.score - 10); state.selected = []; state.lock = false; pendingTimer = null; }, 690);
      }
    }

    function finishGame(reason) {
      if (!running) return;
      running = false;
      cancelAnimationFrame(raf);
      clearTimeout(pendingTimer); pendingTimer = null;
      const result = store.award(gameId, state.score);
      $('game-status').textContent = reason === 'cleared' ? 'BOARD CLEARED' : 'ROUND OVER';
      $('game-start').innerHTML = 'Play again <span>↻</span>';
      $('result-badge').textContent = result.isNewBest && result.raw > 0 ? 'NEW BEST' : reason === 'cleared' ? 'BOARD CLEARED' : 'ROUND OVER';
      $('result-title').textContent = gameId === 'wiki'
        ? (reason === 'cleared' ? 'You got there.' : 'Race paused.')
        : reason === 'cleared' ? 'Clean sweep.' : reason === 'crash' ? 'Paper down.' : gameId === 'snack' ? 'Nice task run.' : 'Nice run.';
      $('result-copy').textContent = resultMessage(reason, result.raw);
      $('result-points').textContent = `+${formatPoints(result.earned)}`;
      $('game-result').hidden = false;
      rewardClaimed = false;
      renderRewardGate();
      updateHud();
      renderActivePerks();
      burstConfetti(reason === 'cleared' ? 31 : 17);
    }

    function resultMessage(reason, rawScore) {
      if (gameId === 'wiki') return reason === 'cleared' ? `Reached DONE in ${state.hops} hops. The shortest path was yours.` : `You made ${state.hops} useful hops before the timer ran out.`;
      if (gameId === 'snack') return `${state.combo > 2 ? `${state.combo}x combo finish. ` : ''}You cleared ${formatPoints(rawScore)} points of tiny work.`;
      if (gameId === 'plane') return reason === 'crash' ? `Three distractions got through. Still a respectable focus run at ${formatPoints(rawScore)} points.` : 'No distraction can stop you from trying one more focus run.';
      return reason === 'cleared' ? `All six pairs found in ${state.moves} moves. Suspiciously sharp.` : `The cards stayed mysterious after ${state.moves} moves.`;
    }

    function roundedRect(x, y, width, height, radius) {
      const r = Math.min(radius, width / 2, height / 2);
      ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + width, y, x + width, y + height, r); ctx.arcTo(x + width, y + height, x, y + height, r); ctx.arcTo(x, y + height, x, y, r); ctx.arcTo(x, y, x + width, y, r); ctx.closePath();
    }

    function canvasText(text, x, y, size, color, align, display) {
      ctx.fillStyle = color; ctx.font = `${display ? '900' : '700'} ${size}px ${display ? 'Arial Rounded MT Bold, Trebuchet MS, sans-serif' : 'system-ui, sans-serif'}`; ctx.textAlign = align || 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText(text, x, y);
    }

    function canvasLabel(text, x, y, color) { ctx.fillStyle = color; ctx.font = '900 10px Courier New, monospace'; ctx.fillText(text, x, y); }

    function drawHeader(label, color) { canvasLabel(label, 44, 47, color); canvasText(`00:${String(Math.max(0, Math.ceil(state.timeLeft))).padStart(2, '0')}`, WIDTH - 44, 49, 22, color, 'right', true); ctx.fillStyle = 'rgba(41,30,69,.2)'; ctx.fillRect(43, 62, WIDTH - 86, 2); }

    function draw() {
      ctx.clearRect(0, 0, WIDTH, HEIGHT);
      if (gameId === 'wiki') drawWiki();
      else if (gameId === 'snack') drawSnack();
      else if (gameId === 'plane') drawPlane();
      else drawMemory();
    }

    function drawSnack() {
      ctx.fillStyle = '#fff2e5'; ctx.fillRect(0, 0, WIDTH, HEIGHT); ctx.globalAlpha = .18; ctx.fillStyle = '#291e45';
      for (let x = 0; x < WIDTH; x += 32) ctx.fillRect(x, 0, 1, HEIGHT);
      for (let y = 0; y < HEIGHT; y += 32) ctx.fillRect(0, y, WIDTH, 1);
      ctx.globalAlpha = 1; ctx.fillStyle = '#ff7fb9'; ctx.beginPath(); ctx.arc(782, 62, 84, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#a4f2d0'; ctx.beginPath(); ctx.arc(82, 498, 65, 0, Math.PI * 2); ctx.fill();
      drawHeader('TASK RADAR / TAP THE NEXT STEP', '#291e45'); canvasText('TAP THE TASKS', WIDTH / 2, 102, 24, '#291e45', 'center', true); canvasText('chain tiny wins for extra points', WIDTH / 2, 124, 12, '#675e80', 'center');
      state.targets.forEach(target => { const bob = Math.sin(target.phase * 3) * 3; ctx.save(); ctx.translate(target.x, target.y + bob); ctx.globalAlpha = clamp(target.life, 0, 1); ctx.fillStyle = 'rgba(41,30,69,.2)'; ctx.beginPath(); ctx.ellipse(5, target.r + 8, target.r * .8, 9, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = target.color; ctx.strokeStyle = '#291e45'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, target.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.font = `${Math.round(target.r * .9)}px "Apple Color Emoji", "Segoe UI Emoji", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(target.icon, 0, 2); ctx.strokeStyle = 'rgba(41,30,69,.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, target.r + 10, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp(target.life / 3.3, 0, 1)); ctx.stroke(); ctx.restore(); });
      canvasText(state.combo > 1 ? `${state.combo}x COMBO` : 'KEEP LOOKING', WIDTH / 2, HEIGHT - 37, 16, state.combo > 1 ? '#f25598' : '#675e80', 'center', true); if (state.flash > .55) drawFlash('#ff7fb9');
    }

    function drawPlane() {
      ctx.fillStyle = '#e1f6ff'; ctx.fillRect(0, 0, WIDTH, HEIGHT); ctx.strokeStyle = 'rgba(78,140,168,.22)'; ctx.lineWidth = 1; for (let y = 90; y < HEIGHT; y += 38) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WIDTH, y); ctx.stroke(); } ctx.fillStyle = 'rgba(255,253,251,.82)'; ctx.fillRect(0, 0, 54, HEIGHT); ctx.fillStyle = '#ff7fb9'; ctx.fillRect(54, 0, 2, HEIGHT); drawHeader('FOCUS FLOW / AVOID DISTRACTIONS', '#291e45');
      state.stars.forEach(star => drawPlaneStar(star.x, star.y, star.r, star.phase)); state.obstacles.forEach(drawObstacle); drawPlanePlayer(); for (let index = 0; index < 4; index++) { ctx.globalAlpha = index < state.lives ? 1 : .18; ctx.fillStyle = '#f25598'; ctx.beginPath(); ctx.arc(WIDTH - 52 - index * 22, 88, 7, 0, Math.PI * 2); ctx.fill(); } ctx.globalAlpha = 1; canvasLabel('LIVES', WIDTH - 137, 91, '#675e80'); canvasText('steer through distractions', WIDTH / 2, HEIGHT - 30, 12, '#4e8ca8', 'center'); if (state.flash > .55) drawFlash('#ff7fb9');
    }

    function drawPlaneStar(x, y, radius, phase) { ctx.save(); ctx.translate(x, y); ctx.rotate(phase * .2); ctx.fillStyle = '#ffe273'; ctx.strokeStyle = '#291e45'; ctx.lineWidth = 2; ctx.beginPath(); for (let index = 0; index < 10; index++) { const angle = -Math.PI / 2 + index * Math.PI / 5; const size = index % 2 ? radius * .43 : radius; ctx.lineTo(Math.cos(angle) * size, Math.sin(angle) * size); } ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore(); }

    function drawObstacle(obstacle) { ctx.save(); ctx.translate(obstacle.x, obstacle.y); ctx.rotate(obstacle.tilt); ctx.fillStyle = 'rgba(41,30,69,.16)'; ctx.fillRect(-obstacle.w / 2 + 5, -obstacle.h / 2 + 6, obstacle.w, obstacle.h); ctx.fillStyle = '#f25598'; ctx.strokeStyle = '#291e45'; ctx.lineWidth = 3; roundedRect(-obstacle.w / 2, -obstacle.h / 2, obstacle.w, obstacle.h, 7); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#fff2e5'; ctx.fillRect(-obstacle.w / 2 + 5, -obstacle.h / 2 + 14, obstacle.w - 10, 8); ctx.fillStyle = '#291e45'; ctx.fillRect(-obstacle.w / 2 + 7, obstacle.h / 2 - 19, obstacle.w - 14, 5); ctx.restore(); }

    function drawPlanePlayer() { const y = HEIGHT - 74; if (state.invuln > 0 && Math.floor(state.invuln * 12) % 2 === 0) return; ctx.save(); ctx.translate(state.playerX, y); ctx.rotate(-.1); ctx.fillStyle = 'rgba(41,30,69,.2)'; ctx.beginPath(); ctx.ellipse(3, 26, 37, 7, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#fffdfb'; ctx.strokeStyle = '#291e45'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-47, 11); ctx.lineTo(46, -27); ctx.lineTo(16, 15); ctx.lineTo(-3, 7); ctx.lineTo(-25, 26); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.strokeStyle = '#4e8ca8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-3, 7); ctx.lineTo(46, -27); ctx.moveTo(-3, 7); ctx.lineTo(16, 15); ctx.stroke(); ctx.restore(); }

    function drawMemory() { ctx.fillStyle = '#f3edff'; ctx.fillRect(0, 0, WIDTH, HEIGHT); ctx.fillStyle = 'rgba(41,30,69,.12)'; for (let x = 0; x < WIDTH; x += 35) ctx.fillRect(x, 0, 1, HEIGHT); drawHeader('PRIORITY FILES / FIND THE TWINS', '#291e45'); canvasText('FIND THE PAIRS', WIDTH / 2, 100, 24, '#291e45', 'center', true); canvasText(`${state.moves} MOVES`, WIDTH / 2, 122, 10, '#675e80', 'center'); const cardWidth = 150, cardHeight = 112, gap = 18, startX = 129, startY = 132; state.cards.forEach((card, index) => { const column = index % 4, row = Math.floor(index / 4), x = startX + column * (cardWidth + gap), y = startY + row * (cardHeight + gap), open = card.flipped || card.matched; ctx.save(); ctx.fillStyle = 'rgba(41,30,69,.17)'; roundedRect(x + 5, y + 6, cardWidth, cardHeight, 12); ctx.fill(); ctx.fillStyle = open ? (card.matched ? '#a4f2d0' : '#fffdfb') : '#291e45'; ctx.strokeStyle = '#291e45'; ctx.lineWidth = 3; roundedRect(x, y, cardWidth, cardHeight, 12); ctx.fill(); ctx.stroke(); if (open) { canvasText(card.symbol, x + cardWidth / 2, y + 72, 49, card.matched ? '#291e45' : '#f25598', 'center', true); if (card.matched) canvasLabel('MATCH', x + 12, y + 23, '#291e45'); } else { ctx.strokeStyle = '#ffe273'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 24, y + 25); ctx.lineTo(x + cardWidth - 24, y + cardHeight - 25); ctx.moveTo(x + cardWidth - 24, y + 25); ctx.lineTo(x + 24, y + cardHeight - 25); ctx.stroke(); canvasText('?', x + cardWidth / 2, y + 76, 48, '#fffdfb', 'center', true); } ctx.restore(); }); canvasText('two work cards / one answer', WIDTH / 2, HEIGHT - 28, 12, '#675e80', 'center'); if (state.flash > .55) drawFlash('#a4f2d0'); }

    function drawWiki() {
      const node = WIKI_NODES[state.node] || WIKI_NODES.start;
      ctx.fillStyle = '#f3edff'; ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.fillStyle = 'rgba(41,30,69,.11)';
      for (let x = 0; x < WIDTH; x += 35) ctx.fillRect(x, 0, 1, HEIGHT);
      for (let y = 86; y < HEIGHT; y += 38) ctx.fillRect(0, y, WIDTH, 1);
      drawHeader('TASK RACE / LINK HOP', '#291e45');
      canvasText('GET FROM STUCK TO DONE', WIDTH / 2, 102, 24, '#291e45', 'center', true);
      canvasText(`${state.hops} HOPS / CHOOSE A USEFUL LINK`, WIDTH / 2, 124, 10, '#675e80', 'center');

      roundedRect(75, 151, 750, 126, 16);
      ctx.fillStyle = '#fffdfb'; ctx.fill();
      ctx.strokeStyle = '#291e45'; ctx.lineWidth = 3; ctx.stroke();
      canvasLabel(node.label, 101, 180, '#f25598');
      canvasText(node.title, 101, 218, 24, '#291e45', 'left', true);
      canvasText(node.note, 101, 248, 13, '#675e80', 'left');
      ctx.fillStyle = '#ffe273'; ctx.beginPath(); ctx.arc(777, 211, 28, 0, Math.PI * 2); ctx.fill();
      canvasText(state.node === 'done' ? '✓' : '→', 777, 222, 28, '#291e45', 'center', true);

      node.links.forEach((link, index) => drawWikiOption(link, index));
      canvasText('choose the next page before time runs out', WIDTH / 2, HEIGHT - 28, 12, '#675e80', 'center');
      if (state.flash > .55) drawFlash('#b4f2d1');
    }

    function drawWikiOption(link, index) {
      const optionWidth = 245, optionHeight = 112, gap = 15, left = 93 + index * (optionWidth + gap), top = 317;
      const fills = ['#ff83b9', '#8bdcff', '#b4f2d1'];
      roundedRect(left, top, optionWidth, optionHeight, 13);
      ctx.fillStyle = fills[index % fills.length]; ctx.fill();
      ctx.strokeStyle = '#291e45'; ctx.lineWidth = 3; ctx.stroke();
      canvasLabel(`LINK 0${index + 1}`, left + 16, top + 24, '#291e45');
      canvasText(link.label, left + 16, top + 62, 17, '#291e45', 'left', true);
      canvasText(link.hint, left + 16, top + 86, 11, '#675e80', 'left');
      canvasText('→', left + optionWidth - 24, top + 30, 20, '#f25598', 'center', true);
    }

    function drawFlash(color) { ctx.save(); ctx.globalAlpha = .13 * state.flash; ctx.fillStyle = color; ctx.fillRect(0, 0, WIDTH, HEIGHT); ctx.restore(); }

    $('game-start').addEventListener('click', startGame);
    $('result-replay').addEventListener('click', startGame);
    canvas.addEventListener('pointerdown', handlePointer);
    canvas.addEventListener('pointermove', handleMove);
    canvas.addEventListener('contextmenu', event => event.preventDefault());
    document.querySelectorAll('[data-direction]').forEach(button => {
      const direction = button.dataset.direction;
      const press = event => { event.preventDefault(); keys[direction] = true; };
      const release = event => { event.preventDefault(); keys[direction] = false; };
      button.addEventListener('pointerdown', press); button.addEventListener('pointerup', release); button.addEventListener('pointercancel', release); button.addEventListener('pointerleave', release);
    });
    window.addEventListener('keydown', event => {
      if (event.key === 'Escape') { window.location.href = '../index.html#arcade'; return; }
      if (event.key === ' ' && !running && $('game-result').hidden) { event.preventDefault(); startGame(); return; }
      if (gameId !== 'plane') return;
      if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') { event.preventDefault(); keys.left = true; }
      if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') { event.preventDefault(); keys.right = true; }
    });
    window.addEventListener('keyup', event => { if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') keys.left = false; if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') keys.right = false; });
    window.addEventListener('blur', () => { keys.left = false; keys.right = false; });
    renderActivePerks(); updateHud(); renderRewardGate(); draw();
  }

  applyPerks();
  updateWallet();
  initNavigation();
  const page = document.body.dataset.page;
  if (page === 'home') initHome();
  if (page === 'shop') initShop();
  if (page === 'game') initGame(document.body.dataset.game);
})();
