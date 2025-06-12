import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebaseConfig";
import { Calendar, Clock, ArrowLeft } from "lucide-react";

const ClassDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [classData, setClassData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchClassDetail = async () => {
      try {
        const classRef = doc(db, "classes", id);
        const classSnap = await getDoc(classRef);
        if (classSnap.exists()) {
          setClassData(classSnap.data());
        } else {
          setError("Class not found");
        }
      } catch (err) {
        console.error("Error fetching class details:", err);
        setError("Failed to fetch class details");
      } finally {
        setLoading(false);
      }
    };
    fetchClassDetail();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <p className="text-lg text-gray-600">Loading class details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 px-6">
        <p className="text-lg text-red-500 mb-4">{error}</p>
        <button
          onClick={() => navigate(-1)}
          className="bg-emerald-500 text-white px-5 py-2 rounded-md hover:bg-emerald-600 flex items-center gap-2"
        >
          <ArrowLeft size={18} />
          Go Back
        </button>
      </div>
    );
  }

  const totalStudents = classData.students?.length || 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto">
        <button
          onClick={() => navigate(-1)}
          className="mb-6 inline-flex items-center gap-2 text-emerald-600 hover:underline"
        >
          <ArrowLeft size={18} />
          Back to Classes
        </button>

        <div className="bg-white rounded-xl shadow-md p-6 sm:p-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-4">
            {classData.subjectName}
          </h1>

          {classData.joinCode && (
            <p className="mb-6 text-sm text-gray-600">
              <span className="font-medium text-gray-700">Join Code:</span> {classData.joinCode}
            </p>
          )}

          {classData.schedule?.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-gray-800 mb-3">Schedule</h2>
              <ul className="space-y-3">
                {classData.schedule.map((s, index) => (
                  <li key={index} className="flex items-center text-gray-700">
                    <Calendar size={18} className="mr-2 text-emerald-500" />
                    <span className="mr-4 font-medium">{s.day}:</span>
                    <Clock size={18} className="mr-2 text-emerald-500" />
                    <span>{s.start} – {s.end}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Students</h2>
            <p className="mb-4 text-sm text-gray-600">
              Total Enrolled: <span className="font-bold text-gray-800">{totalStudents}</span>
            </p>

            {totalStudents > 0 ? (
              <ul className="divide-y divide-gray-200">
                {classData.students.map((student) => (
                  <li key={student.id} className="py-4 flex items-center">
                    <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center font-semibold text-lg mr-4">
                      {student.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-gray-800 font-medium">{student.name}</p>
                      <p className="text-sm text-gray-500">{student.email}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500">No students enrolled yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClassDetail;
