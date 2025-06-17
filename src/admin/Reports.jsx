import React, { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { collection, getDocs, query, where, getCountFromServer, orderBy, limit } from 'firebase/firestore';
import { Download, Users, Book, Clock, ChevronDown, Shield, Activity, TrendingUp, Calendar } from 'lucide-react';
import { Bar, Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

const Reports = () => {
  const [reportType, setReportType] = useState('user_activity');
  const [dateRange, setDateRange] = useState('last_7_days');
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [chartData, setChartData] = useState({});

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

          // Role distribution
          const roles = ['student', 'instructor', 'staff', 'admin'];
const roleCounts = await Promise.all(
  roles.map(role => 
    getCountFromServer(query(usersCol, where('role', '==', role)))
  )
);
data.roleDistribution = roles.map((role, i) => ({
  role,
  count: roleCounts[i].data().count
}));

          // Prepare chart data
          setChartData({
            labels: ['Total Users', 'Active Users', 'New Signups'],
            datasets: [{
              label: 'User Count',
              data: [data.totalUsers, data.activeUsers, data.newUsers],
              backgroundColor: [
                'rgba(16, 185, 129, 0.7)',
                'rgba(59, 130, 246, 0.7)',
                'rgba(139, 92, 246, 0.7)'
              ],
              borderColor: [
                'rgba(16, 185, 129, 1)',
                'rgba(59, 130, 246, 1)',
                'rgba(139, 92, 246, 1)'
              ],
              borderWidth: 1
            }]
          });

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
          
          // Get top classes by student count
          const topClassesQuery = query(
            classesCol,
            orderBy('studentIDs', 'desc'),
            limit(5)
          );
          const topClasses = await getDocs(topClassesQuery);
          data.topClasses = topClasses.docs.map(doc => ({
            id: doc.id,
            name: doc.data().subjectName || 'Unnamed Class',
            students: doc.data().studentIDs?.length || 0
          }));

          // Prepare chart data
          setChartData({
            labels: data.topClasses.map(cls => cls.name),
            datasets: [{
              label: 'Student Count',
              data: data.topClasses.map(cls => cls.students),
              backgroundColor: 'rgba(99, 102, 241, 0.7)',
              borderColor: 'rgba(99, 102, 241, 1)',
              borderWidth: 1
            }]
          });

        } else if (reportType === 'staff_assignments') {
          // Staff assignments report (from TaskingStaff component)
          const tasksCol = collection(db, 'verificationTasks');
          const tasksQuery = query(
            tasksCol,
            where('date', '>=', formatDate(startDate)),
            where('date', '<=', formatDate(now))
          );
          const tasksSnapshot = await getDocs(tasksQuery);
          data.totalAssignments = tasksSnapshot.size;
          
          // Group by staff member
          const staffAssignments = {};
          tasksSnapshot.forEach(doc => {
            const task = doc.data();
            staffAssignments[task.staffId] = (staffAssignments[task.staffId] || 0) + 1;
          });
          
          data.staffAssignmentCounts = Object.entries(staffAssignments)
            .map(([staffId, count]) => ({ staffId, count }))
            .sort((a, b) => b.count - a.count);

          // Get staff names
          const staffIds = Object.keys(staffAssignments);
          if (staffIds.length > 0) {
            const staffQuery = query(
              collection(db, 'users'),
              where('id', 'in', staffIds)
            );
            const staffSnapshot = await getDocs(staffQuery);
            const staffMap = {};
            staffSnapshot.forEach(doc => {
              const staff = doc.data();
              staffMap[doc.id] = `${staff.firstName} ${staff.lastName}`;
            });
            
            data.staffAssignmentCounts = data.staffAssignmentCounts.map(item => ({
              ...item,
              name: staffMap[item.staffId] || 'Unknown Staff'
            }));
          }

          // Prepare chart data
          setChartData({
            labels: data.staffAssignmentCounts.map(item => item.name),
            datasets: [{
              label: 'Assignments',
              data: data.staffAssignmentCounts.map(item => item.count),
              backgroundColor: 'rgba(245, 158, 11, 0.7)',
              borderColor: 'rgba(245, 158, 11, 1)',
              borderWidth: 1
            }]
          });
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

  const formatDate = (date) => {
    return date.toISOString().split('T')[0];
  };

  const convertToCSV = (data) => {
    if (reportType === 'user_activity') {
      const headers = ["Metric", "Count"];
      const rows = [
        ["Total Users", data.totalUsers || 0],
        ["Active Users", data.activeUsers || 0],
        ["New Signups", data.newUsers || 0],
        ...(data.roleDistribution?.map(r => [`${r.role} users`, r.count]) || [])
      ];
      return [headers, ...rows].map(row => row.join(",")).join("\n");
    } else if (reportType === 'class_performance') {
      const headers = ["Metric", "Count"];
      const rows = [
        ["Total Classes", data.totalClasses || 0],
        ["Active Classes", data.activeClasses || 0],
        ...(data.topClasses?.map(cls => [cls.name, `${cls.students} students`]) || [])
      ];
      return [headers, ...rows].map(row => row.join(",")).join("\n");
    } else if (reportType === 'staff_assignments') {
      const headers = ["Staff Member", "Assignments"];
      const rows = [
        ["Total Assignments", data.totalAssignments || 0],
        ...(data.staffAssignmentCounts?.map(item => [item.name, item.count]) || [])
      ];
      return [headers, ...rows].map(row => row.join(",")).join("\n");
    }
    return "";
  };

  const handleExport = () => {
    if (!reportData) return;
    
    const csvContent = convertToCSV(reportData);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    
    // Create filename based on report type and date range
    const filename = `${reportType}_${dateRange}_${new Date().toISOString().split('T')[0]}.csv`;
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Report Controls */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Report Type</label>
          <select
            value={reportType}
            onChange={(e) => setReportType(e.target.value)}
            className="w-full border border-gray-300 rounded-md p-2 text-sm"
          >
            <option value="user_activity">User Activity</option>
            <option value="class_performance">Class Performance</option>
            <option value="staff_assignments">Staff Assignments</option>
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

        <div className="flex items-end">
          <button 
            onClick={handleExport}
            className="flex items-center w-full justify-center px-3 py-2 bg-emerald-600 text-white rounded-md text-sm"
            disabled={!reportData || loading}
          >
            <Download size={16} className="mr-2" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Report Content */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary Cards */}
          {reportData && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {reportType === 'user_activity' && (
                <>
                  <SummaryCard 
                    icon={<Users className="text-emerald-500" />}
                    title="Total Users"
                    value={reportData.totalUsers || 0}
                  />
                  <SummaryCard 
                    icon={<Activity className="text-blue-500" />}
                    title="Active Users"
                    value={reportData.activeUsers || 0}
                  />
                  <SummaryCard 
                    icon={<TrendingUp className="text-purple-500" />}
                    title="New Signups"
                    value={reportData.newUsers || 0}
                  />
                </>
              )}
              
              {reportType === 'class_performance' && (
                <>
                  <SummaryCard 
                    icon={<Book className="text-emerald-500" />}
                    title="Total Classes"
                    value={reportData.totalClasses || 0}
                  />
                  <SummaryCard 
                    icon={<Book className="text-blue-500" />}
                    title="Active Classes"
                    value={reportData.activeClasses || 0}
                  />
                  <SummaryCard 
                    icon={<Users className="text-purple-500" />}
                    title="Top Class Students"
                    value={reportData.topClasses?.[0]?.students || 0}
                    subtitle={reportData.topClasses?.[0]?.name}
                  />
                </>
              )}
              
              {reportType === 'staff_assignments' && (
                <>
                  <SummaryCard 
                    icon={<Shield className="text-amber-500" />}
                    title="Total Assignments"
                    value={reportData.totalAssignments || 0}
                  />
                  <SummaryCard 
                    icon={<Shield className="text-blue-500" />}
                    title="Top Staff Assignments"
                    value={reportData.staffAssignmentCounts?.[0]?.count || 0}
                    subtitle={reportData.staffAssignmentCounts?.[0]?.name}
                  />
                  <SummaryCard 
                    icon={<Calendar className="text-purple-500" />}
                    title="Date Range"
                    value={dateRange.replace(/_/g, ' ')}
                  />
                </>
              )}
            </div>
          )}

          {/* Charts */}
          {reportData && (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">
                {reportType === 'user_activity' && 'User Activity Overview'}
                {reportType === 'class_performance' && 'Top Classes by Student Count'}
                {reportType === 'staff_assignments' && 'Staff Assignment Distribution'}
              </h2>
              
              <div className="h-80">
                {reportType === 'user_activity' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <Bar 
                        data={chartData}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: {
                            legend: {
                              display: false
                            }
                          }
                        }}
                      />
                    </div>
                    <div>
                      <Pie 
                        data={{
                          labels: reportData.roleDistribution?.map(r => r.role) || [],
                          datasets: [{
                            data: reportData.roleDistribution?.map(r => r.count) || [],
                            backgroundColor: [
                              'rgba(16, 185, 129, 0.7)',
                              'rgba(59, 130, 246, 0.7)',
                              'rgba(245, 158, 11, 0.7)',
                              'rgba(139, 92, 246, 0.7)'
                            ],
                            borderColor: [
                              'rgba(16, 185, 129, 1)',
                              'rgba(59, 130, 246, 1)',
                              'rgba(245, 158, 11, 1)',
                              'rgba(139, 92, 246, 1)'
                            ],
                            borderWidth: 1
                          }]
                        }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: {
                            legend: {
                              position: 'right'
                            }
                          }
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <Bar 
                    data={chartData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          display: false
                        }
                      }
                    }}
                  />
                )}
              </div>
            </div>
          )}

          {/* Detailed Data Table */}
          {reportData && (
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-800">
                  Detailed {reportType.replace(/_/g, ' ')} Data
                </h2>
              </div>
              
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {reportType === 'user_activity' && (
                        <>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Count</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Percentage</th>
                        </>
                      )}
                      {reportType === 'class_performance' && (
                        <>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Class Name</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Students</th>
                        </>
                      )}
                      {reportType === 'staff_assignments' && (
                        <>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Staff Member</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assignments</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {reportType === 'user_activity' && reportData.roleDistribution?.map((role) => (
                      <tr key={role.role}>
                        <td className="px-6 py-4 whitespace-nowrap capitalize">{role.role}</td>
                        <td className="px-6 py-4 whitespace-nowrap">{role.count}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {Math.round((role.count / reportData.totalUsers) * 100)}%
                        </td>
                      </tr>
                    ))}
                    
                    {reportType === 'class_performance' && reportData.topClasses?.map((cls) => (
                      <tr key={cls.id}>
                        <td className="px-6 py-4 whitespace-nowrap">{cls.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap">{cls.students}</td>
                      </tr>
                    ))}
                    
                    {reportType === 'staff_assignments' && reportData.staffAssignmentCounts?.map((staff) => (
                      <tr key={staff.staffId}>
                        <td className="px-6 py-4 whitespace-nowrap">{staff.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap">{staff.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const SummaryCard = ({ icon, title, value, subtitle }) => (
  <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
    <div className="flex items-center">
      <div className="p-2 rounded-full bg-gray-100 mr-3">
        {icon}
      </div>
      <div>
        <h3 className="text-sm font-medium text-gray-500">{title}</h3>
        <p className="text-xl font-semibold text-gray-900">{value}</p>
        {subtitle && <p className="text-xs text-gray-500 truncate">{subtitle}</p>}
      </div>
    </div>
  </div>
);

export default Reports;