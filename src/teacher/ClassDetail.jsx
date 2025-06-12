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
      <div className="p-6">
        <p>Loading class details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <p className="text-red-500">{error}</p>
        <button
          onClick={() => navigate(-1)}
          className="mt-4 bg-emerald-500 text-white px-4 py-2 rounded hover:bg-emerald-600 flex items-center"
        >
          <ArrowLeft size={16} className="mr-2" />
          Back
        </button>
      </div>
    );
  }

  // Assuming classData.students is an array of student objects { id, name, email }
  const totalStudents = classData.students?.length || 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <button
        onClick={() => navigate(-1)}
        className="mb-6 bg-emerald-500 text-white px-4 py-2 rounded hover:bg-emerald-600 flex items-center"
      >
        <ArrowLeft size={16} className="mr-2" />
        Back
      </button>
      <div className="bg-white p-6 rounded shadow">
        <h1 className="text-3xl font-bold mb-4">{classData.subjectName}</h1>
        {classData.joinCode && (
          <div className="mb-4">
            <strong>Join Code:</strong> {classData.joinCode}
          </div>
        )}

        {classData.schedule && classData.schedule.length > 0 && (
          <div className="mb-6">
            <h2 className="text-2xl font-semibold mb-3">Schedule</h2>
            <ul className="space-y-3">
              {classData.schedule.map((s, index) => (
                <li key={index} className="flex items-center">
                  <Calendar size={16} className="mr-2 text-emerald-500" />
                  <span className="mr-4 font-medium">{s.day}:</span>
                  <Clock size={16} className="mr-2 text-emerald-500" />
                  <span>
                    {s.start} – {s.end}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mb-6">
          <h2 className="text-2xl font-semibold mb-2">Students</h2>
          <p className="mb-4 text-gray-600">
            Total Enrolled: <span className="font-bold">{totalStudents}</span>
          </p>
          {totalStudents > 0 ? (
            <ul className="divide-y divide-gray-200">
              {classData.students.map((student) => (
                <li key={student.id} className="py-3 flex items-center">
                  <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 font-bold mr-4">
                    {student.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-lg font-medium text-gray-800">
                      {student.name}
                    </p>
                    <p className="text-sm text-gray-500">{student.email}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500">No students enrolled yet.</p>
          )}
        </div>

        {/* Additional detailed information can be added here */}
      </div>
    </div>
  );
};

export default ClassDetail;
