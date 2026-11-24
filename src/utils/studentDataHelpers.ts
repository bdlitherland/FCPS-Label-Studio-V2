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
 * Extracts the student's device/sheet Barcode value, ignoring legacy fallback copies
 * where username or studentId was mistakenly placed into barcode.
 */
export function getStudentDeviceBarcode(record: Partial<RecordData>): string {
  const normBar = normalizeBarcodeValue(record.barcode);
  const normAsset = normalizeBarcodeValue(record.assetTag);
  if (isTenDigitDeviceBarcode(normBar)) return normBar;

  const mainUser = resolveMainUsername(record).trim().toLowerCase();
  const sId = String(record.studentId || '').trim().toLowerCase();
  const lId = String(record.lunchId || '').trim().toLowerCase();
  const uId = String(record.userId || '').trim().toLowerCase();
  const uName = String(record.username || '').trim().toLowerCase();
  const emailUser = extractUsername(record.email).trim().toLowerCase();

  const barLower = normBar.toLowerCase();
  const isLegacyIdentityCopy =
    !normBar ||
    barLower === mainUser ||
    barLower === sId ||
    barLower === lId ||
    barLower === uId ||
    barLower === uName ||
    barLower === emailUser;

  if (!isLegacyIdentityCopy) {
    return normBar;
  }
  if (isTenDigitDeviceBarcode(normAsset)) {
    return normAsset;
  }
  return normAsset || '';
}

/**
 * Cleans up legacy student records (e.g. previously stored in localStorage) so
 * Barcode strictly holds the sheet/device barcode value instead of login username/ID.
 */
export function sanitizeStudentRosterRecord(record: RecordData): RecordData {
  const cleanBarcode = getStudentDeviceBarcode(record);
  const hasTenDigit = isTenDigitDeviceBarcode(cleanBarcode);
  const needsBarcodeUpdate = cleanBarcode !== (record.barcode || '');
  // Clear stale manualHasDevice=false if a valid 10-digit barcode is present on the record
  const clearStaleManualNo = hasTenDigit && record.manualHasDevice === false;
  const effectiveManual = clearStaleManualNo ? undefined : record.manualHasDevice;
  const expectedLaptop =
    effectiveManual !== undefined
      ? effectiveManual
        ? 'Yes'
        : 'No'
      : hasTenDigit
      ? 'Yes'
      : 'No';

  if (!needsBarcodeUpdate && !clearStaleManualNo && record.hasLaptop === expectedLaptop) {
    return record;
  }
  const next: RecordData = {
    ...record,
    barcode: cleanBarcode,
    hasLaptop: expectedLaptop,
  };
  if (clearStaleManualNo) {
    delete next.manualHasDevice;
  }
  return next;
}

/**
 * Links 10-digit device barcodes from Devices & Inventory records onto matching Student Roster records
 * (by SAMAccountName / User ID / Student ID / Email) when a student doesn't already have a 10-digit barcode.
 */
export function linkDeviceBarcodesToStudents(
  students: RecordData[],
  devices: RecordData[]
): { updated: RecordData[]; linkedCount: number } {
  if (!students.length || !devices.length) {
    return { updated: students, linkedCount: 0 };
  }

  const deviceByKey = new Map<string, string>();
  for (const dev of devices) {
    const devBarcode = normalizeBarcodeValue(dev.assetTag || dev.barcode);
    if (!isTenDigitDeviceBarcode(devBarcode)) continue;
    const keys = [
      dev.samAccountName,
      dev.userId,
      dev.username,
      dev.studentId,
      dev.lunchId,
      extractUsername(dev.email),
    ]
      .map((k) => String(k || '').trim().toLowerCase())
      .filter((k) => k && k !== devBarcode.toLowerCase());

    for (const k of keys) {
      if (!deviceByKey.has(k)) {
        deviceByKey.set(k, devBarcode);
      }
    }
  }

  if (deviceByKey.size === 0) {
    return { updated: students, linkedCount: 0 };
  }

  let linkedCount = 0;
  const updated = students.map((stu) => {
    const existingBar = getStudentDeviceBarcode(stu);
    if (isTenDigitDeviceBarcode(existingBar)) return stu;

    const studentKeys = [
      resolveMainUsername(stu),
      stu.userId,
      stu.username,
      stu.studentId,
      stu.lunchId,
      extractUsername(stu.email),
    ]
      .map((k) => String(k || '').trim().toLowerCase())
      .filter(Boolean);

    let matchedBarcode = '';
    for (const k of studentKeys) {
      const found = deviceByKey.get(k);
      if (found) {
        matchedBarcode = found;
        break;
      }
    }

    if (!matchedBarcode) return stu;
    linkedCount += 1;
    const next: RecordData = {
      ...stu,
      barcode: matchedBarcode,
      hasLaptop: 'Yes',
    };
    delete next.manualHasDevice;
    return next;
  });

  return { updated, linkedCount };
}

/**
 * Determines whether a student currently has an assigned computer / device.
 * Rule: Determined by whether a 10-digit barcode with leading zero(s) is listed under Barcode
 * (or Asset Tag), unless manually overridden via the Roster Editor toggle.
 */
export function studentHasDevice(record: Partial<RecordData>): boolean {
  if (record.manualHasDevice !== undefined) {
    return record.manualHasDevice;
  }
  return isTenDigitDeviceBarcode(record.barcode) || isTenDigitDeviceBarcode(record.assetTag);
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
  // Check email, userId, and username
  const emailRaw = String(item.email || (item as any)['Student Email 1'] || (item as any)['Student Email'] || (item as any)['Email'] || '').trim();
  const studentIdRaw = String(item.studentId || (item as any)['Student ID'] || (item as any)['Lunch ID'] || (item as any)['FCPS ID'] || `${1850000 + index}`).trim();
  const userIdRaw = String(
    item.userId ||
    (item as any)['User ID'] ||
    (item as any)['userId'] ||
    (item as any)['UserID'] ||
    (item as any)['user_id'] ||
    (item as any)['SAMAccountName'] ||
    ''
  ).trim();
  const explicitUsername = String(item.username || (item as any)['Username'] || (item as any)['username'] || '').trim();
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
    item as Record<string, any>,
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
  const rawStudentName = item.studentName || (item as any)['Student Name'] || (item as any)['FullName'] || (item as any)['Full Name'] || (item as any)['Name'] || '';
  const lastName = removeMiddleInitials(item.lastName || (item as any)['Last Name'] || '');
  const firstName = removeMiddleInitials(item.firstName || (item as any)['First Name'] || '');
  const studentName = formatStudentFullName(firstName, lastName, rawStudentName);

  const grade = String(item.grade || (item as any)['Grade'] || '03').trim();
  const rawStaffName = item.staffName || (item as any)['Staff Name'] || (item as any)['Teacher'] || (item as any)['Teacher Name'] || '';
  const staffName = extractTeacherLastName(rawStaffName);
  const roomNumber = String(item.roomNumber || (item as any)['Room Name'] || (item as any)['Room Number'] || (item as any)['Room'] || '').trim();
  const stateTestingId = String(item.stateTestingId || (item as any)['State Testing ID'] || (item as any)['Testing ID'] || '').trim();
  const password = String(item.password || (item as any)['Password'] || 'GFES#2026').trim();
  const rawPin =
    item.pin ??
    (item as any)['PIN'] ??
    (item as any)['Pin'] ??
    (item as any)['iPad PIN'] ??
    (item as any)['iPad Pin'] ??
    (item as any)['Device PIN'] ??
    (item as any)['Passcode'] ??
    (item as any)['PIN Code'] ??
    '';
  const pin = String(rawPin).trim();
  const hasAssignedDeviceBarcode = isTenDigitDeviceBarcode(barcode);

  return {
    id: item.id || `rec_${Date.now()}_${index}`,
    studentName,
    studentId: studentIdRaw,
    lunchId: studentIdRaw,
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
    role: item.role || 'Student',
    hasSleeve: item.hasSleeve || (item as any)['Has Sleeve'] || 'Yes',
    hasCharger: item.hasCharger || (item as any)['Has Charger'] || 'Yes',
    hasLaptop: hasAssignedDeviceBarcode ? 'Yes' : String(item.hasLaptop || (item as any)['Has Laptop'] || 'No'),
    hasHeadphones: item.hasHeadphones || (item as any)['Has Headphones'] || 'No',
    attendingSummerPrograms: item.attendingSummerPrograms || (item as any)['Attending Summer'] || 'No',
    deviceCheckedOutForSummer: item.deviceCheckedOutForSummer || (item as any)['Checked Out Summer'] || 'No',
    updatedAt: item.updatedAt || new Date().toISOString().split('T')[0],
    updatedBy: item.updatedBy || 'SIS Sync'
  };
}
