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
  updateDoc,
  arrayRemove,
} from "firebase/firestore";
import { X, Calendar, Clock, Plus, Trash2, Edit } from "lucide-react";
import Swal from "sweetalert2";

const dayOptions = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const ClassModal = ({
  isOpen,
  onClose,
  onSubmit,
  loading,
  mode = "create",
  initialData = null,
}) => {
  const [subjectName, setSubjectName] = useState("");
  const [day, setDay] = useState("Monday");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [schedules, setSchedules] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (mode === "edit" && initialData) {
      setSubjectName(initialData.subjectName);
      setSchedules(initialData.schedule || []);
    } else {
      resetForm();
    }
  }, [mode, initialData]);

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

  const removeSchedule = (index) => {
    setSchedules((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (!subjectName) {
      setError("Please enter a subject name");
      return;
    }

    if (schedules.length === 0) {
      setError("Please add at least one schedule");
      return;
    }

    onSubmit({
      subjectName,
      schedules,
    });
  };

  const resetForm = () => {
    setSubjectName("");
    setDay("Monday");
    setStartTime("");
    setEndTime("");
    setSchedules([]);
    setError("");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 opacity-95 bg-white flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-emerald-500 px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold text-white">
            {mode === "edit" ? "Edit Class" : "Create New Class"}
          </h2>
          <button
            onClick={handleClose}
            className="text-white hover:bg-emerald-600 rounded-full p-1"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {error && (
            <div className="mb-4 bg-red-50 border-l-4 border-red-500 p-3 text-red-700">
              <p className="text-sm">{error}</p>
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Subject Name
            </label>
            <input
              type="text"
              placeholder="e.g., Mathematics 101"
              value={subjectName}
              onChange={(e) => setSubjectName(e.target.value)}
              className="block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Schedule
            </label>

            <div className="bg-gray-50 p-4 rounded-md mb-4">
              <div className="grid grid-cols-4 gap-2">
                <div className="col-span-4 sm:col-span-1">
                  <label className="block text-xs text-gray-500 mb-1">
                    Day
                  </label>
                  <select
                    value={day}
                    onChange={(e) => setDay(e.target.value)}
                    className="w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm focus:ring-emerald-500 focus:border-emerald-500"
                  >
                    {dayOptions.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs text-gray-500 mb-1">
                    Start
                  </label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs text-gray-500 mb-1">
                    End
                  </label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>

                <div className="col-span-4 sm:col-span-1 flex items-end">
                  <button
                    onClick={addSchedule}
                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-2 rounded-md flex items-center justify-center text-sm transition-colors"
                  >
                    <Plus size={16} className="mr-1" /> Add
                  </button>
                </div>
              </div>
            </div>

            {schedules.length > 0 && (
              <div className="border border-gray-200 rounded-md overflow-hidden">
                <h4 className="text-sm font-medium bg-gray-50 px-4 py-2 border-b">
                  Added Schedules
                </h4>
                <ul className="divide-y divide-gray-200">
                  {schedules.map((s, i) => (
                    <li
                      key={i}
                      className="px-4 py-3 flex justify-between items-center hover:bg-gray-50"
                    >
                      <div className="flex items-center">
                        <Calendar size={16} className="text-gray-400 mr-2" />
                        <span className="text-sm font-medium text-gray-700 mr-2">
                          {s.day}:
                        </span>
                        <Clock size={16} className="text-gray-400 mr-1" />
                        <span className="text-sm text-gray-600">
                          {s.start} – {s.end}
                        </span>
                      </div>
                      <button
                        onClick={() => removeSchedule(i)}
                        className="text-red-500 hover:text-red-700 p-1"
                      >
                        <Trash2 size={16} />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        <div className="bg-gray-50 px-6 py-4 flex justify-end gap-2 border-t">
          <button
            onClick={handleClose}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-emerald-500 hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:bg-emerald-300"
          >
            {loading
              ? mode === "edit"
                ? "Updating..."
                : "Creating..."
              : mode === "edit"
              ? "Update Class"
              : "Create Class"}
          </button>
        </div>
      </div>
    </div>
  );
};

const Classes = ({ currentUser }) => {
  const [showModal, setShowModal] = useState(false);
  const [editModalData, setEditModalData] = useState(null);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [teacherNames, setTeacherNames] = useState({});
  const [studentDetails, setStudentDetails] = useState({});
  const [expandedClass, setExpandedClass] = useState(null);

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

  const handleCreateClass = async ({ subjectName, schedules }) => {
    const userId = getUserId();
    if (!userId) {
      setError("User not authenticated. Please log in again.");
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

      Swal.fire({
        icon: "success",
        title: "Class created!",
        html: `Join code: <strong>${joinCode}</strong>`,
        confirmButtonColor: "#10b981",
      });

      setShowModal(false);
      await fetchClasses();
    } catch (err) {
      console.error("Error creating class:", err);
      setError("Failed to create class. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateClass = async ({ subjectName, schedules }) => {
    if (!editModalData) return;

    setLoading(true);
    setError("");

    try {
      await updateDoc(doc(db, "classes", editModalData.id), {
        subjectName,
        schedule: schedules,
      });
      
      Swal.fire({
        icon: "success",
        title: "Class updated!",
        text: "The class has been updated successfully.",
        confirmButtonColor: "#10b981",
      });

      setEditModalData(null);
      await fetchClasses();
    } catch (err) {
      console.error("Error updating class:", err);
      setError("Failed to update class. Please try again.");
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
      const q = query(
        collection(db, "classes"),
        where("teacherID", "==", userId)
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setClasses(data);
      fetchTeacherNames(data);
      fetchStudentDetails(data);
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

  const fetchStudentDetails = async (classes) => {
    const newStudentDetails = {};

    for (const subject of classes) {
      if (subject.studentIDs && subject.studentIDs.length > 0) {
        const students = await Promise.all(
          subject.studentIDs.map(async (studentId) => {
            const studentDoc = await getDoc(doc(db, "users", studentId));
            if (studentDoc.exists()) {
              const studentData = studentDoc.data();
              return {
                id: studentId,
                name: `${studentData.firstName} ${studentData.lastName}`,
                email: studentData.email || "No email",
              };
            }
            return {
              id: studentId,
              name: "Unknown Student",
              email: "Unknown email",
            };
          })
        );
        newStudentDetails[subject.id] = students;
      } else {
        newStudentDetails[subject.id] = [];
      }
    }

    setStudentDetails(newStudentDetails);
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
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this class?"
    );
    if (!confirmDelete) return;

    try {
      await deleteDoc(doc(db, "classes", classId));
      setClasses((prev) => prev.filter((cls) => cls.id !== classId));
      Swal.fire({
        icon: "success",
        title: "Class deleted!",
        text: "The class has been deleted successfully.",
        confirmButtonColor: "#10b981",  
      });
    } catch (err) {
      console.error("Error deleting class:", err);
      setError("Failed to delete class. Please try again.");
    }
  };

  const removeStudent = async (classId, studentId) => {
    const confirmRemove = window.confirm(
      "Are you sure you want to remove this student from the class?"
    );
    if (!confirmRemove) return;

    try {
      const classRef = doc(db, "classes", classId);
      await updateDoc(classRef, {
        studentIDs: arrayRemove(studentId),
      });

      // Update local state
      setStudentDetails((prev) => ({
        ...prev,
        [classId]: prev[classId].filter((student) => student.id !== studentId),
      }));

      Swal.fire({
        icon: "success",
        title: "Student removed!",
        text: "The student has been removed from the class successfully.",
        confirmButtonColor: "#10b981",
      });
    } catch (err) {
      console.error("Error removing student:", err);
      setError("Failed to remove student. Please try again.");
    }
  };

  const toggleExpandClass = (classId) => {
    setExpandedClass(expandedClass === classId ? null : classId);
  };

  const handleEdit = (classData) => {
    setEditModalData(classData);
  };

  useEffect(() => {
    fetchClasses();
  }, []);

  return (
    <div>
      {error && (
        <div className="mb-4 bg-red-50 border-l-4 border-red-500 p-3 text-red-700">
          <p>{error}</p>
        </div>
      )}

      <button
        onClick={() => setShowModal(true)}
        className="bg-emerald-500 text-white px-4 py-2 mb-6 rounded hover:bg-emerald-600 transition-colors flex items-center"
      >
        <Plus size={18} className="mr-1" /> Create New Class
      </button>

      <ClassModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSubmit={handleCreateClass}
        loading={loading}
        mode="create"
      />

      <ClassModal
        isOpen={!!editModalData}
        onClose={() => setEditModalData(null)}
        onSubmit={handleUpdateClass}
        loading={loading}
        mode="edit"
        initialData={editModalData}
      />

      {loading && classes.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">Loading classes...</p>
        </div>
      ) : classes.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <h3 className="text-lg font-medium text-gray-700">
            No Classes Found
          </h3>
          <p className="text-gray-500 mt-2">
            Create your first class to get started
          </p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {classes.map((subject) => (
            <div
              key={subject.id}
              className="bg-white rounded-lg shadow-md overflow-hidden transition-all duration-200 transform hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="h-2 bg-emerald-500"></div>
              <div className="p-5">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="font-bold text-xl text-gray-800">
                    {subject.subjectName}
                  </h3>
                  <div className="flex space-x-2">
                    {subject.joinCode && (
                      <div className="bg-emerald-100 text-emerald-800 text-xs font-medium px-2.5 py-0.5 rounded">
                        Code: {subject.joinCode}
                      </div>
                    )}
                    <button
                      onClick={() => handleEdit(subject)}
                      className="text-gray-600 hover:text-emerald-600 p-1"
                      title="Edit class"
                    >
                      <Edit size={16} />
                    </button>
                  </div>
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

                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
                      👥
                    </div>
                    <div className="ml-3">
                      <span className="text-xs text-gray-500">Students</span>
                      <p className="text-sm font-medium text-gray-800">
                        {studentDetails[subject.id]?.length || 0} enrolled
                      </p>
                    </div>
                  </div>

                  {subject.schedule && subject.schedule.length > 0 && (
                    <div className="border-t border-gray-100 pt-3 mt-3">
                      <span className="text-xs text-gray-500 block mb-2">
                        Schedule
                      </span>
                      <div className="space-y-1">
                        {subject.schedule.slice(0, 2).map((s, i) => (
                          <div
                            key={i}
                            className="flex items-center text-sm text-gray-600"
                          >
                            <Calendar
                              size={14}
                              className="text-emerald-500 mr-1"
                            />
                            <span className="font-medium mr-1">{s.day}:</span>
                            <span>
                              {s.start} – {s.end}
                            </span>
                          </div>
                        ))}
                        {subject.schedule.length > 2 && (
                          <div className="text-xs text-gray-500">
                            +{subject.schedule.length - 2} more times
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-4 flex justify-between">
                  <button
                    onClick={() => toggleExpandClass(subject.id)}
                    className="text-sm text-emerald-600 hover:text-emerald-800 font-medium hover:underline"
                  >
                    {expandedClass === subject.id
                      ? "Hide Students"
                      : "View Students"}
                  </button>
                  <button
                    onClick={() => handleDelete(subject.id)}
                    className="text-sm text-red-500 hover:text-red-700 font-medium hover:underline"
                  >
                    Delete Class
                  </button>
                </div>

                {expandedClass === subject.id && (
                  <div className="mt-4 border-t pt-4">
                    <h4 className="font-medium mb-2">Enrolled Students:</h4>
                    {studentDetails[subject.id]?.length > 0 ? (
                      <ul className="divide-y divide-gray-100">
                        {studentDetails[subject.id].map((student) => (
                          <li
                            key={student.id}
                            className="py-2 flex justify-between items-center"
                          >
                            <div>
                              <p className="font-medium text-gray-800">
                                {student.name}
                              </p>
                              <p className="text-xs text-gray-500">
                                {student.email}
                              </p>
                            </div>
                            <button
                              onClick={() =>
                                removeStudent(subject.id, student.id)
                              }
                              className="text-red-500 text-xs hover:text-red-700 hover:underline font-medium"
                            >
                              Remove
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-gray-500 py-2">
                        No students enrolled yet.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Classes;
