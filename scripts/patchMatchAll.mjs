const originalMatchAll = String.prototype.matchAll;

String.prototype.matchAll = function patchedMatchAll(regex) {
  if (regex instanceof RegExp && !regex.global) {
    const flags = `${regex.flags}g`;
    return originalMatchAll.call(this, new RegExp(regex.source, flags));
  }
  return originalMatchAll.call(this, regex);
};
