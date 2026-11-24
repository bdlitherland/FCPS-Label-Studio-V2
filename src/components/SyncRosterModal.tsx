import React, { useState, useMemo, useEffect } from 'react';
import Papa from 'papaparse';
import { RecordData } from '../types';
import {
  extractUsername,
  resolveMainUsername,
  normalizeStudentRecord,
  formatStudentFullName,
  extractTeacherLastName,
  removeMiddleInitials,
  getStudentFirstName,
  getStudentLastName,
  isTenDigitDeviceBarcode,
  isValidDeviceBarcode,
  normalizeBarcodeValue,
  getRowFieldCaseInsensitive,
} from '../utils/studentDataHelpers';
import {
  RefreshCw,
  X,
  Upload,
  Check,
  AlertTriangle,
  ShieldCheck,
  Key,
  UserCheck,
  FileSpreadsheet,
  ArrowRight,
  PlusCircle
} from 'lucide-react';

export type SyncModalMode = 'system' | 'sis';

interface SyncRosterModalProps {
  isOpen: boolean;
  mode?: SyncModalMode;
  onClose: () => void;
  existingRecords: RecordData[];
  onApplySync: (updatedRecords: RecordData[]) => void;
}

type MatchConfidence =
  | 'dual'
  | 'out-of-sync'
  | 'id-match'
  | 'user-match'
  | 'id-conflict'
  | 'user-conflict';

interface IncomingSyncRow {
  rowIndex: number;
  raw: Record<string, string>;
  studentId: string;
  userId: string;
  username: string;
  barcode: string;
  hasBarcodeColumn?: boolean;
  studentName: string;
  firstName: string;
  lastName: string;
  stateTestingId: string;
  grade: string;
  staffName: string;
  password: string;
  pin: string;
  roomNumber: string;
  hasSleeve: string;
  hasCharger: string;
  hasLaptop: string;
  hasHeadphones: string;
  attendingSummerPrograms: string;
  deviceCheckedOutForSummer: string;
}

interface MatchedSyncItem {
  key: string;
  existing: RecordData;
  incoming: IncomingSyncRow;
  confidence: MatchConfidence;
  conflictDetail?: string;
}

function areNamesCompatible(existing: RecordData, incoming: IncomingSyncRow): boolean {
  if (!incoming.studentName && !incoming.firstName && !incoming.lastName) return true;
  if (!existing.studentName && !existing.firstName && !existing.lastName) return true;

  const exFirst = getStudentFirstName(existing).toLowerCase().trim();
  const exLast = getStudentLastName(existing).toLowerCase().trim();
  const inFirst = (incoming.firstName || getStudentFirstName({ studentName: incoming.studentName })).toLowerCase().trim();
  const inLast = (incoming.lastName || getStudentLastName({ studentName: incoming.studentName })).toLowerCase().trim();

  if (!exLast || !inLast) return true;
  if (exLast === inLast && (!exFirst || !inFirst || exFirst === inFirst || exFirst.startsWith(inFirst) || inFirst.startsWith(exFirst))) {
    return true;
  }
  const exFull = String(existing.studentName || '').toLowerCase().trim();
  const inFull = String(incoming.studentName || '').toLowerCase().trim();
  return exFull === inFull;
}

export const SyncRosterModal: React.FC<SyncRosterModalProps> = ({
  isOpen,
  mode = 'system',
  onClose,
  existingRecords,
  onApplySync,
}) => {
  const isSisMode = mode === 'sis';

  const [rawText, setRawText] = useState('');
  const [parsedRows, setParsedRows] = useState<IncomingSyncRow[]>([]);
  const [parseError, setParseError] = useState('');

  // System Sync toggles
  const [syncPassword, setSyncPassword] = useState(true);
  const [syncPin, setSyncPin] = useState(true);
  const [syncEquipment, setSyncEquipment] = useState(true);

  // SIS Sync toggles
  const [syncProfile, setSyncProfile] = useState(true);
  const [syncPlacement, setSyncPlacement] = useState(true);

  // Shared toggles
  const [syncUsername, setSyncUsername] = useState(true);
  const [addUnmatched, setAddUnmatched] = useState(isSisMode);
  const [selectedMatchKeys, setSelectedMatchKeys] = useState<Record<string, boolean>>({});

  // Reset modal state cleanly when opening or switching mode
  useEffect(() => {
    if (isOpen) {
      setRawText('');
      setParsedRows([]);
      setParseError('');
      setSelectedMatchKeys({});
      setSyncUsername(true);
      setSyncPassword(true);
      setSyncPin(true);
      setSyncEquipment(true);
      setSyncProfile(true);
      setSyncPlacement(true);
      setAddUnmatched(mode === 'sis');
    }
  }, [isOpen, mode]);

  // Match incoming rows against existing student records using BOTH studentId/lunchId and userId/username
  const computeMatches = (existing: RecordData[], incoming: IncomingSyncRow[]) => {
    const matched: MatchedSyncItem[] = [];
    const unmatched: IncomingSyncRow[] = [];
    const usedExistingIds = new Set<string>();

    incoming.forEach((inc) => {
      const inId = inc.studentId.trim().toLowerCase();
      const nonAssetBarcode = isValidDeviceBarcode(inc.barcode, inc) ? '' : inc.barcode;
      const inUser = (inc.userId || inc.username || (nonAssetBarcode !== inc.studentId ? nonAssetBarcode : '')).trim().toLowerCase();
      const inBarcode = inc.barcode.trim().toLowerCase();

      let bestMatch: RecordData | undefined;
      let confidence: MatchConfidence = 'dual';
      let conflictDetail: string | undefined;

      // 1. Exact Dual Match (BOTH Student ID/Lunch ID AND User ID/Username/Barcode match)
      if (inId && inUser) {
        bestMatch = existing.find((rec) => {
          if (usedExistingIds.has(rec.id)) return false;
          const rId = String(rec.lunchId || rec.studentId || '').trim().toLowerCase();
          const rUser = resolveMainUsername(rec).trim().toLowerCase();
          const rBar = String(rec.barcode || '').trim().toLowerCase();
          return rId === inId && (rUser === inUser || rBar === inUser || (inBarcode && rBar === inBarcode));
        });
        if (bestMatch) {
          const rId = String(bestMatch.lunchId || bestMatch.studentId || '').trim().toLowerCase();
          const rUser = resolveMainUsername(bestMatch).trim().toLowerCase();
          confidence = isSisMode && (rId !== inUser || rUser !== inUser) ? 'out-of-sync' : 'dual';
        }
      }

      // 2. Match by current ID / Lunch ID (against incoming Student ID OR incoming User ID)
      if (!bestMatch && (inId || inUser)) {
        const idCandidate = existing.find((rec) => {
          if (usedExistingIds.has(rec.id)) return false;
          const rId = String(rec.lunchId || rec.studentId || '').trim().toLowerCase();
          return (inId && rId === inId) || (inUser && rId === inUser);
        });

        if (idCandidate) {
          bestMatch = idCandidate;
          const rId = String(idCandidate.lunchId || idCandidate.studentId || '').trim().toLowerCase();
          const rUser = resolveMainUsername(idCandidate).trim().toLowerCase();
          const nameOk = areNamesCompatible(idCandidate, inc);

          if (isSisMode) {
            if (!nameOk && rUser !== inUser) {
              confidence = 'id-conflict';
              conflictDetail = `ID matches (${idCandidate.lunchId || idCandidate.studentId}), but name disagrees: "${idCandidate.studentName}" vs "${inc.studentName}"`;
            } else if (inUser && (rId !== inUser || rUser !== inUser)) {
              confidence = 'out-of-sync';
            } else {
              confidence = 'id-match';
            }
          } else {
            // System Sync conflict check
            if (rUser && inUser && rUser !== rId && inUser !== inId && rUser !== inUser) {
              confidence = 'id-conflict';
              conflictDetail = `ID matches (${inc.studentId}), but User ID differs: "${resolveMainUsername(idCandidate)}" vs "${inc.userId || inc.username}"`;
            } else {
              confidence = 'id-match';
            }
          }
        }
      }

      // 3. Match by current User ID / Username / Barcode
      if (!bestMatch && inUser) {
        const userCandidate = existing.find((rec) => {
          if (usedExistingIds.has(rec.id)) return false;
          const rUser = resolveMainUsername(rec).trim().toLowerCase();
          const rBar = String(rec.barcode || '').trim().toLowerCase();
          return rUser === inUser || rBar === inUser;
        });

        if (userCandidate) {
          bestMatch = userCandidate;
          const rId = String(userCandidate.lunchId || userCandidate.studentId || '').trim().toLowerCase();
          const nameOk = areNamesCompatible(userCandidate, inc);

          if (isSisMode) {
            if (!nameOk && rId && inId && rId !== inId) {
              confidence = 'user-conflict';
              conflictDetail = `User ID matches (${inc.userId}), but Student ID & name differ: "${userCandidate.studentName}" (${userCandidate.studentId}) vs "${inc.studentName}" (${inc.studentId})`;
            } else if (rId !== inUser || (inId && rId !== inId)) {
              confidence = 'out-of-sync';
            } else {
              confidence = 'user-match';
            }
          } else {
            if (rId && inId && rId !== inId) {
              confidence = 'user-conflict';
              conflictDetail = `Username matches (${inc.userId || inc.username}), but Student ID differs: "${userCandidate.studentId}" vs "${inc.studentId}"`;
            } else {
              confidence = 'user-match';
            }
          }
        }
      }

      // 4. Fallback match by exact Student Name when neither Student ID nor User ID was provided
      if (!bestMatch && !inId && !inUser && (inc.studentName || (inc.firstName && inc.lastName))) {
        const incFull = inc.studentName.trim().toLowerCase();
        const incFirst = (inc.firstName || getStudentFirstName({ studentName: inc.studentName })).toLowerCase().trim();
        const incLast = (inc.lastName || getStudentLastName({ studentName: inc.studentName })).toLowerCase().trim();
        const nameCandidates = existing.filter((rec) => {
          if (usedExistingIds.has(rec.id)) return false;
          const recFull = String(rec.studentName || '').trim().toLowerCase();
          const recFirst = getStudentFirstName(rec).toLowerCase().trim();
          const recLast = getStudentLastName(rec).toLowerCase().trim();
          if (incFull && recFull && incFull === recFull) return true;
          return !!(incLast && recLast && incLast === recLast && incFirst && recFirst && incFirst === recFirst);
        });
        if (nameCandidates.length === 1) {
          bestMatch = nameCandidates[0];
          confidence = 'user-match';
        } else if (nameCandidates.length > 1 && inc.staffName) {
          const incTeacher = extractTeacherLastName(inc.staffName).toLowerCase();
          const refined = nameCandidates.find(
            (rec) => extractTeacherLastName(rec.staffName).toLowerCase() === incTeacher
          );
          if (refined) {
            bestMatch = refined;
            confidence = 'user-match';
          }
        }
      }

      if (bestMatch) {
        usedExistingIds.add(bestMatch.id);
        matched.push({
          key: `${bestMatch.id}__${inc.rowIndex}`,
          existing: bestMatch,
          incoming: inc,
          confidence,
          conflictDetail,
        });
      } else {
        unmatched.push(inc);
      }
    });

    return { matched, unmatched };
  };

  // Parse CSV or TSV text into normalized IncomingSyncRow[]
  const parseInputData = (text: string) => {
    setParseError('');
    if (!text.trim()) {
      setParsedRows([]);
      return;
    }

    const trimmedText = text.trim();
    const firstLines = trimmedText.split(/\r?\n/).slice(0, 5);
    const hasTabs = firstLines.some((line) => line.includes('\t'));

    Papa.parse(trimmedText, {
      header: false,
      delimiter: hasTabs ? '\t' : '',
      skipEmptyLines: true,
      complete: (results) => {
        const rawRows = (results.data as string[][]) || [];
        if (rawRows.length < 2) {
          setParseError('No data rows found. Make sure the header row and at least one student row are included.');
          setParsedRows([]);
          return;
        }

        // Auto-detect real header row (handles reports with title/date rows above the headers)
        let headerRowIdx = 0;
        for (let i = 0; i < Math.min(rawRows.length, 15); i++) {
          const nonEmptyCount = rawRows[i].filter((c) => c && String(c).trim()).length;
          if (nonEmptyCount < 2) continue;
          const rowStr = rawRows[i].join(' ').toLowerCase();
          if (
            rowStr.includes('student id') ||
            rowStr.includes('studentid') ||
            rowStr.includes('student name') ||
            rowStr.includes('studentname') ||
            rowStr.includes('user id') ||
            rowStr.includes('userid') ||
            rowStr.includes('lunch id') ||
            rowStr.includes('barcode') ||
            rowStr.includes('assettag') ||
            rowStr.includes('asset tag') ||
            rowStr.includes('fullname') ||
            rowStr.includes('last name')
          ) {
            headerRowIdx = i;
            break;
          }
        }

        const headers = rawRows[headerRowIdx].map((h) => String(h || '').replace(/^\uFEFF/, '').trim());
        const dataRows = rawRows.slice(headerRowIdx + 1);
        const rows: Record<string, string>[] = dataRows.map((row) => {
          const obj: Record<string, string> = {};
          headers.forEach((h, colIdx) => {
            if (h && row[colIdx] !== undefined) {
              obj[h] = String(row[colIdx] || '').trim();
            }
          });
          return obj;
        });

        if (rows.length === 0) {
          setParseError('No data rows found below the header row.');
          setParsedRows([]);
          return;
        }

        const normalized: IncomingSyncRow[] = rows
          .map((item, idx) => {
            const getField = (...keys: string[]): string => {
              return getRowFieldCaseInsensitive(item, ...keys).value;
            };

            const studentId = getField('studentId', 'Student ID', 'StudentID', 'student_id', 'Lunch ID', 'LunchID', 'FCPS ID', 'Perm ID', 'SIS ID', 'id');
            const email = getField('email', 'Student Email 1', 'Student Email', 'Email');
            const rawUserId = getField('userId', 'User ID', 'UserID', 'user_id', 'SAMAccountName', 'SAM Account Name', 'Login');
            const rawUsername = getField('username', 'Username') || extractUsername(email);
            const barcodeLookup = getRowFieldCaseInsensitive(
              item,
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
            const hasBarcodeColumn = barcodeLookup.found;
            const barcode = normalizeBarcodeValue(barcodeLookup.value);
            const pin = getField('pin', 'PIN', 'Pin', 'iPad PIN', 'iPad Pin', 'Device PIN', 'Passcode', 'PIN Code');
            const stateTestingId = getField('stateTestingId', 'State Testing ID', 'Testing ID');
            const nonAssetBarcode = isValidDeviceBarcode(barcode, {
              studentId,
              userId: rawUserId,
              username: rawUsername,
              stateTestingId,
              pin,
              email,
            })
              ? ''
              : barcode;

            // If Student ID != User ID, User ID is the login username (never treat a 10-digit device barcode as username)
            const resolvedUser =
              (rawUserId && rawUserId !== studentId ? rawUserId : '') ||
              (rawUsername && rawUsername !== studentId ? rawUsername : '') ||
              (nonAssetBarcode && nonAssetBarcode !== studentId ? nonAssetBarcode : '') ||
              rawUserId ||
              rawUsername ||
              studentId;

            const firstName = removeMiddleInitials(getField('firstName', 'First Name'));
            const lastName = removeMiddleInitials(getField('lastName', 'Last Name'));
            const rawName = getField('studentName', 'Student Name', 'FullName', 'Full Name', 'Name');
            const studentName = rawName || firstName || lastName
              ? formatStudentFullName(firstName, lastName, rawName)
              : '';
            const rawStaff = getField('staffName', 'Staff Name', 'Teacher', 'Teacher Name');
            const staffName = rawStaff ? extractTeacherLastName(rawStaff) : '';

            return {
              rowIndex: idx,
              raw: item as Record<string, string>,
              studentId,
              userId: rawUserId || resolvedUser,
              username: resolvedUser,
              barcode,
              hasBarcodeColumn,
              studentName,
              firstName,
              lastName,
              stateTestingId: getField('stateTestingId', 'State Testing ID', 'Testing ID'),
              grade: getField('grade', 'Grade'),
              staffName,
              password: getField('password', 'Password'),
              pin: getField('pin', 'PIN', 'Pin', 'iPad PIN', 'iPad Pin', 'Device PIN', 'Passcode', 'PIN Code'),
              roomNumber: getField('roomNumber', 'Room Name', 'Room Number', 'Room'),
              hasSleeve: getField('hasSleeve', 'Has Sleeve'),
              hasCharger: getField('hasCharger', 'Has Charger'),
              hasLaptop: getField('hasLaptop', 'Has Laptop'),
              hasHeadphones: getField('hasHeadphones', 'Has Headphones'),
              attendingSummerPrograms: getField('attendingSummerPrograms', 'Attending Summer'),
              deviceCheckedOutForSummer: getField('deviceCheckedOutForSummer', 'Checked Out Summer'),
            };
          })
          .filter((r) => r.studentId || r.username || r.barcode || r.studentName);

        setParsedRows(normalized);

        // Initialize default checkbox selection (auto-select verified & out-of-sync matches, leave true conflicts unchecked)
        const initialSelection: Record<string, boolean> = {};
        const computed = computeMatches(existingRecords, normalized);
        computed.matched.forEach((m) => {
          initialSelection[m.key] = m.confidence !== 'id-conflict' && m.confidence !== 'user-conflict';
        });
        setSelectedMatchKeys(initialSelection);
      },
      error: (err: Error) => {
        setParseError(`Parse error: ${err.message}`);
      },
    });
  };

  const { matched, unmatched } = useMemo(
    () => computeMatches(existingRecords, parsedRows),
    [existingRecords, parsedRows, isSisMode]
  );

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = String(evt.target?.result || '');
      setRawText(content);
      parseInputData(content);
    };
    reader.readAsText(file);
  };

  const handleApply = () => {
    const matchMap = new Map<string, MatchedSyncItem>();
    matched.forEach((m) => {
      if (selectedMatchKeys[m.key]) {
        matchMap.set(m.existing.id, m);
      }
    });

    const today = new Date().toISOString().split('T')[0];

    const updated = existingRecords.map((rec) => {
      const match = matchMap.get(rec.id);
      if (!match) return rec;

      const inc = match.incoming;
      const next = { ...rec };

      if (isSisMode) {
        if (syncProfile) {
          if (inc.studentName) {
            next.studentName = inc.studentName;
            next.fullName = inc.studentName;
          }
          if (inc.firstName) next.firstName = inc.firstName;
          if (inc.lastName) next.lastName = inc.lastName;
          if (inc.stateTestingId) next.stateTestingId = inc.stateTestingId;
          if (inc.studentId) {
            next.studentId = inc.studentId;
            next.lunchId = inc.studentId;
          }
        }
        if (syncPlacement) {
          if (inc.grade) next.grade = inc.grade;
          if (inc.staffName) next.staffName = inc.staffName;
          if (inc.roomNumber) next.roomNumber = inc.roomNumber;
        }
        if (syncUsername) {
          const sisUserId = (inc.userId || inc.username || inc.studentId).trim();
          const currentLunchId = String(rec.lunchId || rec.studentId || '').trim();
          const currentUser = resolveMainUsername(rec).trim();

          // Compare current ID / Lunch ID (and current username) against User ID from SIS Sync:
          // Whenever out of sync, update login username / userId to SIS User ID (preserve device Barcode)
          if (sisUserId && (currentLunchId !== sisUserId || currentUser !== sisUserId || next.userId !== sisUserId)) {
            next.userId = sisUserId;
            next.username = sisUserId;
            if (
              !next.email ||
              next.email === `${currentLunchId}@fcpsschools.net` ||
              next.email === `${rec.studentId}@fcpsschools.net` ||
              next.email === `${currentUser}@fcpsschools.net`
            ) {
              next.email = `${sisUserId}@fcpsschools.net`;
            }
          } else if (sisUserId) {
            next.userId = sisUserId;
            next.username = sisUserId;
          }
        }
        if (inc.hasBarcodeColumn) {
          next.barcode = inc.barcode;
          if (isValidDeviceBarcode(inc.barcode, next)) {
            next.assetTag = inc.barcode;
            delete next.manualHasDevice;
            next.hasLaptop = 'Yes';
          } else if (!isValidDeviceBarcode(next.assetTag, next)) {
            delete next.manualHasDevice;
            next.hasLaptop = 'No';
          }
        }
        next.updatedAt = today;
        next.updatedBy = 'SIS Sync';
      } else {
        if (syncPassword && inc.password) {
          next.password = inc.password;
        }
        if (syncPin && inc.pin) {
          next.pin = inc.pin;
        }
        if (syncUsername) {
          const incUser = inc.userId || inc.username;
          const incIsAssetBarcode = isValidDeviceBarcode(inc.barcode, next);
          if (incUser && incUser !== next.studentId && !isValidDeviceBarcode(incUser, next)) {
            next.userId = incUser;
            next.username = incUser;
            if (!next.email || next.email === `${next.studentId}@fcpsschools.net` || next.email === `${rec.username}@fcpsschools.net`) {
              next.email = `${incUser}@fcpsschools.net`;
            }
          } else if (inc.barcode && !incIsAssetBarcode && inc.barcode !== next.studentId && !inc.hasBarcodeColumn) {
            next.userId = inc.barcode;
            next.username = inc.barcode;
          }
        }
        if (syncEquipment) {
          if (inc.roomNumber) next.roomNumber = inc.roomNumber;
          if (inc.hasSleeve) next.hasSleeve = inc.hasSleeve;
          if (inc.hasCharger) next.hasCharger = inc.hasCharger;
          if (inc.hasBarcodeColumn) {
            next.barcode = inc.barcode;
            if (isValidDeviceBarcode(inc.barcode, next)) {
              next.assetTag = inc.barcode;
              delete next.manualHasDevice;
              next.hasLaptop = 'Yes';
            } else if (!isValidDeviceBarcode(next.assetTag, next)) {
              delete next.manualHasDevice;
              next.hasLaptop = inc.hasLaptop || 'No';
            }
          } else if (inc.hasLaptop) {
            next.hasLaptop = inc.hasLaptop;
          }
          if (inc.hasHeadphones) next.hasHeadphones = inc.hasHeadphones;
          if (inc.attendingSummerPrograms) next.attendingSummerPrograms = inc.attendingSummerPrograms;
          if (inc.deviceCheckedOutForSummer) next.deviceCheckedOutForSummer = inc.deviceCheckedOutForSummer;
        } else if (inc.hasBarcodeColumn) {
          next.barcode = inc.barcode;
          if (isValidDeviceBarcode(inc.barcode, next)) {
            next.assetTag = inc.barcode;
            delete next.manualHasDevice;
            next.hasLaptop = 'Yes';
          } else if (!isValidDeviceBarcode(next.assetTag, next)) {
            delete next.manualHasDevice;
            next.hasLaptop = 'No';
          }
        }
        next.updatedAt = today;
        next.updatedBy = 'System Sync';
      }

      return next;
    });

    let finalRecords = updated;
    if (addUnmatched && unmatched.length > 0) {
      const additions = unmatched.map((u, idx) =>
        normalizeStudentRecord(
          {
            ...u.raw,
            id: u.raw.id || `${isSisMode ? 'sis' : 'sync'}_${Date.now()}_${idx}`,
            studentName: u.studentName,
            firstName: u.firstName,
            lastName: u.lastName,
            stateTestingId: u.stateTestingId,
            studentId: u.studentId,
            userId: u.userId,
            username: u.username,
            grade: u.grade || '03',
            staffName: u.staffName,
            password: u.password || 'GFES#2026',
            barcode: u.barcode,
            pin: u.pin,
            roomNumber: u.roomNumber,
            hasSleeve: u.hasSleeve || (isSisMode ? 'Yes' : 'No'),
            hasCharger: u.hasCharger || (isSisMode ? 'Yes' : 'No'),
            hasLaptop: u.hasLaptop || (isSisMode ? 'Yes' : 'No'),
            hasHeadphones: u.hasHeadphones || 'No',
            attendingSummerPrograms: u.attendingSummerPrograms || 'No',
            deviceCheckedOutForSummer: u.deviceCheckedOutForSummer || 'No',
            updatedAt: today,
            updatedBy: isSisMode ? 'SIS Sync (New)' : 'System Sync (New)',
          },
          idx
        )
      );
      finalRecords = [...updated, ...additions];
    }

    onApplySync(finalRecords);
    onClose();
  };

  const dualCount = matched.filter((m) => m.confidence === 'dual').length;
  const outOfSyncCount = matched.filter((m) => m.confidence === 'out-of-sync').length;
  const singleCount = matched.filter((m) => m.confidence === 'id-match' || m.confidence === 'user-match').length;
  const conflictCount = matched.filter((m) => m.confidence === 'id-conflict' || m.confidence === 'user-conflict').length;
  const selectedApplyCount = matched.filter((m) => selectedMatchKeys[m.key]).length;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-md flex items-center justify-center p-4">
      <div className="glass-modal rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 bg-white/50 border-b border-white/40 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl text-white shadow-sm ${isSisMode ? 'bg-teal-600' : 'bg-indigo-600'}`}>
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-slate-900">
                {isSisMode
                  ? 'SIS Sync — Compare ID / Lunch ID to SIS User ID & Update Roster'
                  : 'Sync Passwords, PINs & Equipment from External System'}
              </h3>
              <p className="text-xs text-slate-600 font-medium">
                {isSisMode
                  ? 'Compares current ID / Lunch ID and username against SIS User ID; if out of sync, updates login to the SIS User ID while keeping existing Passwords & PINs'
                  : 'Dual-key matching verifies both Student ID and User ID / Username for accuracy'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-white/60 rounded-xl cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Input Section */}
          <div className="bg-white/70 border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <FileSpreadsheet className={`w-4 h-4 ${isSisMode ? 'text-teal-600' : 'text-indigo-600'}`} />
                <span>
                  {isSisMode
                    ? 'Paste SIS Export Rows (Tab-Separated or CSV) or Upload File'
                    : 'Paste Tab-Separated (TSV) or CSV Export from External System'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <label className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-white rounded-lg text-xs font-bold cursor-pointer shadow-2xs ${isSisMode ? 'bg-teal-600 hover:bg-teal-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload CSV / TSV / TXT</span>
                  <input
                    type="file"
                    accept=".csv,.tsv,.txt"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
                {rawText && (
                  <button
                    type="button"
                    onClick={() => {
                      setRawText('');
                      setParsedRows([]);
                      setParseError('');
                    }}
                    className="px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:text-rose-700 cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div className="text-[11px] text-slate-600 font-mono bg-slate-100 px-2.5 py-1.5 rounded-lg overflow-x-auto whitespace-nowrap">
              {isSisMode
                ? 'Expected SIS headers: Student Name | Student ID | State Testing ID | Last Name | First Name | Grade | Staff Name | Room Name | User ID'
                : 'Supported headers: id, studentName, studentId, userId/username, grade, staffName, password, barcode, pin, roomNumber, hasSleeve, hasCharger, hasLaptop, hasHeadphones, attendingSummerPrograms, deviceCheckedOutForSummer'}
            </div>

            <textarea
              rows={5}
              value={rawText}
              onChange={(e) => {
                setRawText(e.target.value);
                parseInputData(e.target.value);
              }}
              placeholder={
                isSisMode
                  ? `Paste your SIS export rows with headers directly from Excel / Sheets / SIS (tab-separated or comma-separated)...\nStudent Name\tStudent ID\tState Testing ID\tLast Name\tFirst Name\tGrade\tStaff Name\tRoom Name\tUser ID`
                  : `Paste rows with headers directly from your external system or spreadsheet (tab-separated or comma-separated)...\nid\tstudentName\tstudentId\tgrade\tstaffName\tpassword\tbarcode\tpin\troomNumber\thasSleeve\thasCharger\thasLaptop\thasHeadphones\tattendingSummerPrograms\tdeviceCheckedOutForSummer`
              }
              className="w-full p-3 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />

            {parseError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs font-bold text-rose-800">
                {parseError}
              </div>
            )}
          </div>

          {/* Sync Results & Options */}
          {parsedRows.length > 0 && (
            <>
              {/* Confidence Badges & Field Checkboxes */}
              <div className="bg-white/75 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-950 border border-emerald-200">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                      Dual Verified: {dualCount}
                    </span>
                    {isSisMode && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-100 text-indigo-950 border border-indigo-200">
                        <RefreshCw className="w-3.5 h-3.5 text-indigo-700" />
                        Out of Sync (Update to SIS User ID): {outOfSyncCount}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-100 text-blue-950 border border-blue-200">
                      <UserCheck className="w-3.5 h-3.5 text-blue-700" />
                      Single-Key Matched: {singleCount}
                    </span>
                    {conflictCount > 0 && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-100 text-amber-950 border border-amber-300">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                        Conflicts to Review: {conflictCount}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200">
                      Unmatched Rows: {unmatched.length}
                    </span>
                  </div>
                </div>

                {/* Fields to Update */}
                <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-slate-200 text-xs font-bold text-slate-800">
                  <span className="text-slate-500 uppercase text-[10px] tracking-wider">Fields to Sync:</span>

                  {isSisMode ? (
                    <>
                      <label className="inline-flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={syncUsername}
                          onChange={(e) => setSyncUsername(e.target.checked)}
                          className="rounded text-teal-600 focus:ring-teal-500"
                        />
                        <span>Update Out-of-Sync Login to SIS User ID</span>
                      </label>
                      <label className="inline-flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={syncPlacement}
                          onChange={(e) => setSyncPlacement(e.target.checked)}
                          className="rounded text-teal-600 focus:ring-teal-500"
                        />
                        <span>Grade, Teacher (Staff Name) &amp; Room Name</span>
                      </label>
                      <label className="inline-flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={syncProfile}
                          onChange={(e) => setSyncProfile(e.target.checked)}
                          className="rounded text-teal-600 focus:ring-teal-500"
                        />
                        <span>Student Name, ID / Lunch ID &amp; State Testing ID</span>
                      </label>
                    </>
                  ) : (
                    <>
                      <label className="inline-flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={syncPassword}
                          onChange={(e) => setSyncPassword(e.target.checked)}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <Key className="w-3.5 h-3.5 text-amber-600" />
                        <span>Password</span>
                      </label>
                      <label className="inline-flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={syncPin}
                          onChange={(e) => setSyncPin(e.target.checked)}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>iPad PIN</span>
                      </label>
                      <label className="inline-flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={syncUsername}
                          onChange={(e) => setSyncUsername(e.target.checked)}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>User ID / Main Username (Login)</span>
                      </label>
                      <label className="inline-flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={syncEquipment}
                          onChange={(e) => setSyncEquipment(e.target.checked)}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>Room, Barcode, Headphones, Sleeve, Charger, Laptop &amp; Summer</span>
                      </label>
                    </>
                  )}

                  {unmatched.length > 0 && (
                    <label className="inline-flex items-center gap-1.5 cursor-pointer text-indigo-900">
                      <input
                        type="checkbox"
                        checked={addUnmatched}
                        onChange={(e) => setAddUnmatched(e.target.checked)}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <PlusCircle className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Add {unmatched.length} unmatched students as new</span>
                    </label>
                  )}
                </div>
              </div>

              {/* Preview Table */}
              {matched.length > 0 && (
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                  <div className="overflow-x-auto max-h-[260px]">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 border-b border-slate-200">
                        <tr>
                          <th className="p-2.5 w-8 text-center">Sync</th>
                          <th className="p-2.5">Student</th>
                          <th className="p-2.5">Match Accuracy</th>
                          {isSisMode ? (
                            <>
                              <th className="p-2.5">Current ID/Lunch ID vs SIS User ID</th>
                              <th className="p-2.5">Grade / Room / Teacher</th>
                              <th className="p-2.5">Name / State Testing ID</th>
                            </>
                          ) : (
                            <>
                              <th className="p-2.5">Password Update</th>
                              <th className="p-2.5">PIN Update</th>
                              <th className="p-2.5">User ID / Username</th>
                              <th className="p-2.5">Barcode (Device)</th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {matched.map((item) => {
                          const checked = !!selectedMatchKeys[item.key];
                          const curId = String(item.existing.lunchId || item.existing.studentId || '').trim();
                          const curUser = resolveMainUsername(item.existing);
                          const newUser = item.incoming.userId || item.incoming.username;
                          const isOutOfSyncWithId = Boolean(newUser && curId && curId !== newUser);
                          const isUserChanging = Boolean(newUser && curUser !== newUser);
                          const curPlacement = `Gr ${item.existing.grade || '—'} • Rm ${item.existing.roomNumber || '—'} • ${item.existing.staffName || '—'}`;
                          const newPlacement = `Gr ${item.incoming.grade || item.existing.grade || '—'} • Rm ${item.incoming.roomNumber || item.existing.roomNumber || '—'} • ${item.incoming.staffName || item.existing.staffName || '—'}`;

                          return (
                            <tr
                              key={item.key}
                              className={
                                item.confidence === 'id-conflict' || item.confidence === 'user-conflict'
                                  ? 'bg-amber-50/70'
                                  : item.confidence === 'out-of-sync'
                                  ? 'bg-indigo-50/40'
                                  : checked
                                  ? 'bg-emerald-50/30'
                                  : ''
                              }
                            >
                              <td className="p-2.5 text-center">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) =>
                                    setSelectedMatchKeys((prev) => ({
                                      ...prev,
                                      [item.key]: e.target.checked,
                                    }))
                                  }
                                  className="rounded text-indigo-600 cursor-pointer"
                                />
                              </td>
                              <td className="p-2.5">
                                <div className="font-bold text-slate-900">{item.existing.studentName}</div>
                                <div className="text-[10px] font-mono text-slate-500">
                                  ID / Lunch ID: {curId || '—'}
                                </div>
                              </td>
                              <td className="p-2.5">
                                {item.confidence === 'dual' && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 font-bold text-[10px]">
                                    Dual Match (In Sync)
                                  </span>
                                )}
                                {item.confidence === 'out-of-sync' && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-100 text-indigo-950 font-bold text-[10px]">
                                    Out of Sync → SIS User ID
                                  </span>
                                )}
                                {item.confidence === 'id-match' && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-100 text-blue-900 font-bold text-[10px]">
                                    Matched by ID / Lunch ID
                                  </span>
                                )}
                                {item.confidence === 'user-match' && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-100 text-blue-900 font-bold text-[10px]">
                                    Matched by User ID
                                  </span>
                                )}
                                {(item.confidence === 'id-conflict' || item.confidence === 'user-conflict') && (
                                  <div className="text-[10px] font-bold text-amber-900">
                                    <span className="inline-block px-1.5 py-0.5 rounded bg-amber-200 mb-0.5">
                                      Review Conflict
                                    </span>
                                    <div>{item.conflictDetail}</div>
                                  </div>
                                )}
                              </td>

                              {isSisMode ? (
                                <>
                                  <td className="p-2.5 font-mono text-[11px]">
                                    {syncUsername && (isOutOfSyncWithId || isUserChanging) ? (
                                      <div className="flex flex-col gap-0.5">
                                        <span className="inline-flex items-center gap-1">
                                          <span className="text-slate-500">{curUser || curId || '—'}</span>
                                          <ArrowRight className="w-3 h-3 text-indigo-500" />
                                          <strong className="text-indigo-950">{newUser}</strong>
                                        </span>
                                        <span className="text-[9px] font-sans font-bold text-indigo-700">
                                          {isOutOfSyncWithId
                                            ? `ID/Lunch ID (${curId}) ≠ User ID (${newUser}) → Login updated`
                                            : `Username updated to SIS User ID`}
                                        </span>
                                      </div>
                                    ) : (
                                      <span className="text-emerald-800 font-bold">
                                        In Sync ({curUser || '—'})
                                      </span>
                                    )}
                                  </td>
                                  <td className="p-2.5 text-[11px]">
                                    {syncPlacement && newPlacement !== curPlacement ? (
                                      <div className="flex flex-col gap-0.5">
                                        <span className="text-slate-400 line-through">{curPlacement}</span>
                                        <strong className="text-emerald-900">{newPlacement}</strong>
                                      </div>
                                    ) : (
                                      <span className="text-slate-600">{curPlacement}</span>
                                    )}
                                  </td>
                                  <td className="p-2.5 text-[11px]">
                                    {syncProfile ? (
                                      <div className="space-y-0.5">
                                        {item.incoming.studentName && item.incoming.studentName !== item.existing.studentName ? (
                                          <div className="text-emerald-900 font-bold">{item.incoming.studentName}</div>
                                        ) : (
                                          <div className="text-slate-500">Name unchanged</div>
                                        )}
                                        {item.incoming.stateTestingId && (
                                          <div className="text-[10px] font-mono text-slate-600">
                                            State ID: {item.incoming.stateTestingId}
                                          </div>
                                        )}
                                        {item.incoming.hasBarcodeColumn && (
                                          <div className="text-[10px] font-mono text-emerald-800 font-bold">
                                            Barcode: {item.incoming.barcode || '—'}
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="text-slate-400">No change</span>
                                    )}
                                  </td>
                                </>
                              ) : (
                                <>
                                  <td className="p-2.5 font-mono text-[11px]">
                                    {syncPassword && item.incoming.password ? (
                                      <span className="inline-flex items-center gap-1">
                                        <span className="text-slate-400">{item.existing.password || '—'}</span>
                                        <ArrowRight className="w-3 h-3 text-slate-400" />
                                        <strong className="text-indigo-950">{item.incoming.password}</strong>
                                      </span>
                                    ) : (
                                      <span className="text-slate-400">No change</span>
                                    )}
                                  </td>
                                  <td className="p-2.5 font-mono text-[11px]">
                                    {syncPin && item.incoming.pin ? (
                                      <span className="inline-flex items-center gap-1">
                                        <span className="text-slate-400">{item.existing.pin || '—'}</span>
                                        <ArrowRight className="w-3 h-3 text-slate-400" />
                                        <strong className="text-blue-950">{item.incoming.pin}</strong>
                                      </span>
                                    ) : (
                                      <span className="text-slate-400">No change</span>
                                    )}
                                  </td>
                                  <td className="p-2.5 font-mono text-[11px]">
                                    {syncUsername && newUser && newUser !== curUser ? (
                                      <span className="inline-flex items-center gap-1">
                                        <span className="text-slate-400">{curUser || '—'}</span>
                                        <ArrowRight className="w-3 h-3 text-slate-400" />
                                        <strong className="text-emerald-900">{newUser}</strong>
                                      </span>
                                    ) : (
                                      <span className="text-slate-600">{curUser || '—'}</span>
                                    )}
                                  </td>
                                  <td className="p-2.5 font-mono text-[11px]">
                                    {item.incoming.hasBarcodeColumn ? (
                                      <span className="inline-flex items-center gap-1">
                                        <span className="text-slate-400">{item.existing.barcode || '—'}</span>
                                        <ArrowRight className="w-3 h-3 text-slate-400" />
                                        <strong className={item.incoming.barcode ? 'text-emerald-900' : 'text-slate-500'}>
                                          {item.incoming.barcode || '—'}
                                        </strong>
                                      </span>
                                    ) : (
                                      <span className="text-slate-400">No change</span>
                                    )}
                                  </td>
                                </>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-white/50 border-t border-white/40 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-600 font-medium">
            {parsedRows.length > 0
              ? `Ready to update ${selectedApplyCount} existing student(s)${addUnmatched && unmatched.length > 0 ? ` + add ${unmatched.length} new` : ''}`
              : `Comparing against ${existingRecords.length} student record(s) in roster`}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={selectedApplyCount === 0 && !(addUnmatched && unmatched.length > 0)}
              className={`inline-flex items-center gap-1.5 px-5 py-2 disabled:bg-slate-300 disabled:text-slate-500 text-white rounded-xl text-xs font-extrabold shadow-sm cursor-pointer ${isSisMode ? 'bg-teal-600 hover:bg-teal-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}
            >
              <Check className="w-4 h-4" />
              <span>{isSisMode ? 'Apply SIS Sync' : 'Apply Sync'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
