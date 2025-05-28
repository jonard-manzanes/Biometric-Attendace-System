import React, { useState, useEffect } from 'react';
import { db } from "../firebaseConfig";
import { collection, query, where, getDocs } from "firebase/firestore";
import { Calendar, Clock, Users, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Dashboard = ({ currentUser }) => {
  const [stats, setStats] = useState({
    totalClasses: 0,
    todayClasses: 0,
    totalStudents: 0,
    alerts: 0
  });
  const [recentClasses, setRecentClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const getUserId = () => {
    const storedUserDocId = localStorage.getItem("userDocId");
    if (storedUserDocId) return storedUserDocId;

    const userString = localStorage.getItem("user");
    if (userString) {
      const user = JSON.parse(userString);
      return user.docId || user.uid;
    }

    if (currentUser?.uid) return currentUser.uid;
    return null;
  };

  useEffect(() => {
    const fetchDashboardData = async () => {
      const userId = getUserId();
      if (!userId) return;

      setLoading(true);
      
      try {
        const q = query(collection(db, "classes"), where("teacherID", "==", userId));
        const snapshot = await getDocs(q);
        const classesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        const today = new Date().toLocaleString('en-us', { weekday: 'long' });
        const todayClasses = classesData.filter(cls => 
          cls.schedule?.some(sched => sched.day === today)
        ).length;

        const totalStudents = classesData.reduce(
          (acc, cls) => acc + (cls.studentIDs?.length || 0), 0
        );

        const sortedClasses = [...classesData].sort((a, b) => 
          b.createdAt?.toDate() - a.createdAt?.toDate()
        ).slice(0, 3);

        setStats({
          totalClasses: classesData.length,
          todayClasses,
          totalStudents,
          alerts: 0 
        });

        setRecentClasses(sortedClasses);
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [currentUser]);

  if (loading) {
    return <div className="text-center py-12">Loading dashboard...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Welcome back, Teacher!</h2>
        
        <button 
          onClick={() => navigate('/teacher/classes')}
          className="mt-4 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-md flex items-center transition-colors"
        >
          <Users className="mr-2" size={18} />
          Manage All Classes
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white shadow rounded-xl p-5 flex items-start">
          <div className="bg-blue-100 p-3 rounded-lg mr-4">
            <Users className="text-blue-600" size={20} />
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">Total Classes</h3>
            <p className="text-2xl font-bold text-gray-800 mt-1">{stats.totalClasses}</p>
          </div>
        </div>

        <div className="bg-white shadow rounded-xl p-5 flex items-start">
          <div className="bg-green-100 p-3 rounded-lg mr-4">
            <Calendar className="text-green-600" size={20} />
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">Today's Classes</h3>
            <p className="text-2xl font-bold text-gray-800 mt-1">{stats.todayClasses}</p>
          </div>
        </div>

        <div className="bg-white shadow rounded-xl p-5 flex items-start">
          <div className="bg-purple-100 p-3 rounded-lg mr-4">
            <Users className="text-purple-600" size={20} />
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">Total Students</h3>
            <p className="text-2xl font-bold text-gray-800 mt-1">{stats.totalStudents}</p>
          </div>
        </div>

        <div className="bg-white shadow rounded-xl p-5 flex items-start">
          <div className="bg-red-100 p-3 rounded-lg mr-4">
            <AlertTriangle className="text-red-600" size={20} />
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">Pending Actions</h3>
            <p className="text-2xl font-bold text-gray-800 mt-1">{stats.alerts}</p>
          </div>
        </div>
      </div>

      <div className="bg-white shadow rounded-2xl overflow-hidden">
        <div className="p-5 border-b">
          <h3 className="text-lg font-semibold text-gray-800">Recent Classes</h3>
        </div>
        
        <ul className="divide-y divide-gray-100">
          {recentClasses.length > 0 ? (
            recentClasses.map(cls => (
              <li key={cls.id} className="p-5 hover:bg-gray-50 cursor-pointer" 
                  onClick={() => navigate(`/classes/${cls.id}`)}>
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="font-medium text-gray-800">{cls.subjectName}</h4>
                    {cls.schedule?.[0] && (
                      <div className="flex items-center mt-1 text-sm text-gray-500">
                        <Calendar size={14} className="mr-1" />
                        <span>{cls.schedule[0].day} • </span>
                        <Clock size={14} className="ml-1 mr-1" />
                        <span>{cls.schedule[0].start} - {cls.schedule[0].end}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center">
                    <span className="bg-emerald-100 text-emerald-800 text-xs px-2 py-1 rounded-full">
                      {cls.studentIDs?.length || 0} students
                    </span>
                  </div>
                </div>
              </li>
            ))
          ) : (
            <li className="p-5 text-center text-gray-500">
              No classes found. Create your first class to get started.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
};

export default Dashboard;