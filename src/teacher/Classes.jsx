import React, { useState, useEffect } from "react";
import { db } from "../firebaseConfig";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  Timestamp,
  deleteDoc,
  doc,
  getDoc,
} from "firebase/firestore";

const dayOptions = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const Classes = ({ currentUser }) => {
  const [subjectName, setSubjectName] = useState("");
  const [schedules, setSchedules] = useState([]);
  const [day, setDay] = useState("Monday");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [teacherNames, setTeacherNames] = useState({});

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

  const addSchedule = () => {
    if (!startTime || !endTime) {
      setError("Please set both start and end time");
      return;
    }
    setSchedules((prev) => [...prev, { day, start: startTime, end: endTime }]);
    setStartTime("");
    setEndTime("");
    setError("");
  };

  const handleCreateClass = async () => {
    const userId = getUserId();
    if (!userId) {
      setError("User not authenticated. Please log in again.");
      return;
    }

    if (!subjectName || schedules.length === 0) {
      setError("Please fill subject name and add at least one schedule");
      return;
    }

    setLoading(true);
    setError("");

    const joinCode =
      subjectName.slice(0, 4).toUpperCase() +
      Math.floor(100 + Math.random() * 900);

    try {
      await addDoc(collection(db, "classes"), {
        subjectName,
        schedule: schedules,
        teacherID: userId,
        studentIDs: [],
        joinCode,
        createdAt: Timestamp.now(),
      });

      alert(`Class created successfully! Join code: ${joinCode}`);
      setSubjectName("");
      setSchedules([]);
      await fetchClasses();
    } catch (err) {
      console.error("Error creating class:", err);
      setError("Failed to create class. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const fetchClasses = async () => {
    const userId = getUserId();
    if (!userId) {
      setError("User not authenticated");
      return;
    }

    setLoading(true);
    try {
      const q = query(collection(db, "classes"), where("teacherID", "==", userId));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setClasses(data);
      fetchTeacherNames(data);
    } catch (err) {
      console.error("Error fetching classes:", err);
      setError("Failed to load classes");
    } finally {
      setLoading(false);
    }
  };

  const fetchTeacherNames = async (classes) => {
    const newTeacherNames = {};

    for (const subject of classes) {
      if (subject.teacherID) {
        const teacherName = await getTeacherName(subject.teacherID);
        newTeacherNames[subject.id] = teacherName;
      } else {
        newTeacherNames[subject.id] = "Unknown Teacher";
      }
    }

    setTeacherNames(newTeacherNames);
  };

  const getTeacherName = async (teacherID) => {
    try {
      const teacherDocRef = doc(db, "users", teacherID);
      const teacherDoc = await getDoc(teacherDocRef);

      if (teacherDoc.exists()) {
        const teacherData = teacherDoc.data();
        const fullName = `${teacherData.firstName} ${teacherData.lastName}`;
        return fullName.trim() !== "" ? fullName : "Unnamed Teacher";
      } else {
        console.warn("Teacher not found for ID:", teacherID);
        return "Unknown Teacher";
      }
    } catch (error) {
      console.error("Error fetching teacher data:", error);
      return "Error fetching name";
    }
  };

  const handleDelete = async (classId) => {
    const confirmDelete = window.confirm("Are you sure you want to delete this class?");
    if (!confirmDelete) return;

    try {
      await deleteDoc(doc(db, "classes", classId));
      setClasses((prev) => prev.filter((cls) => cls.id !== classId));
      alert("Class deleted successfully.");
    } catch (err) {
      console.error("Error deleting class:", err);
      setError("Failed to delete class. Please try again.");
    }
  };

  useEffect(() => {
    fetchClasses();
  }, []);

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Create a Class</h1>

      {error && <div className="text-red-500 mb-4">{error}</div>}

      <input
        type="text"
        placeholder="Subject Name"
        value={subjectName}
        onChange={(e) => setSubjectName(e.target.value)}
        className="border p-2 mb-2 w-full"
      />

      <div className="flex items-center gap-2 mb-2">
        <select value={day} onChange={(e) => setDay(e.target.value)} className="border p-2">
          {dayOptions.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <input
          type="time"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          className="border p-2"
        />
        <input
          type="time"
          value={endTime}
          onChange={(e) => setEndTime(e.target.value)}
          className="border p-2"
        />
        <button onClick={addSchedule} className="bg-green-500 text-white px-3 py-1">
          + Add Time
        </button>
      </div>

      <ul className="mb-4">
        {schedules.map((s, i) => (
          <li key={i} className="text-sm">
            {s.day}: {s.start} – {s.end}
          </li>
        ))}
      </ul>

      <button
        onClick={handleCreateClass}
        disabled={loading}
        className="bg-blue-500 text-white px-4 py-2 disabled:bg-blue-300"
      >
        {loading ? "Creating..." : "Create Class"}
      </button>

      <hr className="my-6" />

      <h2 className="text-lg font-semibold mb-2">My Classes</h2>
      {loading && classes.length === 0 ? (
        <p>Loading classes...</p>
      ) : classes.length === 0 ? (
        <p>No classes found</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-4">
          {classes.map((subject) => (
            <div
              key={subject.id}
              className="bg-white rounded-lg shadow-md overflow-hidden transition-all duration-200 transform hover:-translate-y-1 hover:shadow-lg cursor-pointer"
            >
              <div className="h-2 bg-emerald-500"></div>
              <div className="p-5">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="font-bold text-xl text-gray-800">
                    {subject.subjectName}
                  </h3>
                  {subject.joinCode && (
                    <div className="bg-emerald-100 text-emerald-800 text-xs font-medium px-2.5 py-0.5 rounded">
                      Code: {subject.joinCode}
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
                      🎓
                    </div>
                    <div className="ml-3">
                      <span className="text-xs text-gray-500">Teacher</span>
                      <p className="text-sm font-medium text-gray-800">
                        {teacherNames[subject.id] || "Unknown Teacher"}
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleDelete(subject.id)}
                  className="mt-4 text-sm text-red-500 hover:underline"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Classes;
