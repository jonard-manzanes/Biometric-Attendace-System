import React, { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { doc, getDocs, getDoc, collection } from 'firebase/firestore';

const Attendance = () => {
  const [subjects, setSubjects] = useState([]);
  const [activeSubject, setActiveSubject] = useState(null);

  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'classes'));
        const fetchedSubjects = querySnapshot.docs.map(doc => doc.data());

        const teacherPromises = fetchedSubjects.map(async (subject) => {
          const teacherRef = doc(db, 'users', subject.teacherID);
          const teacherDoc = await getDoc(teacherRef);

          let teacherName = 'Unknown Teacher';
          if (teacherDoc.exists()) {
            const data = teacherDoc.data();
            if (data.role === 'teacher') {
              teacherName = `${data.firstName} ${data.middle ? data.middle + ' ' : ''}${data.lastName}`;
            }
          }

          return {
            ...subject,
            teacherName,
          };
        });

        const mappedSubjects = await Promise.all(teacherPromises);
        setSubjects(mappedSubjects);
      } catch (error) {
        console.error('Error fetching subjects: ', error);
      }
    };

    fetchSubjects();
  }, []);

  const AttendanceCard = ({ subject, index, activeSubject, setActiveSubject }) => {
    const getTeacherName = () => subject.teacherName || 'Unknown Teacher';

    return (
      <div
        className={`bg-white rounded-lg shadow-md overflow-hidden transition-all duration-200 transform hover:-translate-y-1 hover:shadow-lg cursor-pointer ${
          activeSubject === index ? 'ring-2 ring-emerald-500' : ''
        }`}
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
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <span className="text-xs text-gray-500">Schedule</span>
                <ul className="text-sm font-medium text-gray-800">
                  {subject.schedule && subject.schedule.length > 0 ? (
                    subject.schedule.map((s, i) => (
                      <li key={i}>
                        {s.day}: {s.start} – {s.end}
                      </li>
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
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800">Class Attendance</h1>
        <p className="text-gray-600 mt-1">Track your attendance for all enrolled classes</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {subjects.map((subject, index) => (
          <AttendanceCard
            key={index}
            subject={subject}
            index={index}
            activeSubject={activeSubject}
            setActiveSubject={setActiveSubject}
          />
        ))}
      </div>
    </div>
  );
};

export default Attendance;
