import React, { useEffect, useState } from "react";
import { db } from "../firebaseConfig";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalClassesToday: 0,
    verifiedClasses: 0,
    pendingVerification: 0,
    verificationRate: 0,
    department: ""
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchVerificationStats = async () => {
      try {
        const user = JSON.parse(localStorage.getItem('user'));
        if (!user || !user.department) {
          navigate('/login');
          return;
        }

        const today = new Date().toLocaleString("en-US", { weekday: "long" });
        const currentDate = new Date().toISOString().split('T')[0];
        
        // Get all classes
        const snapshot = await getDocs(collection(db, "classes"));
        const classesWithTeacher = await Promise.all(
          snapshot.docs.map(async (docRef) => {
            const cls = docRef.data();
            const todaySchedule = cls.schedule?.find((s) => s.day === today);
            if (!todaySchedule) return null;

            let teacherDepartment = null;
            if (cls.teacherID) {
              const teacherDoc = await getDoc(doc(db, "users", cls.teacherID));
              if (teacherDoc.exists()) {
                teacherDepartment = teacherDoc.data().department;
              }
            }

            if (teacherDepartment !== user.department) {
              return null;
            }

            const todayVerification = cls.verifications?.find(
              v => v.date === currentDate || v.day === today
            );

            return {
              ...cls,
              id: docRef.id,
              schedule: todaySchedule,
              verification: todayVerification || null,
            };
          })
        );

        const todayClasses = classesWithTeacher.filter(cls => cls !== null);
        const verifiedCount = todayClasses.filter(cls => cls.verification).length;

        setStats({
          totalClassesToday: todayClasses.length,
          verifiedClasses: verifiedCount,
          pendingVerification: todayClasses.length - verifiedCount,
          verificationRate: todayClasses.length ? 
            Math.round((verifiedCount / todayClasses.length) * 100) : 0,
          department: user.department
        });

      } catch (err) {
        console.error("Error fetching stats:", err);
        setError("Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    };

    fetchVerificationStats();
  }, [navigate]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded max-w-md text-center">
          {error}
          <button 
            onClick={() => window.location.reload()} 
            className="mt-2 bg-red-500 text-white px-3 py-1 rounded"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white rounded-xl shadow-md p-6 mb-8">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center">
          <div className="mb-4 md:mb-0">
            <h1 className="text-2xl font-bold text-emerald-700 mb-2">
              {stats.department} Verification Dashboard
            </h1>
            <p className="text-gray-600">
              {new Date().toLocaleDateString('en-US', { 
                weekday: 'long', 
                month: 'long', 
                day: 'numeric', 
                year: 'numeric' 
              })}
            </p>
          </div>
          <div className="text-right">
            <span className="inline-block bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full text-sm font-medium">
              {stats.verificationRate}% Verified
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
          <h3 className="text-gray-500 font-medium">Total Classes</h3>
          <p className="text-3xl font-bold text-blue-600">
            {stats.totalClassesToday}
          </p>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
          <h3 className="text-gray-500 font-medium">Verified</h3>
          <p className="text-3xl font-bold text-green-600">
            {stats.verifiedClasses}
          </p>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-orange-500">
          <h3 className="text-gray-500 font-medium">Pending</h3>
          <p className="text-3xl font-bold text-orange-500">
            {stats.pendingVerification}
          </p>
        </div>
      </div>

      {stats.totalClassesToday === 0 ? (
        <div className="bg-white rounded-xl shadow-md p-12 text-center">
          <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-12 h-12 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-gray-800 mb-2">No Classes Today</h3>
          <p className="text-gray-600">No classes are scheduled for today in your department.</p>
        </div>
      ) : stats.pendingVerification > 0 ? (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 text-yellow-800 p-4 rounded-lg shadow-sm">
          <div className="flex items-start">
            <svg className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="font-medium">Attention needed!</p>
              <p className="text-sm mt-1">
                You have {stats.pendingVerification} class{stats.pendingVerification !== 1 ? 'es' : ''} remaining to verify today.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-green-50 border-l-4 border-green-400 text-green-800 p-4 rounded-lg shadow-sm">
          <div className="flex items-start">
            <svg className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="font-medium">Great job!</p>
              <p className="text-sm mt-1">All classes have been verified for today.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;