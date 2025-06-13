import React, { useEffect, useState } from 'react';
import { db } from '../firebaseConfig';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';

const ClassesProof = () => {
  const [verifiedClasses, setVerifiedClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchVerifiedClasses = async () => {
      try {
        setLoading(true);
        const snapshot = await getDocs(collection(db, "classes"));
        const allClasses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const classesWithVerifications = await Promise.all(
          allClasses.map(async (cls) => {
            // Filter verifications for the selected date
            const verifications = cls.verifications?.filter(v => v.date === selectedDate) || [];
            
            if (verifications.length === 0) return null;

            // Get teacher details
            let teacherName = "Unknown Teacher";
            if (cls.teacherID) {
              const teacherDoc = await getDoc(doc(db, "users", cls.teacherID));
              if (teacherDoc.exists()) {
                const t = teacherDoc.data();
                teacherName = `${t.firstName || ""} ${t.lastName || ""}`.trim() || "Unnamed Teacher";
              }
            }

            return verifications.map(verification => ({
              classId: cls.id,
              subjectName: cls.subjectName,
              joinCode: cls.joinCode,
              teacherName,
              verification
            }));
          })
        );

        // Flatten and filter out nulls
        const flattened = classesWithVerifications.flat().filter(Boolean);
        setVerifiedClasses(flattened);
      } catch (error) {
        console.error("Error fetching verified classes:", error);
        Swal.fire({
          title: 'Error',
          text: 'Failed to load verified classes',
          icon: 'error'
        });
      } finally {
        setLoading(false);
      }
    };

    fetchVerifiedClasses();
  }, [selectedDate]);

  const handleDateChange = (e) => {
    setSelectedDate(e.target.value);
  };

  const formatDate = (dateString) => {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-lg font-medium text-gray-700">Loading verified classes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className=" mx-auto">
        <div className="bg-white rounded-xl shadow-md p-6 mb-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Class Verification Proof</h1>
              <p className="text-gray-600 mt-1">View evidence of classes that took place</p>
            </div>
            
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-gray-700">
                Select Date:
                <input
                  type="date"
                  value={selectedDate}
                  onChange={handleDateChange}
                  className="ml-2 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
                />
              </label>
              
              <button
                onClick={() => navigate(-1)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-md text-sm font-medium transition-colors"
              >
                Back
              </button>
            </div>
          </div>
        </div>

        {verifiedClasses.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-8 text-center">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No Verifications Found</h3>
            <p className="text-gray-500">No classes were verified on {formatDate(selectedDate)}</p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {verifiedClasses.map((item, index) => (
              <div key={`${item.classId}-${index}`} className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-200">
                <div className="p-5">
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="text-lg font-bold text-gray-800">{item.subjectName}</h3>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Verified
                    </span>
                  </div>
                  
                  <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex items-center">
                      <svg className="w-4 h-4 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {new Date(item.verification.verifiedAt).toLocaleTimeString()}
                    </div>
                    
                    <div className="flex items-center">
                      <svg className="w-4 h-4 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      {item.teacherName}
                    </div>
                    
                    {item.joinCode && (
                      <div className="flex items-center">
                        <svg className="w-4 h-4 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                        </svg>
                        Code: {item.joinCode}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="border-t border-gray-200 p-4 bg-gray-50">
                  <div className="mb-3">
                    <h4 className="text-sm font-medium text-gray-700 mb-1">Verification Proof</h4>
                    <a 
                      href={item.verification.imageUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="block"
                    >
                      <img 
                        src={item.verification.imageUrl} 
                        alt={`Proof for ${item.subjectName}`}
                        className="w-full h-40 object-cover rounded-lg border border-gray-300 hover:shadow-md transition-shadow"
                      />
                    </a>
                  </div>
                  
                  <div className="text-xs text-gray-500">
                    <p>Verified at: {new Date(item.verification.verifiedAt).toLocaleString()}</p>
                    {item.verification.schedule && (
                      <p>Class time: {item.verification.schedule.start} - {item.verification.schedule.end}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ClassesProof;