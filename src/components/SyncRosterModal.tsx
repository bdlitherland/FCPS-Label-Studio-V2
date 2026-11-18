import React, { useState, useMemo } from 'react';
import Papa from 'papaparse';
import { RecordData } from '../types';
import {
  extractUsername,
  resolveMainUsername,
  normalizeStudentRecord,
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

interface SyncRosterModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingRecords: RecordData[];
  onApplySync: (updatedRecords: RecordData[]) => void;
}

type MatchConfidence = 'dual' | 'id-match' | 'user-match' | 'id-conflict' | 'user-conflict';

interface IncomingSyncRow {
  rowIndex: number;
  raw: Record<string, string>;
  studentId: string;
  userId: string;
  username: string;
  barcode: string;
  studentName: string;
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

export const SyncRosterModal: React.FC<SyncRosterModalProps> = ({
  isOpen,
  onClose,
  existingRecords,
  onApplySync,
}) => {
  const [rawText, setRawText] = useState('');
  const [parsedRows, setParsedRows] = useState<IncomingSyncRow[]>([]);
  const [parseError, setParseError] = useState('');
  const [syncPassword, setSyncPassword] = useState(true);
  const [syncPin, setSyncPin] = useState(true);
  const [syncUsername, setSyncUsername] = useState(true);
  const [syncEquipment, setSyncEquipment] = useState(true);
  const [addUnmatched, setAddUnmatched] = useState(false);
  const [selectedMatchKeys, setSelectedMatchKeys] = useState<Record<string, boolean>>({});

  // Parse CSV or TSV text into normalized IncomingSyncRow[]
  const parseInputData = (text: string) => {
    setParseError('');
    if (!text.trim()) {
      setParsedRows([]);
      return;
    }

    Papa.parse(text.trim(), {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = (results.data as Record<string, any>[]) || [];
        if (rows.length === 0) {
          setParseError('No data rows found. Make sure the header row is included.');
          setParsedRows([]);
          return;
        }

        const normalized: IncomingSyncRow[] = rows
          .map((item, idx) => {
            const getField = (...keys: string[]): string => {
              for (const k of keys) {
                if (item[k] !== undefined && item[k] !== null && String(item[k]).trim() !== '') {
                  return String(item[k]).trim();
                }
              }
              // Case-insensitive fallback
              const lowerMap: Record<string, string> = {};
              Object.keys(item).forEach((origKey) => {
                lowerMap[origKey.trim().toLowerCase()] = item[origKey] != null ? String(item[origKey]).trim() : '';
              });
              for (const k of keys) {
                const v = lowerMap[k.toLowerCase()];
                if (v) return v;
              }
              return '';
            };

            const studentId = getField('studentId', 'Student ID', 'Lunch ID', 'FCPS ID', 'id');
            const email = getField('email', 'Student Email 1', 'Student Email', 'Email');
            const rawUserId = getField('userId', 'User ID', 'UserID', 'user_id', 'SAMAccountName');
            const rawUsername = getField('username', 'Username') || extractUsername(email);
            const barcode = getField('barcode', 'Barcode');

            // If userId/username absent, check if barcode looks like a username (differs from studentId)
            const resolvedUser =
              (rawUserId && rawUserId !== studentId ? rawUserId : '') ||
              (rawUsername && rawUsername !== studentId ? rawUsername : '') ||
              (barcode && barcode !== studentId ? barcode : '') ||
              rawUserId ||
              rawUsername;

            return {
              rowIndex: idx,
              raw: item as Record<string, string>,
              studentId,
              userId: rawUserId || resolvedUser,
              username: resolvedUser,
              barcode: barcode || resolvedUser || studentId,
              studentName: getField('studentName', 'Student Name', 'FullName', 'Full Name', 'Name'),
              grade: getField('grade', 'Grade'),
              staffName: getField('staffName', 'Staff Name', 'Teacher', 'Teacher Name'),
              password: getField('password', 'Password'),
              pin: getField('pin', 'PIN', 'Pin', 'iPad PIN', 'iPad Pin', 'Device PIN', 'Passcode', 'PIN Code'),
              roomNumber: getField('roomNumber', 'Room Number', 'Room Name', 'Room'),
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

        // Initialize default checkbox selection (auto-select verified matches, leave conflicts unchecked for review)
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

  // Match incoming rows against existing student records using BOTH studentId and username
  const computeMatches = (existing: RecordData[], incoming: IncomingSyncRow[]) => {
    const matched: MatchedSyncItem[] = [];
    const unmatched: IncomingSyncRow[] = [];
    const usedExistingIds = new Set<string>();

    incoming.forEach((inc) => {
      const inId = inc.studentId.toLowerCase();
      const inUser = (inc.userId || inc.username || (inc.barcode !== inc.studentId ? inc.barcode : '')).toLowerCase();
      const inBarcode = inc.barcode.toLowerCase();

      let bestMatch: RecordData | undefined;
      let confidence: MatchConfidence = 'dual';
      let conflictDetail: string | undefined;

      // 1. Exact Dual Match (BOTH Student ID AND Username/Barcode match)
      if (inId && inUser) {
        bestMatch = existing.find((rec) => {
          if (usedExistingIds.has(rec.id)) return false;
          const rId = String(rec.studentId || rec.lunchId || '').trim().toLowerCase();
          const rUser = resolveMainUsername(rec).trim().toLowerCase();
          const rBar = String(rec.barcode || '').trim().toLowerCase();
          return rId === inId && (rUser === inUser || rBar === inUser || (inBarcode && rBar === inBarcode));
        });
        if (bestMatch) {
          confidence = 'dual';
        }
      }

      // 2. Match by Student ID (check username compatibility for accuracy)
      if (!bestMatch && inId) {
        const idCandidate = existing.find((rec) => {
          if (usedExistingIds.has(rec.id)) return false;
          const rId = String(rec.studentId || rec.lunchId || '').trim().toLowerCase();
          return rId === inId;
        });

        if (idCandidate) {
          bestMatch = idCandidate;
          const rId = String(idCandidate.studentId || idCandidate.lunchId || '').trim().toLowerCase();
          const rUser = resolveMainUsername(idCandidate).trim().toLowerCase();

          // If existing had a distinct username AND incoming has a distinct username that disagrees -> flag conflict
          if (rUser && inUser && rUser !== rId && inUser !== inId && rUser !== inUser) {
            confidence = 'id-conflict';
            conflictDetail = `ID matches (${inc.studentId}), but Username differs: "${resolveMainUsername(idCandidate)}" vs "${inc.userId || inc.username}"`;
          } else {
            confidence = 'id-match';
          }
        }
      }

      // 3. Match by Username / User ID (check Student ID compatibility for accuracy)
      if (!bestMatch && inUser) {
        const userCandidate = existing.find((rec) => {
          if (usedExistingIds.has(rec.id)) return false;
          const rUser = resolveMainUsername(rec).trim().toLowerCase();
          const rBar = String(rec.barcode || '').trim().toLowerCase();
          return rUser === inUser || rBar === inUser;
        });

        if (userCandidate) {
          bestMatch = userCandidate;
          const rId = String(userCandidate.studentId || userCandidate.lunchId || '').trim().toLowerCase();
          if (rId && inId && rId !== inId) {
            confidence = 'user-conflict';
            conflictDetail = `Username matches (${inc.userId || inc.username}), but Student ID differs: "${userCandidate.studentId}" vs "${inc.studentId}"`;
          } else {
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

  const { matched, unmatched } = useMemo(
    () => computeMatches(existingRecords, parsedRows),
    [existingRecords, parsedRows]
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

      if (syncPassword && inc.password) {
        next.password = inc.password;
      }
      if (syncPin && inc.pin) {
        next.pin = inc.pin;
      }
      if (syncUsername) {
        const incUser = inc.userId || inc.username;
        if (incUser && incUser !== next.studentId) {
          next.userId = incUser;
          next.username = incUser;
          if (!next.barcode || next.barcode === next.studentId || next.barcode === rec.username || next.barcode === rec.userId) {
            next.barcode = inc.barcode && inc.barcode !== next.studentId ? inc.barcode : incUser;
          }
          if (!next.email || next.email === `${next.studentId}@fcpsschools.net` || next.email === `${rec.username}@fcpsschools.net`) {
            next.email = `${incUser}@fcpsschools.net`;
          }
        } else if (inc.barcode && inc.barcode !== next.studentId) {
          next.userId = inc.barcode;
          next.username = inc.barcode;
          next.barcode = inc.barcode;
        }
      }
      if (syncEquipment) {
        if (inc.roomNumber) next.roomNumber = inc.roomNumber;
        if (inc.hasSleeve) next.hasSleeve = inc.hasSleeve;
        if (inc.hasCharger) next.hasCharger = inc.hasCharger;
        if (inc.hasLaptop) next.hasLaptop = inc.hasLaptop;
        if (inc.hasHeadphones) next.hasHeadphones = inc.hasHeadphones;
        if (inc.attendingSummerPrograms) next.attendingSummerPrograms = inc.attendingSummerPrograms;
        if (inc.deviceCheckedOutForSummer) next.deviceCheckedOutForSummer = inc.deviceCheckedOutForSummer;
      }

      next.updatedAt = today;
      next.updatedBy = 'System Sync';
      return next;
    });

    let finalRecords = updated;
    if (addUnmatched && unmatched.length > 0) {
      const additions = unmatched.map((u, idx) =>
        normalizeStudentRecord(
          {
            ...u.raw,
            id: u.raw.id || `sync_${Date.now()}_${idx}`,
            studentName: u.studentName,
            studentId: u.studentId,
            userId: u.userId,
            username: u.username,
            grade: u.grade || '03',
            staffName: u.staffName,
            password: u.password || 'GFES#2026',
            barcode: u.barcode,
            pin: u.pin,
            roomNumber: u.roomNumber,
            hasSleeve: u.hasSleeve || 'No',
            hasCharger: u.hasCharger || 'No',
            hasLaptop: u.hasLaptop || 'No',
            hasHeadphones: u.hasHeadphones || 'No',
            attendingSummerPrograms: u.attendingSummerPrograms || 'No',
            deviceCheckedOutForSummer: u.deviceCheckedOutForSummer || 'No',
            updatedAt: today,
            updatedBy: 'System Sync (New)',
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
  const singleCount = matched.filter((m) => m.confidence === 'id-match' || m.confidence === 'user-match').length;
  const conflictCount = matched.filter((m) => m.confidence === 'id-conflict' || m.confidence === 'user-conflict').length;
  const selectedApplyCount = matched.filter((m) => selectedMatchKeys[m.key]).length;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-md flex items-center justify-center p-4">
      <div className="glass-modal rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 bg-white/50 border-b border-white/40 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-600 rounded-xl text-white shadow-sm">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-slate-900">
                Sync Passwords, PINs &amp; Equipment from External System
              </h3>
              <p className="text-xs text-slate-600 font-medium">
                Dual-key matching verifies both <strong>Student ID</strong> and <strong>User ID / Username</strong> for accuracy
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
                <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
                <span>Paste Tab-Separated (TSV) or CSV Export from External System</span>
              </div>
              <div className="flex items-center gap-2">
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold cursor-pointer shadow-2xs">
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

            <div className="text-[11px] text-slate-500 font-mono bg-slate-100 px-2.5 py-1.5 rounded-lg overflow-x-auto whitespace-nowrap">
              Supported headers: id, studentName, studentId, userId/username, grade, staffName, password, barcode, pin, roomNumber, hasSleeve, hasCharger, hasLaptop, hasHeadphones, attendingSummerPrograms, deviceCheckedOutForSummer
            </div>

            <textarea
              rows={5}
              value={rawText}
              onChange={(e) => {
                setRawText(e.target.value);
                parseInputData(e.target.value);
              }}
              placeholder={`Paste rows with headers directly from your external system or spreadsheet (tab-separated or comma-separated)...\nid\tstudentName\tstudentId\tgrade\tstaffName\tpassword\tbarcode\tpin\troomNumber\thasSleeve\thasCharger\thasLaptop\thasHeadphones\tattendingSummerPrograms\tdeviceCheckedOutForSummer`}
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
                      Dual Verified (ID + User): {dualCount}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-100 text-blue-950 border border-blue-200">
                      <UserCheck className="w-3.5 h-3.5 text-blue-700" />
                      Single-Key Matched: {singleCount}
                    </span>
                    {conflictCount > 0 && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-100 text-amber-950 border border-amber-300">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                        ID/User Conflicts: {conflictCount}
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
                    <span>User ID / Main Username &amp; Barcode</span>
                  </label>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={syncEquipment}
                      onChange={(e) => setSyncEquipment(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Room, Headphones, Sleeve, Charger, Laptop &amp; Summer</span>
                  </label>
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
                          <th className="p-2.5">Password Update</th>
                          <th className="p-2.5">PIN Update</th>
                          <th className="p-2.5">User ID / Username</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {matched.map((item) => {
                          const checked = !!selectedMatchKeys[item.key];
                          const curUser = resolveMainUsername(item.existing);
                          const newUser = item.incoming.userId || item.incoming.username;
                          return (
                            <tr
                              key={item.key}
                              className={
                                item.confidence === 'id-conflict' || item.confidence === 'user-conflict'
                                  ? 'bg-amber-50/70'
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
                                  ID: {item.existing.studentId}
                                </div>
                              </td>
                              <td className="p-2.5">
                                {item.confidence === 'dual' && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 font-bold text-[10px]">
                                    Dual Match (ID + User)
                                  </span>
                                )}
                                {item.confidence === 'id-match' && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-100 text-blue-900 font-bold text-[10px]">
                                    Matched by Student ID
                                  </span>
                                )}
                                {item.confidence === 'user-match' && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-100 text-blue-900 font-bold text-[10px]">
                                    Matched by Username
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
              : `Matching against ${existingRecords.length} student record(s) in roster`}
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
              className="inline-flex items-center gap-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:text-slate-500 text-white rounded-xl text-xs font-extrabold shadow-sm cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Apply Sync</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
