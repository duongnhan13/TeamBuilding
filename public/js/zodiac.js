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
    { name: 'Giáp' },
    { name: 'Ất' },
    { name: 'Bính' },
    { name: 'Đinh' },
    { name: 'Mậu' },
    { name: 'Kỷ' },
    { name: 'Canh' },
    { name: 'Tân' },
    { name: 'Nhâm' },
    { name: 'Quý' }
  ];

  function getLunarZodiac(year) {
    if (!year) return null;
    const canIdx = (year - 4) % 10;
    const branchIdx = (year - 4) % 12;
    const stem = CAN_STEMS[canIdx >= 0 ? canIdx : canIdx + 10];
    const branch = LUNAR_ANIMALS[branchIdx >= 0 ? branchIdx : branchIdx + 12];
    
    return {
      year,
      canChi: `${stem.name} ${branch.name}`,
      animal: branch.animal,
      icon: branch.icon,
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

  // Generate glowing Năm Tuổi badge HTML for Game 1 winner announcement
  function generateZodiacBadgesHtml(zodiacInfo) {
    if (!zodiacInfo || !zodiacInfo.lunar) return '';
    const { lunar } = zodiacInfo;

    return `
      <div class="spotlight-nam-tuoi-card" style="display: inline-flex; align-items: center; justify-content: center; gap: 12px; background: rgba(245, 158, 11, 0.15); border: 2px solid var(--gold); border-radius: 999px; padding: 10px 24px; box-shadow: 0 4px 25px rgba(245, 158, 11, 0.4); margin-bottom: 14px;">
        <span style="font-size: 2.2rem; filter: drop-shadow(0 0 10px rgba(245, 158, 11, 0.8));">${lunar.icon}</span>
        <div style="text-align: left;">
          <div style="font-size: 1.3rem; font-weight: 900; color: #fef08a; letter-spacing: 0.5px;">
            Tuổi ${lunar.canChi} (${lunar.animal})
          </div>
          <div style="font-size: 0.85rem; color: #cbd5e1; font-weight: 600;">
            ${lunar.trait}
          </div>
        </div>
      </div>
    `;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { parseDateParts, getZodiacSign, getLunarZodiac, getZodiacDetails, generateZodiacBadgesHtml, ZODIAC_SIGNS, LUNAR_ANIMALS };
  }
  if (typeof window !== 'undefined') {
    window.zodiacHelper = { parseDateParts, getZodiacSign, getLunarZodiac, getZodiacDetails, generateZodiacBadgesHtml, ZODIAC_SIGNS, LUNAR_ANIMALS };
  }
})(typeof window !== 'undefined' ? window : global);
