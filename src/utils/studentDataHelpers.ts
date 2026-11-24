import { RecordData } from '../types';

/**
 * Removes middle initials (single letters with or without dots, e.g. "I.", "I", "M.", "M")
 * from names while preserving full names.
 */
export function removeMiddleInitials(str?: string): string {
  if (!str) return '';
  const trimmed = String(str).trim();
  const words = trimmed.split(/\s+/);
  if (words.length <= 1) {
    // If it's a single word like "Alexis", return it
    return trimmed;
  }
  // Filter out single letter tokens or single letter with dot (e.g. "I.", "I", "M.", "M")
  const filtered = words.filter((word) => !/^[A-Za-z]\.?$/.test(word));
  if (filtered.length > 0) {
    return filtered.join(' ');
  }
  return trimmed;
}

/**
 * Formats student full name in the "First Last" format without middle initials.
 * If First Name and Last Name are given: "First Last"
 * If rawName is "Last, First M" or "Last, First": extracts to "First Last"
 */
export function formatStudentFullName(firstName?: string, lastName?: string, rawName?: string): string {
  const fName = removeMiddleInitials(firstName != null ? String(firstName).trim() : '');
  const lName = removeMiddleInitials(lastName != null ? String(lastName).trim() : '');

  if (fName && lName) {
    return `${fName} ${lName}`;
  }
  if (fName) return fName;

  if (rawName) {
    const trimmed = String(rawName).trim();
    if (trimmed.includes(',')) {
      const parts = trimmed.split(',');
      const last = removeMiddleInitials(parts[0].trim());
      const first = removeMiddleInitials(parts.slice(1).join(' ').trim());
      if (first && last) {
        return `${first} ${last}`;
      }
      return first || last;
    }
    return removeMiddleInitials(trimmed);
  }

  if (lName) return lName;
  return 'Student';
}

/**
 * Extracts just the teacher's last name from names formatted as:
 * - "Last, First M" -> "Last"
 * - "First Last" -> "Last"
 * - "Last" -> "Last"
 */
export function extractTeacherLastName(staffName?: string): string {
  if (!staffName) return '';
  const trimmed = String(staffName).trim();
  if (trimmed.includes(',')) {
    return removeMiddleInitials(trimmed.split(',')[0].trim());
  }
  // If "April Marcot" (First Last), extract last word if no comma
  const parts = trimmed.split(/\s+/);
  if (parts.length > 1) {
    return removeMiddleInitials(parts[parts.length - 1].trim());
  }
  return removeMiddleInitials(trimmed);
}

/**
 * Extracts student last name from record
 */
export function getStudentLastName(record: Partial<RecordData>): string {
  if (record.lastName && String(record.lastName).trim()) {
    return removeMiddleInitials(String(record.lastName).trim());
  }
  const raw = record.studentName || (record as any)['Student Name'] || (record as any)['FullName'] || '';
  if (!raw) return '';
  const trimmed = String(raw).trim();
  if (trimmed.includes(',')) {
    return removeMiddleInitials(trimmed.split(',')[0].trim());
  }
  const parts = trimmed.split(/\s+/);
  if (parts.length > 1) {
    return removeMiddleInitials(parts.slice(1).join(' ').trim());
  }
  return removeMiddleInitials(trimmed);
}

/**
 * Extracts student first name from record
 */
export function getStudentFirstName(record: Partial<RecordData>): string {
  if (record.firstName && String(record.firstName).trim()) {
    return removeMiddleInitials(String(record.firstName).trim());
  }
  const raw = record.studentName || (record as any)['Student Name'] || (record as any)['FullName'] || '';
  if (!raw) return '';
  const trimmed = String(raw).trim();
  if (trimmed.includes(',')) {
    const parts = trimmed.split(',');
    return removeMiddleInitials((parts[1] || '').trim());
  }
  const parts = trimmed.split(/\s+/);
  return removeMiddleInitials(parts[0] || '');
}

/**
 * Checks if a grade represents Kindergarten (00, 0, K, KG, Kindergarten).
 */
export function isKindergartenGrade(gradeStr?: string): boolean {
  if (gradeStr === undefined || gradeStr === null || gradeStr === '') return false;
  const cleaned = gradeStr.toString().trim().toUpperCase();
  return (
    cleaned === '00' ||
    cleaned === '0' ||
    cleaned === 'K' ||
    cleaned === 'KG' ||
    cleaned === 'KINDERGARTEN'
  );
}

/**
 * Checks if a grade is Preschool or Head Start (PS, HS, Preschool, Head Start).
 */
export function isPreschoolOrHeadStartGrade(gradeStr?: string): boolean {
  if (gradeStr === undefined || gradeStr === null || gradeStr === '') return false;
  const cleaned = gradeStr.toString().trim().toUpperCase();
  return (
    cleaned === 'PS' ||
    cleaned === 'HS' ||
    cleaned === 'PRESCHOOL' ||
    cleaned === 'HEAD START' ||
    cleaned === 'HEADSTART'
  );
}

/**
 * Checks if a grade is an excluded/non-printing grade (PS, HS, 00, 0, Preschool, Head Start).
 */
export function isExcludedGrade(gradeStr?: string): boolean {
  if (gradeStr === undefined || gradeStr === null || gradeStr === '') return false;
  const cleaned = gradeStr.toString().trim().toUpperCase();
  return (
    cleaned === 'PS' ||
    cleaned === 'HS' ||
    cleaned === '00' ||
    cleaned === '0' ||
    cleaned === 'PRESCHOOL' ||
    cleaned === 'HEAD START' ||
    cleaned === 'HEADSTART'
  );
}

/**
 * Normalizes a barcode string from spreadsheets/CSVs:
 * - Strips leading spreadsheet apostrophes (e.g. "'0098184741")
 * - Collapses spaces/hyphens when it represents a 10-digit leading-zero device barcode
 */
export function normalizeBarcodeValue(val?: string | number | null): string {
  if (val === undefined || val === null) return '';
  const trimmed = String(val).trim().replace(/^'+/, '').replace(/\.0+$/, '').trim();
  const compact = trimmed.replace(/[\s-]+/g, '');
  if (/^0\d{9}$/.test(compact)) {
    return compact;
  }
  return trimmed;
}

/**
 * Checks whether a value is a 10-digit device asset barcode with leading zero(s)
 * (e.g. "0098184741", "'0098184741", or "00981 84741").
 */
export function isTenDigitDeviceBarcode(val?: string | number | null): boolean {
  if (val === undefined || val === null) return false;
  const normalized = normalizeBarcodeValue(val).replace(/[\s-]+/g, '');
  return /^0\d{9}$/.test(normalized);
}

/**
 * Case-insensitive, BOM-safe and whitespace-safe column lookup for imported CSV/TSV rows.
 */
export function getRowFieldCaseInsensitive(
  item: Record<string, any>,
  ...keys: string[]
): { found: boolean; value: string } {
  const normalizedMap = new Map<string, string>();
  Object.keys(item || {}).forEach((origKey) => {
    const cleanKey = origKey.replace(/^\uFEFF/, '').trim().toLowerCase();
    const rawVal = item[origKey];
    if (!normalizedMap.has(cleanKey)) {
      normalizedMap.set(cleanKey, rawVal !== undefined && rawVal !== null ? String(rawVal).trim() : '');
    }
  });

  for (const k of keys) {
    const cleanTarget = k.trim().toLowerCase();
    if (normalizedMap.has(cleanTarget)) {
      return { found: true, value: normalizedMap.get(cleanTarget) || '' };
    }
  }
  return { found: false, value: '' };
}

/**
 * Extracts all candidate identity keys from a device record (Student ID, Lunch ID, User ID,
 * SAMAccountName, Email username, or parenthesized/explicit IDs in OwnedBy/Description).
 */
function getDeviceStudentMatchKeys(dev: Partial<RecordData>): string[] {
  const keys = new Set<string>();
  const addKey = (val?: string | number | null) => {
    const cleaned = String(val || '').trim().toLowerCase();
    if (cleaned) keys.add(cleaned);
  };

  addKey(dev.studentId);
  addKey(dev.lunchId);
  addKey(dev.userId);
  addKey(dev.username);
  addKey(dev.samAccountName);
  addKey(extractUsername(dev.email));

  // Extract parenthesized or standalone student IDs from OwnedBy / Usage / Description if present
  const textFields = [dev.ownedBy, dev.usage, dev.description];
  for (const field of textFields) {
    if (!field) continue;
    const str = String(field);
    const matches = str.match(/\b\d{6,8}\b/g);
    if (matches) {
      matches.forEach((m) => addKey(m));
    }
  }

  return Array.from(keys);
}

/**
 * Builds a fast lookup map (studentId / userId / username -> 10-digit device barcode)
 * from Devices & Inventory records.
 */
export function buildDeviceBarcodeLookupMap(devices: RecordData[] = []): Map<string, string> {
  const deviceByKey = new Map<string, string>();
  for (const dev of devices) {
    const devBarcode = normalizeBarcodeValue(dev.assetTag || dev.barcode);
    if (!isTenDigitDeviceBarcode(devBarcode)) continue;
    const keys = getDeviceStudentMatchKeys(dev);
    for (const k of keys) {
      if (k && k !== devBarcode.toLowerCase() && !deviceByKey.has(k)) {
        deviceByKey.set(k, devBarcode);
      }
    }
  }
  return deviceByKey;
}

/**
 * Looks up the 10-digit leading-zero device barcode associated with a student's
 * Student ID / Lunch ID / User ID / Username from either the student record itself
 * or the Devices & Inventory lookup map/array.
 */
export function getStudentDeviceBarcode(
  record: Partial<RecordData>,
  devicesOrMap?: RecordData[] | Map<string, string>
): string {
  const normBar = normalizeBarcodeValue(record.barcode);
  const normAsset = normalizeBarcodeValue(record.assetTag);

  if (isTenDigitDeviceBarcode(normBar)) return normBar;
  if (isTenDigitDeviceBarcode(normAsset)) return normAsset;

  if (devicesOrMap) {
    const lookupMap =
      devicesOrMap instanceof Map ? devicesOrMap : buildDeviceBarcodeLookupMap(devicesOrMap);
    if (lookupMap.size > 0) {
      const studentKeys = [
        record.studentId,
        record.lunchId,
        resolveMainUsername(record),
        record.userId,
        record.username,
        extractUsername(record.email),
      ]
        .map((k) => String(k || '').trim().toLowerCase())
        .filter(Boolean);

      for (const k of studentKeys) {
        const found = lookupMap.get(k);
        if (found) return found;
      }
    }
  }

  return '';
}

/**
 * Normalizes cached student records while preserving sheet fields:
 * - Normalizes 10-digit barcodes (strips leading apostrophes / spaces)
 * - Keeps sheet `barcode` if it holds studentId (so spreadsheet fidelity is preserved)
 * - Clears stale manualHasDevice=false when a valid 10-digit barcode is present
 */
export function sanitizeStudentRosterRecord(record: RecordData): RecordData {
  const normBar = normalizeBarcodeValue(record.barcode);
  const deviceBarcode = getStudentDeviceBarcode(record);
  const hasTenDigit = isTenDigitDeviceBarcode(deviceBarcode);
  const clearStaleManualNo = hasTenDigit && record.manualHasDevice === false;
  const effectiveManual = clearStaleManualNo ? undefined : record.manualHasDevice;
  const expectedLaptop =
    effectiveManual !== undefined
      ? effectiveManual
        ? 'Yes'
        : 'No'
      : hasTenDigit
      ? 'Yes'
      : String(record.hasLaptop || 'No');

  const needsBarcodeNorm = normBar !== (record.barcode || '') && isTenDigitDeviceBarcode(normBar);

  if (!needsBarcodeNorm && !clearStaleManualNo && record.hasLaptop === expectedLaptop) {
    return record;
  }
  const next: RecordData = {
    ...record,
    barcode: needsBarcodeNorm ? normBar : record.barcode,
    hasLaptop: expectedLaptop,
  };
  if (clearStaleManualNo) {
    delete next.manualHasDevice;
  }
  return next;
}

/**
 * Links 10-digit device barcodes from Devices & Inventory onto matching Student Roster records
 * (by Student ID / Lunch ID / User ID / SAMAccountName / Email) when a student doesn't already
 * have a 10-digit barcode.
 */
export function linkDeviceBarcodesToStudents(
  students: RecordData[],
  devices: RecordData[]
): { updated: RecordData[]; linkedCount: number } {
  if (!students.length || !devices.length) {
    return { updated: students, linkedCount: 0 };
  }

  const deviceByKey = buildDeviceBarcodeLookupMap(devices);
  if (deviceByKey.size === 0) {
    return { updated: students, linkedCount: 0 };
  }

  let linkedCount = 0;
  const updated = students.map((stu) => {
    const existingBar = getStudentDeviceBarcode(stu);
    if (isTenDigitDeviceBarcode(existingBar)) return stu;

    const matchedBarcode = getStudentDeviceBarcode(stu, deviceByKey);
    if (!matchedBarcode) return stu;

    linkedCount += 1;
    const next: RecordData = {
      ...stu,
      assetTag: matchedBarcode,
      barcode: isTenDigitDeviceBarcode(stu.barcode) ? stu.barcode : matchedBarcode,
      hasLaptop: 'Yes',
    };
    delete next.manualHasDevice;
    return next;
  });

  return { updated, linkedCount };
}

/**
 * Determines whether a student currently has an assigned computer / device.
 * Rule: Determined by whether a 10-digit barcode with leading zero(s) is associated with
 * the student (under Barcode, Asset Tag, or linked via Student ID in Devices & Inventory),
 * unless manually overridden via the Roster Editor toggle.
 */
export function studentHasDevice(
  record: Partial<RecordData>,
  devicesOrMap?: RecordData[] | Map<string, string>
): boolean {
  if (record.manualHasDevice !== undefined) {
    return record.manualHasDevice;
  }
  return isTenDigitDeviceBarcode(getStudentDeviceBarcode(record, devicesOrMap));
}

/**
 * Formats grade for display on badges/cards:
 * - Strips leading zero (e.g. "05" -> "5", "03" -> "3", "01" -> "1")
 * - When includeKindergarten is true, renders "00" / "0" / "K" / "KG" as "K (00)" or "K".
 * - If grade is PS, HS, 00 (when includeKindergarten is false), returns empty string.
 */
export function formatGradeDisplay(
  gradeStr?: string,
  hideExcluded: boolean = true,
  includeKindergarten: boolean = false
): string {
  if (!gradeStr) return '';
  if (includeKindergarten && isKindergartenGrade(gradeStr)) {
    const cleaned = gradeStr.toString().trim().toUpperCase();
    return cleaned === '00' || cleaned === '0' ? 'K (00)' : 'K';
  }
  if (hideExcluded && isExcludedGrade(gradeStr)) {
    return '';
  }
  const cleaned = gradeStr.toString().trim().toUpperCase();
  if (/^0[1-9]$/.test(cleaned)) {
    return cleaned.replace(/^0/, '');
  }
  return cleaned;
}

/**
 * Computes numerical rank for grades for descending sorting (highest grade first).
 * Grade 12 -> 12, Grade 5 -> 5, Grade 1 -> 1, K/00 -> 0, PK -> -1, Staff -> -100, PS/HS -> -500
 */
export function getGradeRank(gradeStr?: string): number {
  if (!gradeStr) return -999;
  const cleaned = gradeStr.toString().trim().toLowerCase();
  if (cleaned.includes('staff')) return -100;
  if (cleaned === 'ps' || cleaned === 'hs' || cleaned === 'preschool' || cleaned === 'head start' || cleaned === 'headstart') return -500;
  if (cleaned.includes('pre') || cleaned.includes('pk')) return -1;
  if (cleaned === 'k' || cleaned === 'kg' || cleaned === '00' || cleaned === '0' || cleaned.includes('kindergarten')) {
    return 0;
  }
  const match = cleaned.match(/\d+/);
  if (match) {
    return parseInt(match[0], 10);
  }
  return -999;
}

/**
 * Sorts student/staff records for printing:
 * 1. Highest grade first (e.g. 5, 4, 3, 2, 1, K, PK)
 * 2. Teacher last name (A-Z)
 * 3. Student last name (A-Z)
 * 4. Student first name (A-Z)
 */
export function sortRecordsForPrint(records: RecordData[]): RecordData[] {
  return [...records].sort((a, b) => {
    // 1. Grade descending (highest grade first)
    const rankA = getGradeRank(a.grade);
    const rankB = getGradeRank(b.grade);
    if (rankA !== rankB) {
      return rankB - rankA;
    }

    // 2. Teacher last name (A-Z)
    const teacherA = extractTeacherLastName(a.staffName).toLowerCase();
    const teacherB = extractTeacherLastName(b.staffName).toLowerCase();
    if (teacherA !== teacherB) {
      if (!teacherA) return 1;
      if (!teacherB) return -1;
      return teacherA.localeCompare(teacherB);
    }

    // 3. Student last name (A-Z)
    const lastA = getStudentLastName(a).toLowerCase();
    const lastB = getStudentLastName(b).toLowerCase();
    if (lastA !== lastB) {
      if (!lastA) return 1;
      if (!lastB) return -1;
      return lastA.localeCompare(lastB);
    }

    // 4. Student first name (A-Z)
    const firstA = getStudentFirstName(a).toLowerCase();
    const firstB = getStudentFirstName(b).toLowerCase();
    return firstA.localeCompare(firstB);
  });
}

/**
 * Truncates an email address to extract just the username (e.g. "jsmith24@fcpsschools.net" -> "jsmith24")
 */
export function extractUsername(emailOrUsername?: string, fallbackId?: string): string {
  if (!emailOrUsername) return fallbackId ? String(fallbackId) : '';
  const trimmed = String(emailOrUsername).trim();
  if (trimmed.includes('@')) {
    return trimmed.split('@')[0].trim();
  }
  return trimmed;
}

/**
 * Resolves the student's main username:
 * If userId (or email/username) exists and does NOT match studentId, userId is the main username.
 */
export function resolveMainUsername(record: Partial<RecordData>): string {
  const studentId = record.studentId != null ? String(record.studentId).trim() : '';
  const rawUserId = record.userId != null ? String(record.userId).trim() : '';
  const rawUsername = record.username != null ? String(record.username).trim() : '';
  const emailUser = extractUsername(record.email);

  if (rawUserId && rawUserId !== studentId) {
    return rawUserId;
  }
  if (rawUsername && rawUsername !== studentId) {
    return rawUsername;
  }
  if (emailUser && emailUser !== studentId) {
    return emailUser;
  }
  return rawUserId || rawUsername || emailUser || studentId || '';
}

/**
 * Normalizes and ensures student record fields:
 * - Student Name = Formatted as "First Last" without middle initials
 * - Lunch ID = studentId / FCPS ID
 * - User ID / Main Username = userId (if userId !== studentId) or Student Email 1 truncated
 * - Barcode = Device barcode value from sheet (or blank if not assigned)
 * - Teacher Name = Just the last name (from "Last, First M" or "First Last")
 */
export function normalizeStudentRecord(item: Partial<RecordData>, index: number = 0): RecordData {
  const row = item as Record<string, any>;
  const gf = (...keys: string[]) => getRowFieldCaseInsensitive(row, ...keys).value;

  const emailRaw = gf('email', 'Student Email 1', 'Student Email', 'Email');
  const studentIdRaw =
    gf('studentId', 'Student ID', 'StudentID', 'student_id', 'Lunch ID', 'LunchID', 'FCPS ID', 'Perm ID', 'SIS ID', 'ID') ||
    `${1850000 + index}`;
  const userIdRaw = gf('userId', 'User ID', 'UserID', 'user_id', 'SAMAccountName', 'SAM Account Name', 'samAccountName', 'Login');
  const explicitUsername = gf('username', 'Username');
  const emailUsername = emailRaw ? extractUsername(emailRaw) : '';

  // If studentId and userId do not match, userId becomes the main username
  let username = '';
  if (userIdRaw && userIdRaw !== studentIdRaw) {
    username = userIdRaw;
  } else if (explicitUsername && explicitUsername !== studentIdRaw) {
    username = explicitUsername;
  } else if (emailUsername && emailUsername !== studentIdRaw) {
    username = emailUsername;
  } else {
    username = userIdRaw || explicitUsername || emailUsername || studentIdRaw;
  }

  // Preserve Barcode strictly from the sheet/record (case-insensitive header aliases supported)
  const barcodeLookup = getRowFieldCaseInsensitive(
    row,
    'barcode',
    'Barcode',
    'Barcode Value',
    'Device Barcode',
    'Asset Tag',
    'AssetTag',
    'assetTag',
    'Asset #',
    'Asset Number',
    'Asset ID',
    'Bar Code',
    'Tag',
    'Tag Number',
    'Device Tag',
    'Computer Barcode',
    'Laptop Barcode',
    'iPad Barcode',
    'Asset'
  );
  const barcode = normalizeBarcodeValue(barcodeLookup.value);

  // Student name handling in "First Last" format without middle initials
  const rawStudentName = gf('studentName', 'Student Name', 'FullName', 'Full Name', 'Name');
  const lastName = removeMiddleInitials(gf('lastName', 'Last Name'));
  const firstName = removeMiddleInitials(gf('firstName', 'First Name'));
  const studentName = formatStudentFullName(firstName, lastName, rawStudentName);

  const grade = gf('grade', 'Grade') || '03';
  const rawStaffName = gf('staffName', 'Staff Name', 'Teacher', 'Teacher Name', 'Homeroom Teacher', 'Homeroom');
  const staffName = extractTeacherLastName(rawStaffName);
  const roomNumber = gf('roomNumber', 'Room Name', 'Room Number', 'Room', 'Rm');
  const stateTestingId = gf('stateTestingId', 'State Testing ID', 'Testing ID');
  const password = gf('password', 'Password') || 'GFES#2026';
  const pin = gf('pin', 'PIN', 'Pin', 'iPad PIN', 'iPad Pin', 'Device PIN', 'Passcode', 'PIN Code');
  const hasAssignedDeviceBarcode = isTenDigitDeviceBarcode(barcode);

  return {
    id: gf('id') || `rec_${Date.now()}_${index}`,
    studentName,
    studentId: studentIdRaw,
    lunchId: gf('lunchId', 'Lunch ID') || studentIdRaw,
    userId: userIdRaw || username,
    username,
    email: emailRaw || (username.includes('@') ? username : `${username}@fcpsschools.net`),
    stateTestingId,
    firstName,
    lastName,
    grade,
    staffName,
    roomNumber,
    password,
    barcode,
    pin,
    role: gf('role') || 'Student',
    hasSleeve: gf('hasSleeve', 'Has Sleeve') || 'Yes',
    hasCharger: gf('hasCharger', 'Has Charger') || 'Yes',
    hasLaptop: hasAssignedDeviceBarcode ? 'Yes' : (gf('hasLaptop', 'Has Laptop') || 'No'),
    hasHeadphones: gf('hasHeadphones', 'Has Headphones') || 'No',
    attendingSummerPrograms: gf('attendingSummerPrograms', 'Attending Summer') || 'No',
    deviceCheckedOutForSummer: gf('deviceCheckedOutForSummer', 'Checked Out Summer') || 'No',
    updatedAt: gf('updatedAt') || new Date().toISOString().split('T')[0],
    updatedBy: gf('updatedBy') || 'SIS Sync'
  };
}
