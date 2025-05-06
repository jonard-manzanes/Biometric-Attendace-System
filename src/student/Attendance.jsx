import React, { useState } from 'react';

const Attendance = () => {
  // Sample data for subjects, teachers, and schedules
  const subjects = [
    { 
      name: 'Mathematics', 
      teacher: 'Mr. Smith', 
      schedule: 'Mon, Wed, Fri - 9:00 AM to 10:30 AM',
      attendance: 85
    },
    { 
      name: 'Physics', 
      teacher: 'Mrs. Johnson', 
      schedule: 'Tue, Thu - 11:00 AM to 12:30 PM',
      attendance: 92
    },
    { 
      name: 'Chemistry', 
      teacher: 'Dr. Lee', 
      schedule: 'Mon, Wed - 1:00 PM to 2:30 PM',
      attendance: 78
    },
    { 
      name: 'Biology', 
      teacher: 'Prof. Garcia', 
      schedule: 'Wed, Fri - 3:00 PM to 4:30 PM',
      attendance: 88
    }
  ];

  const [activeSubject, setActiveSubject] = useState(null);

  // Get attendance status color
  const getAttendanceColor = (percentage) => {
    if (percentage >= 90) return 'bg-emerald-500';
    if (percentage >= 80) return 'bg-emerald-400';
    if (percentage >= 70) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  // Get attendance label
  const getAttendanceLabel = (percentage) => {
    if (percentage >= 90) return 'Excellent';
    if (percentage >= 80) return 'Good';
    if (percentage >= 70) return 'Fair';
    return 'Poor';
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800">Class Attendance</h1>
        <p className="text-gray-600 mt-1">Track your attendance for all enrolled classes</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {subjects.map((subject, index) => (
          <div 
            key={index} 
            className={`bg-white rounded-lg shadow-md overflow-hidden transition-all duration-200 transform hover:-translate-y-1 hover:shadow-lg cursor-pointer ${activeSubject === index ? 'ring-2 ring-emerald-500' : ''}`}
            onClick={() => setActiveSubject(activeSubject === index ? null : index)}
          >
            <div className="h-2 bg-emerald-500"></div>
            <div className="p-5">
              <div className="flex justify-between items-start mb-4">
                <h3 className="font-bold text-xl text-gray-800">{subject.name}</h3>
                <div className={`text-xs font-bold uppercase px-2 py-1 rounded-full text-white ${getAttendanceColor(subject.attendance)}`}>
                  {subject.attendance}%
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <span className="text-xs text-gray-500">Teacher</span>
                    <p className="text-sm font-medium text-gray-800">{subject.teacher}</p>
                  </div>
                </div>
                
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <span className="text-xs text-gray-500">Schedule</span>
                    <p className="text-sm font-medium text-gray-800">{subject.schedule}</p>
                  </div>
                </div>
                
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <span className="text-xs text-gray-500">Attendance Status</span>
                    <p className="text-sm font-medium text-gray-800">{getAttendanceLabel(subject.attendance)}</p>
                  </div>
                </div>
              </div>

              {activeSubject === index && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div 
                      className={`h-2.5 rounded-full ${getAttendanceColor(subject.attendance)}`} 
                      style={{ width: `${subject.attendance}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between mt-2">
                    <span className="text-xs text-gray-500">Present: {subject.attendance}%</span>
                    <span className="text-xs text-gray-500">Absent: {100 - subject.attendance}%</span>
                  </div>
                  <button className="mt-4 w-full bg-emerald-500 hover:bg-emerald-600 text-white py-2 rounded text-sm transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-300">
                    View Full Attendance Record
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Attendance;