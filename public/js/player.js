// Mobile Player Client Logic with Biometric Fingerprint & Zodiac Support
document.addEventListener('DOMContentLoaded', () => {
  const socket = io();

  const AVATARS = ['😎', '🦁', '🐯', '🚀', '🍺', '🥳', '👑', '🔥', '⚡', '🍕', '🎯', '💃', '🕺', '🐱', '🦊', '🐉', '🍷', '🦸'];
  let selectedAvatar = '😎';

  let playerState = {
    id: localStorage.getItem('tckt_player_id') || null,
    memberId: localStorage.getItem('tckt_player_member_id') || null,
    nickname: localStorage.getItem('tckt_player_nick') || '',
    fingerprint: localStorage.getItem('tckt_player_fp') || '',
    avatar: localStorage.getItem('tckt_player_avatar') || '😎',
    role: '',
    dob: localStorage.getItem('tckt_player_dob') || '',
    zodiacInfo: null,
    score: 0,
    hasJoined: false,
    currentMode: 'LOBBY',
    myVote: null,
    myAnswer: null,
    members: []
  };

  // Screens
  const screens = {
    join: document.getElementById('screen-join'),
    waiting: document.getElementById('screen-waiting'),
    squizz: document.getElementById('screen-squizz'),
    qa: document.getElementById('screen-qa')
  };

  const elPlayerHeader = document.getElementById('player-header');
  const elMyAvatar = document.getElementById('my-avatar');
  const elMyNickname = document.getElementById('my-nickname');
  const elMyRoleText = document.getElementById('my-role-text');
  const elMyZodiacBadge = document.getElementById('my-zodiac-badge');
  const elMyScoreTag = document.getElementById('my-score-tag');

  const elWaitAvatar = document.getElementById('wait-avatar');
  const elWaitMemberInfo = document.getElementById('wait-member-info');
  const elWaitZodiacInfo = document.getElementById('wait-zodiac-info');

  const selectMember = document.getElementById('select-member');
  const smartSearchInput = document.getElementById('smart-search-input');
  const smartSuggestionBox = document.getElementById('smart-suggestion-box');
  const fpMatchBadge = document.getElementById('fp-match-badge');
  const fpMatchName = document.getElementById('fp-match-name');
  const memberProfileCard = document.getElementById('member-profile-card');
  const cardMemberName = document.getElementById('card-member-name');
  const cardMemberMeta = document.getElementById('card-member-meta');
  const cardMemberAvatar = document.getElementById('card-member-avatar');
  const btnChangeMember = document.getElementById('btn-change-member');
  const inputFingerprint = document.getElementById('input-fingerprint');
  const inputDob = document.getElementById('input-dob');
  const btnFingerprintScan = document.getElementById('btn-fingerprint-scan');
  const scannerStatusText = document.getElementById('scanner-status-text');
  const joinErrorBox = document.getElementById('join-error-box');
  const elPlayerQaTimer = document.getElementById('player-qa-timer');

  function showScreen(name) {
    Object.keys(screens).forEach(key => {
      const scr = screens[key];
      if (scr) {
        if (key === name) {
          scr.style.display = 'flex';
          scr.classList.remove('view-transition');
          void scr.offsetWidth; // force reflow for smooth re-animation
          scr.classList.add('view-transition');
        } else {
          scr.style.display = 'none';
        }
      }
    });
    if (elPlayerHeader) {
      elPlayerHeader.style.display = (name === 'join') ? 'none' : 'flex';
    }
  }

  // Socket auto-reconnect logic
  socket.on('connect', () => {
    const savedMemberId = localStorage.getItem('tckt_player_member_id') || playerState.memberId;
    const savedFp = localStorage.getItem('tckt_player_fp') || playerState.fingerprint;
    const savedNick = localStorage.getItem('tckt_player_nick') || playerState.nickname;
    const savedDob = localStorage.getItem('tckt_player_dob') || playerState.dob;

    if (savedMemberId || savedFp) {
      socket.emit('player_join', {
        id: localStorage.getItem('tckt_player_id') || playerState.id,
        memberId: savedMemberId,
        nickname: savedNick,
        fingerprint: savedFp,
        dob: savedDob,
        avatar: selectedAvatar
      });
    }
  });

  // Populate Avatar Selector
  const avatarListContainer = document.getElementById('avatar-list');
  if (avatarListContainer) {
    avatarListContainer.innerHTML = '';
    AVATARS.forEach(emoji => {
      const btn = document.createElement('div');
      btn.className = 'avatar-choice' + (emoji === playerState.avatar ? ' selected' : '');
      btn.textContent = emoji;
      btn.addEventListener('click', () => {
        document.querySelectorAll('.avatar-choice').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedAvatar = emoji;
      });
      avatarListContainer.appendChild(btn);
    });
    selectedAvatar = playerState.avatar;
  }

  // Load Official 47 Members
  fetch('/api/members')
    .then(r => r.json())
    .then(members => {
      playerState.members = members;
      populateMemberSelect(members);
      renderMemberSuggestions(members);

      // Restore saved member into smart search if available
      if (playerState.fingerprint || playerState.memberId) {
        const matched = members.find(m => 
          (playerState.memberId && String(m.stt) === String(playerState.memberId)) ||
          (playerState.fingerprint && String(m.fingerprint || '').trim() === String(playerState.fingerprint).trim())
        );
        if (matched) {
          selectMemberById(matched.stt, false);
        }
      }

      // Auto-reconnect if already logged in
      if (playerState.memberId || playerState.fingerprint) {
        attemptLogin(playerState.memberId, playerState.nickname, playerState.fingerprint, playerState.dob, false);
      }
    })
    .catch(err => console.error('Error fetching members:', err));

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>'"]/g, tag => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[tag] || tag));
  }

  function updateProfileCard(member) {
    if (!member) {
      if (memberProfileCard) memberProfileCard.style.display = 'none';
      return;
    }
    if (cardMemberName) cardMemberName.textContent = member.name;
    if (cardMemberAvatar) cardMemberAvatar.textContent = selectedAvatar;
    if (cardMemberMeta) {
      let zodiacText = '';
      if (window.zodiacHelper && member.dob) {
        const zd = window.zodiacHelper.getZodiacDetails(member.dob);
        if (zd && zd.lunar) {
          zodiacText = ` • ${zd.lunar.icon} Tuổi ${zd.lunar.canChi} (${zd.lunar.animal})`;
        }
      }
      cardMemberMeta.textContent = `Mã vân tay: ${member.fingerprint || 'Chưa có'}${zodiacText}`;
    }
    if (inputFingerprint) inputFingerprint.value = member.fingerprint || '';
    if (inputDob) inputDob.value = member.dob || '';
    if (memberProfileCard) memberProfileCard.style.display = 'block';
  }

  function selectMemberById(stt, triggerVibrate = true) {
    const member = (playerState.members || []).find(m => String(m.stt) === String(stt));
    if (!member) return;
    if (selectMember) selectMember.value = member.stt;
    if (smartSearchInput) smartSearchInput.value = member.name;
    if (smartSuggestionBox) smartSuggestionBox.style.display = 'none';
    if (fpMatchBadge) {
      fpMatchBadge.style.display = 'block';
      if (fpMatchName) fpMatchName.textContent = member.name;
    }
    if (joinErrorBox) joinErrorBox.style.display = 'none';
    updateProfileCard(member);
    if (triggerVibrate && navigator.vibrate) navigator.vibrate(30);
  }

  // Real-time smart search: handles both fingerprint numbers and colleague name
  if (smartSearchInput) {
    smartSearchInput.addEventListener('input', () => {
      const val = smartSearchInput.value.trim();
      if (!val) {
        if (fpMatchBadge) fpMatchBadge.style.display = 'none';
        if (smartSuggestionBox) {
          smartSuggestionBox.style.display = 'none';
          smartSuggestionBox.innerHTML = '';
        }
        return;
      }

      const members = playerState.members || [];
      const isDigits = /^\d+$/.test(val);

      if (isDigits) {
        // Fingerprint search
        const exact = members.find(m => String(m.fingerprint || '').trim() === val);
        if (exact) {
          selectMemberById(exact.stt);
          return;
        }

        const partial = members.filter(m => String(m.fingerprint || '').trim().includes(val));
        if (partial.length > 0 && smartSuggestionBox) {
          if (fpMatchBadge) fpMatchBadge.style.display = 'none';
          smartSuggestionBox.innerHTML = '';
          smartSuggestionBox.style.display = 'flex';
          partial.slice(0, 6).forEach(m => {
            const chip = document.createElement('div');
            chip.style.cssText = 'background: rgba(251, 191, 36, 0.2); border: 1.5px solid var(--gold); color: #fff; padding: 6px 12px; border-radius: 999px; font-weight: 800; cursor: pointer; font-size: 0.9rem;';
            chip.innerHTML = `👆 Mã <strong>${m.fingerprint}</strong>: ${escapeHtml(m.name)}`;
            chip.addEventListener('click', () => selectMemberById(m.stt));
            smartSuggestionBox.appendChild(chip);
          });
        } else {
          if (smartSuggestionBox) smartSuggestionBox.style.display = 'none';
          if (fpMatchBadge) fpMatchBadge.style.display = 'none';
        }
      } else {
        // Name search
        if (fpMatchBadge) fpMatchBadge.style.display = 'none';
        const q = val.toLowerCase();
        const matched = members.filter(m => m.name && m.name.toLowerCase().includes(q));

        if (matched.length > 0 && smartSuggestionBox) {
          smartSuggestionBox.innerHTML = '';
          smartSuggestionBox.style.display = 'flex';
          matched.slice(0, 8).forEach(m => {
            const chip = document.createElement('div');
            chip.style.cssText = 'background: rgba(56, 189, 248, 0.2); border: 1.5px solid var(--cyan); color: #fff; padding: 6px 12px; border-radius: 999px; font-weight: 800; cursor: pointer; font-size: 0.9rem;';
            chip.innerHTML = `✨ <strong>${escapeHtml(m.name)}</strong> (mã: ${m.fingerprint || '--'})`;
            chip.addEventListener('click', () => selectMemberById(m.stt));
            smartSuggestionBox.appendChild(chip);
          });
        } else {
          if (smartSuggestionBox) {
            smartSuggestionBox.innerHTML = '<div style="color: var(--text-muted); font-size: 0.85rem; padding: 6px;">Không tìm thấy thành viên khớp từ khóa...</div>';
            smartSuggestionBox.style.display = 'block';
          }
        }
      }
    });

    smartSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        btnFingerprintScan.click();
      }
    });
  }

  // Prevent Mistaken Identity: Button to change member
  if (btnChangeMember) {
    btnChangeMember.addEventListener('click', () => {
      if (memberProfileCard) memberProfileCard.style.display = 'none';
      if (selectMember) selectMember.value = '';
      if (smartSearchInput) {
        smartSearchInput.value = '';
        smartSearchInput.focus();
      }
      if (fpMatchBadge) fpMatchBadge.style.display = 'none';
      if (smartSuggestionBox) {
        smartSuggestionBox.style.display = 'none';
        smartSuggestionBox.innerHTML = '';
      }
      populateMemberSelect(playerState.members);
    });
  }

  function populateMemberSelect(members, filterText = '') {
    if (!selectMember) return;
    selectMember.innerHTML = '<option value="">-- Chọn tên bạn (47 thành viên) --</option>';
    
    const filtered = filterText 
      ? members.filter(m => (m.name && m.name.toLowerCase().includes(filterText)) || String(m.stt) === filterText)
      : members;

    filtered.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.stt;
      opt.textContent = `${m.stt}. ${m.name} (mã: ${m.fingerprint || '--'})`;
      opt.dataset.name = m.name;
      opt.dataset.dob = m.dob || '';
      opt.dataset.fingerprint = m.fingerprint || '';
      if (playerState.memberId && String(m.stt) === String(playerState.memberId)) {
        opt.selected = true;
      }
      selectMember.appendChild(opt);
    });
  }

  selectMember.addEventListener('change', () => {
    if (selectMember.value) {
      selectMemberById(selectMember.value);
    } else {
      if (memberProfileCard) memberProfileCard.style.display = 'none';
    }
  });

  // Priority Check-in (Smart Input or Selected Member)
  btnFingerprintScan.addEventListener('click', () => {
    let memberId = selectMember ? selectMember.value : '';
    let selectedOpt = selectMember ? selectMember.selectedOptions[0] : null;

    // If dropdown selected
    if (memberId && selectedOpt && selectedOpt.value) {
      const nickname = selectedOpt.dataset.name || '';
      const fingerprint = selectedOpt.dataset.fingerprint || '';
      const dob = (inputDob && inputDob.value.trim()) ? inputDob.value.trim() : (selectedOpt.dataset.dob || '');
      attemptLogin(memberId, nickname, fingerprint, dob, true);
      return;
    }

    // If text in smartSearchInput
    const val = smartSearchInput ? smartSearchInput.value.trim() : '';
    if (val) {
      const members = playerState.members || [];
      // Try match fingerprint
      const byFp = members.find(m => String(m.fingerprint || '').trim() === val);
      if (byFp) {
        attemptLogin(byFp.stt, byFp.name, byFp.fingerprint, byFp.dob, true);
        return;
      }
      // Try match name
      const byName = members.find(m => m.name && m.name.toLowerCase() === val.toLowerCase());
      if (byName) {
        attemptLogin(byName.stt, byName.name, byName.fingerprint, byName.dob, true);
        return;
      }
    }

    showJoinError('Vui lòng chọn tên hoặc nhập đúng mã vân tay chấm công của bạn để nhận vé vào tiệc!');
    if (smartSearchInput) smartSearchInput.focus();
  });

  function attemptLogin(memberId, nickname, fingerprint, dob, withAnimation) {
    if (joinErrorBox) joinErrorBox.style.display = 'none';

    if (withAnimation) {
      btnFingerprintScan.classList.add('scanning');
      scannerStatusText.textContent = 'ĐANG XÁC THỰC VÀO TIỆC... ⚡';
      if (window.soundFX) window.soundFX.playBiometricScan();
      if (navigator.vibrate) navigator.vibrate([60, 40, 60]);
    }

    setTimeout(() => {
      socket.emit('player_join', {
        id: playerState.id,
        memberId,
        nickname,
        fingerprint,
        dob,
        avatar: selectedAvatar
      });
    }, withAnimation ? 400 : 50);
  }

  function showJoinError(msg) {
    if (btnFingerprintScan) btnFingerprintScan.classList.remove('scanning');
    if (scannerStatusText) scannerStatusText.textContent = 'BẤM VÀO ĐÂY ĐỂ VÀO TIỆC NGAY 🚀';
    if (window.soundFX) window.soundFX.playBiometricError();
    if (navigator.vibrate) navigator.vibrate([150, 80, 150]);

    if (joinErrorBox) {
      joinErrorBox.textContent = msg;
      joinErrorBox.style.display = 'block';
      joinErrorBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
      alert(msg);
    }
  }

  socket.on('join_error', ({ message }) => {
    showJoinError(message || 'Mã vân tay / mã chấm công chưa chính xác!');
  });

  socket.on('player_joined_success', ({ player, gameState, members }) => {
    if (btnFingerprintScan) btnFingerprintScan.classList.remove('scanning');
    if (scannerStatusText) scannerStatusText.textContent = 'XÁC THỰC THÀNH CÔNG! ✅';
    if (window.soundFX) window.soundFX.playBiometricSuccess();
    if (navigator.vibrate) navigator.vibrate([80, 40, 120]);

    playerState.id = player.id;
    playerState.memberId = player.memberId;
    playerState.nickname = player.nickname;
    playerState.avatar = player.avatar;
    playerState.role = player.role;
    playerState.dob = player.dob;
    playerState.zodiacInfo = player.zodiacInfo;
    playerState.score = player.score;
    playerState.hasJoined = true;
    playerState.members = members || playerState.members;

    // Save to local storage
    const savedFp = (inputFpQuick && inputFpQuick.value.trim()) || (inputFingerprint ? inputFingerprint.value.trim() : '') || (player.fingerprint || '');
    localStorage.setItem('tckt_player_id', player.id);
    localStorage.setItem('tckt_player_member_id', player.memberId);
    localStorage.setItem('tckt_player_nick', player.nickname);
    localStorage.setItem('tckt_player_fp', savedFp);
    localStorage.setItem('tckt_player_dob', player.dob || '');
    localStorage.setItem('tckt_player_avatar', player.avatar);

    // Update Header
    elMyAvatar.textContent = player.avatar;
    elMyNickname.textContent = player.nickname;
    if (elMyRoleText) elMyRoleText.style.display = 'none';
    elMyScoreTag.textContent = `${player.score.toLocaleString()} điểm`;
    elWaitAvatar.textContent = player.avatar;

    if (elWaitMemberInfo) {
      elWaitMemberInfo.textContent = player.nickname;
    }

    // Zodiac Badge
    updateZodiacUI(player.zodiacInfo);

    renderMemberSuggestions(playerState.members);
    syncServerState(gameState);
  });

  function updateZodiacUI(zodiacInfo) {
    if (!zodiacInfo) {
      if (elMyZodiacBadge) elMyZodiacBadge.style.display = 'none';
      if (elWaitZodiacInfo) elWaitZodiacInfo.innerHTML = '';
      return;
    }

    if (elMyZodiacBadge && window.zodiacHelper) {
      elMyZodiacBadge.innerHTML = window.zodiacHelper.generateZodiacBadgesHtml(zodiacInfo, 'small');
      elMyZodiacBadge.style.display = 'inline-flex';
    }

    if (elWaitZodiacInfo && window.zodiacHelper) {
      elWaitZodiacInfo.innerHTML = window.zodiacHelper.generateZodiacBadgesHtml(zodiacInfo, 'normal');
    }
  }

  socket.on('player_list_updated', ({ players, total, activation }) => {
    if (activation) {
      const elMissingCount = document.getElementById('player-missing-count');
      const elMissingNames = document.getElementById('player-missing-names');
      if (elMissingCount) elMissingCount.textContent = activation.missingCount;
      if (elMissingNames) {
        if (activation.missingCount === 0) {
          elMissingNames.innerHTML = `<span style="color: #6ee7b7; font-weight: 800;">🎉 Toàn thể 47 thành viên đã có mặt đầy đủ!</span>`;
        } else {
          const names = activation.missingMembers.map(m => m.name);
          elMissingNames.textContent = names.join(', ');
        }
      }
    }
  });

  socket.on('members_updated', (members) => {
    playerState.members = members;
    populateMemberSelect(members);
    renderMemberSuggestions(members);
  });

  // Filterable Member Suggestions
  const inputSquizzFilter = document.getElementById('input-squizz-filter');
  if (inputSquizzFilter) {
    inputSquizzFilter.addEventListener('input', () => {
      const q = inputSquizzFilter.value.trim().toLowerCase();
      renderMemberSuggestions(playerState.members, q);
    });
  }

  let currentlySelectedColleague = '';

  function renderMemberSuggestions(members, filterText = '') {
    const box = document.getElementById('member-suggestions');
    if (!box) return;
    box.innerHTML = '';

    const list = members || [];
    const filtered = filterText
      ? list.filter(m => m.name && m.name.toLowerCase().includes(filterText))
      : list;

    if (filtered.length === 0) {
      box.innerHTML = '<div style="color: var(--text-muted); font-size: 0.85rem; padding: 8px;">Không tìm thấy đồng nghiệp khớp từ khóa!</div>';
      return;
    }

    filtered.forEach(m => {
      const tag = document.createElement('div');
      tag.className = 'sugg-tag party-sugg-tag' + (currentlySelectedColleague === m.name ? ' selected-colleague' : '');
      tag.innerHTML = `<strong>${m.name}</strong>`;
      tag.addEventListener('click', () => {
        currentlySelectedColleague = m.name;
        document.querySelectorAll('.sugg-tag').forEach(t => t.classList.remove('selected-colleague'));
        tag.classList.add('selected-colleague');
        if (inputSquizzFilter) inputSquizzFilter.value = m.name;
        if (navigator.vibrate) navigator.vibrate(30);
      });
      box.appendChild(tag);
    });
  }

  function syncServerState(state) {
    if (!state) return;
    playerState.currentMode = state.mode;

    if (state.mode === 'SQUIZZ' && state.squizz && state.squizz.question) {
      window._currentSquizzIndex = state.squizz.currentIndex;
      window._currentSquizzQ = state.squizz.question;
      renderPlayerSquizz(state.squizz.question, state.squizz.currentIndex, 12);
      
      const cachedVote = state.squizz.myVote || sessionStorage.getItem('tckt_sq_vote_' + state.squizz.currentIndex);
      if (cachedVote) {
        setSquizzVoted(cachedVote);
      }

      if (state.squizz.isOpen === false) {
        const btnVote = document.getElementById('btn-submit-vote');
        const btnText = document.getElementById('btn-submit-opentext');
        if (btnVote) { btnVote.disabled = true; btnVote.textContent = '🔒 ĐÃ KHÓA BÌNH CHỌN'; }
        if (btnText) { btnText.disabled = true; btnText.textContent = '🔒 ĐÃ KHÓA'; }
      }

      showScreen('squizz');
    } else if (state.mode === 'QA' && state.qa && state.qa.question) {
      window._currentQaIndex = state.qa.currentIndex;
      window._currentQaQ = state.qa.question;
      renderPlayerQa(state.qa.question, state.qa.currentIndex, 15);

      if (elPlayerQaTimer) {
        if (state.qa.isPaused) {
          elPlayerQaTimer.textContent = `⏸️ Tạm dừng (${state.qa.timeRemaining}s)`;
          elPlayerQaTimer.style.background = 'rgba(245, 158, 11, 0.4)';
        } else if (state.qa.isOpen === false) {
          elPlayerQaTimer.textContent = '🔒 ĐÃ KHÓA';
          elPlayerQaTimer.style.background = 'rgba(244, 63, 94, 0.45)';
        } else {
          elPlayerQaTimer.textContent = `⏱️ ${state.qa.timeRemaining}s`;
          elPlayerQaTimer.style.background = 'rgba(244, 63, 94, 0.25)';
        }
      }

      // Restore answer from server state or sessionStorage
      const rawAns = (state.qa.myAnswer !== null && state.qa.myAnswer !== undefined)
        ? state.qa.myAnswer
        : sessionStorage.getItem('tckt_qa_ans_' + state.qa.currentIndex);

      if (rawAns !== null && rawAns !== undefined) {
        if (typeof rawAns === 'number' || (!isNaN(rawAns) && rawAns !== '')) {
          const optIdx = parseInt(rawAns, 10);
          playerState.myAnswer = optIdx;
          document.querySelectorAll('.mobile-opt-btn').forEach(b => {
            b.disabled = true;
            if (parseInt(b.getAttribute('data-opt'), 10) === optIdx) {
              b.classList.add('selected');
              b.style.opacity = '1';
            } else {
              b.style.opacity = '0.4';
            }
          });
        } else if (typeof rawAns === 'string' && rawAns) {
          playerState.myAnswer = rawAns;
          if (btnSubmitQaOpenText) {
            btnSubmitQaOpenText.disabled = true;
            btnSubmitQaOpenText.textContent = 'ĐÃ GỬI ĐÁP ÁN ✅';
          }
        }
      }

      // If question was already locked on server
      if (state.qa.isOpen === false) {
        document.querySelectorAll('.mobile-opt-btn').forEach(b => b.disabled = true);
        if (btnSubmitQaOpenText) btnSubmitQaOpenText.disabled = true;
      }

      // If question was already revealed on server
      if (state.qa.isRevealed && state.qa.correctAnswer !== null && state.qa.correctAnswer !== undefined) {
        if (playerState.myAnswer !== null && typeof playerState.myAnswer === 'number') {
          const isCorrect = (playerState.myAnswer === state.qa.correctAnswer);
          elPlayerQaResult.style.display = 'block';
          if (isCorrect) {
            elPlayerQaResult.style.background = 'rgba(16, 185, 129, 0.2)';
            elPlayerQaResult.style.border = '1px solid var(--emerald)';
            elPlayerQaResultTitle.style.color = '#34d399';
            elPlayerQaResultTitle.textContent = '🎉 CHÍNH XÁC!';
            elPlayerQaResultPoints.textContent = 'Bạn đã ghi điểm trong câu hỏi này!';
          } else {
            elPlayerQaResult.style.background = 'rgba(244, 63, 94, 0.2)';
            elPlayerQaResult.style.border = '1px solid var(--rose)';
            elPlayerQaResultTitle.style.color = '#fb7185';
            elPlayerQaResultTitle.textContent = '😅 RẤT TIẾC, CHƯA ĐÚNG!';
            elPlayerQaResultPoints.textContent = 'Cố gắng ở câu tiếp theo nhé!';
          }
        }
      }

      showScreen('qa');
    } else {
      showScreen('waiting');
    }
  }

  socket.on('game_mode_changed', ({ mode }) => {
    playerState.currentMode = mode;
    if (mode === 'LOBBY' || mode === 'PODIUM') {
      showScreen('waiting');
    }
  });

  // --- SQUIZZ EVENTS ---
  const elSqIndex = document.getElementById('player-sq-index');
  const elSqTitle = document.getElementById('player-sq-title');
  const elSqQuestion = document.getElementById('player-sq-question');
  const elSqVoteForm = document.getElementById('sq-vote-form');
  const elSqOpenTextForm = document.getElementById('sq-opentext-form');
  const inputSquizzOpenText = document.getElementById('input-squizz-opentext');
  const elSqVoteDone = document.getElementById('sq-vote-done');
  const elSqVoteDoneLabel = document.getElementById('sq-vote-done-label');
  const elSqMyVotedName = document.getElementById('sq-my-voted-name');

  function renderPlayerSquizz(q, index, total) {
    elSqIndex.textContent = `CÂU ${index + 1} / ${total || 12}`;
    elSqTitle.textContent = q.title || `Câu hỏi ${index + 1}`;
    elSqQuestion.textContent = q.question;

    elSqVoteDone.style.display = 'none';
    playerState.myVote = null;
    currentlySelectedColleague = '';

    const btnVote = document.getElementById('btn-submit-vote');
    const btnText = document.getElementById('btn-submit-opentext');
    if (btnVote) { btnVote.disabled = false; btnVote.textContent = 'GỬI BÌNH CHỌN 🗳️'; }
    if (btnText) { btnText.disabled = false; btnText.textContent = 'GỬI CÂU TRẢ LỜI 🚀'; }

    if (q.type === 'OPEN_TEXT') {
      // Open-ended text mode
      if (elSqVoteForm) elSqVoteForm.style.display = 'none';
      if (elSqOpenTextForm) elSqOpenTextForm.style.display = 'block';
      if (inputSquizzOpenText) inputSquizzOpenText.value = '';
    } else {
      // Member voting mode
      if (elSqVoteForm) elSqVoteForm.style.display = 'block';
      if (elSqOpenTextForm) elSqOpenTextForm.style.display = 'none';
      if (inputSquizzFilter) inputSquizzFilter.value = '';
      renderMemberSuggestions(playerState.members);
    }
  }

  function setSquizzVoted(answerText) {
    playerState.myVote = answerText;
    elSqMyVotedName.textContent = answerText;
    if (elSqVoteForm) elSqVoteForm.style.display = 'none';
    if (elSqOpenTextForm) elSqOpenTextForm.style.display = 'none';
    elSqVoteDone.style.display = 'block';
  }

  socket.on('squizz_question_started', ({ currentIndex, total, question }) => {
    window._currentSquizzIndex = currentIndex;
    window._currentSquizzQ = question;
    renderPlayerSquizz(question, currentIndex, total);
    showScreen('squizz');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (navigator.vibrate) navigator.vibrate(50);
  });

  socket.on('squizz_lock_changed', ({ isOpen }) => {
    const btnVote = document.getElementById('btn-submit-vote');
    const btnText = document.getElementById('btn-submit-opentext');
    if (btnVote) {
      btnVote.disabled = !isOpen;
      btnVote.textContent = isOpen ? 'GỬI BÌNH CHỌN 🗳️' : '🔒 ĐÃ KHÓA BÌNH CHỌN';
    }
    if (btnText) {
      btnText.disabled = !isOpen;
      btnText.textContent = isOpen ? 'GỬI CÂU TRẢ LỜI 🚀' : '🔒 ĐÃ KHÓA';
    }
  });

  // Submit Member Vote
  document.getElementById('btn-submit-vote').addEventListener('click', () => {
    const chosen = currentlySelectedColleague || (inputSquizzFilter ? inputSquizzFilter.value.trim() : '');
    if (!chosen) {
      alert('Vui lòng chạm chọn 1 đồng nghiệp trong danh sách!');
      return;
    }
    socket.emit('player_vote_squizz', { name: chosen, playerId: playerState.id });
  });

  // Submit Open Text Answer
  const btnSubmitOpenText = document.getElementById('btn-submit-opentext');
  if (btnSubmitOpenText) {
    btnSubmitOpenText.addEventListener('click', () => {
      const text = inputSquizzOpenText ? inputSquizzOpenText.value.trim() : '';
      if (!text) {
        alert('Vui lòng nhập câu trả lời hoặc cảm nghĩ của bạn!');
        if (inputSquizzOpenText) inputSquizzOpenText.focus();
        return;
      }
      socket.emit('player_vote_squizz', { text, playerId: playerState.id });
    });
  }

  socket.on('squizz_vote_accepted', ({ chosenName }) => {
    setSquizzVoted(chosenName);
    try {
      const curIdx = window._currentSquizzIndex !== undefined ? window._currentSquizzIndex : 0;
      sessionStorage.setItem('tckt_sq_vote_' + curIdx, chosenName);
    } catch(e) {}
    if (window.soundFX) window.soundFX.playCorrect();
    if (navigator.vibrate) navigator.vibrate([40, 40, 40]);
  });

  document.getElementById('btn-change-vote').addEventListener('click', () => {
    elSqVoteDone.style.display = 'none';
    try {
      const curIdx = window._currentSquizzIndex !== undefined ? window._currentSquizzIndex : 0;
      sessionStorage.removeItem('tckt_sq_vote_' + curIdx);
    } catch(e) {}
    const currentQ = window._currentSquizzQ;
    if (currentQ && currentQ.type === 'OPEN_TEXT') {
      if (elSqOpenTextForm) elSqOpenTextForm.style.display = 'block';
      if (inputSquizzOpenText) inputSquizzOpenText.focus();
    } else {
      if (elSqVoteForm) elSqVoteForm.style.display = 'block';
    }
  });

  // --- QA EVENTS ---
  const elPlayerQaCat = document.getElementById('player-qa-cat');
  const elPlayerQaIndex = document.getElementById('player-qa-index');
  const elPlayerQaQuestion = document.getElementById('player-qa-question');
  const elPlayerQaGrid = document.getElementById('player-qa-options-grid');
  const elPlayerQaOpenTextForm = document.getElementById('player-qa-opentext-form');
  const inputQaOpenText = document.getElementById('input-qa-opentext');
  const btnSubmitQaOpenText = document.getElementById('btn-submit-qa-opentext');

  const elPlayerQaResult = document.getElementById('player-qa-result');
  const elPlayerQaResultTitle = document.getElementById('player-qa-result-title');
  const elPlayerQaResultPoints = document.getElementById('player-qa-result-points');

  function renderPlayerQa(q, index, total) {
    elPlayerQaCat.textContent = `${q.icon || '⚔️'} ${q.category || 'Đố vui'}`;
    elPlayerQaIndex.textContent = `CÂU ${index + 1} / ${total || 15}`;
    elPlayerQaQuestion.textContent = q.question;

    elPlayerQaResult.style.display = 'none';
    playerState.myAnswer = null;

    if (q.type === 'OPEN_TEXT') {
      if (elPlayerQaGrid) elPlayerQaGrid.style.display = 'none';
      if (elPlayerQaOpenTextForm) elPlayerQaOpenTextForm.style.display = 'block';
      if (inputQaOpenText) inputQaOpenText.value = '';
      if (btnSubmitQaOpenText) {
        btnSubmitQaOpenText.disabled = false;
        btnSubmitQaOpenText.textContent = 'GỬI ĐÁP ÁN 🚀';
      }
    } else {
      if (elPlayerQaGrid) elPlayerQaGrid.style.display = 'grid';
      if (elPlayerQaOpenTextForm) elPlayerQaOpenTextForm.style.display = 'none';

      for (let i = 0; i < 4; i++) {
        const label = document.getElementById(`p-opt-${i}`);
        const btn = document.querySelector(`.mobile-opt-btn[data-opt="${i}"]`);
        if (label && q.options) {
          label.textContent = q.options[i] || '';
        }
        if (btn) {
          btn.classList.remove('selected', 'dimmed');
          btn.disabled = false;
          btn.style.opacity = '1';
        }
      }
    }
  }

  socket.on('qa_question_started', ({ currentIndex, total, timeLimit, question }) => {
    window._currentQaIndex = currentIndex;
    window._currentQaQ = question;
    renderPlayerQa(question, currentIndex, total);
    if (elPlayerQaTimer) {
      elPlayerQaTimer.textContent = `⏱️ ${timeLimit || 15}s`;
      elPlayerQaTimer.style.background = 'rgba(244, 63, 94, 0.25)';
    }
    showScreen('qa');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (navigator.vibrate) navigator.vibrate(50);
  });

  socket.on('qa_timer_tick', ({ timeRemaining, isPaused }) => {
    if (elPlayerQaTimer) {
      if (isPaused) {
        elPlayerQaTimer.textContent = `⏸️ Tạm dừng (${timeRemaining}s)`;
        elPlayerQaTimer.style.background = 'rgba(245, 158, 11, 0.4)';
      } else {
        elPlayerQaTimer.textContent = `⏱️ ${timeRemaining}s`;
        if (timeRemaining <= 5) {
          elPlayerQaTimer.style.background = 'rgba(244, 63, 94, 0.45)';
        } else {
          elPlayerQaTimer.style.background = 'rgba(244, 63, 94, 0.25)';
        }
      }
    }
  });

  socket.on('qa_timer_paused', ({ isPaused, timeRemaining }) => {
    if (elPlayerQaTimer) {
      if (isPaused) {
        elPlayerQaTimer.textContent = `⏸️ Tạm dừng (${timeRemaining !== undefined ? timeRemaining : ''}s)`;
        elPlayerQaTimer.style.background = 'rgba(245, 158, 11, 0.4)';
      } else {
        elPlayerQaTimer.textContent = `⏱️ ${timeRemaining !== undefined ? timeRemaining : ''}s`;
        elPlayerQaTimer.style.background = 'rgba(244, 63, 94, 0.25)';
      }
    }
  });

  socket.on('qa_lock_changed', ({ isOpen }) => {
    if (!isOpen) {
      document.querySelectorAll('.mobile-opt-btn').forEach(b => {
        b.disabled = true;
      });
      if (btnSubmitQaOpenText) {
        btnSubmitQaOpenText.disabled = true;
      }
      if (elPlayerQaTimer) {
        elPlayerQaTimer.textContent = '🔒 ĐÃ KHÓA ĐÁP ÁN';
      }
    }
  });

  document.querySelectorAll('.mobile-opt-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (playerState.myAnswer !== null) return;
      const optIdx = parseInt(btn.getAttribute('data-opt'), 10);
      playerState.myAnswer = optIdx;

      try {
        const curIdx = window._currentQaIndex !== undefined ? window._currentQaIndex : 0;
        sessionStorage.setItem('tckt_qa_ans_' + curIdx, optIdx);
      } catch(e) {}

      // Highlight selected
      document.querySelectorAll('.mobile-opt-btn').forEach(b => {
        b.disabled = true;
        if (b === btn) {
          b.classList.add('selected');
        } else {
          b.style.opacity = '0.4';
        }
      });

      socket.emit('player_answer_qa', { optionIndex: optIdx, playerId: playerState.id });
      if (navigator.vibrate) navigator.vibrate(40);
    });
  });

  if (btnSubmitQaOpenText) {
    btnSubmitQaOpenText.addEventListener('click', () => {
      const text = inputQaOpenText ? inputQaOpenText.value.trim() : '';
      if (!text) {
        alert('Vui lòng nhập đáp án của bạn!');
        return;
      }
      playerState.myAnswer = text;
      try {
        const curIdx = window._currentQaIndex !== undefined ? window._currentQaIndex : 0;
        sessionStorage.setItem('tckt_qa_ans_' + curIdx, text);
      } catch(e) {}
      socket.emit('player_answer_qa', { optionIndex: -1, textAnswer: text, playerId: playerState.id });
      btnSubmitQaOpenText.disabled = true;
      btnSubmitQaOpenText.textContent = 'ĐÃ GỬI ĐÁP ÁN ✅';
    });
  }

  socket.on('qa_answer_accepted', ({ optionIndex, pointsAwarded, isCorrect }) => {
    // Answer accepted
  });

  socket.on('qa_revealed', ({ correctAnswer, explanation, leaderboard }) => {
    if (playerState.myAnswer !== null && typeof playerState.myAnswer === 'number') {
      const isCorrect = (playerState.myAnswer === correctAnswer);
      elPlayerQaResult.style.display = 'block';

      if (isCorrect) {
        elPlayerQaResult.style.background = 'rgba(16, 185, 129, 0.2)';
        elPlayerQaResult.style.border = '1px solid var(--emerald)';
        elPlayerQaResultTitle.style.color = '#34d399';
        elPlayerQaResultTitle.textContent = '🎉 CHÍNH XÁC!';
        elPlayerQaResultPoints.textContent = 'Bạn đã ghi điểm trong câu hỏi này!';
        if (window.soundFX) window.soundFX.playCorrect();
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
      } else {
        elPlayerQaResult.style.background = 'rgba(244, 63, 94, 0.2)';
        elPlayerQaResult.style.border = '1px solid var(--rose)';
        elPlayerQaResultTitle.style.color = '#fb7185';
        elPlayerQaResultTitle.textContent = '😅 RẤT TIẾC, CHƯA ĐÚNG!';
        elPlayerQaResultPoints.textContent = 'Cố gắng ở câu tiếp theo nhé!';
        if (window.soundFX) window.soundFX.playWrong();
      }
    }

    // Update my score
    const me = (leaderboard || []).find(p => p.id === playerState.id);
    if (me) {
      playerState.score = me.score;
      elMyScoreTag.textContent = `${me.score.toLocaleString()} điểm`;
    }
  });

  socket.on('scores_reset', () => {
    playerState.score = 0;
    elMyScoreTag.textContent = '0 điểm';
  });

  // Party Cheer Overlay
  const cheerOverlay = document.getElementById('cheer-overlay');
  const cheerTitle = document.getElementById('cheer-overlay-title');

  socket.on('party_cheer', ({ text }) => {
    if (cheerTitle) cheerTitle.textContent = text || '100% CẠN CHÉN! ZÔ ZÔ!';
    if (cheerOverlay) cheerOverlay.style.display = 'flex';
    if (window.soundFX) window.soundFX.playGlassClink();
    if (navigator.vibrate) navigator.vibrate([100, 100, 100, 100, 300]);
  });

  document.getElementById('btn-close-cheer').addEventListener('click', () => {
    if (cheerOverlay) cheerOverlay.style.display = 'none';
  });

  // Handle Admin Kick / Reset (When user or someone accidentally picked their name)
  socket.on('player_kicked', ({ message }) => {
    localStorage.removeItem('tckt_player_id');
    localStorage.removeItem('tckt_player_member_id');
    localStorage.removeItem('tckt_player_nick');
    localStorage.removeItem('tckt_player_fp');
    localStorage.removeItem('tckt_player_dob');
    localStorage.removeItem('tckt_player_avatar');

    playerState.id = null;
    playerState.memberId = null;
    playerState.nickname = '';
    playerState.fingerprint = '';
    playerState.dob = '';
    playerState.score = 0;
    playerState.hasJoined = false;

    if (smartSearchInput) smartSearchInput.value = '';
    if (selectMember) selectMember.value = '';
    if (memberProfileCard) memberProfileCard.style.display = 'none';
    if (fpMatchBadge) fpMatchBadge.style.display = 'none';
    if (smartSuggestionBox) {
      smartSuggestionBox.style.display = 'none';
      smartSuggestionBox.innerHTML = '';
    }

    showScreen('join');
    showJoinError(message || 'Tài khoản của bạn đã được Admin đặt lại trạng thái. Vui lòng chọn đúng tên hoặc mã vân tay để tham gia lại!');
  });
});
