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

  socket.on('questions_updated', () => {
    // Refresh question list
    Promise.all([
      fetch('/api/questions/squizz').then(r => r.json()),
      fetch('/api/questions/qa').then(r => r.json())
    ]).then(([sqList, qaList]) => {
      adminState.squizzQuestions = sqList;
      adminState.qaQuestions = qaList;
      populateJumpSelect();
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

  // --- MODAL 1: ADD QUESTION LOGIC ---
  const modalAddQ = document.getElementById('modal-add-question');
  const btnOpenAddQ = document.getElementById('btn-open-add-q');
  const btnCloseAddQ = document.getElementById('btn-close-add-q');
  const btnCancelAddQ = document.getElementById('btn-cancel-add-q');
  const btnSaveAddQ = document.getElementById('btn-save-add-q');

  const addQSection = document.getElementById('add-q-section');
  const addQType = document.getElementById('add-q-type');
  const addQaOptionsBox = document.getElementById('add-qa-options-box');

  if (btnOpenAddQ) {
    btnOpenAddQ.addEventListener('click', () => {
      modalAddQ.style.display = 'flex';
      syncAddQTypeOptions();
    });
  }

  [btnCloseAddQ, btnCancelAddQ].forEach(b => {
    if (b) b.addEventListener('click', () => modalAddQ.style.display = 'none');
  });

  function syncAddQTypeOptions() {
    const sec = addQSection.value;
    addQType.innerHTML = '';
    if (sec === 'SQUIZZ') {
      addQType.innerHTML = `
        <option value="OPEN_TEXT">💬 Câu hỏi mở (Nhập văn bản tự do)</option>
        <option value="VOTE_MEMBER">👤 Bình chọn đồng nghiệp (47 thành viên)</option>
      `;
      addQaOptionsBox.style.display = 'none';
    } else {
      addQType.innerHTML = `
        <option value="MULTIPLE_CHOICE">🎯 Trắc nghiệm 4 đáp án (A, B, C, D)</option>
        <option value="OPEN_TEXT">💬 Câu hỏi mở (Tự luận)</option>
      `;
      addQaOptionsBox.style.display = 'block';
    }
  }

  if (addQSection) {
    addQSection.addEventListener('change', syncAddQTypeOptions);
  }

  if (addQType) {
    addQType.addEventListener('change', () => {
      if (addQSection.value === 'QA' && addQType.value === 'MULTIPLE_CHOICE') {
        addQaOptionsBox.style.display = 'block';
      } else {
        addQaOptionsBox.style.display = 'none';
      }
    });
  }

  if (btnSaveAddQ) {
    btnSaveAddQ.addEventListener('click', () => {
      const sec = addQSection.value;
      const type = addQType.value;
      const title = document.getElementById('add-q-title').value.trim();
      const text = document.getElementById('add-q-text').value.trim();
      const theme = document.getElementById('add-q-theme').value;
      const punishment = document.getElementById('add-q-punishment').value.trim();
      const time = parseInt(document.getElementById('add-q-time').value, 10) || 30;
      const mcVoice = document.getElementById('add-q-mcvoice').value.trim();

      if (!text) {
        alert('Vui lòng nhập nội dung câu hỏi!');
        return;
      }

      if (sec === 'SQUIZZ') {
        fetch('/api/questions/squizz/add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type,
            title: title || 'CÂU HỎI MỚI',
            question: text,
            effectTheme: theme,
            punishment: punishment || 'Uống 1 chén danh dự! 🍻',
            mcVoice: mcVoice || 'Xin chúc mừng người có câu trả lời hay nhất!',
            target: 'Gắn kết đồng đội'
          })
        })
        .then(r => r.json())
        .then(res => {
          alert('Đã thêm câu hỏi vào Bộ 1: Squizz thành công!');
          modalAddQ.style.display = 'none';
        })
        .catch(() => alert('Lỗi khi thêm câu hỏi'));
      } else {
        const opts = [
          document.getElementById('add-opt-0').value.trim() || 'Đáp án A',
          document.getElementById('add-opt-1').value.trim() || 'Đáp án B',
          document.getElementById('add-opt-2').value.trim() || 'Đáp án C',
          document.getElementById('add-opt-3').value.trim() || 'Đáp án D'
        ];
        const correct = parseInt(document.getElementById('add-correct-idx').value, 10) || 0;

        fetch('/api/questions/qa/add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type,
            category: title || 'Đố vui Team Building',
            question: text,
            options: opts,
            correctAnswer: correct,
            explanation: mcVoice || 'Đáp án chính xác!',
            timeLimit: time
          })
        })
        .then(r => r.json())
        .then(res => {
          alert('Đã thêm câu hỏi vào Bộ 2: Q&A thành công!');
          modalAddQ.style.display = 'none';
        })
        .catch(() => alert('Lỗi khi thêm câu hỏi'));
      }
    });
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
      ? members.filter(m => (m.name && m.name.toLowerCase().includes(filterText)) || (m.role && m.role.toLowerCase().includes(filterText)))
      : members;

    filtered.forEach(m => {
      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid rgba(255,255,255,0.06)';

      const zodiacDetails = (window.zodiacHelper && m.dob) ? window.zodiacHelper.getZodiacDetails(m.dob) : null;
      let zodiacText = '<span style="color: var(--text-muted); font-size: 0.8rem;">Chưa có</span>';
      if (zodiacDetails && zodiacDetails.sign && zodiacDetails.lunar) {
        zodiacText = `<span style="color: #fef08a; font-weight: 700; font-size: 0.82rem;">${zodiacDetails.sign.icon} ${zodiacDetails.sign.name}<br>${zodiacDetails.lunar.icon} ${zodiacDetails.lunar.canChi}</span>`;
      }

      tr.innerHTML = `
        <td style="padding: 10px 12px; font-weight: 800; color: var(--cyan);">${m.stt}</td>
        <td style="padding: 10px 12px; font-weight: 700;">${m.name}</td>
        <td style="padding: 10px 12px; font-size: 0.85rem; color: var(--text-muted);">${m.role || 'Thành viên'}</td>
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
          if (zd && zd.sign && zd.lunar) {
            zodiacCell.innerHTML = `<span style="color: #fef08a; font-weight: 700; font-size: 0.82rem;">${zd.sign.icon} ${zd.sign.name}<br>${zd.lunar.icon} ${zd.lunar.canChi}</span>`;
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

  const btnReloadExcel = document.getElementById('btn-reload-excel');
  if (btnReloadExcel) {
    btnReloadExcel.addEventListener('click', () => {
      btnReloadExcel.textContent = '⏳ Đang nạp từ Excel...';
      fetch('/api/members/reload_excel', { method: 'POST' })
        .then(r => r.json())
        .then(res => {
          if (res.success) {
            btnReloadExcel.textContent = '✅ Nạp thành công!';
            adminState.members = res.members;
            renderMembersTable(res.members);
            setTimeout(() => { btnReloadExcel.textContent = '🔄 Đọc Lại Từ File Excel'; }, 1800);
          } else {
            alert('Lỗi: ' + (res.error || 'Không thể nạp dữ liệu từ Excel'));
            btnReloadExcel.textContent = '🔄 Đọc Lại Từ File Excel';
          }
        })
        .catch(err => {
          alert('Lỗi kết nối khi nạp Excel: ' + err.message);
          btnReloadExcel.textContent = '🔄 Đọc Lại Từ File Excel';
        });
    });
  }
});
