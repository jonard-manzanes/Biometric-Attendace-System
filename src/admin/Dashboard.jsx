import React, { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { collection, getCountFromServer, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { Users, Book, Clock, Activity, TrendingUp } from 'lucide-react';
import { Bar, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  PointElement,
  LineElement
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalClasses: 0,
    activeUsers: 0,
    recentSignups: 0,
    activeClasses: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userGrowthData, setUserGrowthData] = useState([]);
  const [classesData, setClassesData] = useState([]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const usersCol = collection(db, 'users');
        const classesCol = collection(db, 'classes');

        // Basic counts
        const [usersSnapshot, classesSnapshot] = await Promise.all([
          getCountFromServer(usersCol),
          getCountFromServer(classesCol)
        ]);

        // Active users (logged in last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const activeUsersQuery = query(usersCol, where('lastLogin', '>=', thirtyDaysAgo));
        const activeUsersSnapshot = await getCountFromServer(activeUsersQuery);

        // Recent signups (last 7 days)
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        const recentSignupsQuery = query(usersCol, where('createdAt', '>=', oneWeekAgo));
        const recentSignupsSnapshot = await getCountFromServer(recentSignupsQuery);

        // Active classes (with students)
        const activeClassesQuery = query(classesCol, where('studentIDs', '!=', []));
        const activeClassesSnapshot = await getCountFromServer(activeClassesQuery);

        // User growth data (last 6 months)
        const userGrowth = await getUserGrowthData();
        setUserGrowthData(userGrowth);

        // Classes with teachers data
        const classesWithTeachers = await getClassesWithTeachers();
        setClassesData(classesWithTeachers);

        setStats({
          totalUsers: usersSnapshot.data().count,
          totalClasses: classesSnapshot.data().count,
          activeUsers: activeUsersSnapshot.data().count,
          recentSignups: recentSignupsSnapshot.data().count,
          activeClasses: activeClassesSnapshot.data().count
        });
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        setError('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    const getUserGrowthData = async () => {
      const months = [];
      const counts = [];
      const now = new Date();
      
      for (let i = 5; i >= 0; i--) {
        const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
        
        const monthName = monthStart.toLocaleString('default', { month: 'short' });
        months.push(`${monthName} ${monthStart.getFullYear()}`);
        
        const q = query(
          collection(db, 'users'),
          where('createdAt', '>=', monthStart),
          where('createdAt', '<=', monthEnd)
        );
        
        const snapshot = await getCountFromServer(q);
        counts.push(snapshot.data().count);
      }
      
      return { months, counts };
    };

    const getClassesWithTeachers = async () => {
      const classesSnapshot = await getDocs(collection(db, 'classes'));
      const classes = [];
      
      for (const doc of classesSnapshot.docs) {
        const classData = doc.data();
        let teacherName = "Unknown Teacher";
        
        if (classData.teacherID) {
          try {
            const teacherDoc = await getDoc(doc(db, 'users', classData.teacherID));
            if (teacherDoc.exists()) {
              teacherName = teacherDoc.data().fullName || 
                          `${teacherDoc.data().firstName} ${teacherDoc.data().lastName}` || 
                          "Unknown Teacher";
            }
          } catch (err) {
            console.error(`Error fetching teacher ${classData.teacherID}:`, err);
          }
        }
        
        classes.push({
          id: doc.id,
          name: classData.subjectName || "Unnamed Class",
          teacher: teacherName,
          studentCount: classData.studentIDs?.length || 0,
          joinCode: classData.joinCode || "No code"
        });
      }
      
      // Sort by student count (descending) and then by class name
      return classes.sort((a, b) => {
        if (b.studentCount !== a.studentCount) {
          return b.studentCount - a.studentCount;
        }
        return a.name.localeCompare(b.name);
      });
    };

    fetchDashboardData();
  }, []);

  // Chart data configurations
  const userGrowthChart = {
    labels: userGrowthData.months || [],
    datasets: [
      {
        label: 'New Users',
        data: userGrowthData.counts || [],
        borderColor: 'rgb(16, 185, 129)',
        backgroundColor: 'rgba(16, 185, 129, 0.2)',
        tension: 0.3,
        fill: true
      }
    ]
  };

  const classesChart = {
    labels: classesData.map(cls => cls.name),
    datasets: [
      {
        label: 'Students',
        data: classesData.map(cls => cls.studentCount),
        backgroundColor: 'rgba(99, 102, 241, 0.7)',
        borderColor: 'rgba(99, 102, 241, 1)',
        borderWidth: 1
      }
    ]
  };

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
        <p className="text-red-700">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Admin Dashboard</h1>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          icon={<Users size={20} />}
          title="Total Users"
          value={stats.totalUsers}
          change={`+${stats.recentSignups} this week`}
          color="emerald"
        />

        <StatCard 
          icon={<Activity size={20} />}
          title="Active Users"
          value={stats.activeUsers}
          change={`${Math.round((stats.activeUsers / stats.totalUsers) * 100)}% of total`}
          color="blue"
        />

        <StatCard 
          icon={<Book size={20} />}
          title="Total Classes"
          value={stats.totalClasses}
          change={`${stats.activeClasses} active`}
          color="purple"
        />

        <StatCard 
          icon={<TrendingUp size={20} />}
          title="User Growth"
          value={stats.recentSignups}
          change="new users this week"
          color="pink"
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Growth Chart */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">User Growth (Last 6 Months)</h2>
          <div className="h-80">
            <Line 
              data={userGrowthChart}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: 'top',
                  },
                  tooltip: {
                    mode: 'index',
                    intersect: false,
                  }
                },
                scales: {
                  y: {
                    beginAtZero: true,
                    ticks: {
                      precision: 0
                    }
                  }
                }
              }}
            />
          </div>
        </div>

        {/* Classes Overview Chart */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Classes Overview</h2>
          <div className="h-96">
            <Bar 
              data={classesChart}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    display: false
                  },
                  tooltip: {
                    callbacks: {
                      title: (context) => classesData[context[0].dataIndex].name,
                      afterLabel: (context) => {
                        const data = classesData[context.dataIndex];
                        return [
                          `Teacher: ${data.teacher}`,
                          `Students: ${data.studentCount}`,
                          `Join Code: ${data.joinCode}`
                        ].join('\n');
                      }
                    }
                  }
                },
                scales: {
                  y: {
                    beginAtZero: true,
                    title: {
                      display: true,
                      text: 'Number of Students'
                    },
                    ticks: {
                      precision: 0
                    }
                  },
                  x: {
                    ticks: {
                      autoSkip: false,
                      maxRotation: 45,
                      minRotation: 45
                    }
                  }
                }
              }}
            />
          </div>
        </div>
      </div>

      {/* Recent Activity Section */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Recent Activity</h2>
        <div className="space-y-4">
          <ActivityItem 
            icon={<Users size={16} />}
            title={`${stats.recentSignups} new users signed up this week`}
            time="Today"
            color="emerald"
          />
          <ActivityItem 
            icon={<Book size={16} />}
            title={`${stats.activeClasses} active classes with students`}
            time="This week"
            color="purple"
          />
          <ActivityItem 
            icon={<Clock size={16} />}
            title={`${stats.activeUsers} active users in last 30 days`}
            time="This month"
            color="blue"
          />
        </div>
      </div>
    </div>
  );
};

// StatCard component (unchanged)
const StatCard = ({ icon, title, value, change, color }) => {
  const colorClasses = {
    emerald: 'bg-emerald-100 text-emerald-600',
    blue: 'bg-blue-100 text-blue-600',
    purple: 'bg-purple-100 text-purple-600',
    pink: 'bg-pink-100 text-pink-600'
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex items-center justify-between">
        <div className={`rounded-lg p-3 ${colorClasses[color]}`}>
          {icon}
        </div>
        <span className="text-xs text-gray-500">{change}</span>
      </div>
      <h3 className="mt-4 text-sm font-medium text-gray-500">{title}</h3>
      <p className="mt-1 text-2xl font-semibold text-gray-900">{value}</p>
    </div>
  );
};

// ActivityItem component (unchanged)
const ActivityItem = ({ icon, title, time, color }) => {
  const colorClasses = {
    emerald: 'bg-emerald-100 text-emerald-600',
    blue: 'bg-blue-100 text-blue-600',
    purple: 'bg-purple-100 text-purple-600'
  };

  return (
    <div className="flex items-start">
      <div className={`rounded-lg p-2 mr-3 ${colorClasses[color]}`}>
        {icon}
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-800">{title}</p>
        <p className="text-xs text-gray-500">{time}</p>
      </div>
    </div>
  );
};

export default Dashboard;