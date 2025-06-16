import React, { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { 
  Users, 
  UserCog, 
  CalendarCheck, 
  Activity,
  ChevronRight,
  Loader2,
  AlertCircle,
  BookOpen,
  GraduationCap
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalTeachers: 0,
    totalClasses: 0,
    attendanceRate: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchDepartmentData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const studentDepartment = localStorage.getItem('studentDepartment');
        if (!studentDepartment) {
          throw new Error("Department information not found");
        }

        // Fetch all teachers in the department first
        const teachersQuery = query(
          collection(db, 'users'),
          where('role', '==', 'teacher'),
          where('department', '==', studentDepartment)
        );
        const teachersSnapshot = await getDocs(teachersQuery);
        const teacherIds = teachersSnapshot.docs.map(doc => doc.id);

        // Fetch all data in parallel
        const [studentsSnapshot, classesSnapshot, attendanceSnapshot, activitySnapshot] = await Promise.all([
          getDocs(query(
            collection(db, 'users'), 
            where('role', '==', 'student'),
            where('department', '==', studentDepartment)
          )),
          getDocs(collection(db, 'classes')),
          getDocs(query(
            collection(db, 'teacherAttendance'),
            where('date', '==', new Date().toISOString().split('T')[0]),
            where('department', '==', studentDepartment)
          )),
          getDocs(collection(db, 'activityLog'))
        ]);

        // Filter classes by teacher IDs (client-side)
        const departmentClasses = classesSnapshot.docs.filter(doc => 
          teacherIds.includes(doc.data().teacherID)
        );

        // Calculate stats
        const totalStudents = studentsSnapshot.size;
        const totalTeachers = teachersSnapshot.size;
        const totalClasses = departmentClasses.length;
        const presentTeachers = attendanceSnapshot.size;
        const attendanceRate = totalTeachers > 0 
          ? Math.round((presentTeachers / totalTeachers) * 100) 
          : 0;

        setStats({
          totalStudents,
          totalTeachers,
          totalClasses,
          attendanceRate,
        });

        // Filter and sort recent activity client-side
        const activities = activitySnapshot.docs
          .map(doc => ({ 
            id: doc.id, 
            ...doc.data(),
            timestamp: doc.data().timestamp?.toDate()
          }))
          .filter(activity => 
            activity.department === studentDepartment
          )
          .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
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

  const getAttendanceColor = (rate) => {
    if (rate >= 90) return 'text-green-600 bg-green-50 border-green-200';
    if (rate >= 70) return 'text-blue-600 bg-blue-50 border-blue-200';
    if (rate >= 50) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  const getAttendanceStatus = (rate) => {
    if (rate >= 90) return 'Excellent';
    if (rate >= 70) return 'Good';
    if (rate >= 50) return 'Fair';
    return 'Poor';
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] space-y-3">
        <Loader2 className="animate-spin text-blue-500" size={24} />
        <p className="text-gray-600">Loading dashboard data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
          <div className="flex items-center">
            <AlertCircle className="text-red-500 mr-2" size={20} />
            <h3 className="text-red-800 font-medium">Dashboard Error</h3>
          </div>
          <p className="text-red-700 mt-2 text-sm">{error}</p>
          <p className="text-xs text-gray-600 mt-2">
            Current department: <span className="font-medium">{localStorage.getItem('studentDepartment') || 'Not set'}</span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Department Dashboard</h1>
        <p className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
          {localStorage.getItem('studentDepartment')}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Students */}
        <div 
          className="bg-white p-4 rounded-lg shadow border border-gray-200 hover:shadow-md transition-shadow cursor-pointer"
          onClick={() => navigate('/students')}
        >
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
        <div 
          className="bg-white p-4 rounded-lg shadow border border-gray-200 hover:shadow-md transition-shadow cursor-pointer"
          onClick={() => navigate('/instructors')}
        >
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

        {/* Total Classes */}
        <div 
          className="bg-white p-4 rounded-lg shadow border border-gray-200 hover:shadow-md transition-shadow cursor-pointer"
          onClick={() => navigate('/classes')}
        >
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-purple-100 rounded-full">
              <BookOpen className="text-purple-600" size={20} />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Classes</p>
              <p className="text-2xl font-bold">{stats.totalClasses}</p>
            </div>
          </div>
        </div>

        {/* Attendance Rate */}
        <div className={`bg-white p-4 rounded-lg shadow border hover:shadow-md transition-shadow ${getAttendanceColor(stats.attendanceRate)}`}>
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-full bg-opacity-30">
              <CalendarCheck size={20} />
            </div>
            <div>
              <p className="text-sm text-gray-500">Teacher Attendance</p>
              <p className="text-2xl font-bold">{stats.attendanceRate}%</p>
              <p className="text-xs font-medium">
                {getAttendanceStatus(stats.attendanceRate)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-bold flex items-center space-x-2 text-gray-800">
            <Activity size={18} className="text-purple-600" />
            <span>Recent Activity</span>
          </h2>
          <button 
            onClick={() => navigate('/activity-log')}
            className="text-xs text-blue-600 hover:text-blue-800"
          >
            View All
          </button>
        </div>
        
        {recentActivity.length > 0 ? (
          <ul className="divide-y divide-gray-100">
            {recentActivity.map((item) => (
              <li 
                key={item.id} 
                className="flex items-center justify-between py-3 hover:bg-gray-50 px-2 rounded cursor-pointer"
                onClick={() => item.action.includes('Class') && navigate('/classes')}
              >
                <div className="flex items-start space-x-3">
                  <div className="mt-1">
                    {item.action.includes('Student') ? (
                      <GraduationCap size={16} className="text-blue-500" />
                    ) : item.action.includes('Teacher') ? (
                      <UserCog size={16} className="text-green-500" />
                    ) : (
                      <BookOpen size={16} className="text-purple-500" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{item.action}</p>
                    {item.timestamp && (
                      <p className="text-xs text-gray-500 mt-1">
                        {item.timestamp.toLocaleString()}
                      </p>
                    )}
                  </div>
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