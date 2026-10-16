// Zodiac & Lunar Animal Helper Module with Premium Visuals & Metadata
(function(window) {
  function parseDateParts(dobStr) {
    if (!dobStr) return null;
    dobStr = dobStr.toString().trim();
    // Match dd/mm/yyyy or dd-mm-yyyy or dd.mm.yyyy
    const dmy = dobStr.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
    if (dmy) {
      return { day: parseInt(dmy[1], 10), month: parseInt(dmy[2], 10), year: parseInt(dmy[3], 10) };
    }
    // Match yyyy-mm-dd
    const ymd = dobStr.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
    if (ymd) {
      return { day: parseInt(ymd[3], 10), month: parseInt(ymd[2], 10), year: parseInt(ymd[1], 10) };
    }
    // Match year only
    const yr = dobStr.match(/^(\d{4})$/);
    if (yr) {
      return { day: 1, month: 1, year: parseInt(yr[1], 10) };
    }
    return null;
  }

  const ZODIAC_SIGNS = [
    { name: 'Ma Kết', icon: '♑', en: 'Capricorn', element: 'Đất', elIcon: '🌍', color: '#10b981', gradient: 'linear-gradient(135deg, #059669, #34d399)', trait: 'Kiên định • Trách nhiệm', start: [12, 22], end: [1, 19] },
    { name: 'Bảo Bình', icon: '♒', en: 'Aquarius', element: 'Khí', elIcon: '💨', color: '#06b6d4', gradient: 'linear-gradient(135deg, #0284c7, #38bdf8)', trait: 'Đột phá • Sáng tạo', start: [1, 20], end: [2, 18] },
    { name: 'Song Ngư', icon: '♓', en: 'Pisces', element: 'Nước', elIcon: '💧', color: '#818cf8', gradient: 'linear-gradient(135deg, #4f46e5, #a5b4fc)', trait: 'Bao dung • Trực giác', start: [2, 19], end: [3, 20] },
    { name: 'Bạch Dương', icon: '♈', en: 'Aries', element: 'Lửa', elIcon: '🔥', color: '#f43f5e', gradient: 'linear-gradient(135deg, #e11d48, #fb7185)', trait: 'Tiên phong • Quyết đoán', start: [3, 21], end: [4, 19] },
    { name: 'Kim Ngưu', icon: '♉', en: 'Taurus', element: 'Đất', elIcon: '🌍', color: '#10b981', gradient: 'linear-gradient(135deg, #047857, #10b981)', trait: 'Vững vàng • Đáng tin', start: [4, 20], end: [5, 20] },
    { name: 'Song Tử', icon: '♊', en: 'Gemini', element: 'Khí', elIcon: '💨', color: '#f59e0b', gradient: 'linear-gradient(135deg, #d97706, #fbbf24)', trait: 'Thông thái • Hài hước', start: [5, 21], end: [6, 21] },
    { name: 'Cự Giải', icon: '♋', en: 'Cancer', element: 'Nước', elIcon: '💧', color: '#38bdf8', gradient: 'linear-gradient(135deg, #0369a1, #38bdf8)', trait: 'Ấm áp • Tình cảm', start: [6, 22], end: [7, 22] },
    { name: 'Sư Tử', icon: '♌', en: 'Leo', element: 'Lửa', elIcon: '🔥', color: '#f97316', gradient: 'linear-gradient(135deg, #ea580c, #fb923c)', trait: 'Tỏa sáng • Lãnh đạo', start: [7, 23], end: [8, 22] },
    { name: 'Xử Nữ', icon: '♍', en: 'Virgo', element: 'Đất', elIcon: '🌍', color: '#84cc16', gradient: 'linear-gradient(135deg, #65a30d, #a3e635)', trait: 'Chu đáo • Hoàn mỹ', start: [8, 23], end: [9, 22] },
    { name: 'Thiên Bình', icon: '♎', en: 'Libra', element: 'Khí', elIcon: '💨', color: '#8b5cf6', gradient: 'linear-gradient(135deg, #7c3aed, #c084fc)', trait: 'Công bằng • Tinh tế', start: [9, 23], end: [10, 23] },
    { name: 'Bọ Cạp', icon: '♏', en: 'Scorpio', element: 'Nước', elIcon: '💧', color: '#ec4899', gradient: 'linear-gradient(135deg, #db2777, #f472b6)', trait: 'Sâu sắc • Sắc sảo', start: [10, 24], end: [11, 22] },
    { name: 'Nhân Mã', icon: '♐', en: 'Sagittarius', element: 'Lửa', elIcon: '🔥', color: '#f59e0b', gradient: 'linear-gradient(135deg, #b45309, #fcd34d)', trait: 'Tự do • Lạc quan', start: [11, 23], end: [12, 21] }
  ];

  function getZodiacSign(day, month) {
    if (!day || !month) return null;
    for (const z of ZODIAC_SIGNS) {
      if (z.start[0] === 12 && z.end[0] === 1) {
        if ((month === 12 && day >= 22) || (month === 1 && day <= 19)) return z;
      } else {
        if ((month === z.start[0] && day >= z.start[1]) || (month === z.end[0] && day <= z.end[1])) return z;
      }
    }
    return ZODIAC_SIGNS[0];
  }

  const LUNAR_ANIMALS = [
    { name: 'Tý', animal: 'Chuột', icon: '🐭', desc: 'Nhanh nhẹn & Thông minh', color: '#60a5fa' },
    { name: 'Sửu', animal: 'Trâu', icon: '🐮', desc: 'Chăm chỉ & Bền bỉ', color: '#34d399' },
    { name: 'Dần', animal: 'Hổ', icon: '🐯', desc: 'Mạnh mẽ & Quyết liệt', color: '#f87171' },
    { name: 'Mão', animal: 'Mèo', icon: '🐱', desc: 'Khéo léo & Hòa nhã', color: '#c084fc' },
    { name: 'Thìn', animal: 'Rồng', icon: '🐲', desc: 'Uy quyền & May mắn', color: '#fbbf24' },
    { name: 'Tỵ', animal: 'Rắn', icon: '🐍', desc: 'Sâu sắc & Khôn ngoan', color: '#2dd4bf' },
    { name: 'Ngọ', animal: 'Ngựa', icon: '🐴', desc: 'Tự do & Bứt phá', color: '#fb923c' },
    { name: 'Mùi', animal: 'Dê', icon: '🐐', desc: 'Hiền hòa & Nghệ sĩ', color: '#a78bfa' },
    { name: 'Thân', animal: 'Khỉ', icon: '🐵', desc: 'Linh hoạt & Tài ba', color: '#facc15' },
    { name: 'Dậu', animal: 'Gà', icon: '🐔', desc: 'Đúng giờ & Tận tâm', color: '#f43f5e' },
    { name: 'Tuất', animal: 'Chó', icon: '🐶', desc: 'Trung thành & Đáng tin', color: '#38bdf8' },
    { name: 'Hợi', animal: 'Lợn', icon: '🐷', desc: 'Phúc hậu & Vui vẻ', color: '#f472b6' }
  ];

  const CAN_STEMS = [
    { name: 'Giáp', element: 'Mộc 🌲', color: '#22c55e' },
    { name: 'Ất', element: 'Mộc 🌲', color: '#16a34a' },
    { name: 'Bính', element: 'Hỏa 🔥', color: '#ef4444' },
    { name: 'Đinh', element: 'Hỏa 🔥', color: '#dc2626' },
    { name: 'Mậu', element: 'Thổ ⛰️', color: '#eab308' },
    { name: 'Kỷ', element: 'Thổ ⛰️', color: '#ca8a04' },
    { name: 'Canh', element: 'Kim ⚔️', color: '#f59e0b' },
    { name: 'Tân', element: 'Kim ⚔️', color: '#d97706' },
    { name: 'Nhâm', element: 'Thủy 🌊', color: '#06b6d4' },
    { name: 'Quý', element: 'Thủy 🌊', color: '#0284c7' }
  ];

  function getLunarZodiac(year) {
    if (!year) return null;
    const canIdx = (year - 4) % 10;
    const branchIdx = (year - 4) % 12;
    const stem = CAN_STEMS[canIdx >= 0 ? canIdx : canIdx + 10];
    const branch = LUNAR_ANIMALS[branchIdx >= 0 ? branchIdx : branchIdx + 12];
    
    return {
      canChi: `${stem.name} ${branch.name}`,
      animal: branch.animal,
      icon: branch.icon,
      element: stem.element,
      color: branch.color,
      trait: branch.desc,
      fullText: `Tuổi ${stem.name} ${branch.name} (${branch.animal} ${branch.icon})`
    };
  }

  function getZodiacDetails(dobStr) {
    const parts = parseDateParts(dobStr);
    if (!parts) return null;
    const sign = getZodiacSign(parts.day, parts.month);
    const lunar = getLunarZodiac(parts.year);
    return { sign, lunar, parts };
  }

  // Generate glowing badges HTML for UI rendering
  function generateZodiacBadgesHtml(zodiacInfo, size = 'normal') {
    if (!zodiacInfo) return '';
    const { sign, lunar } = zodiacInfo;
    const isSmall = size === 'small';

    let html = '<div class="zodiac-badges-container">';
    if (sign) {
      html += `
        <div class="zodiac-badge-card zodiac-sign-pill" style="border-color: ${sign.color};">
          <span class="zodiac-badge-icon">${sign.icon}</span>
          <div class="zodiac-badge-text">
            <span class="zodiac-badge-title">${sign.name}</span>
            ${!isSmall ? `<span class="zodiac-badge-sub">${sign.trait}</span>` : ''}
          </div>
        </div>
      `;
    }
    if (lunar) {
      html += `
        <div class="zodiac-badge-card lunar-animal-pill" style="border-color: ${lunar.color};">
          <span class="zodiac-badge-icon">${lunar.icon}</span>
          <div class="zodiac-badge-text">
            <span class="zodiac-badge-title">${lunar.canChi} (${lunar.animal})</span>
            ${!isSmall ? `<span class="zodiac-badge-sub">${lunar.element} • ${lunar.trait}</span>` : ''}
          </div>
        </div>
      `;
    }
    html += '</div>';
    return html;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { parseDateParts, getZodiacSign, getLunarZodiac, getZodiacDetails, generateZodiacBadgesHtml, ZODIAC_SIGNS, LUNAR_ANIMALS };
  }
  if (typeof window !== 'undefined') {
    window.zodiacHelper = { parseDateParts, getZodiacSign, getLunarZodiac, getZodiacDetails, generateZodiacBadgesHtml, ZODIAC_SIGNS, LUNAR_ANIMALS };
  }
})(typeof window !== 'undefined' ? window : global);
