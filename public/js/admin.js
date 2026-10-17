// Admin / MC Controller Logic (Dedicated to Host & MC)
document.addEventListener('DOMContentLoaded', () => {
  const socket = io();

  let adminState = {
    mode: 'LOBBY',
    players: [],
    squizzQuestions: [],
    qaQuestions: [],
    members: [],
    activation: null,
    actTab: 'all',
    squizzIndex: 0,
    qaIndex: 0,
    isSquizzLocked: false,
    isSquizzPaused: false,
    isQaLocked: false,
    timerLimit: 30,
    qaIsPaused: false,
    qaAutoReveal: true
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

  const adminSquizzControlsPanel = document.getElementById('admin-squizz-controls-panel');
  const btnSquizzPause = document.getElementById('btn-squizz-pause');
  const btnSquizzAdd10s = document.getElementById('btn-squizz-add-10s');

  const adminQaControlsPanel = document.getElementById('admin-qa-controls-panel');
  const btnQaAutoToggle = document.getElementById('btn-qa-auto-toggle');
  const btnQaPause = document.getElementById('btn-qa-pause');
  const btnQaAdd5s = document.getElementById('btn-qa-add-5s');
  const btnQaAdd10s = document.getElementById('btn-qa-add-10s');
  const btnQaRevealQuick = document.getElementById('btn-qa-reveal-quick');
  const btnQaShowWrong = document.getElementById('btn-qa-show-wrong');
  const btnQaShowLeaderboard = document.getElementById('btn-qa-show-leaderboard');

  const adminQaWrongMonitor = document.getElementById('admin-qa-wrong-monitor');
  const adminQaWrongCountBadge = document.getElementById('admin-qa-wrong-count-badge');
  const adminQaWrongList = document.getElementById('admin-qa-wrong-list');

  const elActSummary = document.getElementById('admin-act-summary');
  const elActMissingBadge = document.getElementById('admin-act-missing-badge');

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>'"]/g, tag => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[tag] || tag));
  }

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

    if (data.activation) {
      adminState.activation = data.activation;
      updateActivationBadges(data.activation);
    }

    if (data.squizz) {
      adminState.isSquizzPaused = data.squizz.isPaused || false;
      adminState.isSquizzLocked = data.squizz.isOpen === false;
      if (btnSquizzPause) {
        btnSquizzPause.textContent = adminState.isSquizzPaused ? '▶️ Tiếp Tục Timer' : '⏸️ Tạm Dừng Timer';
      }
    }
    if (data.qa) {
      adminState.qaIsPaused = data.qa.isPaused || false;
      adminState.isQaLocked = data.qa.isOpen === false;
      adminState.qaAutoReveal = data.qa.autoReveal !== undefined ? data.qa.autoReveal : true;
      if (btnQaPause) {
        btnQaPause.textContent = adminState.qaIsPaused ? '▶️ Tiếp Tục Timer' : '⏸️ Tạm Dừng Timer';
      }
      if (btnQaAutoToggle) {
        btnQaAutoToggle.textContent = adminState.qaAutoReveal ? '⚙️ Tự động 15s: BẬT' : '⚙️ Tự động 15s: TẮT';
        btnQaAutoToggle.style.color = adminState.qaAutoReveal ? '#6ee7b7' : '#fca5a5';
      }
    }

    if (data.mode === 'SQUIZZ' && data.squizz && data.squizz.question) {
      updateSquizzTeleprompter(data.squizz.question, data.squizz.currentIndex, data.squizzQuestions.length);
      if (data.squizz.tally) updateSecretTally(data.squizz.tally);
    } else if (data.mode === 'QA' && data.qa && data.qa.question) {
      updateQaTeleprompter(data.qa.question, data.qa.currentIndex, data.qaQuestions.length);
    }
  });

  socket.on('player_list_updated', ({ players, total, activation }) => {
    adminState.players = players;
    updatePlayerCount(total);
    if (activation) {
      adminState.activation = activation;
      updateActivationBadges(activation);
      renderActivationTable();
    }
  });

  function updateActivationBadges(activation) {
    if (!activation) return;
    if (elActSummary) {
      elActSummary.textContent = `${activation.activatedCount}/${activation.totalMembers} Đã Điểm Danh`;
    }
    if (elActMissingBadge) {
      elActMissingBadge.textContent = `${activation.missingCount} chưa vào`;
      elActMissingBadge.style.display = activation.missingCount > 0 ? 'inline-block' : 'none';
    }
    const missingBadgeModal = document.getElementById('modal-missing-count-badge');
    if (missingBadgeModal) missingBadgeModal.textContent = activation.missingCount;
    const activeBadgeModal = document.getElementById('modal-active-count-badge');
    if (activeBadgeModal) activeBadgeModal.textContent = activation.activatedCount;
  }

  socket.on('questions_updated', () => {
    // Refresh question list
    Promise.all([
      fetch('/api/questions/squizz').then(r => r.json()),
      fetch('/api/questions/qa').then(r => r.json())
    ]).then(([sqList, qaList]) => {
      adminState.squizzQuestions = sqList;
      adminState.qaQuestions = qaList;
      populateJumpSelect();
      if (typeof updateQuestionCountBadges === 'function') updateQuestionCountBadges();
      if (typeof activeModalTab !== 'undefined' && activeModalTab === 'list' && typeof renderQuestionManagerList === 'function') {
        renderQuestionManagerList();
      }
    });
  });

  socket.on('members_updated', (members) => {
    adminState.members = members;
    renderMembersTable(members);
  });

  function updatePlayerCount(total) {
    if (elPlayerCount) elPlayerCount.textContent = total;
    if (elTotalCount) elTotalCount.textContent = total;
  }

  function updateModeBadge(mode) {
    if (!elModeBadge) return;
    if (adminSquizzControlsPanel) {
      adminSquizzControlsPanel.style.display = (mode === 'SQUIZZ') ? 'flex' : 'none';
    }
    if (adminQaControlsPanel) {
      adminQaControlsPanel.style.display = (mode === 'QA') ? 'flex' : 'none';
    }
    if (mode !== 'QA') {
      if (adminQaWrongMonitor) adminQaWrongMonitor.style.display = 'none';
    }
    if (mode === 'SQUIZZ') {
      elModeBadge.textContent = 'BỘ 1: SQUIZZ (BÓC PHỐT)';
      elModeBadge.style.color = 'var(--rose)';
      if (btnToggleLock) {
        btnToggleLock.textContent = adminState.isSquizzLocked ? '🔓 MỞ LẠI BÌNH CHỌN' : '🔒 KHÓA BÌNH CHỌN';
      }
    } else if (mode === 'QA') {
      elModeBadge.textContent = 'BỘ 2: ĐẤU TRÍ Q&A';
      elModeBadge.style.color = 'var(--primary)';
      if (btnToggleLock) {
        btnToggleLock.textContent = adminState.isQaLocked ? '🔓 MỞ LẠI ĐÁP ÁN' : '🔒 KHÓA ĐÁP ÁN';
      }
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
      g1.label = '🎭 Bộ 1: Squizz (Bình chọn & Mở)';
      adminState.squizzQuestions.forEach((q, i) => {
        const opt = document.createElement('option');
        opt.value = `SQUIZZ:${i}`;
        const typeTag = q.type === 'OPEN_TEXT' ? '[CÂU MỞ] ' : '';
        opt.textContent = `Câu ${i + 1}: ${typeTag}${q.title || q.question.slice(0, 30)}`;
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
        const typeTag = q.type === 'OPEN_TEXT' ? '[CÂU MỞ] ' : '';
        opt.textContent = `Câu ${i + 1}: ${typeTag}${q.question.slice(0, 30)}...`;
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

    const totalCount = total || adminState.squizzQuestions.length || 12;
    const typeLabel = q.type === 'OPEN_TEXT' ? ' (CÂU HỎI MỞ)' : '';
    elCurrentQPill.textContent = `CÂU ${index + 1} / ${totalCount}${typeLabel}`;
    elTargetBadge.textContent = `🎯 Mục tiêu: ${q.target || 'Bình chọn vui nhộn'}`;
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

    const totalCount = total || adminState.qaQuestions.length || 15;
    elCurrentQPill.textContent = `CÂU ${index + 1} / ${totalCount} (Q&A)`;
    elTargetBadge.textContent = `${q.icon || '⚔️'} ${q.category || 'Đố vui'}`;
    elQText.textContent = q.question;
    elMcVoice.textContent = q.explanation ? `💡 Lời giải thích: "${q.explanation}"` : 'Cùng xem ai trả lời đúng và nhanh nhất!';
    elPunishment.textContent = q.type === 'OPEN_TEXT' ? 'Câu hỏi tự luận mở' : `Đáp án đúng: Phương án ${String.fromCharCode(65 + (q.correctAnswer || 0))}`;
    elVotedCount.textContent = '0';
    btnToggleLock.textContent = '🔒 KHÓA ĐÁP ÁN';
  }

  function updateSecretTally(tally) {
    if (!elSecretTally || !tally) return;
    elVotedCount.textContent = tally.totalVotes || 0;

    const isText = (adminState.squizzQuestions[adminState.squizzIndex] && adminState.squizzQuestions[adminState.squizzIndex].type === 'OPEN_TEXT') || tally.isTextQuestion;

    if (isText && tally.responses && tally.responses.length > 0) {
      elSecretTally.innerHTML = '';
      tally.responses.forEach(r => {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.flexDirection = 'column';
        row.style.padding = '6px 10px';
        row.style.background = 'rgba(255, 255, 255, 0.08)';
        row.style.borderRadius = '8px';
        row.style.fontSize = '0.9rem';
        row.innerHTML = `
          <div style="font-weight: 700; color: #fff;">"${r.text}"</div>
          <div style="font-size: 0.75rem; color: var(--cyan); margin-top: 2px;">👤 ${r.voter}</div>
        `;
        elSecretTally.appendChild(row);
      });
      return;
    }

    if (!tally.tallyList || tally.tallyList.length === 0) {
      elSecretTally.innerHTML = '<div style="color: var(--text-muted); font-style: italic; font-size: 0.9rem;">Chưa có phiếu nào...</div>';
      return;
    }

    elSecretTally.innerHTML = '';
    tally.tallyList.slice(0, 6).forEach((item, idx) => {
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.justifyContent = 'space-between';
      row.style.padding = '5px 10px';
      row.style.background = idx === 0 ? 'rgba(245, 158, 11, 0.25)' : 'rgba(255, 255, 255, 0.05)';
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
    adminState.isSquizzPaused = false;
    adminState.isSquizzLocked = false;
    if (btnSquizzPause) {
      btnSquizzPause.textContent = '⏸️ Tạm Dừng Timer';
      btnSquizzPause.style.background = '';
      btnSquizzPause.style.borderColor = '';
      btnSquizzPause.style.color = '';
    }
    updateSquizzTeleprompter(question, currentIndex, total);
  });

  socket.on('squizz_timer_tick', ({ timeRemaining, isPaused }) => {
    if (isPaused) {
      elTimerDisplay.textContent = `⏸️ ${timeRemaining}s`;
      elTimerDisplay.style.color = 'var(--gold)';
    } else {
      elTimerDisplay.textContent = `${timeRemaining}s`;
      elTimerDisplay.style.color = timeRemaining <= 5 ? 'var(--rose)' : 'var(--cyan)';
    }
  });

  socket.on('squizz_timer_paused', ({ isPaused, timeRemaining }) => {
    adminState.isSquizzPaused = isPaused;
    if (btnSquizzPause) {
      btnSquizzPause.textContent = isPaused ? '▶️ Tiếp Tục Timer' : '⏸️ Tạm Dừng Timer';
      if (isPaused) {
        btnSquizzPause.style.background = 'rgba(245, 158, 11, 0.3)';
        btnSquizzPause.style.borderColor = 'var(--gold)';
        btnSquizzPause.style.color = '#fef08a';
      } else {
        btnSquizzPause.style.background = '';
        btnSquizzPause.style.borderColor = '';
        btnSquizzPause.style.color = '';
      }
    }
    if (isPaused) {
      elTimerDisplay.textContent = `⏸️ ${timeRemaining !== undefined ? timeRemaining : ''}s`;
      elTimerDisplay.style.color = 'var(--gold)';
    }
  });

  socket.on('squizz_live_update', ({ tally, totalVotes, totalPlayers }) => {
    updateSecretTally(tally);
    updatePlayerCount(totalPlayers);
  });

  socket.on('squizz_lock_changed', ({ isOpen }) => {
    adminState.isSquizzLocked = !isOpen;
    if (adminState.mode === 'SQUIZZ' && btnToggleLock) {
      btnToggleLock.textContent = isOpen ? '🔒 KHÓA BÌNH CHỌN' : '🔓 MỞ LẠI BÌNH CHỌN';
    }
  });

  socket.on('qa_question_started', ({ currentIndex, total, question }) => {
    adminState.qaIsPaused = false;
    adminState.isQaLocked = false;
    if (btnQaPause) {
      btnQaPause.textContent = '⏸️ Tạm Dừng Timer';
      btnQaPause.style.background = '';
      btnQaPause.style.borderColor = '';
      btnQaPause.style.color = '';
    }
    updateQaTeleprompter(question, currentIndex, total);
    if (adminQaWrongMonitor) adminQaWrongMonitor.style.display = 'none';
    if (adminQaWrongList) adminQaWrongList.innerHTML = '';
    if (adminQaWrongCountBadge) adminQaWrongCountBadge.textContent = '0';
  });

  socket.on('qa_timer_tick', ({ timeRemaining, isPaused }) => {
    if (isPaused) {
      elTimerDisplay.textContent = `⏸️ ${timeRemaining}s`;
      elTimerDisplay.style.color = 'var(--gold)';
    } else {
      elTimerDisplay.textContent = `${timeRemaining}s`;
      elTimerDisplay.style.color = timeRemaining <= 5 ? 'var(--rose)' : 'var(--cyan)';
    }
  });

  socket.on('qa_lock_changed', ({ isOpen }) => {
    adminState.isQaLocked = !isOpen;
    if (adminState.mode === 'QA' && btnToggleLock) {
      btnToggleLock.textContent = isOpen ? '🔒 KHÓA ĐÁP ÁN' : '🔓 MỞ LẠI ĐÁP ÁN';
    }
  });

  socket.on('qa_live_update', ({ stats, totalAnswered, totalPlayers }) => {
    elVotedCount.textContent = totalAnswered;
    updatePlayerCount(totalPlayers);
  });

  socket.on('qa_revealed', ({ wrongAnswers, correctAnswers, unanswered, correctAnswer, explanation, leaderboard }) => {
    if (adminQaWrongMonitor) {
      adminQaWrongMonitor.style.display = 'block';
      const wrongList = wrongAnswers || [];
      if (adminQaWrongCountBadge) adminQaWrongCountBadge.textContent = wrongList.length;
      if (adminQaWrongList) {
        if (wrongList.length === 0) {
          adminQaWrongList.innerHTML = '<div style="color: #6ee7b7; font-weight: 700; font-size: 0.85rem; padding: 4px;">🎉 Tuyệt vời! Không ai trả lời sai câu này!</div>';
        } else {
          const optLabels = ['A', 'B', 'C', 'D'];
          adminQaWrongList.innerHTML = wrongList.map(p => {
            const optLetter = p.chosenOption >= 0 ? (optLabels[p.chosenOption] || p.chosenOption) : 'Chưa chọn';
            return `
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 5px 8px; background: rgba(0,0,0,0.25); border-radius: 6px; font-size: 0.85rem;">
                <span style="font-weight: 700; color: #fff;">${p.avatar || '😎'} ${escapeHtml(p.nickname || p.name)}</span>
                <span style="color: #fca5a5; font-weight: 800; font-size: 0.8rem;">Đã chọn: ${optLetter}</span>
              </div>
            `;
          }).join('');
        }
      }
    }
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
    socket.emit('host_squizz_start', { questionIndex: 0, timeLimit: 30 });
  });

  document.getElementById('btn-mode-qa').addEventListener('click', () => {
    socket.emit('host_qa_start', { questionIndex: 0, timeLimit: 15 });
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
    } else if (adminState.mode === 'QA') {
      const newOpen = adminState.isQaLocked;
      socket.emit('host_qa_toggle_lock', { open: newOpen });
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

  // Squizz MC Control Buttons
  if (btnSquizzPause) {
    btnSquizzPause.addEventListener('click', () => {
      socket.emit('host_squizz_pause_timer', { pause: !adminState.isSquizzPaused });
    });
  }

  if (btnSquizzAdd10s) {
    btnSquizzAdd10s.addEventListener('click', () => {
      socket.emit('host_squizz_add_time', { seconds: 10 });
    });
  }

  // QA MC Control Buttons
  if (btnQaAutoToggle) {
    btnQaAutoToggle.addEventListener('click', () => {
      socket.emit('host_qa_toggle_auto', { enabled: !adminState.qaAutoReveal });
    });
  }

  if (btnQaPause) {
    btnQaPause.addEventListener('click', () => {
      socket.emit('host_qa_pause_timer', { pause: !adminState.qaIsPaused });
    });
  }

  if (btnQaAdd5s) {
    btnQaAdd5s.addEventListener('click', () => {
      socket.emit('host_qa_add_time', { seconds: 5 });
    });
  }

  if (btnQaAdd10s) {
    btnQaAdd10s.addEventListener('click', () => {
      socket.emit('host_qa_add_time', { seconds: 10 });
    });
  }

  if (btnQaRevealQuick) {
    btnQaRevealQuick.addEventListener('click', () => {
      socket.emit('host_qa_reveal');
    });
  }

  if (btnQaShowWrong) {
    btnQaShowWrong.addEventListener('click', () => {
      socket.emit('host_qa_set_display', { displayMode: 'WRONG_ANSWERS' });
    });
  }

  if (btnQaShowLeaderboard) {
    btnQaShowLeaderboard.addEventListener('click', () => {
      socket.emit('host_qa_set_display', { displayMode: 'LEADERBOARD' });
    });
  }

  socket.on('qa_auto_toggled', ({ autoReveal }) => {
    adminState.qaAutoReveal = autoReveal;
    if (btnQaAutoToggle) {
      btnQaAutoToggle.textContent = autoReveal ? '⚙️ Tự động 15s: BẬT' : '⚙️ Tự động 15s: TẮT';
      btnQaAutoToggle.style.color = autoReveal ? '#6ee7b7' : '#fca5a5';
    }
  });

  socket.on('qa_timer_paused', ({ isPaused }) => {
    adminState.qaIsPaused = isPaused;
    if (btnQaPause) {
      btnQaPause.textContent = isPaused ? '▶️ Tiếp Tục Timer' : '⏸️ Tạm Dừng Timer';
      if (isPaused) {
        btnQaPause.style.background = 'rgba(245, 158, 11, 0.3)';
        btnQaPause.style.borderColor = 'var(--gold)';
        btnQaPause.style.color = '#fef08a';
      } else {
        btnQaPause.style.background = '';
        btnQaPause.style.borderColor = '';
        btnQaPause.style.color = '';
      }
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

  // --- MODAL 1: QUESTION MANAGER & ADDER (STRICT COMPLIANCE WITH SET RULES) ---
  const modalAddQ = document.getElementById('modal-add-question');
  const btnOpenAddQ = document.getElementById('btn-open-add-q');
  const btnCloseAddQ = document.getElementById('btn-close-add-q');
  const btnCancelAddQ = document.getElementById('btn-cancel-add-q');
  const btnSaveAddQ = document.getElementById('btn-save-add-q');

  const tabQAdd = document.getElementById('tab-q-add');
  const tabQList = document.getElementById('tab-q-list');
  const tabContentQAdd = document.getElementById('tab-content-q-add');
  const tabContentQList = document.getElementById('tab-content-q-list');

  const subtabQSquizz = document.getElementById('subtab-q-squizz');
  const subtabQQa = document.getElementById('subtab-q-qa');
  const countQSquizz = document.getElementById('count-q-squizz');
  const countQQa = document.getElementById('count-q-qa');
  const qListContainer = document.getElementById('q-list-container');

  const addQSection = document.getElementById('add-q-section');
  const qRuleSquizz = document.getElementById('q-rule-box-squizz');
  const qRuleQa = document.getElementById('q-rule-box-qa');
  const lblQTitle = document.getElementById('lbl-q-title');
  const addQTitle = document.getElementById('add-q-title');
  const addQText = document.getElementById('add-q-text');
  const boxSquizzFields = document.getElementById('box-squizz-fields');
  const boxQaFields = document.getElementById('box-qa-fields');

  let activeModalTab = 'add'; // 'add' or 'list'
  let activeListSubtab = 'squizz'; // 'squizz' or 'qa'

  function updateQuestionCountBadges() {
    if (countQSquizz) countQSquizz.textContent = adminState.squizzQuestions.length;
    if (countQQa) countQQa.textContent = adminState.qaQuestions.length;
  }

  if (btnOpenAddQ) {
    btnOpenAddQ.addEventListener('click', () => {
      modalAddQ.style.display = 'flex';
      switchModalTab('add');
      syncAddQFormFields();
      updateQuestionCountBadges();
    });
  }

  [btnCloseAddQ, btnCancelAddQ].forEach(b => {
    if (b) b.addEventListener('click', () => modalAddQ.style.display = 'none');
  });

  // Modal Top Tabs
  function switchModalTab(tab) {
    activeModalTab = tab;
    if (tab === 'add') {
      if (tabQAdd) { tabQAdd.classList.remove('btn-secondary'); tabQAdd.classList.add('btn-primary'); }
      if (tabQList) { tabQList.classList.remove('btn-primary'); tabQList.classList.add('btn-secondary'); }
      if (tabContentQAdd) tabContentQAdd.style.display = 'block';
      if (tabContentQList) tabContentQList.style.display = 'none';
    } else {
      if (tabQAdd) { tabQAdd.classList.remove('btn-primary'); tabQAdd.classList.add('btn-secondary'); }
      if (tabQList) { tabQList.classList.remove('btn-secondary'); tabQList.classList.add('btn-primary'); }
      if (tabContentQAdd) tabContentQAdd.style.display = 'none';
      if (tabContentQList) tabContentQList.style.display = 'flex';
      renderQuestionManagerList();
    }
  }

  if (tabQAdd) tabQAdd.addEventListener('click', () => switchModalTab('add'));
  if (tabQList) tabQList.addEventListener('click', () => switchModalTab('list'));

  // Section Rule Synchronization
  function syncAddQFormFields() {
    const sec = addQSection.value;
    if (sec === 'SQUIZZ') {
      // BỘ 1: BÌNH CHỌN THÀNH VIÊN TRONG CHUYẾN ĐI
      if (qRuleSquizz) qRuleSquizz.style.display = 'block';
      if (qRuleQa) qRuleQa.style.display = 'none';
      if (lblQTitle) lblQTitle.textContent = 'Tiêu đề danh hiệu / Biệt danh (Bộ 1):';
      if (addQTitle) addQTitle.placeholder = 'Ví dụ: Thần giữ cửa Phương Đông, Siêu quậy chuyến đi, Chiến thần Karaoke...';
      if (addQText) addQText.placeholder = 'Ví dụ: Ai là người quẩy nhiệt tình nhất trong chuyến đi dã ngoại?';
      if (boxSquizzFields) boxSquizzFields.style.display = 'block';
      if (boxQaFields) boxQaFields.style.display = 'none';
    } else {
      // BỘ 2: TRẮC NGHIỆM 4 ĐÁP ÁN (A, B, C, D)
      if (qRuleSquizz) qRuleSquizz.style.display = 'none';
      if (qRuleQa) qRuleQa.style.display = 'block';
      if (lblQTitle) lblQTitle.textContent = 'Chủ đề câu hỏi (Bộ 2):';
      if (addQTitle) addQTitle.placeholder = 'Ví dụ: Lịch sử Việt Nam, Văn hóa Phương Đông, Đố vui mẹo, Nghiệp vụ...';
      if (addQText) addQText.placeholder = 'Nhập nội dung câu hỏi trắc nghiệm muốn đố người chơi...';
      if (boxSquizzFields) boxSquizzFields.style.display = 'none';
      if (boxQaFields) boxQaFields.style.display = 'block';
    }
  }

  if (addQSection) {
    addQSection.addEventListener('change', syncAddQFormFields);
  }

  // Save / Add Question
  if (btnSaveAddQ) {
    btnSaveAddQ.addEventListener('click', () => {
      const sec = addQSection.value;
      const title = addQTitle.value.trim();
      const text = addQText.value.trim();

      if (!text) {
        alert('Vui lòng nhập nội dung câu hỏi!');
        addQText.focus();
        return;
      }

      btnSaveAddQ.textContent = 'Đang lưu...';
      btnSaveAddQ.disabled = true;

      if (sec === 'SQUIZZ') {
        // BỘ 1: TUÂN THỦ LUẬT BÌNH CHỌN THÀNH VIÊN TRONG CHUYẾN ĐI
        const theme = document.getElementById('add-q-theme').value;
        const punishment = document.getElementById('add-q-punishment').value.trim();
        const time = parseInt(document.getElementById('add-q-time-squizz').value, 10) || 30;
        const mcVoice = document.getElementById('add-q-mcvoice').value.trim();

        fetch('/api/questions/squizz/add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: title || 'DANH HIỆU BÓC PHỐT MỚI',
            question: text,
            effectTheme: theme,
            punishment: punishment || 'Uống 1 chén danh dự! 🍻',
            mcVoice: mcVoice || 'Xin chúc mừng đồng chí được bình chọn nhiều nhất!',
            target: 'Bình chọn đồng nghiệp chuyến đi',
            timeLimit: time
          })
        })
        .then(r => r.json())
        .then(res => {
          btnSaveAddQ.textContent = '💾 Lưu & Đưa Vào Trò Chơi Ngay';
          btnSaveAddQ.disabled = false;
          alert(`✅ Đã thêm câu hỏi bình chọn vào BỘ 1 thành công!\n(Tổng số câu Bộ 1 hiện tại: ${res.total} câu)`);
          addQTitle.value = '';
          addQText.value = '';
          // Refresh questions and switch to list
          refreshAllQuestions().then(() => switchModalTab('list'));
        })
        .catch(err => {
          btnSaveAddQ.textContent = '💾 Lưu & Đưa Vào Trò Chơi Ngay';
          btnSaveAddQ.disabled = false;
          alert('Lỗi khi thêm câu hỏi: ' + err.message);
        });

      } else {
        // BỘ 2: TUÂN THỦ LUẬT TRẮC NGHIỆM 4 ĐÁP ÁN (A, B, C, D)
        const opt0 = document.getElementById('add-opt-0').value.trim();
        const opt1 = document.getElementById('add-opt-1').value.trim();
        const opt2 = document.getElementById('add-opt-2').value.trim();
        const opt3 = document.getElementById('add-opt-3').value.trim();
        const correct = parseInt(document.getElementById('add-correct-idx').value, 10) || 0;
        const explanation = document.getElementById('add-qa-explanation').value.trim();
        const time = parseInt(document.getElementById('add-q-time-qa').value, 10) || 15;

        if (!opt0 || !opt1 || !opt2 || !opt3) {
          btnSaveAddQ.textContent = '💾 Lưu & Đưa Vào Trò Chơi Ngay';
          btnSaveAddQ.disabled = false;
          alert('Vui lòng nhập đầy đủ cả 4 đáp án A, B, C, D cho câu hỏi trắc nghiệm Bộ 2!');
          return;
        }

        fetch('/api/questions/qa/add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            category: title || 'Đố vui Team Building',
            question: text,
            options: [opt0, opt1, opt2, opt3],
            correctAnswer: correct,
            explanation: explanation || 'Đáp án chính xác!',
            timeLimit: time
          })
        })
        .then(r => r.json())
        .then(res => {
          btnSaveAddQ.textContent = '💾 Lưu & Đưa Vào Trò Chơi Ngay';
          btnSaveAddQ.disabled = false;
          alert(`✅ Đã thêm câu hỏi trắc nghiệm vào BỘ 2 thành công!\n(Tổng số câu Bộ 2 hiện tại: ${res.total} câu)`);
          addQTitle.value = '';
          addQText.value = '';
          document.getElementById('add-opt-0').value = '';
          document.getElementById('add-opt-1').value = '';
          document.getElementById('add-opt-2').value = '';
          document.getElementById('add-opt-3').value = '';
          document.getElementById('add-qa-explanation').value = '';
          // Refresh questions and switch to list
          activeListSubtab = 'qa';
          refreshAllQuestions().then(() => switchModalTab('list'));
        })
        .catch(err => {
          btnSaveAddQ.textContent = '💾 Lưu & Đưa Vào Trò Chơi Ngay';
          btnSaveAddQ.disabled = false;
          alert('Lỗi khi thêm câu hỏi: ' + err.message);
        });
      }
    });
  }

  function refreshAllQuestions() {
    return Promise.all([
      fetch('/api/questions/squizz').then(r => r.json()),
      fetch('/api/questions/qa').then(r => r.json())
    ]).then(([sqList, qaList]) => {
      adminState.squizzQuestions = sqList;
      adminState.qaQuestions = qaList;
      populateJumpSelect();
      updateQuestionCountBadges();
      if (activeModalTab === 'list') renderQuestionManagerList();
    });
  }

  // Subtabs inside Question List
  if (subtabQSquizz) {
    subtabQSquizz.addEventListener('click', () => {
      activeListSubtab = 'squizz';
      subtabQSquizz.style.opacity = '1';
      if (subtabQQa) subtabQQa.style.opacity = '0.6';
      renderQuestionManagerList();
    });
  }
  if (subtabQQa) {
    subtabQQa.addEventListener('click', () => {
      activeListSubtab = 'qa';
      subtabQQa.style.opacity = '1';
      if (subtabQSquizz) subtabQSquizz.style.opacity = '0.6';
      renderQuestionManagerList();
    });
  }

  function renderQuestionManagerList() {
    if (!qListContainer) return;
    qListContainer.innerHTML = '';
    updateQuestionCountBadges();

    if (activeListSubtab === 'squizz') {
      const list = adminState.squizzQuestions || [];
      if (list.length === 0) {
        qListContainer.innerHTML = '<div style="padding: 24px; text-align: center; color: var(--text-muted);">Chưa có câu hỏi nào trong Bộ 1...</div>';
        return;
      }

      list.forEach((q, idx) => {
        const item = document.createElement('div');
        item.style.background = 'rgba(255, 255, 255, 0.04)';
        item.style.border = '1px solid rgba(244, 63, 94, 0.25)';
        item.style.borderRadius = '12px';
        item.style.padding = '12px 14px';
        item.style.marginBottom = '10px';
        item.style.display = 'flex';
        item.style.justifyContent = 'space-between';
        item.style.alignItems = 'center';
        item.style.gap = '12px';

        item.innerHTML = `
          <div style="flex: 1;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px; flex-wrap: wrap;">
              <span style="font-weight: 900; color: var(--gold); font-size: 0.95rem;">CÂU ${idx + 1}</span>
              <span style="background: rgba(244, 63, 94, 0.25); border: 1px solid var(--rose); color: #fecdd3; padding: 2px 8px; border-radius: 999px; font-size: 0.75rem; font-weight: 800;">👤 VOTE THÀNH VIÊN</span>
              <span style="font-weight: 800; color: #fff; font-size: 0.95rem;">${q.icon || '🎯'} ${escapeHtml(q.title || '')}</span>
            </div>
            <div style="font-size: 0.9rem; color: #e2e8f0; margin-bottom: 4px;">${escapeHtml(q.question)}</div>
            <div style="font-size: 0.8rem; color: #fef08a;">
              <span>🎁 Phần thưởng/Phạt: ${escapeHtml(q.punishment || '--')}</span> • <span>⏱️ ${q.timeLimit || 30}s</span>
            </div>
          </div>
          <div style="display: flex; flex-direction: column; gap: 6px; min-width: 110px;">
            <button class="btn btn-primary btn-sm btn-jump-q" style="padding: 5px 10px; font-size: 0.8rem;">🚀 Chiếu câu này</button>
            <button class="btn btn-rose btn-sm btn-del-q" style="padding: 5px 10px; font-size: 0.8rem; background: rgba(244, 63, 94, 0.25); border: 1px solid var(--rose);">🗑️ Xóa</button>
          </div>
        `;

        item.querySelector('.btn-jump-q').addEventListener('click', () => {
          socket.emit('host_jump_to_q', { mode: 'SQUIZZ', index: idx });
          modalAddQ.style.display = 'none';
        });

        item.querySelector('.btn-del-q').addEventListener('click', () => {
          if (confirm(`Bạn có chắc muốn xóa Câu ${idx + 1}: "${q.title}" khỏi Bộ 1?`)) {
            fetch('/api/questions/squizz/delete', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ index: idx })
            })
            .then(r => r.json())
            .then(() => refreshAllQuestions())
            .catch(err => alert('Lỗi: ' + err.message));
          }
        });

        qListContainer.appendChild(item);
      });

    } else {
      // QA List
      const list = adminState.qaQuestions || [];
      if (list.length === 0) {
        qListContainer.innerHTML = '<div style="padding: 24px; text-align: center; color: var(--text-muted);">Chưa có câu hỏi nào trong Bộ 2...</div>';
        return;
      }

      list.forEach((q, idx) => {
        const item = document.createElement('div');
        item.style.background = 'rgba(255, 255, 255, 0.04)';
        item.style.border = '1px solid rgba(56, 189, 248, 0.25)';
        item.style.borderRadius = '12px';
        item.style.padding = '12px 14px';
        item.style.marginBottom = '10px';
        item.style.display = 'flex';
        item.style.justifyContent = 'space-between';
        item.style.alignItems = 'center';
        item.style.gap = '12px';

        const optLabels = ['A', 'B', 'C', 'D'];
        const optsHtml = (q.options || []).map((opt, i) => {
          const isCorrect = i === q.correctAnswer;
          return `<span style="display: inline-block; margin-right: 8px; font-size: 0.8rem; ${isCorrect ? 'color: #6ee7b7; font-weight: 800;' : 'color: #94a3b8;'}">${isCorrect ? '✅' : '○'} ${optLabels[i]}: ${escapeHtml(opt)}</span>`;
        }).join('');

        item.innerHTML = `
          <div style="flex: 1;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px; flex-wrap: wrap;">
              <span style="font-weight: 900; color: var(--cyan); font-size: 0.95rem;">CÂU ${idx + 1}</span>
              <span style="background: rgba(56, 189, 248, 0.25); border: 1px solid var(--cyan); color: #7dd3fc; padding: 2px 8px; border-radius: 999px; font-size: 0.75rem; font-weight: 800;">🎯 TRẮC NGHIỆM 4 ĐÁP ÁN</span>
              <span style="font-weight: 800; color: #fff; font-size: 0.95rem;">${q.icon || '❓'} ${escapeHtml(q.category || '')}</span>
            </div>
            <div style="font-size: 0.9rem; color: #e2e8f0; margin-bottom: 6px;">${escapeHtml(q.question)}</div>
            <div style="margin-bottom: 4px;">${optsHtml}</div>
            <div style="font-size: 0.8rem; color: var(--text-muted);">
              ⏱️ ${q.timeLimit || 15}s • 💡 Giải thích: ${escapeHtml(q.explanation || '--')}
            </div>
          </div>
          <div style="display: flex; flex-direction: column; gap: 6px; min-width: 110px;">
            <button class="btn btn-primary btn-sm btn-jump-q" style="padding: 5px 10px; font-size: 0.8rem;">🚀 Chiếu câu này</button>
            <button class="btn btn-rose btn-sm btn-del-q" style="padding: 5px 10px; font-size: 0.8rem; background: rgba(244, 63, 94, 0.25); border: 1px solid var(--rose);">🗑️ Xóa</button>
          </div>
        `;

        item.querySelector('.btn-jump-q').addEventListener('click', () => {
          socket.emit('host_jump_to_q', { mode: 'QA', index: idx });
          modalAddQ.style.display = 'none';
        });

        item.querySelector('.btn-del-q').addEventListener('click', () => {
          if (confirm(`Bạn có chắc muốn xóa Câu ${idx + 1} khỏi Bộ 2?`)) {
            fetch('/api/questions/qa/delete', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ index: idx })
            })
            .then(r => r.json())
            .then(() => refreshAllQuestions())
            .catch(err => alert('Lỗi: ' + err.message));
          }
        });

        qListContainer.appendChild(item);
      });
    }
  }

  // --- MODAL 2: 47 MEMBERS & DOB MANAGEMENT TABLE ---
  const modalSettings = document.getElementById('modal-settings');
  const memberTableBody = document.getElementById('member-table-body');
  const memberSearchFilter = document.getElementById('member-search-filter');

  document.getElementById('btn-open-settings').addEventListener('click', () => {
    fetch('/api/members')
      .then(r => r.json())
      .then(members => {
        adminState.members = members;
        renderMembersTable(members);
        modalSettings.style.display = 'flex';
      });
  });

  [document.getElementById('btn-close-settings'), document.getElementById('btn-cancel-settings')].forEach(b => {
    if (b) b.addEventListener('click', () => modalSettings.style.display = 'none');
  });

  if (memberSearchFilter) {
    memberSearchFilter.addEventListener('input', () => {
      const q = memberSearchFilter.value.trim().toLowerCase();
      renderMembersTable(adminState.members, q);
    });
  }

  function renderMembersTable(members, filterText = '') {
    if (!memberTableBody) return;
    memberTableBody.innerHTML = '';

    const filtered = filterText
      ? members.filter(m => (m.name && m.name.toLowerCase().includes(filterText)) || (m.stt && String(m.stt).includes(filterText)))
      : members;

    filtered.forEach(m => {
      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid rgba(255,255,255,0.06)';

      const zodiacDetails = (window.zodiacHelper && m.dob) ? window.zodiacHelper.getZodiacDetails(m.dob) : null;
      let zodiacText = '<span style="color: var(--text-muted); font-size: 0.8rem;">Chưa có</span>';
      if (zodiacDetails && zodiacDetails.lunar) {
        zodiacText = `<span style="color: #fef08a; font-weight: 700; font-size: 0.85rem;">${zodiacDetails.lunar.icon} Tuổi ${zodiacDetails.lunar.canChi} (${zodiacDetails.lunar.animal})</span>`;
      }

      tr.innerHTML = `
        <td style="padding: 10px 12px; font-weight: 800; color: var(--cyan);">${m.stt}</td>
        <td style="padding: 10px 12px; font-weight: 700;">${m.name}</td>
        <td style="padding: 8px 10px;">
          <input type="text" value="${m.fingerprint || ''}" class="input-field inp-fp" style="margin: 0; padding: 4px 8px; font-size: 0.85rem; height: 32px; width: 85px;" placeholder="Mã vân tay">
        </td>
        <td style="padding: 8px 10px;">
          <input type="text" value="${m.dob || ''}" class="input-field inp-dob" style="margin: 0; padding: 4px 8px; font-size: 0.85rem; height: 32px; width: 115px;" placeholder="dd/mm/yyyy">
        </td>
        <td style="padding: 8px 10px;" class="zodiac-cell">${zodiacText}</td>
        <td style="padding: 8px 10px;">
          <button class="btn btn-emerald btn-sm btn-save-member" style="padding: 4px 10px; font-size: 0.8rem;">Lưu</button>
        </td>
      `;

      const btnSave = tr.querySelector('.btn-save-member');
      const inpFp = tr.querySelector('.inp-fp');
      const inpDob = tr.querySelector('.inp-dob');
      const zodiacCell = tr.querySelector('.zodiac-cell');

      inpDob.addEventListener('input', () => {
        if (window.zodiacHelper && inpDob.value.trim()) {
          const zd = window.zodiacHelper.getZodiacDetails(inpDob.value.trim());
          if (zd && zd.lunar) {
            zodiacCell.innerHTML = `<span style="color: #fef08a; font-weight: 700; font-size: 0.85rem;">${zd.lunar.icon} Tuổi ${zd.lunar.canChi} (${zd.lunar.animal})</span>`;
          }
        }
      });

      btnSave.addEventListener('click', () => {
        btnSave.textContent = '...';
        fetch('/api/members/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            stt: m.stt,
            fingerprint: inpFp.value.trim(),
            dob: inpDob.value.trim()
          })
        })
        .then(r => r.json())
        .then(() => {
          btnSave.textContent = '✅ Đã lưu';
          setTimeout(() => { btnSave.textContent = 'Lưu'; }, 1500);
        })
        .catch(() => {
          btnSave.textContent = '❌ Lỗi';
        });
      });

      memberTableBody.appendChild(tr);
    });
  }

  // --- MODAL 3: LIVE ACTIVATION / ATTENDANCE MONITOR ---
  const modalActivation = document.getElementById('modal-activation');
  const btnToggleActivation = document.getElementById('btn-toggle-activation-modal');
  const btnCloseActivation = document.getElementById('btn-close-activation');
  const btnCloseActBottom = document.getElementById('btn-close-act-bottom');
  const tabActAll = document.getElementById('tab-act-all');
  const tabActMissing = document.getElementById('tab-act-missing');
  const tabActActive = document.getElementById('tab-act-active');
  const actSearchFilter = document.getElementById('act-search-filter');
  const activationTableBody = document.getElementById('activation-table-body');

  if (btnToggleActivation) {
    btnToggleActivation.addEventListener('click', () => {
      modalActivation.style.display = 'flex';
      renderActivationTable();
    });
  }

  [btnCloseActivation, btnCloseActBottom].forEach(btn => {
    if (btn) btn.addEventListener('click', () => modalActivation.style.display = 'none');
  });

  if (tabActAll) {
    tabActAll.addEventListener('click', () => {
      adminState.actTab = 'all';
      updateActTabButtons();
      renderActivationTable();
    });
  }
  if (tabActMissing) {
    tabActMissing.addEventListener('click', () => {
      adminState.actTab = 'missing';
      updateActTabButtons();
      renderActivationTable();
    });
  }
  if (tabActActive) {
    tabActActive.addEventListener('click', () => {
      adminState.actTab = 'active';
      updateActTabButtons();
      renderActivationTable();
    });
  }

  function updateActTabButtons() {
    [tabActAll, tabActMissing, tabActActive].forEach(b => {
      if (b) b.style.opacity = '0.6';
    });
    if (adminState.actTab === 'all' && tabActAll) tabActAll.style.opacity = '1';
    if (adminState.actTab === 'missing' && tabActMissing) tabActMissing.style.opacity = '1';
    if (adminState.actTab === 'active' && tabActActive) tabActActive.style.opacity = '1';
  }

  if (actSearchFilter) {
    actSearchFilter.addEventListener('input', () => {
      renderActivationTable();
    });
  }

  function renderActivationTable() {
    if (!activationTableBody) return;
    activationTableBody.innerHTML = '';

    const act = adminState.activation;
    const query = actSearchFilter ? actSearchFilter.value.trim().toLowerCase() : '';

    const activatedSet = new Set(act && act.activatedMembers ? act.activatedMembers.map(m => String(m.stt)) : []);
    const allMembers = adminState.members.length > 0 ? adminState.members : (act ? [...(act.activatedMembers || []), ...(act.missingMembers || [])] : []);

    let listToRender = allMembers;
    if (adminState.actTab === 'missing') {
      listToRender = allMembers.filter(m => !activatedSet.has(String(m.stt)));
    } else if (adminState.actTab === 'active') {
      listToRender = allMembers.filter(m => activatedSet.has(String(m.stt)));
    }

    if (query) {
      listToRender = listToRender.filter(m =>
        (m.name && m.name.toLowerCase().includes(query)) ||
        (m.stt && String(m.stt).includes(query))
      );
    }

    if (listToRender.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="6" style="padding: 24px; text-align: center; color: var(--text-muted); font-style: italic;">Không có thành viên nào phù hợp...</td>`;
      activationTableBody.appendChild(tr);
      return;
    }

    listToRender.forEach(m => {
      const isJoined = activatedSet.has(String(m.stt));
      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid rgba(255,255,255,0.06)';
      tr.style.background = isJoined ? 'rgba(16, 185, 129, 0.05)' : 'rgba(244, 63, 94, 0.05)';

      const zodiacDetails = (window.zodiacHelper && m.dob) ? window.zodiacHelper.getZodiacDetails(m.dob) : null;
      let zodiacBadge = '<span style="color: var(--text-muted); font-size: 0.8rem;">Chưa có</span>';
      if (zodiacDetails && zodiacDetails.lunar) {
        zodiacBadge = `<span style="font-size: 0.85rem; font-weight: 700; color: #fef08a;">${zodiacDetails.lunar.icon} Tuổi ${zodiacDetails.lunar.canChi} (${zodiacDetails.lunar.animal})</span>`;
      }

      const statusBadge = isJoined
        ? `<span style="background: rgba(16, 185, 129, 0.2); border: 1px solid var(--emerald); color: #6ee7b7; padding: 4px 10px; border-radius: 999px; font-weight: 800; font-size: 0.8rem;">🟢 ĐÃ VÀO</span>`
        : `<span style="background: rgba(244, 63, 94, 0.2); border: 1px solid var(--rose); color: #fca5a5; padding: 4px 10px; border-radius: 999px; font-weight: 800; font-size: 0.8rem;">🔴 CHƯA VÀO</span>`;

      const actionBtn = isJoined
        ? `<button class="btn btn-rose btn-sm btn-kick-member" data-stt="${m.stt}" data-name="${escapeHtml(m.name)}" style="padding: 3px 8px; font-size: 0.78rem; font-weight: 800; background: rgba(244, 63, 94, 0.2); border: 1px solid var(--rose); color: #fecdd3; border-radius: 6px; cursor: pointer;">🚫 Kick / Đặt lại</button>`
        : `<span style="color: var(--text-muted); font-size: 0.8rem;">--</span>`;

      tr.innerHTML = `
        <td style="padding: 10px 12px; font-weight: 800; color: var(--cyan);">${m.stt}</td>
        <td style="padding: 10px 12px; font-weight: 800; font-size: 0.95rem; color: #fff;">${m.name}</td>
        <td style="padding: 10px 12px; font-family: monospace; font-size: 0.9rem; color: var(--gold);">${m.fingerprint || '--'}</td>
        <td style="padding: 10px 12px;">${zodiacBadge}</td>
        <td style="padding: 10px 12px; text-align: center;">${statusBadge}</td>
        <td style="padding: 10px 12px; text-align: center;">${actionBtn}</td>
      `;

      if (isJoined) {
        const btnKick = tr.querySelector('.btn-kick-member');
        if (btnKick) {
          btnKick.addEventListener('click', () => {
            const stt = btnKick.dataset.stt;
            const name = btnKick.dataset.name;
            if (confirm(`Bạn có chắc muốn ĐẶT LẠI trạng thái cho "${name}"?\n(Dùng khi người chơi ấn nhầm tên người khác để họ chọn lại)`)) {
              btnKick.disabled = true;
              btnKick.textContent = 'Đang đặt lại...';
              socket.emit('admin_kick_member', { memberId: stt });
            }
          });
        }
      }

      activationTableBody.appendChild(tr);
    });
  }
});
