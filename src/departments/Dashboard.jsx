import React, { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { 
  Users, 
  UserCog, 
  CalendarCheck, 
  Activity,
  ChevronRight,
  Loader2,
  AlertCircle
} from 'lucide-react';

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalTeachers: 0,
    attendanceRate: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);

  useEffect(() => {
    const fetchDepartmentData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Changed from 'department' to 'studentDepartment' to match your working component
        const studentDepartment = localStorage.getItem('studentDepartment');
        if (!studentDepartment) {
          throw new Error("Student department not found in localStorage");
        }

        // Fetch students count - using same query as your working Instructors component
        const studentsQuery = query(
          collection(db, 'users'), 
          where('role', '==', 'student'),
          where('department', '==', studentDepartment)
        );
        const studentsSnapshot = await getDocs(studentsQuery);

        // Fetch teachers count
        const teachersQuery = query(
          collection(db, 'users'),
          where('role', '==', 'teacher'),
          where('department', '==', studentDepartment)
        );
        const teachersSnapshot = await getDocs(teachersQuery);

        // Fetch attendance - using the same department field
        const today = new Date().toISOString().split('T')[0];
        const attendanceQuery = query(
          collection(db, 'teacherAttendance'),
          where('date', '==', today),
          where('department', '==', studentDepartment)
        );
        const attendanceSnapshot = await getDocs(attendanceQuery);

        // Calculate stats
        const totalStudents = studentsSnapshot.size;
        const totalTeachers = teachersSnapshot.size;
        const presentTeachers = attendanceSnapshot.size;
        const attendanceRate = totalTeachers > 0 
          ? Math.round((presentTeachers / totalTeachers) * 100) 
          : 0;

        setStats({
          totalStudents,
          totalTeachers,
          attendanceRate,
        });

        // Fetch recent activity
        const activityQuery = query(collection(db, 'activityLog'));
        const activitySnapshot = await getDocs(activityQuery);
        const activities = activitySnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(activity => activity.department === studentDepartment)
          .sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0))
          .slice(0, 5);

        setRecentActivity(activities);
        
      } catch (error) {
        console.error("Dashboard error:", error);
        setError(`Error loading data: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchDepartmentData();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-3">
        <Loader2 className="animate-spin text-blue-500" size={24} />
        <p className="text-gray-600">Loading dashboard data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border-l-4 border-red-500 p-4">
          <div className="flex items-center">
            <AlertCircle className="text-red-500 mr-2" size={20} />
            <h3 className="text-red-800 font-medium">Dashboard Error</h3>
          </div>
          <p className="text-red-700 mt-2 text-sm">{error}</p>
          <p className="text-xs text-gray-600 mt-2">
            Using department: {localStorage.getItem('studentDepartment') || 'Not found'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Department Dashboard</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Students */}
        <div className="bg-white p-4 rounded-lg shadow border border-gray-200 hover:shadow-md transition-shadow">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-full">
              <Users className="text-blue-600" size={20} />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Students</p>
              <p className="text-2xl font-bold">{stats.totalStudents}</p>
            </div>
          </div>
        </div>

        {/* Total Teachers */}
        <div className="bg-white p-4 rounded-lg shadow border border-gray-200 hover:shadow-md transition-shadow">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-green-100 rounded-full">
              <UserCog className="text-green-600" size={20} />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Teachers</p>
              <p className="text-2xl font-bold">{stats.totalTeachers}</p>
            </div>
          </div>
        </div>

        {/* Attendance Rate */}
        <div className={`bg-white p-4 rounded-lg shadow border ${
          stats.attendanceRate < 80 ? 'border-yellow-200' : 'border-gray-200'
        } hover:shadow-md transition-shadow`}>
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-full ${
              stats.attendanceRate < 80 ? 'bg-yellow-100' : 'bg-orange-100'
            }`}>
              <CalendarCheck className={
                stats.attendanceRate < 80 ? 'text-yellow-600' : 'text-orange-600'
              } size={20} />
            </div>
            <div>
              <p className="text-sm text-gray-500">Teacher Attendance</p>
              <p className="text-2xl font-bold">{stats.attendanceRate}%</p>
              <p className={`text-xs ${
                stats.attendanceRate >= 80 ? 'text-green-600' : 'text-yellow-600'
              }`}>
                {stats.attendanceRate >= 80 ? 
                  'Good attendance' : 
                  'Needs attention'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
        <h2 className="font-bold flex items-center space-x-2 mb-4 text-gray-800">
          <Activity size={18} className="text-purple-600" />
          <span>Recent Activity</span>
        </h2>
        
        {recentActivity.length > 0 ? (
          <ul className="divide-y divide-gray-100">
            {recentActivity.map((item) => (
              <li 
                key={item.id} 
                className="flex items-center justify-between py-3 hover:bg-gray-50 px-2 rounded cursor-pointer"
              >
                <div>
                  <p className="text-sm font-medium text-gray-800">{item.action}</p>
                  {item.timestamp && (
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(item.timestamp.seconds * 1000).toLocaleString()}
                    </p>
                  )}
                </div>
                <ChevronRight size={16} className="text-gray-400" />
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-center py-6">
            <p className="text-gray-500">No recent activity found</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;