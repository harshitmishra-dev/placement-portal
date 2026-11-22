// Skill matching: compares student skills with the skills an internship needs.
function normalize(list) {
  const arr = Array.isArray(list) ? list : String(list || '').split(',');
  return [...new Set(arr.map(s => s.trim().toLowerCase()).filter(Boolean))];
}

function matchSkills(studentSkills, requiredSkills) {
  const have = normalize(studentSkills);
  const need = normalize(requiredSkills);
  if (need.length === 0) return { score: 0, matched: [], missing: [] };
  const matched = need.filter(s => have.includes(s));
  const missing = need.filter(s => !have.includes(s));
  return { score: Math.round((matched.length / need.length) * 100), matched, missing };
}

module.exports = { normalize, matchSkills };
