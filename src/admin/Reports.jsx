import React, { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { collection, getDocs, query, where, getCountFromServer } from 'firebase/firestore';
import { Download, Users, Book, Clock, ChevronDown } from 'lucide-react';

const Reports = () => {
  const [reportType, setReportType] = useState('user_activity');
  const [dateRange, setDateRange] = useState('last_7_days');
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchReportData = async () => {
      setLoading(true);
      try {
        const now = new Date();
        let startDate = new Date();

        // Set date range based on selection
        switch(dateRange) {
          case 'last_7_days':
            startDate.setDate(now.getDate() - 7);
            break;
          case 'last_30_days':
            startDate.setDate(now.getDate() - 30);
            break;
          case 'this_month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
          case 'last_month':
            startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            break;
          default:
            startDate.setDate(now.getDate() - 7);
        }

        const data = {};
        
        if (reportType === 'user_activity') {
          // User activity report
          const usersCol = collection(db, 'users');
          
          // Total users
          const totalUsers = await getCountFromServer(usersCol);
          data.totalUsers = totalUsers.data().count;
          
          // Active users (logged in recently)
          const activeUsersQuery = query(
            usersCol, 
            where('lastLogin', '>=', startDate)
          );
          const activeUsers = await getCountFromServer(activeUsersQuery);
          data.activeUsers = activeUsers.data().count;
          
          // New signups
          const newUsersQuery = query(
            usersCol,
            where('createdAt', '>=', startDate)
          );
          const newUsers = await getCountFromServer(newUsersQuery);
          data.newUsers = newUsers.data().count;

        } else if (reportType === 'class_performance') {
          // Class performance report
          const classesCol = collection(db, 'classes');
          
          // Total classes
          const totalClasses = await getCountFromServer(classesCol);
          data.totalClasses = totalClasses.data().count;
          
          // Active classes (with students)
          const activeClassesQuery = query(
            classesCol,
            where('studentIDs', '!=', [])
          );
          const activeClasses = await getCountFromServer(activeClassesQuery);
          data.activeClasses = activeClasses.data().count;
          
          // Get some sample classes
          const sampleClasses = await getDocs(query(classesCol, limit(5)));
          data.sampleClasses = sampleClasses.docs.map(doc => ({
            id: doc.id,
            name: doc.data().subjectName,
            students: doc.data().studentIDs?.length || 0
          }));
        }

        setReportData(data);
      } catch (error) {
        console.error("Error fetching report data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchReportData();
  }, [reportType, dateRange]);

  const handleExport = () => {
    // In a real app, this would generate a CSV/PDF
    alert(`Exporting ${reportType} report for ${dateRange}`);
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Reports</h1>
      
      {/* Report Controls */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Report Type</label>
          <select
            value={reportType}
            onChange={(e) => setReportType(e.target.value)}
            className="w-full border border-gray-300 rounded-md p-2 text-sm"
          >
            <option value="user_activity">User Activity</option>
            <option value="class_performance">Class Performance</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Date Range</label>
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="w-full border border-gray-300 rounded-md p-2 text-sm"
          >
            <option value="last_7_days">Last 7 Days</option>
            <option value="last_30_days">Last 30 Days</option>
            <option value="this_month">This Month</option>
            <option value="last_month">Last Month</option>
          </select>
        </div>
      </div>

      {/* Report Content */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-semibold text-gray-800">
              {reportType === 'user_activity' ? 'User Activity' : 'Class Performance'} Report
            </h2>
            <button 
              onClick={handleExport}
              className="flex items-center px-3 py-2 bg-emerald-600 text-white rounded-md text-sm"
            >
              <Download size={16} className="mr-2" />
              Export
            </button>
          </div>

          {reportType === 'user_activity' && reportData && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center mb-2">
                  <Users size={20} className="text-emerald-500 mr-2" />
                  <h3 className="text-sm font-medium">Total Users</h3>
                </div>
                <p className="text-2xl font-bold">{reportData.totalUsers || 0}</p>
              </div>
              
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center mb-2">
                  <Clock size={20} className="text-blue-500 mr-2" />
                  <h3 className="text-sm font-medium">Active Users</h3>
                </div>
                <p className="text-2xl font-bold">{reportData.activeUsers || 0}</p>
              </div>
              
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center mb-2">
                  <Users size={20} className="text-purple-500 mr-2" />
                  <h3 className="text-sm font-medium">New Signups</h3>
                </div>
                <p className="text-2xl font-bold">{reportData.newUsers || 0}</p>
              </div>
            </div>
          )}

          {reportType === 'class_performance' && reportData && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center mb-2">
                  <Book size={20} className="text-emerald-500 mr-2" />
                  <h3 className="text-sm font-medium">Total Classes</h3>
                </div>
                <p className="text-2xl font-bold">{reportData.totalClasses || 0}</p>
              </div>
              
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center mb-2">
                  <Book size={20} className="text-blue-500 mr-2" />
                  <h3 className="text-sm font-medium">Active Classes</h3>
                </div>
                <p className="text-2xl font-bold">{reportData.activeClasses || 0}</p>
              </div>
            </div>
          )}

          {/* Sample Data Table */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
              <h3 className="text-sm font-medium">Sample Data</h3>
            </div>
            <div className="p-4">
              {reportType === 'user_activity' ? (
                <p>User activity data would display here in a full implementation.</p>
              ) : (
                <div className="space-y-2">
                  {reportData?.sampleClasses?.map(cls => (
                    <div key={cls.id} className="flex justify-between py-2 border-b border-gray-100">
                      <span>{cls.name}</span>
                      <span>{cls.students} students</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;