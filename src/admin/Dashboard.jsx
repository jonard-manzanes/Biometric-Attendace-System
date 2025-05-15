import React, { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { collection, getCountFromServer, query, where, getDocs } from 'firebase/firestore';
import { Users, Book, Clock, Activity, Calendar, TrendingUp } from 'lucide-react';
import { Bar, Line, Pie } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, PointElement, LineElement, ArcElement } from 'chart.js';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  PointElement,
  LineElement,
  ArcElement
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
  const [classDistributionData, setClassDistributionData] = useState([]);

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

        // Class distribution by student count
        const classDistribution = await getClassDistribution();
        setClassDistributionData(classDistribution);

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
      
      // Get data for last 6 months
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

    const getClassDistribution = async () => {
      const ranges = [
        { name: '1-5 students', min: 1, max: 5 },
        { name: '6-10 students', min: 6, max: 10 },
        { name: '11-20 students', min: 11, max: 20 },
        { name: '20+ students', min: 21, max: Infinity }
      ];
      
      const counts = await Promise.all(
        ranges.map(async range => {
          const q = query(
            collection(db, 'classes'),
            where('studentIDs', '>=', range.min),
            where('studentIDs', '<=', range.max === Infinity ? 999 : range.max)
          );
          const snapshot = await getCountFromServer(q);
          return snapshot.data().count;
        })
      );
      
      return {
        labels: ranges.map(r => r.name),
        counts
      };
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

  const classDistributionChart = {
    labels: classDistributionData.labels || [],
    datasets: [
      {
        label: 'Classes',
        data: classDistributionData.counts || [],
        backgroundColor: [
          'rgba(99, 102, 241, 0.7)',
          'rgba(168, 85, 247, 0.7)',
          'rgba(236, 72, 153, 0.7)',
          'rgba(16, 185, 129, 0.7)'
        ],
        borderColor: [
          'rgba(99, 102, 241, 1)',
          'rgba(168, 85, 247, 1)',
          'rgba(236, 72, 153, 1)',
          'rgba(16, 185, 129, 1)'
        ],
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

        {/* Class Distribution Chart */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Class Size Distribution</h2>
          <div className="h-80">
            <Pie 
              data={classDistributionChart}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: 'right',
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