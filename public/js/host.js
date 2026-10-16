// Host / Projector View Logic
document.addEventListener('DOMContentLoaded', () => {
  const socket = io();

  // State
  let hostState = {
    mode: 'LOBBY',
    players: [],
    squizz: {
      currentIndex: 0,
      total: 10,
      question: null,
      isOpen: false,
      isRevealed: false
    },
    qa: {
      currentIndex: 0,
      total: 15,
      question: null,
      timeRemaining: 20,
      timeLimit: 20,
      isOpen: false,
      isRevealed: false,
      stats: null
    },
    members: []
  };

  // DOM Elements
  const elPlayerCount = document.getElementById('host-player-count');
  const elLobbyReadyCount = document.getElementById('lobby-ready-count');
  const elLobbyPlayerGrid = document.getElementById('lobby-player-grid');
  const elEmptyHint = document.getElementById('empty-player-hint');
  const elHostQrImg = document.getElementById('host-qr-img');
  const elHostJoinUrl = document.getElementById('host-join-url');

  // Views
  const views = {
    lobby: document.getElementById('view-lobby'),
    squizz: document.getElementById('view-squizz'),
    qa: document.getElementById('view-qa'),
    leaderboard: document.getElementById('view-leaderboard'),
    podium: document.getElementById('view-podium')
  };

  function switchView(viewName) {
    Object.keys(views).forEach(key => {
      if (views[key]) views[key].style.display = key === viewName ? 'flex' : 'none';
    });
    if (viewName === 'lobby') {
      views.lobby.style.display = 'grid';
    }

    const btnLobbyReturn = document.getElementById('btn-lobby-return');
    if (btnLobbyReturn) {
      btnLobbyReturn.style.display = viewName === 'lobby' ? 'none' : 'inline-flex';
    }
  }

  // Load server info
  fetch('/api/info')
    .then(r => r.json())
    .then(data => {
      if (data.qrCodeData) elHostQrImg.src = data.qrCodeData;
      elHostJoinUrl.textContent = data.joinUrl;
    })
    .catch(console.error);

  // Load members
  fetch('/api/members')
    .then(r => r.json())
    .then(list => {
      hostState.members = list;
      document.getElementById('settings-members-textarea').value = list.join('\n');
    })
    .catch(console.error);

  // Connect Host
  socket.emit('host_join');

  socket.on('host_init', (data) => {
    hostState.mode = data.mode;
    hostState.players = data.players || [];
    updatePlayerGrid();

    if (data.membersList) {
      hostState.members = data.membersList;
      document.getElementById('settings-members-textarea').value = data.membersList.join('\n');
    }

    if (data.mode === 'SQUIZZ' && data.squizz && data.squizz.question) {
      renderSquizzQuestion(data.squizz.question, data.squizz.currentIndex, data.squizzQuestions.length);
      if (data.squizz.tally) {
        renderSquizzTally(data.squizz.tally);
      }
      switchView('squizz');
    } else if (data.mode === 'QA' && data.qa && data.qa.question) {
      renderQaQuestion(data.qa.question, data.qa.currentIndex, data.qaQuestions.length, data.qa.timeLimit);
      switchView('qa');
    } else {
      switchView('lobby');
    }
  });

  // Player list updates
  socket.on('player_list_updated', ({ players, total }) => {
    hostState.players = players;
    elPlayerCount.textContent = total;
    elLobbyReadyCount.textContent = total;
    updatePlayerGrid();

    // Update counters in views
    const sqTotal = document.getElementById('squizz-total-players');
    if (sqTotal) sqTotal.textContent = total;
    const qaTotal = document.getElementById('qa-total-players');
    if (qaTotal) qaTotal.textContent = total;
  });

  socket.on('player_joined_toast', ({ nickname, avatar }) => {
    if (window.soundFX) window.soundFX.playJoin();
  });

  function updatePlayerGrid() {
    if (!elLobbyPlayerGrid) return;
    elLobbyPlayerGrid.innerHTML = '';

    if (hostState.players.length === 0) {
      if (elEmptyHint) elLobbyPlayerGrid.appendChild(elEmptyHint);
      return;
    }

    hostState.players.forEach(p => {
      const chip = document.createElement('div');
      chip.className = 'player-chip';
      chip.innerHTML = `<span class="avatar">${p.avatar}</span> <span>${p.nickname}</span>`;
      elLobbyPlayerGrid.appendChild(chip);
    });
  }

  // --- SQUIZZ (GAME 1) HANDLERS ---
  const elSquizzQIndex = document.getElementById('squizz-q-index');
  const elSquizzQTitle = document.getElementById('squizz-q-title');
  const elSquizzQText = document.getElementById('squizz-q-text');
  const elSquizzQTarget = document.getElementById('squizz-q-target');
  const elSquizzMcVoice = document.getElementById('squizz-mc-voice');
  const elSquizzTallyList = document.getElementById('squizz-tally-list');
  const elSquizzVotedCount = document.getElementById('squizz-voted-count');
  const elSquizzLockStatus = document.getElementById('squizz-lock-status');
  const elSquizzRevealModal = document.getElementById('squizz-reveal-container');

  function renderSquizzQuestion(q, index, total) {
    if (!q) return;
    hostState.squizz.currentIndex = index;
    hostState.squizz.question = q;
    hostState.squizz.isOpen = true;
    hostState.squizz.isRevealed = false;

    elSquizzQIndex.textContent = `CÂU ${index + 1} / ${total || 10}`;
    elSquizzQTitle.textContent = q.title || `Câu hỏi ${index + 1}`;
    elSquizzQText.textContent = q.question;
    elSquizzQTarget.textContent = `🎯 Mục tiêu: ${q.target || 'Bình chọn vui nhộn'}`;
    elSquizzMcVoice.textContent = q.mcVoice ? `"${q.mcVoice}"` : 'Xin mời đồng chí được gọi tên cạn 1 chén!';

    elSquizzVotedCount.textContent = '0';
    elSquizzLockStatus.textContent = '● Đang mở bình chọn';
    elSquizzLockStatus.style.color = 'var(--emerald)';
    elSquizzRevealModal.style.display = 'none';

    elSquizzTallyList.innerHTML = `
      <div style="color: var(--text-muted); font-style: italic; margin: auto; text-align: center; padding: 30px;">
        Đang chờ anh em gửi tên bình chọn từ điện thoại...
      </div>
    `;
  }

  function renderSquizzTally(tally) {
    if (!tally || !tally.tallyList) return;
    elSquizzVotedCount.textContent = tally.totalVotes;

    if (tally.tallyList.length === 0) {
      elSquizzTallyList.innerHTML = `
        <div style="color: var(--text-muted); font-style: italic; margin: auto; text-align: center; padding: 30px;">
          Đang chờ anh em gửi tên bình chọn từ điện thoại...
        </div>
      `;
      return;
    }

    const maxVotes = tally.tallyList[0].count || 1;
    elSquizzTallyList.innerHTML = '';

    tally.tallyList.forEach((item, idx) => {
      const pct = Math.round((item.count / maxVotes) * 100);
      const row = document.createElement('div');
      row.className = 'tally-item';
      row.innerHTML = `
        <div class="tally-bar" style="width: ${pct}%"></div>
        <div class="tally-content">
          <div class="tally-name">
            <span style="color: var(--cyan); margin-right: 6px;">#${idx + 1}</span>
            ${item.name}
          </div>
          <div class="tally-votes">${item.count} phiếu</div>
        </div>
      `;
      elSquizzTallyList.appendChild(row);
    });
  }

  socket.on('squizz_question_started', ({ currentIndex, total, question }) => {
    switchView('squizz');
    renderSquizzQuestion(question, currentIndex, total);
    if (window.soundFX) window.soundFX.playJoin();
  });

  socket.on('squizz_live_update', ({ tally, totalVotes, totalPlayers }) => {
    renderSquizzTally(tally);
    elSquizzVotedCount.textContent = totalVotes;
    const totalEl = document.getElementById('squizz-total-players');
    if (totalEl) totalEl.textContent = totalPlayers;
  });

  socket.on('squizz_lock_changed', ({ isOpen }) => {
    hostState.squizz.isOpen = isOpen;
    if (isOpen) {
      elSquizzLockStatus.textContent = '● Đang mở bình chọn';
      elSquizzLockStatus.style.color = 'var(--emerald)';
    } else {
      elSquizzLockStatus.textContent = '● Đã khóa bình chọn';
      elSquizzLockStatus.style.color = 'var(--rose)';
    }
  });

  socket.on('squizz_revealed', ({ tally, question, winner }) => {
    hostState.squizz.isRevealed = true;
    if (window.soundFX) {
      window.soundFX.playCheer();
    }
    if (window.burstCannons) window.burstCannons();

    const winnerNameEl = document.getElementById('squizz-winner-name');
    const winnerVotesEl = document.getElementById('squizz-winner-votes');
    const winnerPunishmentEl = document.getElementById('squizz-winner-punishment');

    if (winner) {
      winnerNameEl.textContent = winner.name.toUpperCase();
      winnerVotesEl.textContent = `Đạt ${winner.count} / ${tally.totalVotes} phiếu bầu`;
    } else {
      winnerNameEl.textContent = 'CHƯA CÓ BÌNH CHỌN';
      winnerVotesEl.textContent = 'Không có phiếu nào';
    }

    winnerPunishmentEl.textContent = (question && question.punishment) ? question.punishment : 'Uống 1 chén danh dự! 🍻';
    elSquizzRevealModal.style.display = 'flex';
  });

  // Squizz Controls
  document.getElementById('btn-start-squizz').addEventListener('click', () => {
    socket.emit('host_squizz_start', { questionIndex: 0 });
  });

  document.getElementById('btn-squizz-toggle-lock').addEventListener('click', () => {
    hostState.squizz.isOpen = !hostState.squizz.isOpen;
    socket.emit('host_squizz_toggle_lock', { open: hostState.squizz.isOpen });
  });

  document.getElementById('btn-squizz-reveal').addEventListener('click', () => {
    socket.emit('host_squizz_reveal');
  });

  document.getElementById('btn-squizz-next').addEventListener('click', () => {
    socket.emit('host_squizz_next');
  });

  document.getElementById('btn-squizz-prev').addEventListener('click', () => {
    socket.emit('host_squizz_prev');
  });

  document.getElementById('btn-close-winner').addEventListener('click', () => {
    elSquizzRevealModal.style.display = 'none';
  });

  document.getElementById('btn-winner-toast').addEventListener('click', () => {
    socket.emit('host_trigger_cheer', { text: '100% CẠN CHÉN! ZÔ ZÔ ZÔ! 🍻🍻🍻' });
    if (window.burstCannons) window.burstCannons();
    if (window.soundFX) window.soundFX.playGlassClink();
  });

  document.getElementById('btn-cheer-cheers').addEventListener('click', () => {
    socket.emit('host_trigger_cheer', { text: '100% CẠN CHÉN! ZÔ ZÔ ZÔ! 🍻🍻🍻' });
    if (window.burstCannons) window.burstCannons();
    if (window.soundFX) window.soundFX.playGlassClink();
  });

  // --- QA (GAME 2) HANDLERS ---
  const elQaCategory = document.getElementById('qa-category-badge');
  const elQaIndexBadge = document.getElementById('qa-index-badge');
  const elQaQuestionText = document.getElementById('qa-question-text');
  const elQaTimerNum = document.getElementById('qa-timer-num');
  const elQaTimerRing = document.getElementById('qa-timer-ring');
  const elQaAnsweredCount = document.getElementById('qa-answered-count');
  const elQaTotalPlayers = document.getElementById('qa-total-players');
  const elQaExplanationBox = document.getElementById('qa-explanation-box');
  const elQaExplanationText = document.getElementById('qa-explanation-text');
  const btnQaPodium = document.getElementById('btn-qa-podium');

  function renderQaQuestion(q, index, total, timeLimit) {
    if (!q) return;
    hostState.qa.currentIndex = index;
    hostState.qa.question = q;
    hostState.qa.timeLimit = timeLimit || 20;
    hostState.qa.timeRemaining = hostState.qa.timeLimit;
    hostState.qa.isOpen = true;
    hostState.qa.isRevealed = false;

    elQaCategory.textContent = `${q.icon || '⚔️'} ${q.category || 'Đố vui'}`;
    elQaIndexBadge.textContent = `CÂU ${index + 1} / ${total || 15}`;
    elQaQuestionText.textContent = q.question;
    elQaTimerNum.textContent = hostState.qa.timeRemaining;
    elQaTimerRing.style.background = `conic-gradient(var(--cyan) 100%, transparent 0)`;

    elQaAnsweredCount.textContent = '0';
    elQaExplanationBox.style.display = 'none';

    // Show podium button on last question
    if (index >= (total || 15) - 1) {
      btnQaPodium.style.display = 'inline-flex';
    } else {
      btnQaPodium.style.display = 'none';
    }

    // Reset option cards
    for (let i = 0; i < 4; i++) {
      const card = document.getElementById(`qa-card-${i}`);
      const text = document.getElementById(`qa-text-${i}`);
      const count = document.getElementById(`qa-count-${i}`);
      if (card && text) {
        card.classList.remove('correct-answer', 'dimmed');
        text.textContent = q.options && q.options[i] ? q.options[i] : '';
        count.style.display = 'none';
        count.textContent = '0';
      }
    }
  }

  socket.on('qa_question_started', ({ currentIndex, total, timeLimit, question }) => {
    switchView('qa');
    renderQaQuestion(question, currentIndex, total, timeLimit);
    if (window.soundFX) window.soundFX.playJoin();
  });

  socket.on('qa_timer_tick', ({ timeRemaining }) => {
    hostState.qa.timeRemaining = timeRemaining;
    elQaTimerNum.textContent = timeRemaining;
    const fraction = Math.max(0, timeRemaining / hostState.qa.timeLimit);
    const degrees = Math.round(fraction * 360);
    elQaTimerRing.style.background = `conic-gradient(${timeRemaining <= 5 ? 'var(--rose)' : 'var(--cyan)'} ${degrees}deg, transparent 0)`;

    if (window.soundFX) {
      if (timeRemaining <= 5 && timeRemaining > 0) {
        window.soundFX.playUrgentTick();
      } else {
        window.soundFX.playTick();
      }
    }
  });

  socket.on('qa_time_up', () => {
    elQaTimerNum.textContent = '0';
    if (window.soundFX) window.soundFX.playBuzzer();
  });

  socket.on('qa_live_update', ({ stats, totalAnswered, totalPlayers }) => {
    elQaAnsweredCount.textContent = totalAnswered;
    elQaTotalPlayers.textContent = totalPlayers;
  });

  socket.on('qa_revealed', ({ correctAnswer, explanation, stats, leaderboard }) => {
    hostState.qa.isRevealed = true;
    if (window.soundFX) window.soundFX.playCorrect();
    if (window.fireConfetti) window.fireConfetti({ count: 50 });

    for (let i = 0; i < 4; i++) {
      const card = document.getElementById(`qa-card-${i}`);
      const count = document.getElementById(`qa-count-${i}`);
      if (card && count) {
        count.style.display = 'inline-block';
        count.textContent = `${stats.optionCounts[i] || 0} người`;

        if (i === correctAnswer) {
          card.classList.add('correct-answer');
        } else {
          card.classList.add('dimmed');
        }
      }
    }

    if (explanation) {
      elQaExplanationText.textContent = explanation;
      elQaExplanationBox.style.display = 'flex';
    }
  });

  // QA Controls
  document.getElementById('btn-start-qa').addEventListener('click', () => {
    socket.emit('host_qa_start', { questionIndex: 0 });
  });

  document.getElementById('btn-qa-reveal').addEventListener('click', () => {
    socket.emit('host_qa_reveal');
  });

  document.getElementById('btn-qa-next').addEventListener('click', () => {
    socket.emit('host_qa_next');
  });

  document.getElementById('btn-qa-prev').addEventListener('click', () => {
    socket.emit('host_qa_prev');
  });

  document.getElementById('btn-qa-show-rank').addEventListener('click', () => {
    renderLeaderboardView();
    switchView('leaderboard');
  });

  document.getElementById('btn-lb-continue').addEventListener('click', () => {
    switchView('qa');
  });

  document.getElementById('btn-qa-podium').addEventListener('click', () => {
    socket.emit('host_show_podium');
  });

  // --- LEADERBOARD & PODIUM ---
  function renderLeaderboardView() {
    const sorted = [...hostState.players].sort((a, b) => b.score - a.score);
    const container = document.getElementById('leaderboard-table-container');
    container.innerHTML = '';

    if (sorted.length === 0) {
      container.innerHTML = '<div style="color: var(--text-muted); text-align: center; padding: 40px;">Chưa có dữ liệu điểm số.</div>';
      return;
    }

    sorted.slice(0, 15).forEach((p, idx) => {
      const item = document.createElement('div');
      item.style.display = 'flex';
      item.style.alignItems = 'center';
      item.style.justifyContent = 'space-between';
      item.style.padding = '14px 20px';
      item.style.borderRadius = '14px';
      item.style.marginBottom = '10px';
      item.style.background = idx < 3 ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.04)';
      item.style.border = idx === 0 ? '1.5px solid var(--gold)' : '1px solid rgba(255, 255, 255, 0.08)';

      const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;

      item.innerHTML = `
        <div style="display: flex; align-items: center; gap: 16px;">
          <span style="font-size: 1.4rem; font-weight: 900; width: 40px; text-align: center; color: var(--gold);">${medal}</span>
          <span style="font-size: 1.6rem;">${p.avatar}</span>
          <span style="font-size: 1.25rem; font-weight: 800;">${p.nickname}</span>
        </div>
        <div style="font-size: 1.3rem; font-weight: 900; color: var(--cyan);">${p.score.toLocaleString()} điểm</div>
      `;
      container.appendChild(item);
    });
  }

  socket.on('podium_celebration', ({ leaderboard, top3 }) => {
    switchView('podium');
    if (window.soundFX) window.soundFX.playCheer();
    if (window.burstCannons) window.burstCannons();

    // 1st Place
    if (top3[0]) {
      document.getElementById('podium-avatar-1').textContent = top3[0].avatar;
      document.getElementById('podium-name-1').textContent = top3[0].nickname.toUpperCase();
      document.getElementById('podium-score-1').textContent = `${top3[0].score.toLocaleString()} điểm`;
    }
    // 2nd Place
    if (top3[1]) {
      document.getElementById('podium-avatar-2').textContent = top3[1].avatar;
      document.getElementById('podium-name-2').textContent = top3[1].nickname;
      document.getElementById('podium-score-2').textContent = `${top3[1].score.toLocaleString()} điểm`;
    }
    // 3rd Place
    if (top3[2]) {
      document.getElementById('podium-avatar-3').textContent = top3[2].avatar;
      document.getElementById('podium-name-3').textContent = top3[2].nickname;
      document.getElementById('podium-score-3').textContent = `${top3[2].score.toLocaleString()} điểm`;
    }

    // Periodic confetti blasts
    const interval = setInterval(() => {
      if (document.getElementById('view-podium').style.display !== 'none') {
        if (window.fireConfetti) window.fireConfetti();
      } else {
        clearInterval(interval);
      }
    }, 2500);
  });

  document.getElementById('btn-podium-confetti').addEventListener('click', () => {
    if (window.burstCannons) window.burstCannons();
    if (window.soundFX) window.soundFX.playCheer();
  });

  document.getElementById('btn-podium-restart').addEventListener('click', () => {
    socket.emit('host_back_to_lobby');
    switchView('lobby');
  });

  // Global Return to lobby
  document.getElementById('btn-lobby-return').addEventListener('click', () => {
    if (confirm('Bạn có chắc muốn tạm dừng để quay lại Sảnh chính?')) {
      socket.emit('host_back_to_lobby');
      switchView('lobby');
    }
  });

  // Fullscreen toggle
  document.getElementById('btn-fullscreen').addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(console.error);
    } else {
      document.exitFullscreen().catch(console.error);
    }
  });

  // Sound toggle
  const btnSound = document.getElementById('btn-sound-toggle');
  btnSound.addEventListener('click', () => {
    if (window.soundFX) {
      const isMuted = window.soundFX.toggleMute();
      btnSound.textContent = isMuted ? '🔇' : '🔊';
      btnSound.style.opacity = isMuted ? '0.6' : '1';
    }
  });

  // Settings Modal
  const modalSettings = document.getElementById('modal-settings');
  document.getElementById('btn-open-editor').addEventListener('click', () => {
    modalSettings.style.display = 'flex';
  });
  document.getElementById('btn-close-settings').addEventListener('click', () => {
    modalSettings.style.display = 'none';
  });
  document.getElementById('btn-cancel-settings').addEventListener('click', () => {
    modalSettings.style.display = 'none';
  });

  document.getElementById('btn-save-settings').addEventListener('click', () => {
    const text = document.getElementById('settings-members-textarea').value;
    const names = text.split('\n').map(n => n.trim()).filter(n => n.length > 0);
    fetch('/api/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(names)
    })
    .then(r => r.json())
    .then(res => {
      alert(`Đã lưu thành công ${names.length} thành viên phòng!`);
      modalSettings.style.display = 'none';
    })
    .catch(err => alert('Lỗi khi lưu danh sách thành viên'));
  });

  document.getElementById('btn-reset-scores').addEventListener('click', () => {
    if (confirm('Bạn có chắc chắn muốn đặt lại điểm số của tất cả người chơi về 0?')) {
      socket.emit('host_reset_scores');
      alert('Đã xóa điểm toàn bộ người chơi về 0!');
    }
  });
});
