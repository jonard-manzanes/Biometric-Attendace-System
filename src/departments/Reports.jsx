import React, { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { 
  Download,
  CalendarDays,
  Clock,
  UserCheck,
  UserX,
  BarChart2,
  Users,
  Filter,
  AlertCircle
} from 'lucide-react';
import { CSVLink } from 'react-csv';
import { Bar, Pie } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

const Reports = () => {
  const [attendanceData, setAttendanceData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setDate(1)).toISOString().split('T')[0], // 1st of current month
    end: new Date().toISOString().split('T')[0] // Today
  });
  const [department, setDepartment] = useState('');
  const [teachers, setTeachers] = useState([]);

  useEffect(() => {
    const fetchDepartment = async () => {
      const dept = localStorage.getItem('studentDepartment');
      if (!dept) {
        setError('Department information not found');
        setLoading(false);
        return;
      }
      setDepartment(dept);
      await fetchTeachers(dept);
    };

    fetchDepartment();
  }, []);

  const fetchTeachers = async (dept) => {
    try {
      const teachersQuery = query(
        collection(db, 'users'),
        where('role', '==', 'teacher'),
        where('department', '==', dept)
      );
      const teachersSnapshot = await getDocs(teachersQuery);
      const teachersData = teachersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setTeachers(teachersData);
      fetchAttendanceData(teachersData.map(t => t.id));
    } catch (err) {
      console.error('Error fetching teachers:', err);
      setError('Failed to load teacher data');
      setLoading(false);
    }
  };

  const fetchAttendanceData = async (teacherIds) => {
    try {
      setLoading(true);
      setError('');

      if (!teacherIds.length) {
        setAttendanceData([]);
        setLoading(false);
        return;
      }

      // Convert date strings to Date objects for comparison
      const startDate = new Date(dateRange.start);
      const endDate = new Date(dateRange.end);
      endDate.setHours(23, 59, 59, 999); // Include entire end day

      // Query attendance for all teachers in the department
      const attendanceQuery = query(
        collection(db, 'teacherAttendance'),
        where('teacherID', 'in', teacherIds)
      );
      const attendanceSnapshot = await getDocs(attendanceQuery);
      
      // Filter by date range and format data
      const filteredData = attendanceSnapshot.docs
        .map(doc => {
          const data = doc.data();
          // Convert Firestore Timestamp to Date if needed
          const recordDate = data.date?.toDate ? data.date.toDate() : new Date(data.date);
          return {
            id: doc.id,
            ...data,
            date: recordDate,
            formattedDate: recordDate.toLocaleDateString(),
            status: data.timeIn ? 'Present' : 'Absent',
            hoursWorked: data.timeIn && data.timeOut 
              ? calculateHours(data.timeIn, data.timeOut)
              : 0
          };
        })
        .filter(item => {
          const itemDate = item.date;
          return itemDate >= startDate && itemDate <= endDate;
        });

      // Add teacher names to attendance records
      const dataWithNames = filteredData.map(record => {
        const teacher = teachers.find(t => t.id === record.teacherID);
        return {
          ...record,
          teacherName: teacher ? `${teacher.firstName} ${teacher.lastName}` : 'Unknown Teacher'
        };
      });

      setAttendanceData(dataWithNames);
    } catch (err) {
      console.error('Error fetching attendance:', err);
      setError('Failed to load attendance data. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const calculateHours = (timeIn, timeOut) => {
    if (!timeIn || !timeOut) return 0;
    
    // Handle both string timestamps and Firestore Timestamps
    const inTime = typeof timeIn === 'string' ? timeIn : timeIn.toDate().toTimeString().substr(0, 5);
    const outTime = typeof timeOut === 'string' ? timeOut : timeOut.toDate().toTimeString().substr(0, 5);
    
    const [inHours, inMinutes] = inTime.split(':').map(Number);
    const [outHours, outMinutes] = outTime.split(':').map(Number);
    
    const totalInMinutes = inHours * 60 + inMinutes;
    const totalOutMinutes = outHours * 60 + outMinutes;
    
    const diffMinutes = totalOutMinutes - totalInMinutes;
    return (diffMinutes / 60).toFixed(2);
  };

  const handleDateChange = (e) => {
    const { name, value } = e.target;
    setDateRange(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleApplyFilter = () => {
    fetchAttendanceData(teachers.map(t => t.id));
  };

  // Prepare data for CSV export
  const csvData = [
    ['Teacher ID', 'Name', 'Date', 'Status', 'Time In', 'Time Out', 'Hours Worked'],
    ...attendanceData.map(item => [
      item.teacherID,
      item.teacherName,
      item.formattedDate,
      item.status,
      item.timeIn ? (typeof item.timeIn === 'string' ? item.timeIn : item.timeIn.toDate().toTimeString().substr(0, 5)) : 'N/A',
      item.timeOut ? (typeof item.timeOut === 'string' ? item.timeOut : item.timeOut.toDate().toTimeString().substr(0, 5)) : 'N/A',
      item.hoursWorked
    ])
  ];

  // Chart data
  const statusCount = attendanceData.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {});

  const barChartData = {
    labels: [...new Set(attendanceData.map(item => item.teacherName))],
    datasets: [
      {
        label: 'Hours Worked',
        data: attendanceData.reduce((acc, item) => {
          const teacherName = item.teacherName;
          if (!acc[teacherName]) {
            acc[teacherName] = 0;
          }
          acc[teacherName] += parseFloat(item.hoursWorked);
          return acc;
        }, {}),
        backgroundColor: 'rgba(54, 162, 235, 0.6)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1
      }
    ]
  };

  const pieChartData = {
    labels: Object.keys(statusCount),
    datasets: [
      {
        data: Object.values(statusCount),
        backgroundColor: [
          'rgba(75, 192, 192, 0.6)',
          'rgba(255, 99, 132, 0.6)'
        ],
        borderColor: [
          'rgba(75, 192, 192, 1)',
          'rgba(255, 99, 132, 1)'
        ],
        borderWidth: 1
      }
    ]
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Teacher Attendance Reports</h1>
        <div className="flex items-center space-x-2">
          <span className="text-sm bg-gray-100 px-3 py-1 rounded-full">
            {department}
          </span>
          <CSVLink 
            data={csvData}
            filename={`teacher-attendance-${dateRange.start}-to-${dateRange.end}.csv`}
            className="flex items-center bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
          >
            <Download size={16} className="mr-1" />
            Export CSV
          </CSVLink>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <div className="relative">
              <input
                type="date"
                name="start"
                value={dateRange.start}
                onChange={handleDateChange}
                className="w-full p-2 border rounded"
              />
              <CalendarDays size={18} className="absolute right-3 top-2.5 text-gray-400" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <div className="relative">
              <input
                type="date"
                name="end"
                value={dateRange.end}
                onChange={handleDateChange}
                className="w-full p-2 border rounded"
              />
              <CalendarDays size={18} className="absolute right-3 top-2.5 text-gray-400" />
            </div>
          </div>
          <div className="flex items-end">
            <button
              onClick={handleApplyFilter}
              className="flex items-center bg-emerald-600 text-white px-4 py-2 rounded hover:bg-emerald-700"
            >
              <Filter size={16} className="mr-1" />
              Apply Filters
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : error ? (
        <div className="bg-red-50 border-l-4 border-red-500 p-4">
          <div className="flex items-center">
            <AlertCircle className="text-red-500 mr-2" size={20} />
            <h3 className="text-red-800 font-medium">Error</h3>
          </div>
          <p className="text-red-700 mt-2">{error}</p>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-100 rounded-full">
                  <Users className="text-blue-600" size={20} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Teachers Tracked</p>
                  <p className="text-2xl font-bold">
                    {[...new Set(attendanceData.map(item => item.teacherID))].length}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-green-100 rounded-full">
                  <UserCheck className="text-green-600" size={20} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Present Days</p>
                  <p className="text-2xl font-bold">{statusCount.Present || 0}</p>
                </div>
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-red-100 rounded-full">
                  <UserX className="text-red-600" size={20} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Absent Days</p>
                  <p className="text-2xl font-bold">{statusCount.Absent || 0}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="bg-white p-4 rounded-lg shadow">
              <h3 className="font-medium text-gray-700 mb-4 flex items-center">
                <BarChart2 className="mr-2 text-blue-500" size={20} />
                Hours Worked by Teacher
              </h3>
              <div className="h-64">
                <Bar 
                  data={barChartData} 
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: 'top',
                      },
                    },
                  }}
                />
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <h3 className="font-medium text-gray-700 mb-4 flex items-center">
                <BarChart2 className="mr-2 text-blue-500" size={20} />
                Attendance Status Distribution
              </h3>
              <div className="h-64">
                <Pie 
                  data={pieChartData} 
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Detailed Table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Teacher</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time In</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time Out</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hours</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {attendanceData.length > 0 ? (
                    attendanceData.map((record) => (
                      <tr key={record.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {record.teacherName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {record.formattedDate}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            record.status === 'Present' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {record.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {record.timeIn ? (typeof record.timeIn === 'string' ? record.timeIn : record.timeIn.toDate().toTimeString().substr(0, 5)) : 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {record.timeOut ? (typeof record.timeOut === 'string' ? record.timeOut : record.timeOut.toDate().toTimeString().substr(0, 5)) : 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {record.hoursWorked}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" className="px-6 py-4 text-center text-sm text-gray-500">
                        No attendance records found for the selected period
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Reports;