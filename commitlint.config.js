module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'header-max-length': [0, 'always', Infinity],
    // Body & footer baris panjang diizinkan agar deskripsi commit tidak terpotong.
    // Default 100 karakter dari @commitlint/config-conventional terlalu ketat untuk
    // pesan multi-baris yang menjelaskan serangkaian perubahan terkait.
    'body-max-line-length': [0, 'always', Infinity],
    'footer-max-line-length': [0, 'always', Infinity],
  },
};