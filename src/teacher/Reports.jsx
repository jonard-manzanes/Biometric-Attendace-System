import React, { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { Calendar, Check, X, Users, BookOpen, ChevronDown, ChevronUp } from 'lucide-react';

const Reports = ({ currentUser }) => {
  const [classes, setClasses] = useState([]);
  const [attendanceData, setAttendanceData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedClass, setExpandedClass] = useState(null);
  const [dateRange, setDateRange] = useState('week'); // 'week', 'month', or 'all'

  const getUserId = () => {
    const storedUserDocId = localStorage.getItem('userDocId');
    if (storedUserDocId) return storedUserDocId;

    const userString = localStorage.getItem('user');
    if (userString) {
      const user = JSON.parse(userString);
      return user.docId || user.uid;
    }

    if (currentUser?.uid) return currentUser.uid;

    return null;
  };

  const fetchClasses = async () => {
    const userId = getUserId();
    if (!userId) {
      setError('User not authenticated');
      return;
    }

    setLoading(true);
    try {
      const q = query(collection(db, 'classes'), where('teacherID', '==', userId));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setClasses(data);
      await fetchAttendanceData(data);
    } catch (err) {
      console.error('Error fetching classes:', err);
      setError('Failed to load classes');
    } finally {
      setLoading(false);
    }
  };

  const fetchAttendanceData = async (classes) => {
    const attendanceMap = {};
    
    for (const cls of classes) {
      try {
        // Fetch attendance records for this class
        const attendanceQuery = query(collection(db, 'attendance'), where('classId', '==', cls.id));
        const attendanceSnapshot = await getDocs(attendanceQuery);
        
        const classAttendance = {
          totalSessions: 0,
          students: {},
          sessions: []
        };

        // Process each attendance record
        attendanceSnapshot.forEach((doc) => {
          const data = doc.data();
          classAttendance.sessions.push({
            date: data.date.toDate(),
            presentStudents: data.presentStudents || []
          });
          classAttendance.totalSessions++;
        });

        // Get student details for this class
        const studentDetails = {};
        for (const studentId of cls.studentIDs || []) {
          const studentDoc = await getDoc(doc(db, 'users', studentId));
          if (studentDoc.exists()) {
            const studentData = studentDoc.data();
            studentDetails[studentId] = {
              name: `${studentData.firstName} ${studentData.lastName}`,
              email: studentData.email
            };
          } else {
            studentDetails[studentId] = {
              name: 'Unknown Student',
              email: 'Unknown'
            };
          }
        }

        // Calculate attendance for each student
        for (const studentId in studentDetails) {
          const presentCount = classAttendance.sessions.reduce((count, session) => {
            return count + (session.presentStudents.includes(studentId) ? 1 : 0);
          }, 0);

          classAttendance.students[studentId] = {
            ...studentDetails[studentId],
            presentCount,
            attendanceRate: classAttendance.totalSessions > 0 
              ? Math.round((presentCount / classAttendance.totalSessions) * 100) 
              : 0
          };
        }

        attendanceMap[cls.id] = classAttendance;
      } catch (err) {
        console.error(`Error fetching attendance for class ${cls.id}:`, err);
        attendanceMap[cls.id] = {
          error: 'Failed to load attendance data'
        };
      }
    }

    setAttendanceData(attendanceMap);
  };

  const toggleExpandClass = (classId) => {
    setExpandedClass(expandedClass === classId ? null : classId);
  };

  const filterSessionsByDateRange = (sessions) => {
    const now = new Date();
    let cutoffDate;

    switch (dateRange) {
      case 'week':
        cutoffDate = new Date(now.setDate(now.getDate() - 7));
        break;
      case 'month':
        cutoffDate = new Date(now.setMonth(now.getMonth() - 1));
        break;
      case 'all':
      default:
        return sessions;
    }

    return sessions.filter(session => session.date >= cutoffDate);
  };

  useEffect(() => {
    fetchClasses();
  }, [dateRange]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
        <div className="flex">
          <div className="flex-shrink-0">
            <X className="h-5 w-5 text-red-500" />
          </div>
          <div className="ml-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-gray-800">Class Attendance Reports</h1>
        <div className="flex items-center space-x-2">
          <label htmlFor="dateRange" className="text-sm font-medium text-gray-700">Time Period:</label>
          <select
            id="dateRange"
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="mt-1 block pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm rounded-md"
          >
            <option value="week">Last 7 Days</option>
            <option value="month">Last 30 Days</option>
            <option value="all">All Time</option>
          </select>
        </div>
      </div>

      {classes.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <BookOpen className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-lg font-medium text-gray-700">No Classes Found</h3>
          <p className="mt-1 text-sm text-gray-500">You don't have any classes yet.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {classes.map((cls) => {
            const classAttendance = attendanceData[cls.id] || {};
            const filteredSessions = filterSessionsByDateRange(classAttendance.sessions || []);
            const totalFilteredSessions = filteredSessions.length;

            return (
              <div key={cls.id} className="bg-white shadow overflow-hidden rounded-lg">
                <div className="px-6 py-5 border-b border-gray-200 flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">{cls.subjectName}</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      {cls.studentIDs?.length || 0} students • {cls.schedule?.length || 0} sessions per week
                    </p>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="text-center">
                      <span className="text-sm text-gray-500">Sessions</span>
                      <p className="font-medium">{totalFilteredSessions}</p>
                    </div>
                    <button
                      onClick={() => toggleExpandClass(cls.id)}
                      className="text-emerald-600 hover:text-emerald-800 flex items-center"
                    >
                      {expandedClass === cls.id ? (
                        <>
                          <span className="mr-1">Hide</span>
                          <ChevronUp size={18} />
                        </>
                      ) : (
                        <>
                          <span className="mr-1">View</span>
                          <ChevronDown size={18} />
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {expandedClass === cls.id && (
                  <div className="px-6 py-4">
                    <div className="mb-6">
                      <h4 className="font-medium text-gray-700 mb-3 flex items-center">
                        <Users className="mr-2 text-emerald-500" size={18} />
                        Student Attendance Summary
                      </h4>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Student
                              </th>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Email
                              </th>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Attended
                              </th>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Attendance Rate
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {classAttendance.students && Object.entries(classAttendance.students).map(([studentId, student]) => (
                              <tr key={studentId}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                  {student.name}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {student.email}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {student.presentCount} of {totalFilteredSessions}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="flex items-center">
                                    <div className="w-full bg-gray-200 rounded-full h-2.5 mr-2">
                                      <div 
                                        className={`h-2.5 rounded-full ${student.attendanceRate >= 80 ? 'bg-emerald-500' : student.attendanceRate >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                        style={{ width: `${student.attendanceRate}%` }}
                                      ></div>
                                    </div>
                                    <span className="text-sm font-medium text-gray-700">
                                      {student.attendanceRate}%
                                    </span>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium text-gray-700 mb-3 flex items-center">
                        <Calendar className="mr-2 text-emerald-500" size={18} />
                        Session Details
                      </h4>
                      {filteredSessions.length > 0 ? (
                        <div className="space-y-4">
                          {filteredSessions.map((session, index) => (
                            <div key={index} className="border border-gray-200 rounded-lg p-4">
                              <div className="flex justify-between items-center mb-2">
                                <span className="font-medium">
                                  {session.date.toLocaleDateString()} at {session.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                <span className="text-sm text-gray-500">
                                  {session.presentStudents.length} students attended
                                </span>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-emerald-50 p-3 rounded-md">
                                  <h5 className="text-sm font-medium text-emerald-800 mb-2 flex items-center">
                                    <Check className="mr-1" size={16} /> Present ({session.presentStudents.length})
                                  </h5>
                                  <div className="flex flex-wrap gap-2">
                                    {session.presentStudents.length > 0 ? (
                                      session.presentStudents.map(studentId => (
                                        <span key={studentId} className="bg-emerald-100 text-emerald-800 text-xs px-2 py-1 rounded">
                                          {classAttendance.students?.[studentId]?.name || 'Unknown Student'}
                                        </span>
                                      ))
                                    ) : (
                                      <span className="text-sm text-gray-500">No students attended</span>
                                    )}
                                  </div>
                                </div>
                                <div className="bg-red-50 p-3 rounded-md">
                                  <h5 className="text-sm font-medium text-red-800 mb-2 flex items-center">
                                    <X className="mr-1" size={16} /> Absent ({cls.studentIDs?.length - session.presentStudents.length || 0})
                                  </h5>
                                  <div className="flex flex-wrap gap-2">
                                    {cls.studentIDs?.filter(id => !session.presentStudents.includes(id)).length > 0 ? (
                                      cls.studentIDs
                                        .filter(id => !session.presentStudents.includes(id))
                                        .map(studentId => (
                                          <span key={studentId} className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded">
                                            {classAttendance.students?.[studentId]?.name || 'Unknown Student'}
                                          </span>
                                        ))
                                    ) : (
                                      <span className="text-sm text-gray-500">All students attended</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-6 bg-gray-50 rounded-lg">
                          <p className="text-gray-500">No attendance records found for the selected time period</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Reports;