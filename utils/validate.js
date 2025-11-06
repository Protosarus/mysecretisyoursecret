const CATEGORIES = ['desire', 'family', 'work', 'health', 'other'];

function isString(value) {
  return typeof value === 'string';
}

function isValidNickname(str) {
  if (!isString(str)) {
    return false;
  }
  const trimmed = str.trim();
  if (trimmed.length < 2 || trimmed.length > 32) {
    return false;
  }
  return /^[A-Za-z0-9 _-]+$/.test(trimmed);
}

function isValidPassword(str) {
  if (!isString(str)) {
    return false;
  }
  const length = str.length;
  return length >= 6 && length <= 128;
}

function isValidGender(str) {
  if (!isString(str)) {
    return false;
  }
  return ['male', 'female', 'other'].includes(str);
}

function isValidCategory(str) {
  if (!isString(str)) {
    return false;
  }
  return CATEGORIES.includes(str);
}

function isValidContent(str) {
  if (!isString(str)) {
    return false;
  }
  const trimmed = str.trim();
  const length = trimmed.length;
  return length >= 2 && length <= 2000;
}

module.exports = {
  CATEGORIES,
  isValidNickname,
  isValidPassword,
  isValidGender,
  isValidCategory,
  isValidContent
};
