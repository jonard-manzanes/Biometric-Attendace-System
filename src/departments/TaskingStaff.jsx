import React, { useEffect, useState } from 'react';
import { db } from '../firebaseConfig';
import { collection, getDocs, doc, setDoc, query, where, deleteDoc } from 'firebase/firestore';
import { format } from 'date-fns';
import { Search, ChevronDown, ChevronUp, Calendar, User, Clock } from 'lucide-react';

const TaskingStaff = () => {
  const [classes, setClasses] = useState([]);
  const [staffMembers, setStaffMembers] = useState([]);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [assignments, setAssignments] = useState({});
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'className', direction: 'ascending' });
  const [expandedClass, setExpandedClass] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      
      // Fetch all classes
      const classesSnapshot = await getDocs(collection(db, 'classes'));
      const allClasses = classesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setClasses(allClasses);

      // Fetch all staff members
      const staffQuery = query(
        collection(db, 'users'),
        where('role', '==', 'staff')
      );
      const staffSnapshot = await getDocs(staffQuery);
      const allStaff = staffSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setStaffMembers(allStaff);

      // Load existing assignments for selected date
      const assignmentsQuery = query(
        collection(db, 'verificationTasks'),
        where('date', '==', selectedDate)
      );
      const assignmentsSnapshot = await getDocs(assignmentsQuery);
      
      const assignmentsMap = {};
      assignmentsSnapshot.forEach(doc => {
        const data = doc.data();
        assignmentsMap[data.classId] = data.staffId; // Store only one staff per class
      });
      setAssignments(assignmentsMap);

      setLoading(false);
    };

    fetchData();
  }, [selectedDate]);

  const handleAssignment = async (classId, staffId) => {
    const taskId = `${classId}_${selectedDate}`;
    const taskRef = doc(db, 'verificationTasks', taskId);

    // Check if assignment already exists for this class
    const currentAssignment = assignments[classId];

    try {
      if (currentAssignment === staffId) {
        // Remove assignment if clicking the same staff
        await deleteDoc(taskRef);
        setAssignments(prev => {
          const newAssignments = {...prev};
          delete newAssignments[classId];
          return newAssignments;
        });
      } else {
        // Add/update assignment
        await setDoc(taskRef, {
          classId,
          staffId,
          date: selectedDate,
          assignedAt: new Date().toISOString(),
          assignedBy: JSON.parse(localStorage.getItem('user')).docId
        });
        setAssignments(prev => ({
          ...prev,
          [classId]: staffId
        }));
      }
    } catch (error) {
      console.error('Error updating assignment:', error);
    }
  };

  const getClassSchedule = (cls) => {
    const day = format(new Date(selectedDate), 'EEEE');
    return cls.schedule?.find(s => s.day === day);
  };

  const requestSort = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const renderSortIndicator = (key) => {
    if (sortConfig.key !== key) return null;
    return sortConfig.direction === 'ascending' ? 
      <ChevronUp size={16} className="inline ml-1" /> : 
      <ChevronDown size={16} className="inline ml-1" />;
  };

  const toggleExpandClass = (classId) => {
    setExpandedClass(expandedClass === classId ? null : classId);
  };

  // Apply sorting and filtering
  const sortedAndFilteredClasses = React.useMemo(() => {
    let filteredClasses = [...classes];
    
    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filteredClasses = filteredClasses.filter(cls => 
        cls.subjectName?.toLowerCase().includes(term) || 
        cls.id?.toLowerCase().includes(term)
      );
    }
    
    // Apply sorting
    if (sortConfig.key) {
      filteredClasses.sort((a, b) => {
        let aValue, bValue;
        
        if (sortConfig.key === 'className') {
          aValue = a.subjectName?.toLowerCase() || '';
          bValue = b.subjectName?.toLowerCase() || '';
        } else if (sortConfig.key === 'schedule') {
          const aSchedule = getClassSchedule(a);
          const bSchedule = getClassSchedule(b);
          aValue = aSchedule ? aSchedule.start : '';
          bValue = bSchedule ? bSchedule.start : '';
        } else {
          aValue = a[sortConfig.key]?.toString().toLowerCase() || '';
          bValue = b[sortConfig.key]?.toString().toLowerCase() || '';
        }
        
        if (aValue < bValue) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    
    return filteredClasses;
  }, [classes, searchTerm, sortConfig, selectedDate]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div>

      {/* Stats summary */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-blue-500 rounded-md p-3">
                <User className="text-white" size={20} />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total Classes</dt>
                  <dd className="flex items-baseline">
                    <div className="text-2xl font-semibold text-gray-900">{classes.length}</div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-emerald-500 rounded-md p-3">
                <User className="text-white" size={20} />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Assigned Classes</dt>
                  <dd className="flex items-baseline">
                    <div className="text-2xl font-semibold text-gray-900">
                      {Object.keys(assignments).length}
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-purple-500 rounded-md p-3">
                <User className="text-white" size={20} />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Available Staff</dt>
                  <dd className="flex items-baseline">
                    <div className="text-2xl font-semibold text-gray-900">
                      {staffMembers.length}
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="text-gray-400" size={18} />
            </div>
            <input
              type="text"
              placeholder="Search classes..."
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Calendar className="text-gray-400" size={18} />
            </div>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
            />
          </div>
        </div>
      </div>
      
      {/* Classes table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th 
                  scope="col" 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => requestSort('className')}
                >
                  <div className="flex items-center">
                    Class
                    {renderSortIndicator('className')}
                  </div>
                </th>
                <th 
                  scope="col" 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => requestSort('schedule')}
                >
                  <div className="flex items-center">
                    Schedule
                    {renderSortIndicator('schedule')}
                  </div>
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Assigned Staff
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedAndFilteredClasses.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-6 py-4 text-center text-gray-500">
                    No classes found
                  </td>
                </tr>
              ) : (
                sortedAndFilteredClasses.map(cls => {
                  const schedule = getClassSchedule(cls);
                  const assignedStaffId = assignments[cls.id];
                  const assignedStaff = assignedStaffId 
                    ? staffMembers.find(s => s.id === assignedStaffId)
                    : null;

                  return (
                    <React.Fragment key={cls.id}>
                      <tr 
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => toggleExpandClass(cls.id)}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                              <User size={18} />
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">
                                {cls.subjectName}
                              </div>
                              <div className="text-sm text-gray-500">
                                {cls.id}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {schedule ? (
                            <div className="flex items-center">
                              <Clock className="text-gray-400 mr-2" size={16} />
                              <span className="text-sm text-gray-900">
                                {schedule.start} - {schedule.end}
                              </span>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-500">No schedule</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {assignedStaff ? (
                            <div className="flex items-center">
                              <div className="flex-shrink-0 h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                                <User size={14} />
                              </div>
                              <div className="ml-3">
                                <div className="text-sm font-medium text-gray-900">
                                  {assignedStaff.firstName} {assignedStaff.lastName}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-500">Not assigned</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (assignedStaffId) {
                                handleAssignment(cls.id, assignedStaffId);
                              }
                            }}
                            className={`px-3 py-1 rounded-md text-sm ${
                              assignedStaffId 
                                ? 'bg-red-100 text-red-800 hover:bg-red-200' 
                                : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                            }`}
                          >
                            {assignedStaffId ? 'Unassign' : 'Assign'}
                          </button>
                        </td>
                      </tr>
                      {expandedClass === cls.id && (
                        <tr className="bg-gray-50">
                          <td colSpan="4" className="px-6 py-4">
                            <div>
                              <h3 className="text-sm font-medium text-gray-500 mb-2">Available Staff</h3>
                              <div className="flex flex-wrap gap-2">
                                {staffMembers.map(staff => {
                                  const isAssigned = assignedStaffId === staff.id;
                                  return (
                                    <button
                                      key={staff.id}
                                      onClick={() => handleAssignment(cls.id, staff.id)}
                                      className={`flex items-center px-3 py-2 rounded-md text-sm ${
                                        isAssigned 
                                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                          : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                                      }`}
                                    >
                                      <div className="flex-shrink-0 h-6 w-6 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 mr-2">
                                        <User size={12} />
                                      </div>
                                      {staff.firstName} {staff.lastName}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      
    </div>
  );
};

export default TaskingStaff;