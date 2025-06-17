import React, { useEffect, useState } from "react";
import { db } from "../firebaseConfig";
import { collection, getDocs, query, where, getDoc, doc } from "firebase/firestore";
import { User, CheckCircle, Clock, Calendar, Image as ImageIcon } from 'lucide-react';

const VerifiedClass = () => {
  const [verifiedClasses, setVerifiedClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    const fetchVerifiedClasses = async () => {
      try {
        const user = JSON.parse(localStorage.getItem('user'));
        setCurrentUser(user);

        // Get all classes with verifications
        const classesSnapshot = await getDocs(collection(db, "classes"));
        const allClasses = classesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // Filter classes that have verifications for the selected date
        const verified = await Promise.all(
          allClasses
            .filter(cls => cls.verifications?.some(v => v.date === filterDate))
            .map(async cls => {
              const verification = cls.verifications.find(v => v.date === filterDate);
              
              // Get teacher details
              let teacherName = "Unknown Teacher";
              if (cls.teacherID) {
                const teacherDoc = await getDoc(doc(db, "users", cls.teacherID));
                if (teacherDoc.exists()) {
                  const t = teacherDoc.data();
                  teacherName = `${t.firstName || ""} ${t.lastName || ""}`.trim();
                }
              }

              // Get staff who verified
              let verifiedByName = "Unknown";
              if (verification.verifiedBy) {
                const verifierDoc = await getDoc(doc(db, "users", verification.verifiedBy));
                if (verifierDoc.exists()) {
                  const v = verifierDoc.data();
                  verifiedByName = `${v.firstName || ""} ${v.lastName || ""}`.trim();
                }
              }

              return {
                id: cls.id,
                subjectName: cls.subjectName,
                teacherName,
                verification,
                verifiedByName,
                department: cls.department,
                schedule: cls.schedule?.find(s => s.day === verification.day)
              };
            })
        );

        setVerifiedClasses(verified);
      } catch (error) {
        console.error("Error fetching verified classes:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchVerifiedClasses();
  }, [filterDate]);

  const formatTime = (timeStr) => {
    if (!timeStr) return "";
    if (timeStr.includes("AM") || timeStr.includes("PM")) return timeStr;
    
    const [hours, minutes] = timeStr.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 || 12;
    return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="bg-white rounded-lg shadow-sm overflow-hidden mb-6">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">
            Verified Classes
          </h2>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 mt-2">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Calendar size={16} className="text-gray-400" />
              </div>
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
              />
            </div>
            <div className="bg-emerald-100 text-emerald-800 px-3 py-2 rounded-md text-sm">
              {verifiedClasses.length} verified classes
            </div>
          </div>
        </div>

        {verifiedClasses.length === 0 ? (
          <div className="p-8 text-center">
            <div className="mx-auto h-12 w-12 text-gray-400">
              <CheckCircle size={48} className="mx-auto" />
            </div>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No verified classes</h3>
            <p className="mt-1 text-sm text-gray-500">
              No classes were verified on {formatDate(filterDate)}.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Class
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Schedule
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Verified By
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Proof
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {verifiedClasses.map(cls => (
                  <tr key={cls.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                          <User size={18} />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {cls.subjectName}
                          </div>
                          <div className="text-sm text-gray-500">
                            {cls.teacherName}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {cls.schedule ? (
                        <div className="flex items-center">
                          <Clock size={16} className="text-gray-400 mr-2" />
                          <span className="text-sm text-gray-900">
                            {formatTime(cls.schedule.start)} - {formatTime(cls.schedule.end)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-500">No schedule</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {cls.verifiedByName}
                      <div className="text-xs text-gray-400">
                        {new Date(cls.verification.verifiedAt).toLocaleTimeString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {cls.verification.imageUrl ? (
                        <a
                          href={cls.verification.imageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md text-emerald-700 bg-emerald-100 hover:bg-emerald-200 focus:outline-none"
                        >
                          <ImageIcon size={16} className="mr-1" />
                          View Proof
                        </a>
                      ) : (
                        <span className="text-gray-500">No image</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default VerifiedClass;