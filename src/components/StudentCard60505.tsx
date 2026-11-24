import React from 'react';
import { RecordData } from '../types';
import { GlenForestLogo } from './GlenForestLogo';
import { BarcodeGenerator } from './BarcodeGenerator';
import { Key, Hash, User, Utensils } from 'lucide-react';
import {
  resolveMainUsername,
  extractTeacherLastName,
  formatStudentFullName,
  formatGradeDisplay,
} from '../utils/studentDataHelpers';

interface StudentCard60505Props {
  data: RecordData;
  schoolName?: string;
  schoolAddress?: string;
  schoolYear?: string;
  customLogoUrl?: string;
  hideExcludedGrade?: boolean;
  showPassword?: boolean;
  showPin?: boolean;
}

/**
 * Student Business Card / Credential Label sized for Avery 60505 (4.0" x 2.0", 10 per sheet, 2 cols x 5 rows).
 */
export const StudentCard60505: React.FC<StudentCard60505Props> = ({
  data,
  schoolName = 'Glen Forest Elementary School',
  schoolAddress = 'Falls Church, VA',
  schoolYear = '2025-2026',
  customLogoUrl,
  hideExcludedGrade = true,
  showPassword = true,
  showPin = true,
}) => {
  const mainUsername = resolveMainUsername(data);
  const lunchId = String(data.lunchId || data.studentId || '').trim();
  const barcodeValue = lunchId || mainUsername;
  const teacherLastName = extractTeacherLastName(data.staffName);
  const studentDisplayName = formatStudentFullName(data.firstName, data.lastName, data.studentName);
  const displayGrade = formatGradeDisplay(data.grade, hideExcludedGrade);
  const pinValue = String(data.pin ?? '').trim() || '—';
  const passValue = String(data.password || 'GFES#2026');

  const colCount = 2 + (showPin ? 1 : 0) + (showPassword ? 1 : 0);
  const gridColsClass =
    colCount === 4 ? 'grid-cols-4' : colCount === 3 ? 'grid-cols-3' : 'grid-cols-2';

  return (
    <div
      className="relative w-[4.0in] h-[2.0in] bg-white border border-slate-300 rounded-sm p-2 pr-3 flex flex-col justify-between overflow-hidden shadow-xs print:shadow-none print:border-none print:m-0 print:pt-[0.08in] print:pb-[0.08in] print:pl-[0.09in] print:pr-[0.14in] print:bg-white"
      style={{ boxSizing: 'border-box' }}
    >
      {/* Top Header: School Logo + School Name + Year */}
      <div className="flex justify-between items-center border-b border-slate-200 pb-1 shrink-0">
        <div className="flex items-center gap-1.5 min-w-0 pr-2">
          <div className="w-[0.36in] h-[0.36in] bg-slate-50 border border-slate-200 rounded flex items-center justify-center p-0.5 shrink-0">
            <GlenForestLogo customUrl={customLogoUrl} className="h-full w-full object-contain" />
          </div>
          <div className="min-w-0">
            <h1 className="text-[10px] font-black text-slate-900 leading-tight uppercase truncate" title={schoolName}>
              {schoolName}
            </h1>
            <p className="text-[7.5px] text-slate-500 font-bold truncate" title={schoolAddress}>
              {schoolAddress} • Student Credential Card
            </p>
          </div>
        </div>

        <div className="text-right shrink-0">
          <span className="inline-block bg-blue-50 text-blue-900 text-[8px] font-black px-1.5 py-0.5 rounded border border-blue-200 uppercase">
            {schoolYear}
          </span>
        </div>
      </div>

      {/* Middle Section: Student Name, Grade/Room/Teacher, & Credentials Grid */}
      <div className="flex-1 my-1 flex flex-col justify-center gap-1 min-w-0">
        <div className="flex justify-between items-baseline gap-2">
          <div className="text-[12px] font-black text-slate-950 truncate" title={studentDisplayName}>
            {studentDisplayName}
          </div>
          <div className="text-[8.5px] font-extrabold text-slate-700 shrink-0">
            {displayGrade && (
              <>
                Gr: <span className="text-blue-900 font-black">{displayGrade}</span> |{' '}
              </>
            )}
            Rm: <span className="text-slate-900 font-black">{data.roomNumber || '—'}</span>
            {teacherLastName && (
              <span className="ml-1 text-slate-600 font-semibold">
                | T: <strong className="text-slate-900">{teacherLastName}</strong>
              </span>
            )}
          </div>
        </div>

        {/* Adaptive 2/3/4-column Credential Strip */}
        <div className={`grid ${gridColsClass} gap-1 bg-slate-50/90 border border-slate-200 rounded p-1 text-[8px]`}>
          <div className="bg-white border border-slate-200 rounded px-1.5 py-0.5 flex flex-col justify-center min-w-0">
            <span className="text-[6.5px] font-extrabold text-slate-500 uppercase tracking-tight flex items-center gap-0.5 truncate">
              <Utensils className="w-2 h-2 text-indigo-600 shrink-0" />
              ID / Lunch ID
            </span>
            <span className="text-[9.5px] font-black font-mono text-slate-950 truncate">
              {lunchId || '—'}
            </span>
          </div>

          <div className="bg-white border border-slate-200 rounded px-1.5 py-0.5 flex flex-col justify-center min-w-0">
            <span className="text-[6.5px] font-extrabold text-slate-500 uppercase tracking-tight flex items-center gap-0.5 truncate">
              <User className="w-2 h-2 text-blue-600 shrink-0" />
              User ID
            </span>
            <span className="text-[9.5px] font-black font-mono text-blue-950 truncate" title={mainUsername}>
              {mainUsername || '—'}
            </span>
          </div>

          {showPin && (
            <div className="bg-blue-50/80 border border-blue-200 rounded px-1.5 py-0.5 flex flex-col justify-center min-w-0">
              <span className="text-[6.5px] font-extrabold text-blue-800 uppercase tracking-tight flex items-center gap-0.5 truncate">
                <Hash className="w-2 h-2 text-blue-600 shrink-0" />
                PIN
              </span>
              <span className="text-[9.5px] font-black font-mono text-blue-950 truncate" title={pinValue}>
                {pinValue}
              </span>
            </div>
          )}

          {showPassword && (
            <div className="bg-amber-50 border border-amber-300 rounded px-1.5 py-0.5 flex flex-col justify-center min-w-0">
              <span className="text-[6.5px] font-extrabold text-amber-900 uppercase tracking-tight flex items-center gap-0.5 truncate">
                <Key className="w-2 h-2 text-amber-700 shrink-0" />
                Password
              </span>
              <span className="text-[9.5px] font-black font-mono text-amber-950 truncate select-all" title={passValue}>
                {passValue}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Row: Scannable ID / Lunch ID Barcode */}
      <div className="pt-0.5 border-t border-slate-200 flex flex-col items-center justify-end shrink-0">
        <div className="w-full flex justify-center items-center h-[28px] overflow-hidden">
          <BarcodeGenerator
            value={barcodeValue || '1234567'}
            height={24}
            width={2}
            maxWidthPx={340}
            displayValue={false}
          />
        </div>
        <div className="w-full flex justify-center items-center text-[7.5px] text-slate-700 font-bold mt-0.5">
          <span>
            ID / Lunch ID: <strong className="font-mono text-slate-950 font-black">{lunchId || '—'}</strong>
          </span>
        </div>
      </div>
    </div>
  );
};
