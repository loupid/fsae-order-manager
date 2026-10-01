/**
 * Subsystem Helper Utilities
 * Provides resilient, diacritic-insensitive resolution of default subsystems for FSAE members.
 */

export function normalizeSubsystemText(str) {
  if (!str) return '';
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
}

/**
 * Resolves the default subsystem ID based on user department/subsystem profile
 * @param {Array} list - Array of subsystems ({ id, code, name })
 * @param {Object} [user] - Current user object ({ department, subsystem })
 * @returns {number|string} Resolved subsystem ID, or first subsystem ID, or ''
 */
export function resolveDefaultSubsystemId(list, user) {
  if (!Array.isArray(list) || list.length === 0) return '';

  if (user) {
    const userDept = normalizeSubsystemText(user.department);
    const userSub = normalizeSubsystemText(user.subsystem);

    // 1. Direct code match with department
    if (userDept) {
      const matched = list.find(s => s.code && normalizeSubsystemText(s.code) === userDept);
      if (matched) return matched.id;
    }

    // 2. Direct code match with subsystem
    if (userSub) {
      const matched = list.find(s => s.code && normalizeSubsystemText(s.code) === userSub);
      if (matched) return matched.id;
    }

    // 3. Bidirectional name match with department (e.g. "Team Électrique" <-> "Electrique")
    if (userDept) {
      const matched = list.find(s => {
        if (!s.name) return false;
        const normName = normalizeSubsystemText(s.name);
        return normName.includes(userDept) || userDept.includes(normName);
      });
      if (matched) return matched.id;
    }

    // 4. Bidirectional name match with subsystem
    if (userSub) {
      const matched = list.find(s => {
        if (!s.name) return false;
        const normName = normalizeSubsystemText(s.name);
        return normName.includes(userSub) || userSub.includes(normName);
      });
      if (matched) return matched.id;
    }

    // 5. Keyword heuristic for FSAE specialties
    const keywords = [
      { keys: ['ELEC', 'BMS', 'BATTER', 'ACCU', 'VOLT', 'HV', 'LV', 'TELEMETR', 'ECU', 'CAN', 'WIRE'], code: 'ELE' },
      { keys: ['STRUCT', 'CHASSIS', 'FRAME', 'AERO', 'CARBON', 'CRASH', 'COMPOSIT'], code: 'STR' },
      { keys: ['DRIVE', 'POWERTRAIN', 'MOTOR', 'MOTEUR', 'COOL', 'REFROID', 'DIFF', 'TRANSMISS', 'GEAR'], code: 'DRI' },
      { keys: ['ERGO', 'VOLANT', 'PEDAL', 'HARNAIS', 'SEAT', 'SIEGE', 'STEER'], code: 'ERG' },
      { keys: ['ADMIN', 'GESTION', 'FINANC', 'ACHAT', 'BUDGET', 'SPONSOR', 'COST'], code: 'ADM' }
    ];

    const combinedText = `${userDept} ${userSub}`;
    for (const group of keywords) {
      if (group.keys.some(k => combinedText.includes(k))) {
        const found = list.find(s => s.code === group.code);
        if (found) return found.id;
      }
    }
  }

  // Fallback to first available subsystem
  return list[0]?.id !== undefined ? list[0].id : '';
}
