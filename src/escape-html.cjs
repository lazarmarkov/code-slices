const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => entities[character]);

module.exports = { escapeHtml };
