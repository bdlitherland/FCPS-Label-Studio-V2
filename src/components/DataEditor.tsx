import React, { useState, useMemo } from 'react';
import { RecordData } from '../types';
import Papa from 'papaparse';
import {
  extractUsername,
  resolveMainUsername,
  extractTeacherLastName,
  formatStudentFullName,
  getStudentFirstName,
  getStudentLastName,
  removeMiddleInitials,
  normalizeStudentRecord,
  getGradeRank,
  isExcludedGrade,
  studentHasDevice,
  isTenDigitDeviceBarcode,
  isValidDeviceBarcode,
  normalizeBarcodeValue,
  getRowFieldCaseInsensitive,
  getStudentDeviceBarcode
} from '../utils/studentDataHelpers';
import { SyncRosterModal, SyncModalMode } from './SyncRosterModal';
import {
  Search,
  Plus,
  Trash2,
  FileSpreadsheet,
  Download,
  Upload,
  RefreshCw,
  CheckSquare,
  Square,
  Filter,
  Edit2,
  Check,
  X,
  HardDrive,
  Users,
  UserCheck,
  Laptop,
  Printer,
  Barcode,
  Utensils,
  User,
  Key,
  Eye,
  EyeOff
} from 'lucide-react';

interface DataEditorProps {
  records: RecordData[];
  deviceRecords?: RecordData[];
  activeRoster?: 'students' | 'staff' | 'devices';
  onChangeRoster?: (roster: 'students' | 'staff' | 'devices') => void;
  studentCount?: number;
  staffCount?: number;
  deviceCount?: number;
  onUpdateRecords: (newRecords: RecordData[]) => void;
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onSelectAll: (ids: string[]) => void;
  onDeselectAll: () => void;
  onOpenDriveModal: () => void;
  onClearRoster: () => void;
  onQuickPrintDevice?: (id: string) => void;
  excludeNonPrintableGrades?: boolean;
  onToggleExcludeNonPrintable?: (exclude: boolean) => void;
  onSelectTeacherForPrint?: (teacher: string) => void;
}

export const DataEditor: React.FC<DataEditorProps> = ({
  records,
  deviceRecords = [],
  activeRoster = 'students',
  onChangeRoster,
  studentCount = 0,
  staffCount = 0,
  deviceCount = 0,
  onUpdateRecords,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onDeselectAll,
  onOpenDriveModal,
  onClearRoster,
  onQuickPrintDevice,
  excludeNonPrintableGrades = true,
  onToggleExcludeNonPrintable,
  onSelectTeacherForPrint
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGrade, setFilterGrade] = useState<string>('all');
  const [filterStaff, setFilterStaff] = useState<string>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<RecordData | null>(null);
  const [syncModalMode, setSyncModalMode] = useState<SyncModalMode | null>(null);
  const [showCredentials, setShowCredentials] = useState<boolean>(false);

  const isStaffMode = activeRoster === 'staff';
  const isDeviceMode = activeRoster === 'devices';

  // Extract unique grades and staff names for filtering
  const uniqueGrades = useMemo(() => {
    const set = new Set(records.map(r => r.grade).filter(Boolean) as string[]);
    return Array.from(set).sort((a, b) => {
      const rankA = getGradeRank(a);
      const rankB = getGradeRank(b);
      if (rankA !== rankB) return rankB - rankA; // Highest grade first
      return a.localeCompare(b);
    });
  }, [records]);

  const uniqueStaff = useMemo(() => {
    const set = new Set(records.map(r => r.staffName).filter(Boolean) as string[]);
    return Array.from(set).sort((a, b) => {
      const lastA = extractTeacherLastName(a).toLowerCase();
      const lastB = extractTeacherLastName(b).toLowerCase();
      return lastA.localeCompare(lastB);
    });
  }, [records]);

  // Filtered records based on search term & filters
  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      const query = searchTerm.trim().toLowerCase();
      let matchSearch = true;
      if (query) {
        const nameMatch =
          (r.studentName && r.studentName.toLowerCase().includes(query)) ||
          (r.fullName && r.fullName.toLowerCase().includes(query)) ||
          (r.staffName && r.staffName.toLowerCase().includes(query)) ||
          (r.firstName && r.firstName.toLowerCase().includes(query)) ||
          (r.lastName && r.lastName.toLowerCase().includes(query));

        const descMatch =
          (r.description && r.description.toLowerCase().includes(query)) ||
          (r.role && r.role.toLowerCase().includes(query)) ||
          (r.title && r.title.toLowerCase().includes(query));

        const idMatch =
          (r.studentId && r.studentId.toLowerCase().includes(query)) ||
          (r.lunchId && r.lunchId.toLowerCase().includes(query)) ||
          (r.pin && r.pin.toLowerCase().includes(query)) ||
          (r.userId && r.userId.toLowerCase().includes(query)) ||
          (r.username && r.username.toLowerCase().includes(query)) ||
          (r.samAccountName && r.samAccountName.toLowerCase().includes(query)) ||
          (r.barcode && r.barcode.toLowerCase().includes(query)) ||
          (r.email && r.email.toLowerCase().includes(query));

        const deviceMatch =
          (r.serialNumber && r.serialNumber.toLowerCase().includes(query)) ||
          (r.assetTag && r.assetTag.toLowerCase().includes(query)) ||
          (r.make && r.make.toLowerCase().includes(query)) ||
          (r.model && r.model.toLowerCase().includes(query)) ||
          (r.deviceType && r.deviceType.toLowerCase().includes(query)) ||
          (r.site && r.site.toLowerCase().includes(query));

        matchSearch = !!(nameMatch || descMatch || idMatch || deviceMatch || (r.roomNumber && r.roomNumber.toLowerCase().includes(query)));
      }

      // Grade matching
      let matchGrade = true;
      if (filterGrade !== 'all') {
        const rGrade = (r.grade || '').toString().trim().toLowerCase();
        const fGrade = filterGrade.toString().trim().toLowerCase();
        matchGrade =
          rGrade === fGrade ||
          rGrade.replace(/^0+/, '') === fGrade.replace(/^0+/, '') ||
          rGrade === `grade ${fGrade}` ||
          rGrade === `gr ${fGrade}` ||
          `grade ${rGrade}` === fGrade;
      }

      // Staff matching
      let matchStaff = true;
      if (filterStaff !== 'all') {
        const rStaff = (r.staffName || '').trim().toLowerCase();
        const fStaff = filterStaff.trim().toLowerCase();
        matchStaff =
          rStaff === fStaff ||
          extractTeacherLastName(r.staffName).toLowerCase() === extractTeacherLastName(filterStaff).toLowerCase();
      }

      return matchSearch && matchGrade && matchStaff;
    });
  }, [records, searchTerm, filterGrade, filterStaff]);

  const allFilteredSelected =
    filteredRecords.length > 0 &&
    filteredRecords.every(r => selectedIds.includes(r.id));

  const handleToggleSelectFilteredAll = () => {
    if (allFilteredSelected) {
      // Deselect only filtered records
      const filteredIdSet = new Set(filteredRecords.map(r => r.id));
      onSelectAll(selectedIds.filter(id => !filteredIdSet.has(id)));
    } else {
      // Add all filtered records to selection
      const newSelected = Array.from(new Set([...selectedIds, ...filteredRecords.map(r => r.id)]));
      onSelectAll(newSelected);
    }
  };

  const handleSelectOnlyFiltered = () => {
    onSelectAll(filteredRecords.map(r => r.id));
  };

  const printableStudentRecords = useMemo(() => {
    return records.filter(r => !isExcludedGrade(r.grade));
  }, [records]);

  const handleSelectPrintableStudents = () => {
    onSelectAll(printableStudentRecords.map(r => r.id));
  };

  // Smart CSV File Import Handler
  // Supports report CSVs starting on Row 7 or standard CSVs
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: false,
      skipEmptyLines: true,
      complete: (results) => {
        const rawRows = results.data as string[][];
        if (!rawRows || rawRows.length === 0) return;

        // Find header row index (e.g. searching for "AssetTag", "Serial", "Make", "Student Name", "FullName")
        let headerRowIdx = 0;
        for (let i = 0; i < Math.min(rawRows.length, 15); i++) {
          const nonEmptyCount = rawRows[i].filter(c => c && c.trim()).length;
          if (nonEmptyCount < 2) continue;
          const rowStr = rawRows[i].join(' ').toLowerCase();
          if (
            rowStr.includes('assettag') ||
            rowStr.includes('asset tag') ||
            rowStr.includes('serial') ||
            rowStr.includes('make') ||
            rowStr.includes('model') ||
            rowStr.includes('fullname') ||
            rowStr.includes('student id') ||
            rowStr.includes('studentid') ||
            rowStr.includes('student name') ||
            rowStr.includes('studentname') ||
            rowStr.includes('user id') ||
            rowStr.includes('userid') ||
            rowStr.includes('barcode')
          ) {
            headerRowIdx = i;
            break;
          }
        }

        const headers = rawRows[headerRowIdx].map(h => (h || '').replace(/^\uFEFF/, '').trim());
        const dataRows = rawRows.slice(headerRowIdx + 1);

        const newRecords: RecordData[] = dataRows.map((row, index) => {
          const item: Record<string, string> = {};
          headers.forEach((h, colIdx) => {
            if (h && row[colIdx] !== undefined) {
              item[h] = String(row[colIdx] ?? '').trim();
            }
          });

          // If in Student mode or contains student headers (case-insensitive check)
          const hasStudentHeaders =
            getRowFieldCaseInsensitive(item, 'Student Name', 'Student ID', 'studentId', 'State Testing ID', 'Room Name', 'User ID', 'Student Email 1', 'studentName', 'userId', 'Lunch ID').found;

          if (!isDeviceMode && (hasStudentHeaders || !isStaffMode)) {
            const gf = (...keys: string[]) => getRowFieldCaseInsensitive(item, ...keys).value;
            // SIS Export fields: Student Name, Student ID, State Testing ID, Last Name, First Name, Grade, Staff Name, Room Name, User ID
            const emailRaw = gf('Student Email 1', 'Student Email', 'Email', 'email');
            const studentId =
              gf('Student ID', 'StudentID', 'student_id', 'Lunch ID', 'LunchID', 'FCPS ID', 'Perm ID', 'SIS ID', 'studentId', 'ID') ||
              `${1850000 + index}`;
            const rawUserId = gf('User ID', 'userId', 'UserID', 'user_id', 'SAMAccountName', 'SAM Account Name', 'samAccountName', 'Login');
            const rawUsername = gf('Username', 'username');
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
            const pin = gf('pin', 'PIN', 'Pin', 'iPad PIN', 'iPad Pin', 'Device PIN', 'Passcode', 'PIN Code');
            const stateTestingId = gf('stateTestingId', 'State Testing ID', 'Testing ID');
            const rawBarcode = normalizeBarcodeValue(barcodeLookup.value);
            const hasValidBarcode = isValidDeviceBarcode(rawBarcode, {
              studentId,
              userId: rawUserId,
              username: rawUsername,
              stateTestingId,
              pin,
              email: emailRaw,
            });
            const nonAssetBarcode = hasValidBarcode ? '' : rawBarcode;
            // If studentId and userId do not match, userId is treated as main username
            const username =
              (rawUserId && rawUserId !== studentId ? rawUserId : '') ||
              (rawUsername && rawUsername !== studentId ? rawUsername : '') ||
              (nonAssetBarcode && nonAssetBarcode !== studentId ? nonAssetBarcode : '') ||
              rawUserId ||
              rawUsername ||
              extractUsername(emailRaw, studentId);
            const userId = rawUserId || username;
            const barcodeVal = rawBarcode;

            const rawName = gf('Student Name', 'studentName', 'FullName', 'Full Name', 'Name');
            const lastName = removeMiddleInitials(gf('Last Name', 'lastName'));
            const firstName = removeMiddleInitials(gf('First Name', 'firstName'));
            const name = formatStudentFullName(firstName, lastName, rawName);

            const room = gf('Room Name', 'RoomName', 'Room Number', 'RoomNumber', 'Room', 'Rm', 'roomNumber');
            const grade = gf('Grade', 'grade') || '03';
            const rawStaff = gf('Staff Name', 'StaffName', 'Teacher', 'Teacher Name', 'Homeroom Teacher', 'Homeroom', 'staffName');
            const staff = extractTeacherLastName(rawStaff);
            const password = gf('Password', 'password') || 'GFES#2026';

            return {
              id: gf('id') || `imp_${Date.now()}_${index}`,
              studentName: name,
              fullName: name,
              firstName,
              lastName,
              studentId,
              lunchId: studentId,
              userId,
              username,
              email: emailRaw || (username ? `${username}@fcpsschools.net` : ''),
              stateTestingId,
              grade,
              staffName: staff,
              roomNumber: room,
              password,
              barcode: barcodeVal,
              assetTag: hasValidBarcode ? barcodeVal : '',
              pin,
              role: 'Student',
              title: 'Student',
              hasSleeve: gf('hasSleeve', 'Has Sleeve') || 'Yes',
              hasCharger: gf('hasCharger', 'Has Charger') || 'Yes',
              hasLaptop: hasValidBarcode ? 'Yes' : (gf('hasLaptop', 'Has Laptop') || 'No'),
              hasHeadphones: gf('hasHeadphones', 'Has Headphones') || 'No',
              attendingSummerPrograms: gf('attendingSummerPrograms', 'Attending Summer') || 'No',
              deviceCheckedOutForSummer: gf('deviceCheckedOutForSummer', 'Checked Out Summer') || 'No',
              updatedAt: new Date().toISOString().split('T')[0],
              updatedBy: 'SIS Sync Import'
            };
          }

          // Device / Staff report fields (case-insensitive & whitespace-safe)
          const dgf = (...keys: string[]) => getRowFieldCaseInsensitive(item, ...keys).value;
          const site = dgf('Site', 'site') || 'Glen Forest ES';
          const devType = dgf('Type', 'Device Type', 'deviceType') || 'Laptop';
          const make = dgf('Make', 'make');
          const model = dgf('Model', 'model');
          const serial = dgf('Serial', 'SerialNumber', 'Serial Number', 'serialNumber', 'SN', 'S/N');
          const rawAssetTag = dgf(
            'AssetTag',
            'Asset Tag',
            'Asset_Tag',
            'assetTag',
            'Barcode',
            'Barcode Value',
            'Device Barcode',
            'Asset #',
            'Asset Number',
            'Asset ID',
            'Tag',
            'Tag Number',
            'Asset'
          );
          const assetTag = normalizeBarcodeValue(rawAssetTag);
          const rawDevBarcode = normalizeBarcodeValue(
            dgf('Barcode', 'Barcode Value', 'Device Barcode', 'AssetTag', 'Asset Tag')
          );
          const room = dgf('Room', 'Room Number', 'Room Name', 'roomNumber') || 'Main Office';
          const usage = dgf('Usage', 'usage');
          const usability = dgf('Usability', 'usability');
          const lifecycle = dgf('Lifecycle', 'lifecycle');
          const statusReason = dgf('StatusRea', 'Status Reason', 'statusReason');
          const poNumber = dgf('PO', 'PO Number', 'poNumber');
          const ownedBy =
            dgf('OwnedBy', 'Owned By', 'Owner', 'Custodian', 'Patron', 'Patron Name') ||
            'Fairfax County Public Schools';

          // Student/User assignment identifiers for Devices & Inventory (never mix serial into studentId)
          const devStudentId = dgf(
            'Student ID',
            'StudentID',
            'studentId',
            'student_id',
            'Lunch ID',
            'LunchID',
            'Patron ID',
            'PatronID',
            'Patron Barcode',
            'Custodian ID',
            'Assigned ID',
            'ID'
          );
          const devUserId = dgf('User ID', 'UserID', 'userId', 'user_id');
          const samAcc = dgf(
            'SAMAccountName',
            'SAM Account Name',
            'samAccountName',
            'User ID',
            'UserID',
            'userId',
            'Username',
            'username',
            'Assigned To',
            'Assigned User',
            'Checked Out To',
            'Login'
          );
          const emailVal = dgf('Email', 'Student Email', 'Student Email 1', 'User Email', 'email');

          // Detect Staff vs Device CSV headers
          const name =
            dgf('FullName', 'Full Name', 'studentName', 'Student Name', 'Name') ||
            (assetTag ? `FCPS Device Asset #${assetTag}` : serial ? `Device S/N: ${serial}` : 'Unknown Record');

          const desc =
            dgf('Description', 'role', 'Role', 'title', 'Title') ||
            (isDeviceMode ? `${make} ${model}`.trim() || 'FCPS Device' : 'Staff Member');

          const barcodeVal =
            rawDevBarcode || assetTag || serial || samAcc || devStudentId || `${1800000 + index}`;

          return {
            id: dgf('id') || `imp_${Date.now()}_${index}`,
            studentName: name,
            fullName: name,
            staffName: dgf('staffName', 'Staff Name', 'Teacher') || name,
            studentId: isDeviceMode ? devStudentId : (samAcc || devStudentId || `${1800000 + index}`),
            lunchId: isDeviceMode ? devStudentId : undefined,
            userId: devUserId || samAcc || undefined,
            username: samAcc || devUserId || undefined,
            samAccountName: samAcc || devStudentId || serial,
            email: emailVal,
            description: desc,
            role: desc,
            title: desc,
            grade: isDeviceMode ? 'Device' : 'Staff',
            password: dgf('password', 'Password'),
            barcode: barcodeVal,
            pin: dgf('pin', 'PIN'),
            roomNumber: room,
            hasSleeve: dgf('hasSleeve', 'Has Sleeve') || 'No',
            hasCharger: dgf('hasCharger', 'Has Charger') || 'Yes',
            hasLaptop: dgf('hasLaptop', 'Has Laptop') || 'Yes',
            // FCPS Inventory Device Fields
            serialNumber: serial,
            assetTag: assetTag || barcodeVal,
            make,
            model,
            deviceType: devType,
            site,
            usage,
            usability,
            lifecycle,
            statusReason,
            poNumber,
            ownedBy,
            updatedAt: new Date().toISOString().split('T')[0],
            updatedBy: 'CSV Import'
          };
        });

        if (newRecords.length > 0) {
          onUpdateRecords(newRecords);
          const currentRosterIdSet = new Set(records.map(r => r.id));
          const otherRosterSelected = selectedIds.filter(id => !currentRosterIdSet.has(id));
          onSelectAll([...otherRosterSelected, ...newRecords.map(r => r.id)]);
        }
      },
      error: (error) => {
        alert(`Error parsing CSV file: ${error.message}`);
      }
    });
  };

  // Export CSV Handler
  const handleExportCSV = () => {
    const dataToExport = records.filter(r => selectedIds.includes(r.id));
    if (dataToExport.length === 0) {
      alert('Please select at least one record to export.');
      return;
    }

    let exportData: any[] = dataToExport;
    if (!isDeviceMode && !isStaffMode) {
      // Export using Student Roster Sheet headers + Studio login/device fields
      exportData = dataToExport.map(r => {
        const uName = resolveMainUsername(r) || extractUsername(r.email, r.studentId);
        const devBarcode = getStudentDeviceBarcode(r, deviceRecords);
        return {
          'id': r.id,
          'studentName': r.studentName || r.fullName || '',
          'studentId': r.studentId || r.lunchId || '',
          'grade': r.grade || '03',
          'staffName': r.staffName || '',
          'password': r.password || '',
          'barcode': devBarcode || r.barcode || r.studentId || '',
          'pin': r.pin || '',
          'roomNumber': r.roomNumber || '',
          'hasSleeve': r.hasSleeve || 'No',
          'hasCharger': r.hasCharger || 'No',
          'hasLaptop': studentHasDevice(r, deviceRecords) ? 'Yes' : 'No',
          'hasHeadphones': r.hasHeadphones || 'No',
          'attendingSummerPrograms': r.attendingSummerPrograms || 'No',
          'deviceCheckedOutForSummer': r.deviceCheckedOutForSummer || 'No',
          'updatedAt': r.updatedAt || '',
          'updatedBy': r.updatedBy || '',
          'User ID': r.userId || uName,
        };
      });
    }

    const csv = Papa.unparse(exportData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `glen_forest_${isDeviceMode ? 'devices' : isStaffMode ? 'staff' : 'student'}_roster_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Inline row edit
  const handleStartEdit = (record: RecordData) => {
    setEditingId(record.id);
    if (!isStaffMode && !isDeviceMode) {
      const resolvedDeviceBarcode = getStudentDeviceBarcode(record, deviceRecords);
      setEditFormData({
        ...record,
        assetTag: resolvedDeviceBarcode,
      });
    } else {
      setEditFormData({ ...record });
    }
  };

  const handleSaveEdit = () => {
    if (!editFormData) return;
    const normalizedBarcode = normalizeBarcodeValue(editFormData.barcode);
    const normalizedAsset = normalizeBarcodeValue(editFormData.assetTag);
    const finalFormData: RecordData = {
      ...editFormData,
      barcode: normalizedBarcode || editFormData.barcode,
      assetTag: normalizedAsset || editFormData.assetTag,
    };
    const updated = records.map(r => (r.id === finalFormData.id ? finalFormData : r));
    onUpdateRecords(updated);
    setEditingId(null);
    setEditFormData(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditFormData(null);
  };

  // Delete Record
  const handleDeleteRecord = (id: string) => {
    if (confirm('Are you sure you want to delete this record?')) {
      onUpdateRecords(records.filter(r => r.id !== id));
    }
  };

  // Add Record
  const handleAddRecord = () => {
    if (isDeviceMode) {
      const newDevTag = `00981 ${Math.floor(80000 + Math.random() * 10000)}`;
      const newDevice: RecordData = {
        id: `dev_${Date.now()}`,
        studentName: `FCPS Device — Asset #${newDevTag}`,
        fullName: `FCPS Device — Asset #${newDevTag}`,
        staffName: 'Glen Forest ES Tech Dept',
        studentId: `5CG${Math.floor(1000000 + Math.random() * 9000000)}`,
        serialNumber: `5CG${Math.floor(1000000 + Math.random() * 9000000)}`,
        assetTag: newDevTag,
        barcode: newDevTag,
        make: 'HP',
        model: 'ProBook 440 G8',
        deviceType: 'Laptop',
        site: 'Glen Forest ES',
        roomNumber: 'Main Office',
        grade: 'Device',
        password: '',
        usage: 'Student Checkout',
        usability: 'Usable',
        lifecycle: 'Active',
        ownedBy: 'Fairfax County Public Schools',
        updatedAt: new Date().toISOString().split('T')[0],
        updatedBy: 'Manual'
      };
      onUpdateRecords([newDevice, ...records]);
      setEditingId(newDevice.id);
      setEditFormData(newDevice);
    } else if (isStaffMode) {
      const newStaff: RecordData = {
        id: `st_${Date.now()}`,
        studentName: 'New Staff Member',
        fullName: 'New Staff Member',
        staffName: 'New Staff Member',
        studentId: `st_${Math.floor(1000 + Math.random() * 9000)}`,
        samAccountName: `staff${Math.floor(1000 + Math.random() * 9000)}`,
        email: 'staff@fcps.edu',
        description: 'Teacher / Staff',
        role: 'Teacher / Staff',
        title: 'Teacher / Staff',
        grade: 'Staff',
        password: '',
        barcode: `${1800000 + Math.floor(Math.random() * 100000)}`,
        roomNumber: 'Main Office',
        updatedAt: new Date().toISOString().split('T')[0],
        updatedBy: 'Manual'
      };
      onUpdateRecords([newStaff, ...records]);
      setEditingId(newStaff.id);
      setEditFormData(newStaff);
    } else {
      const studentNum = `${1800000 + Math.floor(Math.random() * 100000)}`;
      const sampleUname = `std${Math.floor(10000 + Math.random() * 90000)}`;
      const newStudent: RecordData = {
        id: `rec_${Date.now()}`,
        studentName: 'New Student',
        fullName: 'New Student',
        studentId: studentNum,
        lunchId: studentNum,
        userId: sampleUname,
        username: sampleUname,
        email: `${sampleUname}@fcpsschools.net`,
        stateTestingId: '',
        grade: '03',
        staffName: 'April Marcot',
        password: `GFES#${Math.floor(1000 + Math.random() * 9000)}`,
        barcode: '',
        pin: '',
        roomNumber: '307',
        hasSleeve: 'Yes',
        hasCharger: 'Yes',
        hasLaptop: 'No',
        hasHeadphones: 'No',
        attendingSummerPrograms: 'No',
        deviceCheckedOutForSummer: 'No',
        updatedAt: new Date().toISOString().split('T')[0],
        updatedBy: 'Manual'
      };
      onUpdateRecords([newStudent, ...records]);
      setEditingId(newStudent.id);
      setEditFormData(newStudent);
    }
  };

  return (
    <div className="glass-card rounded-2xl shadow-xl flex flex-col overflow-hidden">
      {/* Top Roster Tab Switcher (Student Roster vs Staff Roster vs Devices Report) */}
      {onChangeRoster && (
        <div className="px-5 py-3 bg-slate-900/10 border-b border-white/20 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase text-slate-700 tracking-wider">Roster Category:</span>
            <div className="inline-flex p-1 bg-white/70 backdrop-blur-md rounded-xl border border-white/60 shadow-xs">
              <button
                onClick={() => onChangeRoster('students')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                  !isStaffMode && !isDeviceMode
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-700 hover:text-slate-950 hover:bg-white/50'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Student Roster ({studentCount})</span>
              </button>

              <button
                onClick={() => onChangeRoster('staff')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                  isStaffMode
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-700 hover:text-slate-950 hover:bg-white/50'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Staff Roster ({staffCount})</span>
              </button>

              <button
                onClick={() => onChangeRoster('devices')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                  isDeviceMode
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-700 hover:text-slate-950 hover:bg-white/50'
                }`}
              >
                <Laptop className="w-3.5 h-3.5" />
                <span>Devices & Inventory ({deviceCount})</span>
              </button>
            </div>
          </div>

          <div className="text-xs text-slate-600 font-medium">
            {isDeviceMode ? (
              <span className="bg-emerald-100 text-emerald-950 font-bold px-2.5 py-1 rounded-md border border-emerald-300">
                Brother P-Touch Reports: Search by <strong>AssetTag & SerialNumber</strong> (Headers on Row 7 supported)
              </span>
            ) : isStaffMode ? (
              <span className="bg-amber-100 text-amber-900 font-bold px-2.5 py-1 rounded-md border border-amber-200">
                Staff CSV Fields: <strong>FullName, Description (Title/Role), SAMAccountName, Email</strong>
              </span>
            ) : (
              <span className="bg-indigo-100 text-indigo-900 font-bold px-2.5 py-1 rounded-md border border-indigo-200">
                Roster Sheet: <strong>id, studentName, studentId, grade, staffName, password, barcode, pin, roomNumber</strong> • Student ID (Barcode) = studentId
              </span>
            )}
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="p-4 border-b border-white/30 bg-white/30 flex flex-wrap items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[260px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={
              isDeviceMode
                ? "Search AssetTag, SerialNumber, Make, Model, Type, Room..."
                : isStaffMode
                ? "Search staff name, title/role, SAM account, email..."
                : "Search student name, ID, PIN, staff, room, password..."
            }
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 glass-input rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs font-medium"
          />
        </div>

        {/* Filters (Student Mode Only) */}
        {!isStaffMode && !isDeviceMode && (
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 text-xs text-slate-700 font-bold">
              <Filter className="w-3.5 h-3.5 text-indigo-600" />
              <span>Grade:</span>
            </div>
            <select
              value={filterGrade}
              onChange={(e) => setFilterGrade(e.target.value)}
              className="px-3 py-1.5 glass-input rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs cursor-pointer"
            >
              <option value="all">All Grades ({records.length})</option>
              {uniqueGrades.map(g => {
                const count = records.filter(r => {
                  const rGrade = (r.grade || '').toString().trim().toLowerCase();
                  const fGrade = g.toString().trim().toLowerCase();
                  return (
                    rGrade === fGrade ||
                    rGrade.replace(/^0+/, '') === fGrade.replace(/^0+/, '') ||
                    rGrade === `grade ${fGrade}` ||
                    rGrade === `gr ${fGrade}` ||
                    `grade ${rGrade}` === fGrade
                  );
                }).length;
                const isExcluded = isExcludedGrade(g);
                return (
                  <option key={g} value={g}>
                    Grade {g} ({count}){isExcluded ? ' — Non-Print (PS/HS/00)' : ''}
                  </option>
                );
              })}
            </select>

            <div className="flex items-center gap-1 text-xs text-slate-700 font-bold ml-1">
              <span>Teacher:</span>
            </div>
            <select
              value={filterStaff}
              onChange={(e) => {
                setFilterStaff(e.target.value);
                onSelectTeacherForPrint?.(e.target.value);
              }}
              className="px-3 py-1.5 glass-input rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs cursor-pointer"
            >
              <option value="all">All Teachers</option>
              {uniqueStaff.map(s => {
                const count = records.filter(r => {
                  const rStaff = (r.staffName || '').trim().toLowerCase();
                  const fStaff = s.trim().toLowerCase();
                  return rStaff === fStaff || extractTeacherLastName(r.staffName).toLowerCase() === extractTeacherLastName(s).toLowerCase();
                }).length;
                return (
                  <option key={s} value={s}>
                    {s} ({count})
                  </option>
                );
              })}
            </select>

            {(filterGrade !== 'all' || filterStaff !== 'all' || searchTerm.trim() !== '') && (
              <button
                onClick={() => {
                  setFilterGrade('all');
                  setFilterStaff('all');
                  onSelectTeacherForPrint?.('all');
                  setSearchTerm('');
                }}
                className="text-xs text-indigo-700 hover:text-indigo-900 font-bold underline px-1 cursor-pointer"
              >
                Reset filters
              </button>
            )}
          </div>
        )}

        {/* Primary Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Add Record */}
          <button
            onClick={handleAddRecord}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer hover:shadow-md"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{isDeviceMode ? 'Add Device' : isStaffMode ? 'Add Staff' : 'Add Student'}</span>
          </button>

          {/* Import CSV / TSV */}
          <label className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white/80 hover:bg-white text-slate-700 border border-white/60 rounded-xl text-xs font-semibold cursor-pointer shadow-2xs transition-all">
            <Upload className="w-3.5 h-3.5 text-slate-500" />
            <span>{isDeviceMode ? 'Import Inventory Report CSV' : isStaffMode ? 'Import Staff CSV' : 'Import CSV / TSV'}</span>
            <input
              type="file"
              accept=".csv,.tsv,.txt"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>

          {/* SIS Sync (Student Roster Export) */}
          {!isStaffMode && !isDeviceMode && (
            <button
              type="button"
              onClick={() => setSyncModalMode('sis')}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-teal-500/15 border border-teal-500/35 hover:bg-teal-500/25 text-teal-950 rounded-xl text-xs font-bold shadow-2xs transition-all cursor-pointer"
              title="Sync against SIS student export (Student Name, Student ID, State Testing ID, Last/First Name, Grade, Staff Name, Room Name, User ID)"
            >
              <RefreshCw className="w-3.5 h-3.5 text-teal-700" />
              <span>SIS Sync</span>
            </button>
          )}

          {/* Sync System Data (Passwords & PINs) */}
          {!isStaffMode && !isDeviceMode && (
            <button
              type="button"
              onClick={() => setSyncModalMode('system')}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-500/15 border border-amber-500/35 hover:bg-amber-500/25 text-amber-950 rounded-xl text-xs font-bold shadow-2xs transition-all cursor-pointer"
              title="Sync passwords, PINs, user IDs, and equipment from an external system export"
            >
              <RefreshCw className="w-3.5 h-3.5 text-amber-700" />
              <span>Sync System Data</span>
            </button>
          )}

          {/* Google Drive Import */}
          <button
            onClick={onOpenDriveModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 text-emerald-900 rounded-xl text-xs font-bold shadow-2xs transition-all cursor-pointer"
          >
            <HardDrive className="w-3.5 h-3.5 text-emerald-600" />
            <span>Google Drive</span>
          </button>

          {/* Export CSV */}
          <button
            onClick={handleExportCSV}
            disabled={records.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white/80 hover:bg-white disabled:opacity-40 disabled:pointer-events-none text-slate-700 border border-white/60 rounded-xl text-xs font-semibold cursor-pointer shadow-2xs transition-all"
            title="Export selected records to CSV"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export CSV</span>
          </button>

          {/* Clear Roster */}
          {records.length > 0 && (
            <button
              onClick={onClearRoster}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-500/10 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              title="Clear all records from this roster"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Roster</span>
            </button>
          )}
        </div>
      </div>

      {/* Selection Stats Bar */}
      <div className="px-4 py-2.5 bg-indigo-500/10 border-b border-indigo-500/10 flex items-center justify-between text-xs text-indigo-950 font-medium flex-wrap gap-2">
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={handleToggleSelectFilteredAll}
            className="inline-flex items-center gap-1.5 font-bold text-indigo-800 hover:text-indigo-950 cursor-pointer"
          >
            {allFilteredSelected ? (
              <CheckSquare className="w-4 h-4 text-indigo-600" />
            ) : (
              <Square className="w-4 h-4 text-slate-400" />
            )}
            <span>
              {allFilteredSelected ? 'Deselect Filtered' : `Select Filtered (${filteredRecords.length})`}
            </span>
          </button>

          {(filterGrade !== 'all' || filterStaff !== 'all' || searchTerm.trim() !== '') && (
            <button
              onClick={handleSelectOnlyFiltered}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-2xs cursor-pointer shadow-2xs"
            >
              <span>Select ONLY This {filterGrade !== 'all' ? `Grade ${filterGrade}` : 'Filter'} ({filteredRecords.length})</span>
            </button>
          )}

          {!isStaffMode && !isDeviceMode && onToggleExcludeNonPrintable && (
            <label
              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/80 hover:bg-white border border-indigo-200 rounded-lg font-bold text-xs text-slate-800 cursor-pointer shadow-2xs select-none"
              title="When enabled, students in grades PS, HS, and 00 are excluded from printing and grade badges"
            >
              <input
                type="checkbox"
                checked={excludeNonPrintableGrades}
                onChange={(e) => onToggleExcludeNonPrintable(e.target.checked)}
                className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
              <span>Exclude Non-Printable Grades (PS, HS, 00)</span>
            </label>
          )}

          {!isStaffMode && !isDeviceMode && records.some(r => isExcludedGrade(r.grade)) && (
            <button
              onClick={handleSelectPrintableStudents}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-2xs cursor-pointer shadow-2xs"
              title="Select only students with printable grades (excludes non-grades PS, HS, 00)"
            >
              <span>Select Printable Grades Only ({printableStudentRecords.length})</span>
            </button>
          )}

          {!isStaffMode && !isDeviceMode && (
            <button
              type="button"
              onClick={() => setShowCredentials(prev => !prev)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold text-xs border cursor-pointer shadow-2xs transition-colors ${
                showCredentials
                  ? 'bg-indigo-600 text-white border-indigo-700 hover:bg-indigo-700'
                  : 'bg-white/80 text-slate-700 border-slate-300 hover:bg-white'
              }`}
              title="Toggle visibility of student PINs & Passwords in the table (printing uses Print Settings)"
            >
              {showCredentials ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>{showCredentials ? 'Hide PINs & Passwords' : 'Show PINs & Passwords'}</span>
            </button>
          )}

          <span className="text-slate-300">|</span>
          <span>
            Showing <strong className="text-indigo-950 font-extrabold">{filteredRecords.length}</strong> of {records.length} records
          </span>
          <span className="text-slate-300">|</span>
          <span>
            Selected for Printing: <strong className="text-indigo-950 font-extrabold">{selectedIds.length}</strong>
          </span>
        </div>

        {selectedIds.length > 0 && (
          <button
            onClick={onDeselectAll}
            className="text-xs text-indigo-700 hover:underline font-bold cursor-pointer"
          >
            Clear All Selected ({selectedIds.length})
          </button>
        )}
      </div>

      {/* Data Table */}
      <div className="overflow-x-auto max-h-[480px]">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="bg-white/60 backdrop-blur-md text-slate-700 font-bold sticky top-0 z-10 border-b border-white/40">
            {isDeviceMode ? (
              <tr>
                <th className="p-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={handleToggleSelectFilteredAll}
                    className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                </th>
                <th className="p-3">Asset Tag (Barcode)</th>
                <th className="p-3">Serial Number</th>
                <th className="p-3">Make & Model</th>
                <th className="p-3">Device Type</th>
                <th className="p-3">Site / Room</th>
                <th className="p-3">Usage</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            ) : isStaffMode ? (
              <tr>
                <th className="p-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={handleToggleSelectFilteredAll}
                    className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                </th>
                <th className="p-3">Full Name (FullName)</th>
                <th className="p-3">Title / Role (Description)</th>
                <th className="p-3">Email</th>
                <th className="p-3">SAM Account Name</th>
                <th className="p-3">Room / Location</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            ) : (
              <tr>
                <th className="p-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={handleToggleSelectFilteredAll}
                    className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                </th>
                <th className="p-3">Student Name</th>
                <th className="p-3">ID / Lunch ID</th>
                <th className="p-3">User ID / Main Username</th>
                <th className="p-3">Grade</th>
                <th className="p-3">Teacher / Staff</th>
                <th className="p-3">
                  <button
                    type="button"
                    onClick={() => setShowCredentials(prev => !prev)}
                    className="inline-flex items-center gap-1 hover:text-indigo-700 cursor-pointer"
                    title={showCredentials ? 'Hide PINs & Passwords' : 'Show PINs & Passwords'}
                  >
                    <span>PIN</span>
                    {showCredentials ? <EyeOff className="w-3 h-3 text-indigo-600" /> : <Eye className="w-3 h-3 text-slate-400" />}
                  </button>
                </th>
                <th className="p-3">
                  <button
                    type="button"
                    onClick={() => setShowCredentials(prev => !prev)}
                    className="inline-flex items-center gap-1 hover:text-indigo-700 cursor-pointer"
                    title={showCredentials ? 'Hide PINs & Passwords' : 'Show PINs & Passwords'}
                  >
                    <span>Password</span>
                    {showCredentials ? <EyeOff className="w-3 h-3 text-indigo-600" /> : <Eye className="w-3 h-3 text-slate-400" />}
                  </button>
                </th>
                <th className="p-3" title="Student ID (Barcode) corresponds to ID / Lunch ID (studentId) on the spreadsheet">
                  Student ID (Barcode)
                </th>
                <th className="p-3">Room</th>
                <th className="p-3 text-center" title="10-digit leading-zero device barcode correlated to barcode / studentId">
                  Device Barcode
                </th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            )}
          </thead>
          <tbody className="divide-y divide-white/20 text-slate-800">
            {filteredRecords.length === 0 ? (
              <tr>
                <td colSpan={12} className="p-12 text-center text-slate-500">
                  <div className="max-w-md mx-auto flex flex-col items-center">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mb-3">
                      <FileSpreadsheet className="w-6 h-6 text-indigo-600" />
                    </div>
                    <p className="font-bold text-sm text-slate-800">
                      {records.length === 0
                        ? `No ${isDeviceMode ? 'device' : isStaffMode ? 'staff' : 'student'} records imported yet`
                        : `No matching records found`}
                    </p>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm">
                      {records.length === 0
                        ? `Import your ${isDeviceMode ? 'inventory report' : isStaffMode ? 'staff directory' : 'student roster'} CSV or connect via Google Drive to start generating labels.`
                        : `Try clearing your search query or filters to see all imported records.`}
                    </p>

                    {records.length === 0 && (
                      <div className="flex items-center justify-center gap-2.5 mt-4 flex-wrap">
                        <label className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer shadow-sm hover:shadow-md transition-all">
                          <Upload className="w-3.5 h-3.5" />
                          <span>Import CSV / TSV File</span>
                          <input
                            type="file"
                            accept=".csv,.tsv,.txt"
                            onChange={handleFileUpload}
                            className="hidden"
                          />
                        </label>
                        <button
                          onClick={onOpenDriveModal}
                          className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer shadow-sm hover:shadow-md transition-all"
                        >
                          <HardDrive className="w-3.5 h-3.5" />
                          <span>Google Drive Import</span>
                        </button>
                        <button
                          onClick={handleAddRecord}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold cursor-pointer shadow-2xs transition-all"
                        >
                          <Plus className="w-3.5 h-3.5 text-slate-500" />
                          <span>Add Manually</span>
                        </button>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              filteredRecords.map((record) => {
                const isSelected = selectedIds.includes(record.id);
                const isEditing = editingId === record.id;

                if (isEditing && editFormData) {
                  return (
                    <tr key={record.id} className="bg-amber-500/10 backdrop-blur-xs">
                      <td className="p-3 text-center">
                        <CheckSquare className="w-4 h-4 text-amber-600 mx-auto" />
                      </td>
                      {isDeviceMode ? (
                        <>
                          <td className="p-2">
                            <input
                              type="text"
                              value={editFormData.assetTag || editFormData.barcode || ''}
                              onChange={(e) =>
                                setEditFormData({
                                  ...editFormData,
                                  assetTag: e.target.value,
                                  barcode: e.target.value
                                })
                              }
                              className="w-28 px-2 py-1 glass-input rounded text-xs font-mono font-bold"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={editFormData.serialNumber || editFormData.studentId || ''}
                              onChange={(e) =>
                                setEditFormData({
                                  ...editFormData,
                                  serialNumber: e.target.value,
                                  studentId: e.target.value
                                })
                              }
                              className="w-28 px-2 py-1 glass-input rounded text-xs font-mono"
                            />
                          </td>
                          <td className="p-2 flex gap-1">
                            <input
                              type="text"
                              placeholder="Make"
                              value={editFormData.make || ''}
                              onChange={(e) => setEditFormData({ ...editFormData, make: e.target.value })}
                              className="w-16 px-1.5 py-1 glass-input rounded text-xs"
                            />
                            <input
                              type="text"
                              placeholder="Model"
                              value={editFormData.model || ''}
                              onChange={(e) => setEditFormData({ ...editFormData, model: e.target.value })}
                              className="w-24 px-1.5 py-1 glass-input rounded text-xs"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={editFormData.deviceType || ''}
                              onChange={(e) => setEditFormData({ ...editFormData, deviceType: e.target.value })}
                              className="w-20 px-2 py-1 glass-input rounded text-xs"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={editFormData.roomNumber || ''}
                              onChange={(e) => setEditFormData({ ...editFormData, roomNumber: e.target.value })}
                              className="w-20 px-2 py-1 glass-input rounded text-xs"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={editFormData.usage || ''}
                              onChange={(e) => setEditFormData({ ...editFormData, usage: e.target.value })}
                              className="w-24 px-2 py-1 glass-input rounded text-xs"
                            />
                          </td>
                        </>
                      ) : isStaffMode ? (
                        <>
                          <td className="p-2">
                            <input
                              type="text"
                              value={editFormData.fullName || editFormData.studentName}
                              onChange={(e) => setEditFormData({ ...editFormData, fullName: e.target.value, studentName: e.target.value, staffName: e.target.value })}
                              className="w-full px-2 py-1 glass-input rounded text-xs font-semibold"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={editFormData.description || editFormData.role || editFormData.title || ''}
                              onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value, role: e.target.value, title: e.target.value })}
                              className="w-full px-2 py-1 glass-input rounded text-xs"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={editFormData.email || ''}
                              onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                              className="w-full px-2 py-1 glass-input rounded text-xs"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={editFormData.samAccountName || editFormData.studentId || ''}
                              onChange={(e) => setEditFormData({ ...editFormData, samAccountName: e.target.value, studentId: e.target.value })}
                              className="w-24 px-2 py-1 glass-input rounded text-xs font-mono"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={editFormData.roomNumber}
                              onChange={(e) => setEditFormData({ ...editFormData, roomNumber: e.target.value })}
                              className="w-20 px-2 py-1 glass-input rounded text-xs"
                            />
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="p-2">
                            <input
                              type="text"
                              value={editFormData.studentName}
                              onChange={(e) => setEditFormData({ ...editFormData, studentName: e.target.value, fullName: e.target.value })}
                              className="w-full px-2 py-1 glass-input rounded text-xs font-semibold"
                              placeholder="Student Name"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={editFormData.lunchId || editFormData.studentId || ''}
                              onChange={(e) => setEditFormData({ ...editFormData, studentId: e.target.value, lunchId: e.target.value })}
                              className="w-24 px-2 py-1 glass-input rounded text-xs font-mono font-bold text-amber-950"
                              placeholder="Lunch ID"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={editFormData.userId || editFormData.username || ''}
                              onChange={(e) => {
                                const newU = e.target.value;
                                setEditFormData({
                                  ...editFormData,
                                  userId: newU,
                                  username: newU,
                                  email: newU ? `${newU}@fcpsschools.net` : editFormData.email
                                });
                              }}
                              className="w-28 px-2 py-1 glass-input rounded text-xs font-mono font-bold text-indigo-950"
                              placeholder="User ID / Username"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={editFormData.grade}
                              onChange={(e) => setEditFormData({ ...editFormData, grade: e.target.value })}
                              className="w-12 px-2 py-1 glass-input rounded text-xs text-center"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={editFormData.staffName}
                              onChange={(e) => setEditFormData({ ...editFormData, staffName: e.target.value })}
                              className="w-full px-2 py-1 glass-input rounded text-xs"
                              placeholder="Teacher"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={editFormData.pin || ''}
                              onChange={(e) => setEditFormData({ ...editFormData, pin: e.target.value })}
                              className="w-20 px-2 py-1 glass-input rounded text-xs font-mono text-blue-950 font-bold"
                              placeholder="PIN"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={editFormData.password}
                              onChange={(e) => setEditFormData({ ...editFormData, password: e.target.value })}
                              className="w-24 px-2 py-1 glass-input rounded text-xs font-mono text-indigo-950 font-bold"
                              placeholder="Password"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={editFormData.studentId || editFormData.lunchId || ''}
                              onChange={(e) =>
                                setEditFormData({
                                  ...editFormData,
                                  studentId: e.target.value,
                                  lunchId: e.target.value,
                                })
                              }
                              className="w-24 px-2 py-1 glass-input rounded text-xs font-mono"
                              placeholder="studentId"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={editFormData.roomNumber}
                              onChange={(e) => setEditFormData({ ...editFormData, roomNumber: e.target.value })}
                              className="w-16 px-2 py-1 glass-input rounded text-xs"
                              placeholder="Room"
                            />
                          </td>
                          <td className="p-2 text-center">
                            <input
                              type="text"
                              value={editFormData.assetTag || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setEditFormData({
                                  ...editFormData,
                                  barcode: val,
                                  assetTag: val,
                                  hasLaptop: isValidDeviceBarcode(val, editFormData) ? 'Yes' : 'No',
                                });
                              }}
                              className="w-28 px-2 py-1 glass-input rounded text-xs font-mono text-center"
                              placeholder="0098184741"
                            />
                          </td>
                        </>
                      )}
                      <td className="p-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={handleSaveEdit}
                            className="p-1 bg-emerald-600 text-white rounded hover:bg-emerald-700 cursor-pointer shadow-2xs"
                            title="Save changes"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="p-1 bg-slate-300 text-slate-700 rounded hover:bg-slate-400 cursor-pointer shadow-2xs"
                            title="Cancel edit"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }

                if (isDeviceMode) {
                  const tagDisplay = record.assetTag || record.barcode || '—';
                  const snDisplay = record.serialNumber || record.studentId || '—';

                  return (
                    <tr
                      key={record.id}
                      className={`hover:bg-white/40 transition-colors ${
                        isSelected ? 'bg-emerald-500/10' : ''
                      }`}
                    >
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => onToggleSelect(record.id)}
                          className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                      </td>
                      <td className="p-3 font-mono font-black text-slate-950">
                        <span className="inline-flex items-center gap-1 bg-indigo-100 text-indigo-950 px-2.5 py-0.5 rounded-md border border-indigo-200">
                          <Barcode className="w-3 h-3 text-indigo-600" />
                          <span>{tagDisplay}</span>
                        </span>
                      </td>
                      <td className="p-3 font-mono font-bold text-slate-800">
                        <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          {snDisplay}
                        </span>
                      </td>
                      <td className="p-3 font-semibold text-slate-900">
                        {record.make || record.model ? `${record.make || ''} ${record.model || ''}`.trim() : record.description || 'FCPS Device'}
                      </td>
                      <td className="p-3">
                        <span className="inline-block px-2 py-0.5 bg-emerald-500/15 text-emerald-950 rounded font-bold text-[11px] border border-emerald-500/20">
                          {record.deviceType || 'Laptop'}
                        </span>
                      </td>
                      <td className="p-3 text-slate-800 font-medium">
                        {record.roomNumber || 'Main Office'} {record.site ? `(${record.site})` : ''}
                      </td>
                      <td className="p-3 text-slate-600 text-[11px]">
                        <div>{record.usage || 'Student Checkout'}</div>
                        {(record.studentId || record.samAccountName || record.userId) && (
                          <div className="text-[10px] font-mono font-bold text-indigo-800 mt-0.5">
                            Assigned ID: {record.studentId || record.samAccountName || record.userId}
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {onQuickPrintDevice && (
                            <button
                              onClick={() => onQuickPrintDevice(record.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer"
                              title="Print Brother P-Touch barcode label"
                            >
                              <Printer className="w-3 h-3" />
                              <span>Print Label</span>
                            </button>
                          )}
                          <button
                            onClick={() => handleStartEdit(record)}
                            className="p-1 text-slate-500 hover:text-indigo-700 hover:bg-white/60 rounded-lg cursor-pointer transition-all"
                            title="Edit device record"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteRecord(record.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-500/10 rounded-lg cursor-pointer transition-all"
                            title="Delete device record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }

                if (isStaffMode) {
                  return (
                    <tr
                      key={record.id}
                      className={`hover:bg-white/40 transition-colors ${
                        isSelected ? 'bg-indigo-500/10' : ''
                      }`}
                    >
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => onToggleSelect(record.id)}
                          className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                      </td>
                      <td className="p-3 font-bold text-slate-950">
                        {record.fullName || record.studentName || record.staffName}
                      </td>
                      <td className="p-3">
                        <span className="inline-block px-2.5 py-0.5 bg-indigo-100/90 text-indigo-950 rounded-md font-bold text-xs border border-indigo-200">
                          {record.description || record.role || record.title || 'Staff Member'}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-slate-600 text-[11px]">
                        {record.email || '—'}
                      </td>
                      <td className="p-3 font-mono font-bold text-indigo-900">
                        {record.samAccountName || record.studentId || '—'}
                      </td>
                      <td className="p-3 text-slate-800 font-medium">
                        {record.roomNumber || 'Main Office'}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleStartEdit(record)}
                            className="p-1 text-slate-500 hover:text-indigo-700 hover:bg-white/60 rounded-lg cursor-pointer transition-all"
                            title="Edit staff record"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteRecord(record.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-500/10 rounded-lg cursor-pointer transition-all"
                            title="Delete record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }

                const studentLunchId = record.studentId || record.lunchId || '—';
                const resolvedUser = resolveMainUsername(record);
                const studentUsername = resolvedUser || '—';
                const studentBarcode = getStudentDeviceBarcode(record, deviceRecords);
                const hasDevice = Boolean(studentBarcode);

                return (
                  <tr
                    key={record.id}
                    className={`hover:bg-white/40 transition-colors ${
                      isSelected ? 'bg-indigo-500/10' : ''
                    }`}
                  >
                    <td className="p-3 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleSelect(record.id)}
                        className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                    </td>
                    <td className="p-3 font-semibold text-slate-900">
                      <div>{record.studentName}</div>
                      {record.email && (
                        <div className="text-[10px] text-slate-400 font-mono">{record.email}</div>
                      )}
                    </td>
                    <td className="p-3">
                      <span className="inline-block px-2 py-0.5 bg-amber-50 text-amber-950 rounded font-mono font-bold text-xs border border-amber-200">
                        {studentLunchId}
                      </span>
                    </td>
                    <td className="p-3">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(record)}
                        title="Click to edit User ID / Main Username"
                        className="inline-block px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-950 rounded font-mono font-bold text-xs border border-indigo-200 cursor-pointer transition-colors"
                      >
                        {studentUsername}
                      </button>
                      {record.userId && record.studentId && record.userId !== record.studentId && (
                        <div className="text-[9px] text-indigo-700 font-semibold mt-0.5">
                          Main Username (User ID ≠ ID)
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      <span className="inline-block px-2 py-0.5 bg-white/60 text-slate-800 rounded font-semibold border border-white/40 shadow-2xs">
                        {record.grade || '—'}
                      </span>
                    </td>
                    <td className="p-3 text-slate-700 font-medium">
                      {record.staffName || '—'}
                    </td>
                    <td className="p-3 font-mono text-xs font-bold">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(record)}
                        title={showCredentials ? 'Click to edit iPad PIN' : 'Hidden on screen — click Show PINs & Passwords or click to edit'}
                        className={`px-2 py-0.5 rounded-lg border cursor-pointer transition-colors ${
                          record.pin
                            ? 'bg-blue-500/15 text-blue-950 border-blue-500/25 hover:bg-blue-500/25'
                            : 'bg-slate-100 text-slate-400 border-slate-200 hover:text-blue-700 hover:border-blue-300'
                        }`}
                      >
                        {record.pin ? (showCredentials ? record.pin : '••••') : '+ PIN'}
                      </button>
                    </td>
                    <td className="p-3 font-mono text-xs font-bold text-indigo-900">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(record)}
                        title={showCredentials ? 'Click to edit Password' : 'Hidden on screen — click Show PINs & Passwords or click to edit'}
                        className="bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-900 px-2 py-0.5 rounded-lg border border-indigo-500/20 cursor-pointer transition-colors"
                      >
                        {record.password ? (showCredentials ? record.password : '••••••••') : '—'}
                      </button>
                    </td>
                    <td className="p-3 font-mono text-slate-700">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(record)}
                        title="Student ID (Barcode) = studentId / Lunch ID on spreadsheet"
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs border font-mono cursor-pointer transition-colors bg-slate-100 hover:bg-slate-200 text-slate-900 border-slate-300 font-bold"
                      >
                        <Barcode className="w-3 h-3 text-indigo-600" />
                        <span>{studentLunchId}</span>
                      </button>
                    </td>
                    <td className="p-3 text-slate-800 font-medium">
                      {record.roomNumber || '—'}
                    </td>
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(record)}
                        title={
                          hasDevice
                            ? `Device Barcode from barcode column / lookup (${studentBarcode}) — click to edit`
                            : 'No device barcode found — click to enter device barcode'
                        }
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold font-mono border cursor-pointer transition-colors ${
                          hasDevice
                            ? 'bg-emerald-500/15 text-emerald-900 border-emerald-500/30 hover:bg-emerald-500/25'
                            : 'bg-slate-200/80 text-slate-600 border-slate-300 hover:bg-indigo-50 hover:text-indigo-800 hover:border-indigo-300'
                        }`}
                      >
                        <Laptop className="w-3 h-3 shrink-0" />
                        <span>
                          {hasDevice ? studentBarcode : 'No Barcode'}
                        </span>
                      </button>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleStartEdit(record)}
                          className="p-1 text-slate-500 hover:text-indigo-700 hover:bg-white/60 rounded-lg cursor-pointer transition-all"
                          title="Edit record"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteRecord(record.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-500/10 rounded-lg cursor-pointer transition-all"
                          title="Delete record"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* External System & SIS Sync Modal (Dual-Key Student ID + User ID Matching) */}
      <SyncRosterModal
        isOpen={syncModalMode !== null && !isStaffMode && !isDeviceMode}
        mode={syncModalMode || 'system'}
        onClose={() => setSyncModalMode(null)}
        existingRecords={records}
        onApplySync={(updatedRecords) => {
          onUpdateRecords(updatedRecords);
          const addedIds = updatedRecords
            .filter((u) => !records.some((r) => r.id === u.id))
            .map((u) => u.id);
          if (addedIds.length > 0) {
            onSelectAll([...selectedIds, ...addedIds]);
          }
        }}
      />
    </div>
  );
};
