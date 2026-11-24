import React from 'react';
import { RecordData } from '../types';
import { BarcodeGenerator } from './BarcodeGenerator';
import { resolveMainUsername, extractTeacherLastName, formatStudentFullName, formatGradeDisplay } from '../utils/studentDataHelpers';

interface IpadLabel5160Props {
  data: RecordData;
  schoolName?: string;
  hideExcludedGrade?: boolean;
  showPassword?: boolean;
  showPin?: boolean;
}

export const IpadLabel5160: React.FC<IpadLabel5160Props> = ({
  data,
  schoolName = 'Glen Forest ES',
  hideExcludedGrade = true,
  showPassword = true,
  showPin = true,
}) => {
  const mainUsername = resolveMainUsername(data);
  const lunchId = String(data.lunchId || data.studentId || '').trim();
  const barcodeValue = lunchId || mainUsername || '';
  const teacherLastName = extractTeacherLastName(data.staffName);
  const studentDisplayName = formatStudentFullName(data.firstName, data.lastName, data.studentName);
  const pinValue = String(data.pin ?? '').trim() || '—';
  const passValue = String(data.password || 'GFES#2026');
  const displayGrade = formatGradeDisplay(data.grade, hideExcludedGrade);

  const credentialCols =
    showPin && showPassword ? 'grid-cols-3' : showPin || showPassword ? 'grid-cols-2' : 'grid-cols-1';

  return (
    <div
      className="relative w-[2.625in] h-[1in] bg-white border border-gray-300 rounded-[2px] p-1 pr-2.5 flex flex-col justify-between overflow-hidden text-gray-900 shadow-xs print:shadow-none print:border-none print:pt-[0.04in] print:pb-[0.04in] print:pl-[0.04in] print:pr-[0.14in]"
      style={{ boxSizing: 'border-box' }}
    >
      {/* Top Header: School & Grade/Room */}
      <div className="flex justify-between items-center text-[7.5px] font-bold text-blue-900 border-b border-gray-200 pb-0.5 leading-none">
        <span className="truncate font-extrabold max-w-[1.6in]" title={schoolName}>
          {schoolName} — iPad
        </span>
        <span className="bg-blue-50 text-blue-950 px-1 py-[1px] rounded text-[7px] font-extrabold border border-blue-200 shrink-0">
          {displayGrade ? `Gr: ${displayGrade} | ` : ''}Rm: {data.roomNumber || '—'}
        </span>
      </div>

      {/* Main Student Name, Teacher & User ID */}
      <div className="my-0.5 min-w-0">
        <p className="text-[8.5px] font-extrabold text-slate-950 leading-tight truncate" title={studentDisplayName}>
          {studentDisplayName}
        </p>
        <div className="flex justify-between items-center text-[6.5px] text-slate-600 font-medium gap-1 leading-tight pr-0.5">
          <span className="truncate min-w-0">
            {teacherLastName ? (
              <>T: <strong className="text-slate-900">{teacherLastName}</strong></>
            ) : null}
          </span>
          <span className="font-mono font-bold text-slate-700 truncate max-w-[1.5in]" title={`User ID / Username: ${mainUsername}`}>
            User: <strong className="text-blue-950">{mainUsername || '—'}</strong>
          </span>
        </div>
      </div>

      {/* ID/Lunch ID / PIN / Password Credential Grid (adapts cleanly when PIN or Password is hidden) */}
      <div
        className={`grid ${credentialCols} gap-0.5 bg-slate-50 border border-slate-200 rounded p-0.5 text-center ${
          showPin && showPassword ? 'text-[6.5px]' : 'text-[7px]'
        } font-mono leading-none`}
      >
        <div className="px-0.5 min-w-0">
          <span className="block text-[5px] font-extrabold text-slate-500 font-sans uppercase truncate">ID/Lunch ID</span>
          <span className="font-extrabold text-slate-900 truncate block" title={lunchId}>{lunchId || '—'}</span>
        </div>
        {showPin && (
          <div className={`${showPassword ? 'border-x' : 'border-l'} border-slate-200 px-0.5 min-w-0`}>
            <span className="block text-[5px] font-extrabold text-blue-700 font-sans uppercase truncate">PIN</span>
            <span className="font-extrabold text-blue-950 truncate block" title={pinValue}>{pinValue}</span>
          </div>
        )}
        {showPassword && (
          <div className={`${!showPin ? 'border-l border-slate-200' : ''} px-0.5 min-w-0`}>
            <span className="block text-[5px] font-extrabold text-amber-700 font-sans uppercase truncate">Password</span>
            <span className="font-extrabold text-amber-950 truncate block" title={passValue}>{passValue}</span>
          </div>
        )}
      </div>

      {/* Full-Width Scannable Barcode */}
      <div className="w-full flex justify-center items-center h-[24px] pt-0.5 overflow-hidden">
        <BarcodeGenerator
          value={barcodeValue || '1234567'}
          height={20}
          width={2}
          maxWidthPx={218}
          displayValue={false}
        />
      </div>
    </div>
  );
};

