import React from 'react';
import { ClassroomNoDeviceMode, RecordData } from '../types';
import { GlenForestLogo } from './GlenForestLogo';
import {
  extractTeacherLastName,
  formatGradeDisplay,
  getGradeRank,
  getStudentFirstName,
  getStudentLastName,
  resolveMainUsername,
  studentHasDevice,
  getStudentDeviceBarcode,
} from '../utils/studentDataHelpers';

export interface ClassroomAssignedRow {
  rowType: 'student' | 'divider';
  record?: RecordData;
  orderNumber?: number; // 1-based cart slot index (only increments for students with a device)
  hasDevice: boolean;
  isOverflow: boolean;
  slotLabel: string; // "1".."30", "Additional Charging 1..N", or "No Device"
  displayLastFirst: string;
}

export interface ClassroomAssignmentPage {
  classroomKey: string;
  teacherName: string;
  roomNumber: string;
  gradeLabel: string;
  totalStudents: number;
  deviceCount: number;
  noDeviceCount: number;
  maxCartSlots: number;
  overflowCount: number;
  openSlotsCount: number;
  pageInClassroom: number;
  totalPagesInClassroom: number;
  rows: ClassroomAssignedRow[];
}

function compareStudentsLastFirst(a: RecordData, b: RecordData): number {
  const lastA = getStudentLastName(a).toLowerCase();
  const lastB = getStudentLastName(b).toLowerCase();
  if (lastA !== lastB) {
    if (!lastA) return 1;
    if (!lastB) return -1;
    return lastA.localeCompare(lastB);
  }
  const firstA = getStudentFirstName(a).toLowerCase();
  const firstB = getStudentFirstName(b).toLowerCase();
  return firstA.localeCompare(firstB);
}

/**
 * Groups student records by classroom (Teacher + Room), sorts students A-Z by Last Name,
 * assigns Cart Slots ONLY to students with a device (starting at 1..maxCartSlots, then Additional Charging 1..N),
 * and handles students without devices (e.g., Kindergarten / Grade 00) cleanly without wasting cart slots.
 */
export function buildClassroomAssignmentPages(
  records: RecordData[],
  options?: {
    maxCartSlots?: number;
    hideExcludedGrade?: boolean;
    sortClassroomsBy?: 'grade-teacher' | 'teacher';
    rowsPerPage?: number;
    noDeviceMode?: ClassroomNoDeviceMode;
  }
): ClassroomAssignmentPage[] {
  const maxCartSlots = Math.max(1, options?.maxCartSlots ?? 30);
  const hideExcludedGrade = options?.hideExcludedGrade ?? true;
  const sortClassroomsBy = options?.sortClassroomsBy ?? 'grade-teacher';
  const rowsPerPage = options?.rowsPerPage ?? 31;
  const noDeviceMode: ClassroomNoDeviceMode = options?.noDeviceMode ?? 'separate-section';

  if (records.length === 0) return [];

  interface GroupBucket {
    key: string;
    teacherName: string;
    roomNumber: string;
    students: RecordData[];
    highestGradeRank: number;
    grades: Set<string>;
  }

  const groups = new Map<string, GroupBucket>();

  for (const r of records) {
    const teacherRaw = String(r.staffName || '').trim();
    const teacherLast = extractTeacherLastName(teacherRaw) || teacherRaw || 'Unassigned';
    const room = String(r.roomNumber || '').trim();
    const key = `${teacherLast.toLowerCase()}__${room.toLowerCase()}`;

    let bucket = groups.get(key);
    if (!bucket) {
      bucket = {
        key,
        teacherName: teacherRaw || teacherLast,
        roomNumber: room,
        students: [],
        highestGradeRank: -999,
        grades: new Set<string>(),
      };
      groups.set(key, bucket);
    }

    bucket.students.push(r);
    const rank = getGradeRank(r.grade);
    if (rank > bucket.highestGradeRank) {
      bucket.highestGradeRank = rank;
    }
    // Always display Kindergarten (00 / 0 / K) clearly on classroom sheets
    const formattedGrade = formatGradeDisplay(r.grade, hideExcludedGrade, true);
    if (formattedGrade) {
      bucket.grades.add(formattedGrade);
    }
  }

  const sortedGroups = Array.from(groups.values()).sort((a, b) => {
    if (sortClassroomsBy === 'grade-teacher' && a.highestGradeRank !== b.highestGradeRank) {
      return b.highestGradeRank - a.highestGradeRank;
    }
    const tA = extractTeacherLastName(a.teacherName).toLowerCase();
    const tB = extractTeacherLastName(b.teacherName).toLowerCase();
    if (tA !== tB) return tA.localeCompare(tB);
    return a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true });
  });

  const pages: ClassroomAssignmentPage[] = [];

  for (const group of sortedGroups) {
    const sortedAll = [...group.students].sort(compareStudentsLastFirst);
    const withDevice = sortedAll.filter((s) => studentHasDevice(s));
    const withoutDevice = sortedAll.filter((s) => !studentHasDevice(s));

    const makeDisplayName = (student: RecordData) => {
      const lastName = getStudentLastName(student);
      const firstName = getStudentFirstName(student);
      return lastName && firstName
        ? `${lastName}, ${firstName}`
        : student.studentName || lastName || firstName || 'Student';
    };

    const rows: ClassroomAssignedRow[] = [];

    if (noDeviceMode === 'inline') {
      let slotCounter = 0;
      for (const student of sortedAll) {
        const hasDevice = studentHasDevice(student);
        if (hasDevice) {
          slotCounter += 1;
          const isOverflow = slotCounter > maxCartSlots;
          rows.push({
            rowType: 'student',
            record: student,
            orderNumber: slotCounter,
            hasDevice: true,
            isOverflow,
            slotLabel: isOverflow ? `Additional Charging ${slotCounter - maxCartSlots}` : `${slotCounter}`,
            displayLastFirst: makeDisplayName(student),
          });
        } else {
          rows.push({
            rowType: 'student',
            record: student,
            hasDevice: false,
            isOverflow: false,
            slotLabel: '—',
            displayLastFirst: makeDisplayName(student),
          });
        }
      }
    } else {
      // 'separate-section' or 'hide': number ONLY device holders 1..N A-Z
      withDevice.forEach((student, idx) => {
        const orderNumber = idx + 1;
        const isOverflow = orderNumber > maxCartSlots;
        rows.push({
          rowType: 'student',
          record: student,
          orderNumber,
          hasDevice: true,
          isOverflow,
          slotLabel: isOverflow ? `Additional Charging ${orderNumber - maxCartSlots}` : `${orderNumber}`,
          displayLastFirst: makeDisplayName(student),
        });
      });

      if (noDeviceMode === 'separate-section' && withoutDevice.length > 0) {
        rows.push({
          rowType: 'divider',
          hasDevice: false,
          isOverflow: false,
          slotLabel: `No 10-Digit Device Barcode (${withoutDevice.length}) — No Cart Slot`,
          displayLastFirst: '',
        });
        withoutDevice.forEach((student) => {
          rows.push({
            rowType: 'student',
            record: student,
            hasDevice: false,
            isOverflow: false,
            slotLabel: '—',
            displayLastFirst: makeDisplayName(student),
          });
        });
      }
    }

    // If 'hide' filtered out every student in a class (e.g. nobody assigned a device yet), still produce 1 clean sheet noting 0 assigned devices
    const gradeList = Array.from(group.grades).sort((a, b) => getGradeRank(b) - getGradeRank(a));
    const gradeLabel = gradeList.join(' / ');
    const overflowCount = Math.max(0, withDevice.length - maxCartSlots);
    const openSlotsCount = Math.max(0, maxCartSlots - withDevice.length);
    const totalPagesInClassroom = Math.max(1, Math.ceil(rows.length / rowsPerPage));

    for (let p = 0; p < totalPagesInClassroom; p++) {
      pages.push({
        classroomKey: group.key,
        teacherName: group.teacherName,
        roomNumber: group.roomNumber,
        gradeLabel,
        totalStudents: sortedAll.length,
        deviceCount: withDevice.length,
        noDeviceCount: withoutDevice.length,
        maxCartSlots,
        overflowCount,
        openSlotsCount,
        pageInClassroom: p + 1,
        totalPagesInClassroom,
        rows: rows.slice(p * rowsPerPage, (p + 1) * rowsPerPage),
      });
    }
  }

  return pages;
}

interface ClassroomAssignmentSheetProps {
  page: ClassroomAssignmentPage;
  schoolName?: string;
  schoolYear?: string;
  customLogoUrl?: string;
  showPassword?: boolean;
  showPin?: boolean;
}

export const ClassroomAssignmentSheet: React.FC<ClassroomAssignmentSheetProps> = ({
  page,
  schoolName = 'Glen Forest Elementary School',
  schoolYear = '2025-2026',
  customLogoUrl,
  showPassword = true,
  showPin = true,
}) => {
  const colCount = 5 + (showPin ? 1 : 0) + (showPassword ? 1 : 0);

  return (
    <div
      className="w-[7.5in] h-[10.2in] bg-white text-slate-900 flex flex-col justify-between overflow-hidden"
      style={{ boxSizing: 'border-box' }}
    >
      <div className="flex flex-col min-h-0 flex-1">
        {/* Classroom Sheet Header */}
        <div className="flex items-center justify-between border-b-2 border-blue-900 pb-2 mb-2 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 bg-slate-50 border border-slate-200 rounded-lg p-1 flex items-center justify-center shrink-0">
              <GlenForestLogo customUrl={customLogoUrl} className="w-full h-full object-contain" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-extrabold text-blue-800 uppercase tracking-wider truncate">
                {schoolName} • {schoolYear}
              </div>
              <h2 className="text-[16px] font-black text-slate-950 leading-tight truncate">
                Classroom Cart Assignments — {page.teacherName}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 text-right">
            {page.gradeLabel && (
              <div className="bg-blue-50 border border-blue-200 rounded-md px-2 py-1 text-center">
                <div className="text-[8px] font-extrabold text-blue-700 uppercase">Grade</div>
                <div className="text-[11.5px] font-black text-blue-950 leading-none">{page.gradeLabel}</div>
              </div>
            )}
            <div className="bg-slate-100 border border-slate-300 rounded-md px-2 py-1 text-center">
              <div className="text-[8px] font-extrabold text-slate-600 uppercase">Room</div>
              <div className="text-[11.5px] font-black text-slate-950 leading-none">
                {page.roomNumber || '—'}
              </div>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-md px-2 py-1 text-center">
              <div className="text-[8px] font-extrabold text-emerald-700 uppercase">Devices</div>
              <div className="text-[11.5px] font-black text-emerald-950 leading-none">
                {page.deviceCount}/{page.totalStudents}
              </div>
            </div>
          </div>
        </div>

        {/* Summary Strip */}
        <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded px-2.5 py-1 mb-2 text-[9.5px] font-semibold text-slate-700 shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span>
              Sorted <strong>A–Z by Last Name</strong> • Cart Slots:{' '}
              <strong>1–{page.maxCartSlots}</strong> ({Math.min(page.deviceCount, page.maxCartSlots)} Assigned
              {page.openSlotsCount > 0 ? `, ${page.openSlotsCount} Open` : ''})
            </span>
            {page.overflowCount > 0 && (
              <span className="inline-block bg-amber-100 text-amber-950 border border-amber-300 px-1.5 py-0.2 rounded font-extrabold">
                +{page.overflowCount} Additional Charging
              </span>
            )}
            {page.noDeviceCount > 0 && (
              <span className="inline-block bg-slate-200 text-slate-800 border border-slate-300 px-1.5 py-0.2 rounded font-bold">
                {page.noDeviceCount} Without Barcode
              </span>
            )}
          </div>
          {page.totalPagesInClassroom > 1 && (
            <span className="font-bold text-slate-800 shrink-0">
              Page {page.pageInClassroom} of {page.totalPagesInClassroom}
            </span>
          )}
        </div>

        {/* Student Cart Assignment Table */}
        {page.rows.length === 0 ? (
          <div className="border border-dashed border-slate-300 rounded-lg p-6 text-center text-xs text-slate-500 font-semibold mt-4">
            No students in this classroom have a 10-digit device barcode assigned ({page.noDeviceCount} without barcode).
          </div>
        ) : (
          <table className="w-full table-fixed border-collapse text-[9.5px] leading-tight">
            <thead>
              <tr className="bg-blue-900 text-white text-left text-[8.5px] uppercase tracking-wider">
                <th className="py-1.5 px-1.5 font-extrabold border border-blue-900 w-[1.05in]">
                  Cart Slot
                </th>
                <th className="py-1.5 px-1.5 font-extrabold border border-blue-900">
                  Student Name (A–Z)
                </th>
                <th className="py-1.5 px-1.5 font-extrabold border border-blue-900 w-[0.85in]">
                  ID / Lunch ID
                </th>
                <th className="py-1.5 px-1.5 font-extrabold border border-blue-900 w-[1.05in]">
                  User ID
                </th>
                <th className="py-1.5 px-1.5 font-extrabold border border-blue-900 w-[1.05in]">
                  Barcode
                </th>
                {showPin && (
                  <th className="py-1.5 px-1.5 font-extrabold border border-blue-900 w-[0.6in] text-center">
                    PIN
                  </th>
                )}
                {showPassword && (
                  <th className="py-1.5 px-1.5 font-extrabold border border-blue-900 w-[1.0in]">
                    Password
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {page.rows.map((row, idx) => {
                if (row.rowType === 'divider') {
                  return (
                    <tr key={`div_${idx}`} className="bg-slate-200/90">
                      <td
                        colSpan={colCount}
                        className="py-1 px-1.5 border border-slate-300 text-[8.5px] font-black uppercase tracking-wider text-slate-800"
                      >
                        {row.slotLabel}
                      </td>
                    </tr>
                  );
                }

                const student = row.record!;
                const mainUsername = resolveMainUsername(student);
                const lunchId = String(student.lunchId || student.studentId || '—');
                const pinVal = String(student.pin ?? '').trim() || '—';
                const passVal = String(student.password || 'GFES#2026');
                const lastName = getStudentLastName(student);
                const firstName = getStudentFirstName(student);

                // Supply the Barcode value from the sheet (10-digit leading-zero device barcode)
                const rawDeviceBarcode = getStudentDeviceBarcode(student);

                return (
                  <tr
                    key={student.id}
                    className={
                      !row.hasDevice
                        ? 'bg-slate-100/80 text-slate-600'
                        : row.isOverflow
                        ? 'bg-amber-50/90'
                        : idx % 2 === 1
                        ? 'bg-slate-50/80'
                        : 'bg-white'
                    }
                  >
                    <td className="py-1 px-1.5 border border-slate-300 font-bold whitespace-nowrap">
                      {!row.hasDevice ? (
                        <span className="text-slate-400 font-mono text-[9.5px]">—</span>
                      ) : row.isOverflow ? (
                        <span className="inline-block bg-amber-100 text-amber-950 border border-amber-400 px-1 py-0.2 rounded text-[8px] font-black uppercase tracking-tight">
                          {row.slotLabel}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-mono text-[9.5px] font-black text-blue-950">
                          <span className="inline-block w-4.5 text-center bg-blue-100 text-blue-900 rounded py-0.2 border border-blue-200">
                            {row.orderNumber}
                          </span>
                          <span className="text-[8.5px] font-sans font-semibold text-slate-600">
                            Slot #{row.orderNumber}
                          </span>
                        </span>
                      )}
                    </td>
                    <td className="py-1 px-1.5 border border-slate-300 truncate max-w-[1.85in]">
                      {lastName && firstName ? (
                        <>
                          <strong className={`font-extrabold ${row.hasDevice ? 'text-slate-950' : 'text-slate-700'}`}>
                            {lastName}
                          </strong>
                          <span className="text-slate-600">, {firstName}</span>
                        </>
                      ) : (
                        <strong className="font-extrabold">{row.displayLastFirst}</strong>
                      )}
                    </td>
                    <td className="py-1 px-1.5 border border-slate-300 font-mono font-bold text-slate-800">
                      {lunchId}
                    </td>
                    <td className="py-1 px-1.5 border border-slate-300 font-mono font-bold text-blue-950 truncate max-w-[1.1in]">
                      {mainUsername || '—'}
                    </td>
                    <td className="py-1 px-1.5 border border-slate-300 font-mono font-bold">
                      {rawDeviceBarcode ? (
                        <span className="text-slate-950">{rawDeviceBarcode}</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    {showPin && (
                      <td className="py-1 px-1.5 border border-slate-300 font-mono font-bold text-center text-blue-900">
                        {pinVal}
                      </td>
                    )}
                    {showPassword && (
                      <td className="py-1 px-1.5 border border-slate-300 font-mono font-bold text-amber-950 truncate max-w-[1in]">
                        {passVal}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Sheet Footer */}
      <div className="pt-1.5 mt-2 border-t border-slate-300 flex items-center justify-between text-[8.5px] text-slate-500 font-semibold shrink-0">
        <span>
          Slots 1–{page.maxCartSlots}: Standard Cart • Over {page.maxCartSlots}: Additional Charging • Device Barcode: 10-Digit Asset Tag
        </span>
        <span>
          {page.teacherName} {page.roomNumber ? `(Rm ${page.roomNumber})` : ''} • Page {page.pageInClassroom}/{page.totalPagesInClassroom}
        </span>
      </div>
    </div>
  );
};
