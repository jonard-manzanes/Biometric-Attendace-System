import React from 'react';
import Swal from 'sweetalert2';

const AttendanceCard = ({ subject, index, activeSubject, setActiveSubject, userRole }) => {
  const getTeacherName = () => {
    if (subject.teacherName) return subject.teacherName;
    if (subject.fullName) return subject.fullName;
    if (subject.firstName && subject.lastName) return `${subject.firstName} ${subject.lastName}`;
    if (subject.firstName) return subject.firstName;
    return "Unknown Teacher";
  };

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete ${subject.subjectName}?`)) {
      Swal.fire({
        title: 'Deleted!',
        text: `${subject.subjectName} has been deleted successfully.`,
        icon: 'success',
        confirmButtonText: 'OK'
      });
    }
  };

  return (
    <div 
      className={`bg-white rounded-lg shadow-md overflow-hidden transition-all duration-200 transform hover:-translate-y-1 hover:shadow-lg cursor-pointer ${activeSubject === index ? 'ring-2 ring-emerald-500' : ''}`}
      onClick={() => setActiveSubject(activeSubject === index ? null : index)}
    >
      <div className="h-2 bg-emerald-500"></div>
      <div className="p-5">
        <div className="flex justify-between items-start mb-4">
          <h3 className="font-bold text-xl text-gray-800">{subject.subjectName}</h3>
          {subject.joinCode && (
            <div className="bg-emerald-100 text-emerald-800 text-xs font-medium px-2.5 py-0.5 rounded">
              Code: {subject.joinCode}
            </div>
          )}
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
              <p className="text-sm font-medium text-gray-800">{getTeacherName()}</p>
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
              <ul className="text-sm font-medium text-gray-800">
                {subject.schedule && subject.schedule.length > 0 ? (
                  subject.schedule.map((s, i) => (
                    <li key={i}>{s.day}: {s.start} – {s.end}</li>
                  ))
                ) : (
                  <li>No schedule set</li>
                )}
              </ul>
            </div>
          </div>
        </div>

        {activeSubject === index && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            {userRole === "teacher" && (
              <div className="space-y-2 mt-4">
                <button
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-2 rounded text-sm transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                  onClick={(e) => {
                    e.stopPropagation();
                    alert(`Attendance marked for ${subject.subjectName}`);
                  }}
                >
                  Mark Attendance
                </button>
                <button
                  className="w-full bg-red-500 hover:bg-red-600 text-white py-2 rounded text-sm transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-red-300"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete();
                  }}
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AttendanceCard;
