// Projector Presentation View (Dedicated to Big Screen / Audience)
document.addEventListener('DOMContentLoaded', () => {
  const socket = io();

  let projState = {
    mode: 'LOBBY',
    players: [],
    squizz: {
      currentIndex: 0,
      total: 12,
      question: null,
      timeLimit: 30,
      timeRemaining: 30,
      isRevealed: false
    },
    qa: {
      currentIndex: 0,
      total: 15,
      question: null,
      timeLimit: 20,
      timeRemaining: 20
    }
  };

  // Elements
  const elPlayerCount = document.getElementById('proj-player-count');
  const elLobbyReadyCount = document.getElementById('proj-lobby-ready-count');
  const elLobbyTotalMembers = document.getElementById('proj-lobby-total-members');
  const elPlayerGrid = document.getElementById('proj-player-grid');
  const elEmptyHint = document.getElementById('empty-hint');
  const elQrImg = document.getElementById('proj-qr-img');
  const elJoinUrl = document.getElementById('proj-join-url');
  const elNetStatus = document.getElementById('proj-net-status');
  const elMissingBox = document.getElementById('proj-missing-box');
  const elMissingCount = document.getElementById('proj-missing-count');
  const elMissingGrid = document.getElementById('proj-missing-grid');

  // Views
  const views = {
    lobby: document.getElementById('view-lobby'),
    squizz: document.getElementById('view-squizz'),
    qa: document.getElementById('view-qa'),
    leaderboard: document.getElementById('view-leaderboard'),
    podium: document.getElementById('view-podium')
  };

  function switchView(name) {
    Object.keys(views).forEach(key => {
      if (views[key]) views[key].style.display = (key === name) ? 'flex' : 'none';
    });
    if (name === 'lobby') {
      views.lobby.style.display = 'grid';
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, tag => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[tag] || tag));
  }

  // Load Info
  fetch('/api/info')
    .then(r => r.json())
    .then(data => {
      if (data.qrCodeData) elQrImg.src = data.qrCodeData;
      elJoinUrl.textContent = data.joinUrl;
      if (data.isTunnel) {
        elNetStatus.innerHTML = `🌐 <strong>ĐÃ NỐI CLOUDFLARE TOÀN CẦU</strong> (4G / 5G / Wi-Fi)`;
      }
    })
    .catch(console.error);

  // Connect as Projector
  socket.emit('projector_join');

  socket.on('host_init', (data) => {
    projState.mode = data.mode;
    projState.players = data.players || [];
    updatePlayers();
    if (data.activation) {
      updateMissingMembersList(data.activation);
    }

    if (data.mode === 'SQUIZZ' && data.squizz && data.squizz.question) {
      renderSquizz(data.squizz.question, data.squizz.currentIndex, data.squizzQuestions.length, data.squizz.timeLimit);
      projState.squizz.isRevealed = data.squizz.isRevealed;
      if (data.squizz.tally) renderSquizzTally(data.squizz.tally, data.squizz.isRevealed);
      if (data.squizz.isRevealed) showSpotlight(data.squizz.tally, data.squizz.question, data.squizz.tally.winner);
      switchView('squizz');
    } else if (data.mode === 'QA' && data.qa && data.qa.question) {
      renderQa(data.qa.question, data.qa.currentIndex, data.qaQuestions.length, data.qa.timeLimit);
      switchView('qa');
    } else if (data.mode === 'PODIUM') {
      switchView('podium');
    } else {
      switchView('lobby');
    }
  });

  socket.on('tunnel_ready', ({ joinUrl, qrCodeData }) => {
    if (qrCodeData) elQrImg.src = qrCodeData;
    if (joinUrl) elJoinUrl.textContent = joinUrl;
    elNetStatus.innerHTML = `🌐 <strong>ĐÃ NỐI CLOUDFLARE TOÀN CẦU</strong> (4G / 5G / Wi-Fi)`;
  });

  socket.on('player_list_updated', ({ players, total, activation }) => {
    projState.players = players;
    if (elPlayerCount) elPlayerCount.textContent = total;
    if (elLobbyReadyCount) elLobbyReadyCount.textContent = total;
    updatePlayers();

    if (activation) {
      updateMissingMembersList(activation);
    }

    const sqTotal = document.getElementById('proj-sq-total');
    if (sqTotal) sqTotal.textContent = total;
    const qaTotal = document.getElementById('proj-qa-total');
    if (qaTotal) qaTotal.textContent = total;
  });

  socket.on('player_joined_toast', () => {
    if (window.soundFX) window.soundFX.playJoin();
  });

  function updateMissingMembersList(activation) {
    if (!activation) return;
    if (elLobbyTotalMembers) elLobbyTotalMembers.textContent = activation.totalMembers;
    if (elLobbyReadyCount) elLobbyReadyCount.textContent = activation.activatedCount;
    if (elMissingCount) elMissingCount.textContent = activation.missingCount;

    if (!elMissingGrid) return;
    elMissingGrid.innerHTML = '';

    if (activation.missingCount === 0) {
      elMissingGrid.innerHTML = `
        <div class="all-checked-in-banner" style="width: 100%;">
          🎉 TOÀN THỂ ${activation.totalMembers} CÁN BỘ NHÂN VIÊN PHÒNG TCKT ĐÃ ĐIỂM DANH ĐÔNG ĐỦ! SẴN SÀNG KHỞI TRANH! 🚀
        </div>
      `;
      return;
    }

    activation.missingMembers.forEach(m => {
      const chip = document.createElement('div');
      chip.className = 'missing-chip';
      chip.innerHTML = `<span class="chip-stt">#${m.stt}</span> <span>${escapeHtml(m.name)}</span>`;
      elMissingGrid.appendChild(chip);
    });
  }

  function updatePlayers() {
    if (!elPlayerGrid) return;
    elPlayerGrid.innerHTML = '';
    if (projState.players.length === 0) {
      if (elEmptyHint) elPlayerGrid.appendChild(elEmptyHint);
      return;
    }
    projState.players.forEach(p => {
      const chip = document.createElement('div');
      chip.className = 'player-chip';
      const zodiacText = (p.zodiacInfo && p.zodiacInfo.sign) ? ` <span style="font-size: 0.82rem; opacity: 0.9;">(${p.zodiacInfo.sign.icon})</span>` : '';
      chip.innerHTML = `<span class="avatar">${p.avatar}</span> <span>${escapeHtml(p.nickname)}${zodiacText}</span>`;
      elPlayerGrid.appendChild(chip);
    });
  }

  // --- SQUIZZ PRESENTATION ---
  const elSqIndex = document.getElementById('proj-sq-index');
  const elSqTitle = document.getElementById('proj-sq-title');
  const elSqText = document.getElementById('proj-sq-text');
  const elSqTarget = document.getElementById('proj-sq-target');
  const elSqTallyList = document.getElementById('proj-sq-tally-list');
  const elSqWordwall = document.getElementById('proj-sq-wordwall');
  const elSqMysteryBadge = document.getElementById('proj-sq-mystery-badge');
  const elSqVoted = document.getElementById('proj-sq-voted');
  const elSqLock = document.getElementById('proj-sq-lock-status');
  const elSqTimerCard = document.getElementById('proj-sq-timer-card');
  const elSqTimerNum = document.getElementById('proj-sq-timer-num');

  // Spotlight Elements
  const spotlightModal = document.getElementById('spotlight-modal');
  const spotlightCrown = document.getElementById('spotlight-crown');
  const spotlightBadge = document.getElementById('spotlight-badge');
  const spotWinnerName = document.getElementById('spotlight-winner-name');
  const spotWinnerRole = document.getElementById('spotlight-winner-role');
  const spotZodiacCard = document.getElementById('spotlight-zodiac-card');
  const spotWinnerVotes = document.getElementById('spotlight-winner-votes');
  const spotPunishment = document.getElementById('spotlight-punishment');
  const spotMcVoice = document.getElementById('spotlight-mc-voice');

  function renderSquizz(q, index, total, timeLimit) {
    projState.squizz.currentIndex = index;
    projState.squizz.question = q;
    projState.squizz.timeLimit = timeLimit || 30;
    projState.squizz.timeRemaining = projState.squizz.timeLimit;
    projState.squizz.isRevealed = false;

    elSqIndex.textContent = `CÂU ${index + 1} / ${total || 12}`;
    elSqTitle.textContent = `${q.icon || '🎯'} ${q.title || `Câu hỏi ${index + 1}`}`;
    elSqText.textContent = q.question;
    elSqTarget.textContent = `🎯 Mục tiêu: ${q.target || 'Bình chọn vui nhộn'}`;
    elSqVoted.textContent = '0';
    elSqLock.textContent = '● Đang mở bình chọn';
    elSqLock.style.color = 'var(--emerald)';

    if (projState.squizz.timeLimit > 0) {
      elSqTimerCard.style.display = 'flex';
      elSqTimerNum.textContent = projState.squizz.timeRemaining;
    } else {
      elSqTimerCard.style.display = 'none';
    }

    spotlightModal.style.display = 'none';

    if (q.type === 'OPEN_TEXT') {
      if (elSqTallyList) elSqTallyList.style.display = 'none';
      if (elSqWordwall) {
        elSqWordwall.style.display = 'grid';
        elSqWordwall.innerHTML = `
          <div style="color: var(--text-muted); font-style: italic; margin: auto; text-align: center; padding: 40px; font-size: 1.1rem; grid-column: 1 / -1;">
            Đang chờ anh em gửi câu trả lời từ điện thoại...
          </div>
        `;
      }
      if (elSqMysteryBadge) elSqMysteryBadge.style.display = 'none';
    } else {
      if (elSqTallyList) {
        elSqTallyList.style.display = 'flex';
        elSqTallyList.innerHTML = `
          <div style="color: var(--text-muted); font-style: italic; margin: auto; text-align: center; padding: 40px; font-size: 1.1rem;">
            Đang chờ anh em gửi tên bình chọn từ điện thoại...
          </div>
        `;
      }
      if (elSqWordwall) elSqWordwall.style.display = 'none';
      if (elSqMysteryBadge) elSqMysteryBadge.style.display = 'inline-flex';
    }
  }

  function renderSquizzTally(tally, isRevealed = false) {
    if (!tally) return;
    elSqVoted.textContent = tally.totalVotes;

    const isText = (projState.squizz.question && projState.squizz.question.type === 'OPEN_TEXT') || tally.isTextQuestion;

    if (isText) {
      // Render Word Wall
      if (elSqTallyList) elSqTallyList.style.display = 'none';
      if (elSqWordwall) {
        elSqWordwall.style.display = 'grid';
        if (!tally.responses || tally.responses.length === 0) {
          elSqWordwall.innerHTML = `
            <div style="color: var(--text-muted); font-style: italic; margin: auto; text-align: center; padding: 40px; font-size: 1.1rem; grid-column: 1 / -1;">
              Đang chờ anh em gửi câu trả lời từ điện thoại...
            </div>
          `;
          return;
        }

        elSqWordwall.innerHTML = '';
        tally.responses.forEach(resp => {
          const card = document.createElement('div');
          card.className = 'open-text-card';
          card.innerHTML = `
            <div class="open-text-content">"${escapeHtml(resp.text)}"</div>
            <div class="open-text-author">
              <span>${resp.avatar || '😎'}</span>
              <span>${escapeHtml(resp.voter || 'Đồng nghiệp')}</span>
            </div>
          `;
          elSqWordwall.appendChild(card);
        });
      }
      return;
    }

    // Render Member Vote Bar Chart
    if (elSqWordwall) elSqWordwall.style.display = 'none';
    if (!elSqTallyList) return;
    elSqTallyList.style.display = 'flex';

    if (!tally.tallyList || tally.tallyList.length === 0) {
      elSqTallyList.innerHTML = `
        <div style="color: var(--text-muted); font-style: italic; margin: auto; text-align: center; padding: 40px; font-size: 1.1rem;">
          Đang chờ anh em gửi tên bình chọn từ điện thoại...
        </div>
      `;
      return;
    }

    const maxVotes = tally.tallyList[0].count || 1;
    elSqTallyList.innerHTML = '';

    // Mystery blur mode: during active voting, only show top 4-5 with blurred names!
    const displayList = (!isRevealed) ? tally.tallyList.slice(0, 5) : tally.tallyList;

    if (!isRevealed) {
      if (elSqMysteryBadge) elSqMysteryBadge.style.display = 'inline-flex';
    } else {
      if (elSqMysteryBadge) elSqMysteryBadge.style.display = 'none';
    }

    displayList.forEach((item, idx) => {
      const pct = Math.round((item.count / maxVotes) * 100);
      const row = document.createElement('div');
      row.className = 'tally-item';

      const nameClass = !isRevealed ? 'tally-name mystery-blur-name' : 'tally-name mystery-unblurred';

      row.innerHTML = `
        <div class="tally-bar" style="width: ${pct}%"></div>
        <div class="tally-content">
          <div class="${nameClass}" style="font-size: 1.25rem;">
            <span style="color: var(--cyan); margin-right: 8px;">#${idx + 1}</span>
            <span>${item.name}</span>
          </div>
          <div class="tally-votes" style="font-size: 1.35rem;">${item.count} phiếu</div>
        </div>
      `;
      elSqTallyList.appendChild(row);
    });
  }

  function showSpotlight(tally, question, winner, winnerDetails) {
    const theme = (question && question.effectTheme) ? question.effectTheme : 'royal-gold';

    // Apply question-specific theme class
    spotlightModal.className = `spotlight-overlay theme-${theme}`;

    if (window.soundFX) {
      window.soundFX.playTheme(theme);
    }
    if (window.burstCannons) window.burstCannons();

    // Crown / Theme Icon
    if (spotlightCrown) {
      spotlightCrown.textContent = (question && question.icon) ? question.icon : '👑';
    }

    // Title / Badge
    if (spotlightBadge) {
      spotlightBadge.textContent = (question && question.title) ? question.title.toUpperCase() : 'NHÂN VẬT ĐƯỢC GỌI TÊN NHIỀU NHẤT';
    }

    if (winner) {
      spotWinnerName.textContent = winner.name.toUpperCase();
      spotWinnerVotes.textContent = `Đạt ${winner.count} / ${tally.totalVotes} phiếu bình chọn (${Math.round((winner.count / (tally.totalVotes || 1)) * 100)}%)`;
    } else {
      spotWinnerName.textContent = 'CHƯA CÓ BÌNH CHỌN';
      spotWinnerVotes.textContent = '0 phiếu';
    }



    // Zodiac & Con Giap Display
    if (spotZodiacCard) {
      if (winnerDetails && winnerDetails.zodiac && window.zodiacHelper) {
        spotZodiacCard.innerHTML = window.zodiacHelper.generateZodiacBadgesHtml(winnerDetails.zodiac, 'normal');
        spotZodiacCard.style.display = 'flex';
      } else {
        spotZodiacCard.style.display = 'none';
      }
    }

    spotPunishment.textContent = (question && question.punishment) ? question.punishment : 'Uống 1 chén danh dự khai tiệc! 🍻';
    spotMcVoice.textContent = (question && question.mcVoice) ? `"${question.mcVoice}"` : '"Xin chúc mừng đồng chí được gọi tên nhiều nhất!"';

    spotlightModal.style.display = 'flex';
  }

  socket.on('squizz_question_started', ({ currentIndex, total, timeLimit, question }) => {
    switchView('squizz');
    renderSquizz(question, currentIndex, total, timeLimit);
    if (window.soundFX) window.soundFX.playJoin();
  });

  socket.on('squizz_timer_tick', ({ timeRemaining }) => {
    elSqTimerNum.textContent = timeRemaining;
    if (window.soundFX) {
      if (timeRemaining <= 5 && timeRemaining > 0) window.soundFX.playUrgentTick();
      else window.soundFX.playTick();
    }
  });

  socket.on('squizz_live_update', ({ tally, totalVotes, totalPlayers }) => {
    renderSquizzTally(tally, projState.squizz.isRevealed);
    elSqVoted.textContent = totalVotes;
    const totalEl = document.getElementById('proj-sq-total');
    if (totalEl) totalEl.textContent = totalPlayers;
  });

  socket.on('squizz_lock_changed', ({ isOpen }) => {
    if (isOpen) {
      elSqLock.textContent = '● Đang mở bình chọn';
      elSqLock.style.color = 'var(--emerald)';
    } else {
      elSqLock.textContent = '● Đã chốt bình chọn';
      elSqLock.style.color = 'var(--rose)';
    }
  });

  socket.on('squizz_revealed', ({ tally, question, winner, winnerDetails }) => {
    projState.squizz.isRevealed = true;
    renderSquizzTally(tally, true);
    showSpotlight(tally, question, winner, winnerDetails);
  });

  // Click on spotlight to dismiss
  spotlightModal.addEventListener('click', () => {
    spotlightModal.style.display = 'none';
  });

  // --- QA PRESENTATION ---
  const elQaCat = document.getElementById('proj-qa-cat');
  const elQaIndex = document.getElementById('proj-qa-index');
  const elQaText = document.getElementById('proj-qa-text');
  const elQaTimerNum = document.getElementById('proj-qa-timer-num');
  const elQaTimerRing = document.getElementById('proj-qa-timer-ring');
  const elQaAnswered = document.getElementById('proj-qa-answered');
  const elQaExplanationBox = document.getElementById('proj-qa-explanation-box');
  const elQaExplanationText = document.getElementById('proj-qa-explanation-text');

  function renderQa(q, index, total, timeLimit) {
    projState.qa.currentIndex = index;
    projState.qa.question = q;
    projState.qa.timeLimit = timeLimit || 20;
    projState.qa.timeRemaining = projState.qa.timeLimit;

    elQaCat.textContent = `${q.icon || '⚔️'} ${q.category || 'Đố vui'}`;
    elQaIndex.textContent = `CÂU ${index + 1} / ${total || 15}`;
    elQaText.textContent = q.question;
    elQaTimerNum.textContent = projState.qa.timeRemaining;
    elQaTimerRing.style.background = `conic-gradient(var(--cyan) 100%, transparent 0)`;
    elQaAnswered.textContent = '0';
    elQaExplanationBox.style.display = 'none';

    for (let i = 0; i < 4; i++) {
      const card = document.getElementById(`pcard-${i}`);
      const text = document.getElementById(`ptext-${i}`);
      const count = document.getElementById(`pcount-${i}`);
      if (card && text) {
        card.classList.remove('correct-answer', 'dimmed');
        text.textContent = (q.options && q.options[i]) ? q.options[i] : '';
        count.style.display = 'none';
        count.textContent = '0';
      }
    }
  }

  socket.on('qa_question_started', ({ currentIndex, total, timeLimit, question }) => {
    switchView('qa');
    renderQa(question, currentIndex, total, timeLimit);
    if (window.soundFX) window.soundFX.playJoin();
  });

  socket.on('qa_timer_tick', ({ timeRemaining }) => {
    projState.qa.timeRemaining = timeRemaining;
    elQaTimerNum.textContent = timeRemaining;
    const fraction = Math.max(0, timeRemaining / projState.qa.timeLimit);
    const degrees = Math.round(fraction * 360);
    elQaTimerRing.style.background = `conic-gradient(${timeRemaining <= 5 ? 'var(--rose)' : 'var(--cyan)'} ${degrees}deg, transparent 0)`;

    if (window.soundFX) {
      if (timeRemaining <= 5 && timeRemaining > 0) window.soundFX.playUrgentTick();
      else window.soundFX.playTick();
    }
  });

  socket.on('qa_time_up', () => {
    elQaTimerNum.textContent = '0';
    if (window.soundFX) window.soundFX.playBuzzer();
  });

  socket.on('qa_live_update', ({ stats, totalAnswered, totalPlayers }) => {
    elQaAnswered.textContent = totalAnswered;
    const qaTotal = document.getElementById('proj-qa-total');
    if (qaTotal) qaTotal.textContent = totalPlayers;
  });

  socket.on('qa_revealed', ({ correctAnswer, explanation, stats }) => {
    if (window.soundFX) window.soundFX.playCorrect();
    if (window.fireConfetti) window.fireConfetti({ count: 60 });

    for (let i = 0; i < 4; i++) {
      const card = document.getElementById(`pcard-${i}`);
      const count = document.getElementById(`pcount-${i}`);
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

  // Leaderboard & Podium
  socket.on('game_mode_changed', ({ mode }) => {
    projState.mode = mode;
    if (mode === 'LOBBY') switchView('lobby');
    if (mode === 'PODIUM') switchView('podium');
  });

  socket.on('podium_celebration', ({ leaderboard, top3 }) => {
    switchView('podium');
    if (window.soundFX) window.soundFX.playCheer();
    if (window.burstCannons) window.burstCannons();

    if (top3[0]) {
      document.getElementById('pod-avatar-1').textContent = top3[0].avatar;
      document.getElementById('pod-name-1').textContent = top3[0].nickname.toUpperCase();
      document.getElementById('pod-score-1').textContent = `${top3[0].score.toLocaleString()} điểm`;
    }
    if (top3[1]) {
      document.getElementById('pod-avatar-2').textContent = top3[1].avatar;
      document.getElementById('pod-name-2').textContent = top3[1].nickname;
      document.getElementById('pod-score-2').textContent = `${top3[1].score.toLocaleString()} điểm`;
    }
    if (top3[2]) {
      document.getElementById('pod-avatar-3').textContent = top3[2].avatar;
      document.getElementById('pod-name-3').textContent = top3[2].nickname;
      document.getElementById('pod-score-3').textContent = `${top3[2].score.toLocaleString()} điểm`;
    }

    // Periodic fireworks on podium
    const interval = setInterval(() => {
      if (views.podium.style.display !== 'none') {
        if (window.fireConfetti) window.fireConfetti();
      } else {
        clearInterval(interval);
      }
    }, 2500);
  });

  // Cheer / Toast everywhere
  socket.on('party_cheer', () => {
    if (window.burstCannons) window.burstCannons();
    if (window.soundFX) window.soundFX.playGlassClink();
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

  // Fullscreen toggle
  const btnFullscreen = document.getElementById('btn-fullscreen');
  btnFullscreen.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(console.error);
    } else {
      document.exitFullscreen().catch(console.error);
    }
  });

  // Double click anywhere on screen toggles fullscreen
  document.addEventListener('dblclick', (e) => {
    if (e.target.tagName !== 'BUTTON' && e.target.tagName !== 'INPUT') {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(console.error);
      } else {
        document.exitFullscreen().catch(console.error);
      }
    }
  });
});
