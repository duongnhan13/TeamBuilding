// Zodiac & Lunar Animal Helper Module
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

  function getZodiacSign(day, month) {
    if (!day || !month) return null;
    const signs = [
      { name: 'Ma Kết', icon: '♑', en: 'Capricorn', start: [12, 22], end: [1, 19] },
      { name: 'Bảo Bình', icon: '♒', en: 'Aquarius', start: [1, 20], end: [2, 18] },
      { name: 'Song Ngư', icon: '♓', en: 'Pisces', start: [2, 19], end: [3, 20] },
      { name: 'Bạch Dương', icon: '♈', en: 'Aries', start: [3, 21], end: [4, 19] },
      { name: 'Kim Ngưu', icon: '♉', en: 'Taurus', start: [4, 20], end: [5, 20] },
      { name: 'Song Tử', icon: '♊', en: 'Gemini', start: [5, 21], end: [6, 21] },
      { name: 'Cự Giải', icon: '♋', en: 'Cancer', start: [6, 22], end: [7, 22] },
      { name: 'Sư Tử', icon: '♌', en: 'Leo', start: [7, 23], end: [8, 22] },
      { name: 'Xử Nữ', icon: '♍', en: 'Virgo', start: [8, 23], end: [9, 22] },
      { name: 'Thiên Bình', icon: '♎', en: 'Libra', start: [9, 23], end: [10, 23] },
      { name: 'Bọ Cạp', icon: '♏', en: 'Scorpio', start: [10, 24], end: [11, 22] },
      { name: 'Nhân Mã', icon: '♐', en: 'Sagittarius', start: [11, 23], end: [12, 21] }
    ];

    for (const z of signs) {
      if (z.start[0] === 12 && z.end[0] === 1) {
        if ((month === 12 && day >= 22) || (month === 1 && day <= 19)) return z;
      } else {
        if ((month === z.start[0] && day >= z.start[1]) || (month === z.end[0] && day <= z.end[1])) return z;
      }
    }
    return { name: 'Ma Kết', icon: '♑', en: 'Capricorn' };
  }

  function getLunarZodiac(year) {
    if (!year) return null;
    const animals = [
      { name: 'Tý', animal: 'Chuột', icon: '🐭' },
      { name: 'Sửu', animal: 'Trâu', icon: '🐮' },
      { name: 'Dần', animal: 'Hổ', icon: '🐯' },
      { name: 'Mão', animal: 'Mèo', icon: '🐱' },
      { name: 'Thìn', animal: 'Rồng', icon: '🐲' },
      { name: 'Tỵ', animal: 'Rắn', icon: '🐍' },
      { name: 'Ngọ', animal: 'Ngựa', icon: '🐴' },
      { name: 'Mùi', animal: 'Dê', icon: '🐐' },
      { name: 'Thân', animal: 'Khỉ', icon: '🐵' },
      { name: 'Dậu', animal: 'Gà', icon: '🐔' },
      { name: 'Tuất', animal: 'Chó', icon: '🐶' },
      { name: 'Hợi', animal: 'Lợn', icon: '🐷' }
    ];
    const can = ['Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu', 'Kỷ', 'Canh', 'Tân', 'Nhâm', 'Quý'];
    const stem = can[(year - 4) % 10];
    const branch = animals[(year - 4) % 12];
    return {
      canChi: `${stem} ${branch.name}`,
      animal: branch.animal,
      icon: branch.icon,
      fullText: `Tuổi ${stem} ${branch.name} (${branch.animal} ${branch.icon})`
    };
  }

  function getZodiacDetails(dobStr) {
    const parts = parseDateParts(dobStr);
    if (!parts) return null;
    const sign = getZodiacSign(parts.day, parts.month);
    const lunar = getLunarZodiac(parts.year);
    return { sign, lunar, parts };
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { parseDateParts, getZodiacSign, getLunarZodiac, getZodiacDetails };
  }
  if (typeof window !== 'undefined') {
    window.zodiacHelper = { parseDateParts, getZodiacSign, getLunarZodiac, getZodiacDetails };
  }
})(typeof window !== 'undefined' ? window : global);
