import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
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
  serverTimestamp,
  setDoc
} from "firebase/firestore";
import { X, Calendar, Clock, Plus, Trash2, Edit, Download } from "lucide-react";
import Swal from "sweetalert2";
import { jsPDF } from "jspdf";
import * as faceapi from "face-api.js";

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
                  <label className="block text-xs text-gray-500 mb-1">Day</label>
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
                  <label className="block text-xs text-gray-500 mb-1">Start</label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs text-gray-500 mb-1">End</label>
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
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [editModalData, setEditModalData] = useState(null);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [teacherNames, setTeacherNames] = useState({});
  const [studentDetails, setStudentDetails] = useState({});
  const [attendanceStatus, setAttendanceStatus] = useState({});

  // Face recognition states
  const [showFaceModal, setShowFaceModal] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const videoRef = useRef();
  const currentClassRef = useRef(null);
  const intervalRef = useRef(null);

  // Load face recognition models
  useEffect(() => {
    const loadModels = async () => {
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri("/models/tiny_face_detector_model"),
          faceapi.nets.faceLandmark68Net.loadFromUri("/models/face_landmark_68_model"),
          faceapi.nets.faceRecognitionNet.loadFromUri("/models/face_recognition_model"),
        ]);
        setModelsLoaded(true);
      } catch (error) {
        console.error("Error loading face models:", error);
        Swal.fire({
          icon: "error",
          title: "Error",
          text: "Could not load face recognition models. Please refresh the page.",
        });
      }
    };

    loadModels();

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Handle camera when face modal opens/closes
  useEffect(() => {
    if (showFaceModal && modelsLoaded) {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [showFaceModal, modelsLoaded]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      Swal.fire({
        icon: "error",
        title: "Camera Error",
        text: "Could not access camera. Please check permissions.",
      });
      setShowFaceModal(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
    }
  };

  const verifyIdentity = async () => {
    if (!currentClassRef.current) return;

    setIsVerifying(true);
    setVerificationStatus("Verifying your identity...");

    try {
      const teacherID = getUserId();
      const teacherRef = doc(db, "users", teacherID);
      const teacherDoc = await getDoc(teacherRef);

      if (!teacherDoc.exists() || !teacherDoc.data().descriptor) {
        throw new Error("No face data found for this teacher");
      }

      const teacherDescriptor = new Float32Array(teacherDoc.data().descriptor);
      const labeledDescriptor = new faceapi.LabeledFaceDescriptors(teacherID, [
        teacherDescriptor,
      ]);
      const faceMatcher = new faceapi.FaceMatcher([labeledDescriptor], 0.3);

      intervalRef.current = setInterval(async () => {
        try {
          const detection = await faceapi
            .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceDescriptor();

          if (detection) {
            const bestMatch = faceMatcher.findBestMatch(detection.descriptor);

            if (bestMatch.label === teacherID) {
              clearInterval(intervalRef.current);
              setVerificationStatus("Identity verified!");
              setIsVerifying(false);

              await markTeacherAttendance(currentClassRef.current);

              setTimeout(() => {
                setShowFaceModal(false);
              }, 1500);
            } else {
              setVerificationStatus("Face not recognized. Please try again.");
            }
          }
        } catch (error) {
          console.error("Verification error:", error);
          setVerificationStatus("Error during verification");
        }
      }, 2000);
    } catch (error) {
      console.error("Verification setup error:", error);
      setVerificationStatus("Error setting up verification");
      setIsVerifying(false);
      Swal.fire({
        icon: "error",
        title: "Verification Error",
        text: "Could not verify your identity. Please try again or contact support.",
      });
    }
  };

  const markTeacherAttendance = async (classData) => {
    try {
      const teacherID = getUserId();
      if (!teacherID) {
        throw new Error("Teacher ID not found");
      }

      const now = new Date();
      const today = now.toISOString().split("T")[0];
      const classID = classData.id;

      const attendanceRef = doc(db, "teacherAttendance", classID, today, teacherID);
      const attendanceSnap = await getDoc(attendanceRef);

      if (attendanceSnap.exists()) {
        const data = attendanceSnap.data();
        if (!data.timeOut) {
          await updateDoc(attendanceRef, {
            timeOut: serverTimestamp(),
            verificationMethod: "face_recognition",
          });
          // Update local attendance status
          setAttendanceStatus(prev => ({
            ...prev,
            [classID]: 'completed'
          }));
          Swal.fire({
            icon: "success",
            title: "Success",
            text: "Time-out recorded successfully!",
          });
        } else {
          Swal.fire({
            icon: "info",
            title: "Already Recorded",
            text: "Attendance already recorded for today.",
          });
        }
      } else {
        await setDoc(attendanceRef, {
          timeIn: serverTimestamp(),
          verifiedBy: "face_recognition",
          classId: classID,
          className: classData.subjectName,
          teacherId: teacherID,
        });
        // Update local attendance status
        setAttendanceStatus(prev => ({
          ...prev,
          [classID]: 'timeIn'
        }));
        Swal.fire({
          icon: "success",
          title: "Success",
          text: "Attendance marked successfully!",
        });
      }
    } catch (error) {
      console.error("Error marking teacher attendance:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "Failed to mark attendance after verification.",
      });
    }
  };

  const handleMarkAttendance = (classData) => {
    const now = new Date();
    const currentDay = now.toLocaleString("en-US", { weekday: "long" });
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();
    const currentTime24 = `${currentHours}:${currentMinutes < 10 ? "0" + currentMinutes : currentMinutes}`;
    const currentTime12 = convertTo12HourFormat(currentTime24);
    const currentTimeInMinutes = timeToMinutes(currentTime12);

    // Check current attendance status for this class
    const today = now.toISOString().split('T')[0];
    const attendanceRef = doc(db, "teacherAttendance", classData.id, today, getUserId());
    
    getDoc(attendanceRef).then((docSnap) => {
      const isTimeOut = docSnap.exists() && docSnap.data().timeIn && !docSnap.data().timeOut;
      const isCompleted = docSnap.exists() && docSnap.data().timeIn && docSnap.data().timeOut;

      if (isCompleted) {
        Swal.fire({
          icon: "info",
          title: "Already Recorded",
          text: "Attendance already completed for today.",
        });
        return;
      }

      const todaysSchedule = classData.schedule?.find(
        (s) => s.day === currentDay
      );

      if (!todaysSchedule) {
        Swal.fire({
          icon: "error",
          title: "No Class Today",
          text: "You don't have any class scheduled for today.",
        });
        return;
      }

      const startTimeInMinutes = timeToMinutes(todaysSchedule.start);
      const endTimeInMinutes = timeToMinutes(todaysSchedule.end);

      if (isTimeOut) {
        // For time-out
        if (currentTimeInMinutes < endTimeInMinutes - 10) {
          Swal.fire({
            icon: "error",
            title: "Too Early",
            text: `You can only time out within 10 minutes before your class ends.`,
          });
          return;
        }
        if (currentTimeInMinutes > endTimeInMinutes + 20) {
          Swal.fire({
            icon: "error",
            title: "Too Late",
            text: `You can only time out within 20 minutes after your class has finished.`,
          });
          return;
        }
      } else {
        // For time-in
        if (currentTimeInMinutes < startTimeInMinutes - 10) {
          Swal.fire({
            icon: "error",
            title: "Too Early",
            text: `You can only time in within 10 minutes before your class starts.`,
          });
          return;
        }
        if (currentTimeInMinutes > endTimeInMinutes) {
          Swal.fire({
            icon: "error",
            title: "Too Late",
            text: `You can only time in before your class ends.`,
          });
          return;
        }
      }

      currentClassRef.current = classData;
      setShowFaceModal(true);
      setVerificationStatus("Position your face in the frame");
    });
  };

  const convertTo12HourFormat = (time24) => {
    if (!time24) return "";
    const [hours, minutes] = time24.split(":");
    const hour = parseInt(hours, 10);
    const suffix = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${suffix}`;
  };

  const timeToMinutes = (timeStr) => {
    if (!timeStr) return 0;
    const [time, period] = timeStr.split(" ");
    let [hours, minutes] = time.split(":").map(Number);
    if (period === "PM" && hours !== 12) {
      hours += 12;
    } else if (period === "AM" && hours === 12) {
      hours = 0;
    }
    return hours * 60 + minutes;
  };

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

  const isClassCurrentlyHappening = (classData) => {
    const now = new Date();
    const currentDay = now.toLocaleString("en-US", { weekday: "long" });
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();
    const currentTime24 = `${currentHours}:${currentMinutes < 10 ? "0" + currentMinutes : currentMinutes}`;
    const currentTime12 = convertTo12HourFormat(currentTime24);
    const currentTimeInMinutes = timeToMinutes(currentTime12);

    const todaysSchedule = classData.schedule?.find(
      (s) => s.day === currentDay
    );

    if (!todaysSchedule) return false;

    const startTimeInMinutes = timeToMinutes(todaysSchedule.start);
    const endTimeInMinutes = timeToMinutes(todaysSchedule.end);

    return (
      currentTimeInMinutes >= startTimeInMinutes - 10 && 
      currentTimeInMinutes <= endTimeInMinutes + 20
    );
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
      fetchAttendanceStatus(data);
    } catch (err) {
      console.error("Error fetching classes:", err);
      setError("Failed to load classes");
    } finally {
      setLoading(false);
    }
  };

  const fetchAttendanceStatus = async (classes) => {
    const userId = getUserId();
    if (!userId) return;

    const status = {};
    const today = new Date().toISOString().split('T')[0];

    for (const classData of classes) {
      const attendanceRef = doc(db, "teacherAttendance", classData.id, today, userId);
      const attendanceSnap = await getDoc(attendanceRef);

      if (attendanceSnap.exists()) {
        const data = attendanceSnap.data();
        if (data.timeIn && data.timeOut) {
          status[classData.id] = 'completed';
        } else if (data.timeIn) {
          status[classData.id] = 'timeIn';
        }
      } else {
        status[classData.id] = 'notMarked';
      }
    }

    setAttendanceStatus(status);
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

  const downloadClassData = async (classData) => {
    try {
      const teacherName = teacherNames[classData.id] || "Unknown Teacher";
      const students = studentDetails[classData.id] || [];
      
      const doc = new jsPDF();
      
      doc.setFontSize(16);
      doc.text(classData.subjectName, 10, 10);
      doc.setFontSize(12);
      doc.text(`Teacher: ${teacherName}`, 10, 20);
      doc.text(`Class Code: ${classData.joinCode}`, 10, 30);
      doc.text(`Date: ${new Date().toLocaleDateString()}`, 10, 40);
      
      if (classData.schedule && classData.schedule.length > 0) {
        doc.text("Schedule:", 10, 50);
        let y = 60;
        classData.schedule.forEach((sched, index) => {
          doc.text(`${sched.day}: ${sched.start} - ${sched.end}`, 15, y);
          y += 10;
        });
        y += 10;
      }
      
      doc.text("Student List:", 10, 80);
      doc.setFontSize(10);
      doc.text("Email", 10, 90);
      doc.text("Student ID", 70, 90);
      doc.text("Full Name", 120, 90);
      
      let y = 100;
      students.forEach(student => {
        doc.text(student.email, 10, y);
        doc.text(student.id, 70, y);
        doc.text(student.name, 120, y);
        y += 10;
        
        if (y > 280) {
          doc.addPage();
          y = 20;
        }
      });
      
      doc.save(`${classData.subjectName}_student_list.pdf`);
      
    } catch (error) {
      console.error("Error generating PDF:", error);
      Swal.fire({
        icon: "error",
        title: "PDF Generation Failed",
        text: "Could not generate the PDF. Please try again.",
        confirmButtonColor: "#10b981",
      });
    }
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

      {/* Face Verification Modal */}
      {showFaceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-500/30 backdrop-blur-sm"></div>
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-200">
            <div className="p-6">
              <h2 className="text-center text-1xl font-bold text-gray-800 mb-4">
                Verify Your Identity
              </h2>
              
              <div className="relative mb-6">
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  className="w-full h-auto rounded-lg border-2 border-gray-200"
                  style={{ minHeight: "400px" }}
                />
                {isVerifying && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/70 rounded-lg">
                    <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-emerald-500"></div>
                  </div>
                )}
              </div>

              <p className="text-center text-lg mb-6 min-h-8 font-medium text-gray-700">
                {verificationStatus}
              </p>

              <div className="flex justify-center space-x-6">
                {!isVerifying ? (
                  <>
                    <button
                      onClick={verifyIdentity}
                      className="px-8 py-3 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 text-sm font-semibold transition-colors duration-200 shadow-md"
                    >
                      Verify Identity
                    </button>
                    <button
                      onClick={() => {
                        clearInterval(intervalRef.current);
                        setShowFaceModal(false);
                        stopCamera();
                      }}
                      className="px-8 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 text-sm font-semibold transition-colors duration-200 shadow-md"
                    >
                      Cancel
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          </div>
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
          {classes.map((subject) => {
            const isActive = isClassCurrentlyHappening(subject);
            const status = attendanceStatus[subject.id] || 'notMarked';

            return (
              <div
                key={subject.id}
                className="bg-white rounded-lg shadow-md overflow-hidden transition-all duration-200 transform hover:-translate-y-1 hover:shadow-lg cursor-pointer"
                onClick={() => navigate(`/teacher/classes/${subject.id}`)}
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
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(subject);
                        }}
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

                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMarkAttendance(subject);
                      }}
                      disabled={!isActive || status === 'completed'}
                      className={`w-full py-2 rounded text-sm transition-colors duration-200 focus:outline-none focus:ring-2 ${
                        status === 'completed'
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          : isActive
                          ? 'bg-emerald-500 hover:bg-emerald-600 text-white focus:ring-emerald-300'
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      {status === 'completed'
                        ? 'Attendance Completed'
                        : status === 'timeIn'
                        ? 'Time Out'
                        : 'Time In'}
                    </button>
                  </div>

                  <div className="mt-4 flex justify-end space-x-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadClassData(subject);
                      }}
                      className="text-sm text-blue-500 hover:text-blue-700 font-medium hover:underline flex items-center"
                    >
                      <Download size={16} className="mr-1" /> List
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(subject.id);
                      }}
                      className="text-sm text-red-500 hover:text-red-700 font-medium hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Classes;