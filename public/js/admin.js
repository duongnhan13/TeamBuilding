// Admin / MC Controller Logic (Dedicated to Host & MC)
document.addEventListener('DOMContentLoaded', () => {
  const socket = io();

  let adminState = {
    mode: 'LOBBY',
    players: [],
    squizzQuestions: [],
    qaQuestions: [],
    members: [],
    squizzIndex: 0,
    qaIndex: 0,
    isSquizzLocked: false,
    timerLimit: 30
  };

  // Elements
  const elPlayerCount = document.getElementById('admin-player-count');
  const elModeBadge = document.getElementById('admin-mode-badge');
  const elCurrentQPill = document.getElementById('admin-current-q-pill');
  const elJumpSelect = document.getElementById('admin-jump-select');
  const elTargetBadge = document.getElementById('admin-target-badge');
  const elQText = document.getElementById('admin-q-text');
  const elMcVoice = document.getElementById('admin-mc-voice');
  const elPunishment = document.getElementById('admin-punishment');
  const elTimerDisplay = document.getElementById('admin-timer-display');
  const elVotedCount = document.getElementById('admin-voted-count');
  const elTotalCount = document.getElementById('admin-total-count');
  const elSecretTally = document.getElementById('admin-secret-tally');
  const btnToggleLock = document.getElementById('btn-toggle-lock');

  // Connect as Admin
  socket.emit('admin_join');

  socket.on('host_init', (data) => {
    adminState.mode = data.mode;
    adminState.players = data.players || [];
    adminState.squizzQuestions = data.squizzQuestions || [];
    adminState.qaQuestions = data.qaQuestions || [];
    adminState.members = data.membersList || [];

    updatePlayerCount(data.totalPlayers || 0);
    updateModeBadge(data.mode);
    populateJumpSelect();

    if (data.mode === 'SQUIZZ' && data.squizz && data.squizz.question) {
      updateSquizzTeleprompter(data.squizz.question, data.squizz.currentIndex, data.squizzQuestions.length);
      if (data.squizz.tally) updateSecretTally(data.squizz.tally);
    } else if (data.mode === 'QA' && data.qa && data.qa.question) {
      updateQaTeleprompter(data.qa.question, data.qa.currentIndex, data.qaQuestions.length);
    }
  });

  socket.on('player_list_updated', ({ players, total }) => {
    adminState.players = players;
    updatePlayerCount(total);
  });

  function updatePlayerCount(total) {
    if (elPlayerCount) elPlayerCount.textContent = total;
    if (elTotalCount) elTotalCount.textContent = total;
  }

  function updateModeBadge(mode) {
    if (!elModeBadge) return;
    if (mode === 'SQUIZZ') {
      elModeBadge.textContent = 'BỘ 1: SQUIZZ (BÓC PHỐT)';
      elModeBadge.style.color = 'var(--rose)';
    } else if (mode === 'QA') {
      elModeBadge.textContent = 'BỘ 2: ĐẤU TRÍ Q&A';
      elModeBadge.style.color = 'var(--primary)';
    } else if (mode === 'PODIUM') {
      elModeBadge.textContent = 'TRAO GIẢI PODIUM';
      elModeBadge.style.color = 'var(--gold)';
    } else {
      elModeBadge.textContent = 'SẢNH CHỜ';
      elModeBadge.style.color = 'var(--cyan)';
    }
  }

  // Populate Jump Dropdown
  function populateJumpSelect() {
    if (!elJumpSelect) return;
    elJumpSelect.innerHTML = '<option value="">-- Nhảy tới câu bất kỳ --</option>';

    if (adminState.squizzQuestions.length) {
      const g1 = document.createElement('optgroup');
      g1.label = '🎭 Bộ 1: Squizz (Bình chọn)';
      adminState.squizzQuestions.forEach((q, i) => {
        const opt = document.createElement('option');
        opt.value = `SQUIZZ:${i}`;
        opt.textContent = `Câu ${i + 1}: ${q.title || q.question.slice(0, 30)}`;
        g1.appendChild(opt);
      });
      elJumpSelect.appendChild(g1);
    }

    if (adminState.qaQuestions.length) {
      const g2 = document.createElement('optgroup');
      g2.label = '🧠 Bộ 2: Đấu Trí Q&A';
      adminState.qaQuestions.forEach((q, i) => {
        const opt = document.createElement('option');
        opt.value = `QA:${i}`;
        opt.textContent = `Câu ${i + 1}: ${q.question.slice(0, 30)}...`;
        g2.appendChild(opt);
      });
      elJumpSelect.appendChild(g2);
    }
  }

  elJumpSelect.addEventListener('change', () => {
    const val = elJumpSelect.value;
    if (!val) return;
    const [mode, idxStr] = val.split(':');
    const idx = parseInt(idxStr, 10);
    socket.emit('host_jump_to_q', { mode, index: idx });
    elJumpSelect.value = '';
  });

  // --- TELEPROMPTER UPDATES ---
  function updateSquizzTeleprompter(q, index, total) {
    adminState.mode = 'SQUIZZ';
    adminState.squizzIndex = index;
    updateModeBadge('SQUIZZ');

    elCurrentQPill.textContent = `CÂU ${index + 1} / ${total || 10} (SQUIZZ)`;
    elTargetBadge.textContent = `🎯 Mục tiêu: ${q.target || 'Bình chọn vui'}`;
    elQText.textContent = q.question;
    elMcVoice.textContent = q.mcVoice ? `"${q.mcVoice}"` : '"Xin chúc mừng đồng chí được nêu tên nhiều nhất!"';
    elPunishment.textContent = q.punishment || 'Uống 1 chén danh dự! 🍻';
    elVotedCount.textContent = '0';
    btnToggleLock.textContent = '🔒 KHÓA BÌNH CHỌN';
    adminState.isSquizzLocked = false;
  }

  function updateQaTeleprompter(q, index, total) {
    adminState.mode = 'QA';
    adminState.qaIndex = index;
    updateModeBadge('QA');

    elCurrentQPill.textContent = `CÂU ${index + 1} / ${total || 15} (Q&A)`;
    elTargetBadge.textContent = `${q.icon || '⚔️'} ${q.category || 'Đố vui'}`;
    elQText.textContent = q.question;
    elMcVoice.textContent = q.explanation ? `💡 Lời giải thích: "${q.explanation}"` : 'Cùng xem ai trả lời đúng và nhanh nhất!';
    elPunishment.textContent = `Đáp án đúng: Phương án ${String.fromCharCode(65 + (q.correctAnswer || 0))}`;
    elVotedCount.textContent = '0';
    btnToggleLock.textContent = '🔒 KHÓA ĐÁP ÁN';
  }

  function updateSecretTally(tally) {
    if (!elSecretTally || !tally || !tally.tallyList) return;
    elVotedCount.textContent = tally.totalVotes;

    if (tally.tallyList.length === 0) {
      elSecretTally.innerHTML = '<div style="color: var(--text-muted); font-style: italic; font-size: 0.9rem;">Chưa có phiếu nào...</div>';
      return;
    }

    elSecretTally.innerHTML = '';
    tally.tallyList.slice(0, 5).forEach((item, idx) => {
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.justifyContent = 'space-between';
      row.style.padding = '4px 8px';
      row.style.background = idx === 0 ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255, 255, 255, 0.05)';
      row.style.borderRadius = '6px';
      row.style.fontSize = '0.9rem';
      row.innerHTML = `
        <span style="font-weight: 700;">#${idx + 1} ${item.name}</span>
        <span style="color: var(--gold); font-weight: 800;">${item.count} phiếu</span>
      `;
      elSecretTally.appendChild(row);
    });
  }

  // Socket Events
  socket.on('squizz_question_started', ({ currentIndex, total, question }) => {
    updateSquizzTeleprompter(question, currentIndex, total);
  });

  socket.on('squizz_timer_tick', ({ timeRemaining }) => {
    elTimerDisplay.textContent = `${timeRemaining}s`;
    elTimerDisplay.style.color = timeRemaining <= 5 ? 'var(--rose)' : 'var(--cyan)';
  });

  socket.on('squizz_live_update', ({ tally, totalVotes, totalPlayers }) => {
    updateSecretTally(tally);
    updatePlayerCount(totalPlayers);
  });

  socket.on('squizz_lock_changed', ({ isOpen }) => {
    adminState.isSquizzLocked = !isOpen;
    btnToggleLock.textContent = isOpen ? '🔒 KHÓA BÌNH CHỌN' : '🔓 MỞ LẠI BÌNH CHỌN';
  });

  socket.on('qa_question_started', ({ currentIndex, total, question }) => {
    updateQaTeleprompter(question, currentIndex, total);
  });

  socket.on('qa_timer_tick', ({ timeRemaining }) => {
    elTimerDisplay.textContent = `${timeRemaining}s`;
    elTimerDisplay.style.color = timeRemaining <= 5 ? 'var(--rose)' : 'var(--cyan)';
  });

  socket.on('qa_live_update', ({ stats, totalAnswered, totalPlayers }) => {
    elVotedCount.textContent = totalAnswered;
    updatePlayerCount(totalPlayers);
  });

  socket.on('game_mode_changed', ({ mode }) => {
    adminState.mode = mode;
    updateModeBadge(mode);
  });

  // --- CONTROLLER BUTTON ACTIONS ---
  document.getElementById('btn-mode-lobby').addEventListener('click', () => {
    socket.emit('host_back_to_lobby');
  });

  document.getElementById('btn-mode-squizz').addEventListener('click', () => {
    socket.emit('host_squizz_start', { questionIndex: 0, timeLimit: adminState.timerLimit });
  });

  document.getElementById('btn-mode-qa').addEventListener('click', () => {
    socket.emit('host_qa_start', { questionIndex: 0, timeLimit: adminState.timerLimit });
  });

  document.getElementById('btn-mode-podium').addEventListener('click', () => {
    socket.emit('host_show_podium');
  });

  // Prev / Next
  document.getElementById('btn-prev-q').addEventListener('click', () => {
    if (adminState.mode === 'SQUIZZ') socket.emit('host_squizz_prev');
    else if (adminState.mode === 'QA') socket.emit('host_qa_prev');
  });

  document.getElementById('btn-next-q').addEventListener('click', () => {
    if (adminState.mode === 'SQUIZZ') socket.emit('host_squizz_next');
    else if (adminState.mode === 'QA') socket.emit('host_qa_next');
  });

  // Lock / Unlock
  btnToggleLock.addEventListener('click', () => {
    if (adminState.mode === 'SQUIZZ') {
      const newOpen = adminState.isSquizzLocked;
      socket.emit('host_squizz_toggle_lock', { open: newOpen });
    }
  });

  // Master Reveal Action
  document.getElementById('btn-reveal-action').addEventListener('click', () => {
    if (adminState.mode === 'SQUIZZ') {
      socket.emit('host_squizz_reveal');
    } else if (adminState.mode === 'QA') {
      socket.emit('host_qa_reveal');
    }
  });

  // Timer Presets
  document.querySelectorAll('.btn-timer-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.btn-timer-preset').forEach(b => b.classList.remove('btn-cyan'));
      btn.classList.add('btn-cyan');
      const sec = parseInt(btn.getAttribute('data-sec'), 10);
      adminState.timerLimit = sec;
      if (adminState.mode === 'SQUIZZ') {
        socket.emit('host_set_squizz_timer', { seconds: sec });
      } else if (adminState.mode === 'QA') {
        socket.emit('host_set_qa_timer', { seconds: sec });
      }
    });
  });

  // --- SOUNDBOARD TRIGGERS ---
  document.getElementById('snd-cheers').addEventListener('click', () => {
    socket.emit('host_trigger_cheer', { text: '100% CẠN CHÉN! ZÔ ZÔ ZÔ! 🍻🍻🍻' });
    if (window.soundFX) window.soundFX.playGlassClink();
  });

  document.getElementById('snd-confetti').addEventListener('click', () => {
    if (window.burstCannons) window.burstCannons();
  });

  document.getElementById('snd-applause').addEventListener('click', () => {
    if (window.soundFX) window.soundFX.playCheer();
  });

  document.getElementById('snd-drumroll').addEventListener('click', () => {
    if (window.soundFX) window.soundFX.playDrumRoll();
  });

  document.getElementById('snd-correct').addEventListener('click', () => {
    if (window.soundFX) window.soundFX.playCorrect();
  });

  document.getElementById('snd-wrong').addEventListener('click', () => {
    if (window.soundFX) window.soundFX.playWrong();
  });

  // --- ADMIN TEST & SIMULATION ---
  document.getElementById('btn-add-bots-20').addEventListener('click', () => {
    socket.emit('host_add_bots', { count: 20 });
  });

  document.getElementById('btn-add-bots-50').addEventListener('click', () => {
    socket.emit('host_add_bots', { count: 50 });
  });

  document.getElementById('btn-admin-simulate').addEventListener('click', () => {
    if (adminState.mode === 'SQUIZZ') {
      socket.emit('host_simulate_squizz');
    } else if (adminState.mode === 'QA') {
      socket.emit('host_simulate_qa');
    } else {
      alert('Vui lòng bấm Bắt đầu Bộ 1 (Squizz) hoặc Bộ 2 (Q&A) trước khi bấm mô phỏng nhé!');
    }
  });

  document.getElementById('btn-admin-reset-q').addEventListener('click', () => {
    socket.emit('host_reset_current_q');
  });

  document.getElementById('btn-admin-reset-lobby').addEventListener('click', () => {
    socket.emit('host_back_to_lobby');
  });

  document.getElementById('btn-admin-clear-players').addEventListener('click', () => {
    if (confirm('Xóa sạch toàn bộ người chơi trong phòng?')) {
      socket.emit('host_clear_all_players');
    }
  });

  // Settings Modal
  const modalSettings = document.getElementById('modal-settings');
  const txtMembers = document.getElementById('settings-members-input');

  document.getElementById('btn-open-settings').addEventListener('click', () => {
    txtMembers.value = adminState.members.join('\n');
    modalSettings.style.display = 'flex';
  });

  document.getElementById('btn-close-settings').addEventListener('click', () => {
    modalSettings.style.display = 'none';
  });

  document.getElementById('btn-cancel-settings').addEventListener('click', () => {
    modalSettings.style.display = 'none';
  });

  document.getElementById('btn-save-settings').addEventListener('click', () => {
    const names = txtMembers.value.split('\n').map(n => n.trim()).filter(n => n.length > 0);
    fetch('/api/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(names)
    })
    .then(r => r.json())
    .then(() => {
      adminState.members = names;
      alert(`Đã lưu ${names.length} thành viên phòng!`);
      modalSettings.style.display = 'none';
    })
    .catch(() => alert('Lỗi khi lưu danh sách thành viên'));
  });
});
