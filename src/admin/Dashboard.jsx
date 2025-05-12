import React, { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { collection, getCountFromServer } from 'firebase/firestore';
import { Users, Calendar } from 'lucide-react';

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalClasses: 0,
    recentSignups: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const usersCol = collection(db, 'users');
        const classesCol = collection(db, 'classes');

        const [usersSnapshot, classesSnapshot] = await Promise.all([
          getCountFromServer(usersCol),
          getCountFromServer(classesCol)
        ]);

        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        const recentSignupsQuery = collection(db, 'users');
        const recentSignupsSnapshot = await getCountFromServer(recentSignupsQuery);

        setStats({
          totalUsers: usersSnapshot.data().count,
          totalClasses: classesSnapshot.data().count,
          recentSignups: recentSignupsSnapshot.data().count
        });
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        setError('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

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
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <StatCard 
          icon={<Users size={20} />}
          title="Total Users"
          value={stats.totalUsers}
          change={`+${stats.recentSignups} this week`}
          color="emerald"
        />

        <StatCard 
          icon={<Calendar size={20} />}
          title="Total Classes"
          value={stats.totalClasses}
          change="Manage classes"
          color="purple"
        />
      </div>
    </>
  );
};

const StatCard = ({ icon, title, value, change, color }) => {
  const colorClasses = {
    emerald: 'bg-emerald-100 text-emerald-600',
    blue: 'bg-blue-100 text-blue-600',
    purple: 'bg-purple-100 text-purple-600'
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

export default Dashboard;
