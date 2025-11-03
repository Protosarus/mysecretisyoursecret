function escapeHTML(str) {
  if (typeof str !== 'string') {
    return '';
  }
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\//g, '&#47;');
}

function cleanInput(value, options = {}) {
  const { allowNewlines = false } = options;

  if (typeof value !== 'string') {
    throw new Error('Invalid input type.');
  }
  const trimmed = value.trim();

  const controlPattern = allowNewlines
    ? /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/
    : /[\u0000-\u001F\u007F]/;

  if (controlPattern.test(trimmed)) {
    throw new Error('Control characters are not allowed.');
  }

  return trimmed;
}

module.exports = {
  escapeHTML,
  cleanInput
};
