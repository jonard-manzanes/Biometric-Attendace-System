import React, { useState, useEffect, useRef } from "react";
import * as faceapi from "face-api.js";
import { db } from "../firebaseConfig";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
} from "firebase/firestore";
import { serverTimestamp } from "firebase/firestore";
import Swal from "sweetalert2";

const Attendance = () => {
  const [subjects, setSubjects] = useState([]);
  const [activeSubject, setActiveSubject] = useState(null);
  const [showFaceModal, setShowFaceModal] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const videoRef = useRef();
  const currentSubjectRef = useRef(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    const loadModels = async () => {
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(
            "/models/tiny_face_detector_model"
          ),
          faceapi.nets.faceLandmark68Net.loadFromUri(
            "/models/face_landmark_68_model"
          ),
          faceapi.nets.faceRecognitionNet.loadFromUri(
            "/models/face_recognition_model"
          ),
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

  useEffect(() => {
    fetchSubjectsAndAttendance();
  }, []);

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
    if (!currentSubjectRef.current) return;

    setIsVerifying(true);
    setVerificationStatus("Verifying your identity...");

    try {
      const studentID = localStorage.getItem("userDocId");
      const studentRef = doc(db, "users", studentID);
      const studentDoc = await getDoc(studentRef);

      if (!studentDoc.exists() || !studentDoc.data().descriptor) {
        throw new Error("No face data found for this student");
      }

      const studentDescriptor = new Float32Array(studentDoc.data().descriptor);
      const labeledDescriptor = new faceapi.LabeledFaceDescriptors(studentID, [
        studentDescriptor,
      ]);
      const faceMatcher = new faceapi.FaceMatcher([labeledDescriptor], 0.3);

      intervalRef.current = setInterval(async () => {
        try {
          const detection = await faceapi
            .detectSingleFace(
              videoRef.current,
              new faceapi.TinyFaceDetectorOptions()
            )
            .withFaceLandmarks()
            .withFaceDescriptor();

          if (detection) {
            const bestMatch = faceMatcher.findBestMatch(detection.descriptor);

            if (bestMatch.label === studentID) {
              clearInterval(intervalRef.current);
              setVerificationStatus("Identity verified!");
              setIsVerifying(false);

              await markAttendanceAfterVerification(currentSubjectRef.current);

              setTimeout(() => {
                setShowFaceModal(false);
                fetchSubjectsAndAttendance();
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

  const markAttendanceAfterVerification = async (subject) => {
    try {
      const studentID = localStorage.getItem("userDocId");
      if (!studentID) {
        throw new Error("Student ID not found");
      }

      const now = new Date();
      const classID =
        subject.joinCode || subject.subjectName.replace(/\s/g, "_");
      const today = now.toISOString().split("T")[0];

      const attendanceRef = doc(db, "attendance", classID, today, studentID);
      const attendanceSnap = await getDoc(attendanceRef);

      if (attendanceSnap.exists()) {
        const data = attendanceSnap.data();
        if (!data.timeOut) {
          await updateDoc(attendanceRef, {
            timeOut: serverTimestamp(),
            verificationMethod: "face_recognition",
          });
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
        });
        Swal.fire({
          icon: "success",
          title: "Success",
          text: "Attendance marked successfully!",
        });
      }
    } catch (error) {
      console.error("Error marking attendance:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "Failed to mark attendance after verification.",
      });
    }
  };

  const handleMarkAttendance = (subject) => {
    const now = new Date();
    const currentDay = now.toLocaleString("en-US", { weekday: "long" });
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();
    const currentTime24 = `${currentHours}:${
      currentMinutes < 10 ? "0" + currentMinutes : currentMinutes
    }`;
    const currentTime12 = convertTo12HourFormat(currentTime24);
    const currentTimeInMinutes = timeToMinutes(currentTime12);

    // Check if this is a time-out attempt:
    if (subject.attendanceStatus === "timeIn") {
      // Find today's schedule for this subject:
      const todaysSchedule = subject.schedule?.find(
        (s) => s.day === currentDay
      );
      if (todaysSchedule) {
        const endTimeInMinutes = timeToMinutes(todaysSchedule.end);
        // Allow time out only if current time is within 20 minutes after scheduled end time.
        if (currentTimeInMinutes > endTimeInMinutes + 20) {
          Swal.fire({
            icon: "error",
            title: "Too Late",
            text: `You can only time out within 20 minutes after your class has finished (until ${addMinutesToTime(
              todaysSchedule.end,
              20
            )}). You will be marked as absent.`,
          });
          return;
        }
      }
    } else {
      // For time in, ensure the student is within their scheduled class time.
      const isWithinSchedule = subject.schedule?.some((sched) => {
        if (sched.day !== currentDay) return false;
        const startTimeInMinutes = timeToMinutes(sched.start);
        const endTimeInMinutes = timeToMinutes(sched.end);
        return (
          currentTimeInMinutes >= startTimeInMinutes &&
          currentTimeInMinutes <= endTimeInMinutes
        );
      });

      if (!isWithinSchedule) {
        Swal.fire({
          icon: "error",
          title: "Error",
          text: `You can only mark attendance during your scheduled class time (${subject.schedule
            .map((s) => `${s.day}: ${s.start} - ${s.end}`)
            .join(", ")})`,
        });
        return;
      }
    }

    currentSubjectRef.current = subject;
    setShowFaceModal(true);
    setVerificationStatus("Position your face in the frame");
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

  const addMinutesToTime = (timeStr, minutesToAdd) => {
    const [time, period] = timeStr.split(" ");
    let [hours, minutes] = time.split(":").map(Number);

    // Convert to 24-hour format for easier calculation
    if (period === "PM" && hours !== 12) {
      hours += 12;
    } else if (period === "AM" && hours === 12) {
      hours = 0;
    }

    // Add minutes
    let totalMinutes = hours * 60 + minutes + minutesToAdd;

    // Convert back to 12-hour format
    let newHours = Math.floor(totalMinutes / 60) % 24;
    const newMinutes = totalMinutes % 60;

    const newPeriod = newHours >= 12 ? "PM" : "AM";
    newHours = newHours % 12 || 12;

    return `${newHours}:${
      newMinutes < 10 ? "0" + newMinutes : newMinutes
    } ${newPeriod}`;
  };

  const fetchSubjectsAndAttendance = async () => {
    try {
      const studentID = localStorage.getItem("userDocId");
      const querySnapshot = await getDocs(collection(db, "classes"));
      const fetchedSubjects = querySnapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter((subject) => subject.studentIDs?.includes(studentID));

      const teacherPromises = fetchedSubjects.map(async (subject) => {
        const teacherRef = doc(db, "users", subject.teacherID);
        const teacherDoc = await getDoc(teacherRef);

        let teacherName = "Unknown Teacher";
        if (teacherDoc.exists()) {
          const data = teacherDoc.data();
          if (data.role === "teacher") {
            teacherName = `${data.firstName} ${
              data.middle ? data.middle + " " : ""
            }${data.lastName}`;
          }
        }

        const scheduleWith12HourFormat = subject.schedule?.map((sched) => {
          return {
            ...sched,
            start: convertTo12HourFormat(sched.start),
            end: convertTo12HourFormat(sched.end),
          };
        });

        const now = new Date();
        const today = now.toISOString().split("T")[0];
        const classID =
          subject.joinCode || subject.subjectName.replace(/\s/g, "_");
        const attendanceRef = doc(db, "attendance", classID, today, studentID);
        const attendanceSnap = await getDoc(attendanceRef);

        let status = "none";
        let excuseSubmitted = false;
        if (attendanceSnap.exists()) {
          const data = attendanceSnap.data();
          if (data.timeIn && data.timeOut) {
            status = "completed";
          } else if (data.timeIn) {
            status = "timeIn";
          }
          if (data.excuse) {
            excuseSubmitted = true;
          }
        }

        return {
          ...subject,
          teacherName,
          schedule: scheduleWith12HourFormat,
          attendanceStatus: status,
          excuseSubmitted, // new field for excuse submission
        };
      });

      const mappedSubjects = await Promise.all(teacherPromises);
      setSubjects(mappedSubjects);
    } catch (error) {
      console.error("Error fetching subjects: ", error);
    }
  };

  // New function to submit an excuse
  const submitExcuse = async (subject) => {
    const now = new Date();
    const currentDay = now.toLocaleString("en-US", { weekday: "long" });
    const todaysSchedule = subject.schedule?.find((s) => s.day === currentDay);

    if (!todaysSchedule) {
      Swal.fire({
        icon: "error",
        title: "No Class Today",
        text: "You can only submit an excuse for classes scheduled today.",
      });
      return;
    }

    // Check if the class has already ended
    const currentTime24 = `${now.getHours()}:${
      now.getMinutes() < 10 ? "0" + now.getMinutes() : now.getMinutes()
    }`;
    const currentTime12 = convertTo12HourFormat(currentTime24);
    const currentMinutes = timeToMinutes(currentTime12);
    const classEndMinutes = timeToMinutes(todaysSchedule.end);

    if (currentMinutes > classEndMinutes) {
      Swal.fire({
        icon: "error",
        title: "Class Completed",
        text: "You cannot submit an excuse as the class has already ended.",
      });
      return;
    }

    const { value: formValues } = await Swal.fire({
      title: "Submit Excuse",
      html:
        '<textarea id="excuseReason" class="swal2-input" placeholder="Type your excuse here..."></textarea>' +
        '<input id="proofImage" type="file" accept="image/*" class="swal2-file" />',
      focusConfirm: false,
      showCancelButton: true,
      preConfirm: () => {
        const reason = document.getElementById("excuseReason").value;
        const fileInput = document.getElementById("proofImage");
        const file = fileInput.files[0];
        if (!reason) {
          Swal.showValidationMessage("Please enter a reason for your excuse");
        }
        if (!file) {
          Swal.showValidationMessage("Please upload an image as proof");
        }
        return { reason, file };
      },
    });

    if (!formValues) return;

    // Function to upload image to Cloudinary
    const uploadImageToCloudinary = async (file) => {
      const formData = new FormData();
      formData.append("file", file);
      // Replace 'your_upload_preset' and 'your_cloud_name' with your Cloudinary details
      formData.append("upload_preset", "attendance_excuses");

      const response = await fetch(
        "https://api.cloudinary.com/v1_1/dzufxspg4/image/upload",
        {
          method: "POST",
          body: formData,
        }
      );
      const data = await response.json();
      return data.secure_url;
    };

    try {
      const imageUrl = await uploadImageToCloudinary(formValues.file);
      const studentID = localStorage.getItem("userDocId");
      const today = now.toISOString().split("T")[0];
      const classID =
        subject.joinCode || subject.subjectName.replace(/\s/g, "_");
      const attendanceRef = doc(db, "attendance", classID, today, studentID);
      const attendanceSnap = await getDoc(attendanceRef);

      const excuseData = {
        reason: formValues.reason,
        image: imageUrl,
        status: "pending",
        submittedAt: serverTimestamp(),
      };

      if (attendanceSnap.exists()) {
        await updateDoc(attendanceRef, {
          excuse: excuseData,
        });
      } else {
        await setDoc(attendanceRef, {
          excuse: excuseData,
        });
      }
      Swal.fire({
        icon: "success",
        title: "Excuse Submitted",
        text: "Your excuse has been submitted and is pending approval.",
      });
      fetchSubjectsAndAttendance();
    } catch (error) {
      console.error("Error submitting excuse", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "Could not submit excuse. Please try again later.",
      });
    }
  };

  // Inline AttendanceCard component inside Attendance component
  const AttendanceCard = ({
    subject,
    index,
    activeSubject,
    setActiveSubject,
    markAttendance,
  }) => {
    let canTimeOut = true;
    let timeOutMessage = "Time Out Now";

    if (subject.attendanceStatus === "timeIn") {
      const now = new Date();
      const currentDay = now.toLocaleString("en-US", { weekday: "long" });
      const todaysSchedule = subject.schedule?.find(
        (s) => s.day === currentDay
      );

      if (todaysSchedule) {
        const currentHours = now.getHours();
        const currentMinutes = now.getMinutes();
        const currentTime24 = `${currentHours}:${
          currentMinutes < 10 ? "0" + currentMinutes : currentMinutes
        }`;
        const currentTime12 = convertTo12HourFormat(currentTime24);
        const currentTimeInMinutes = timeToMinutes(currentTime12);
        const endTimeInMinutes = timeToMinutes(todaysSchedule.end);

        if (currentTimeInMinutes > endTimeInMinutes + 20) {
          canTimeOut = false;
          timeOutMessage = "You forgot to time out (Absent)";
        } else if (currentTimeInMinutes < endTimeInMinutes) {
          canTimeOut = false;
          timeOutMessage = "Class still in session";
        }
      }
    }

    const getTeacherName = () => subject.teacherName || "Unknown Teacher";

    const getButtonText = () => {
      if (subject.attendanceStatus === "timeIn") {
        return timeOutMessage;
      } else if (subject.attendanceStatus === "completed") {
        return "Attendance Completed";
      }
      return "Mark Attendance";
    };

    const isMarkAttendanceDisabled =
      subject.attendanceStatus === "completed" ||
      (subject.attendanceStatus === "timeIn" && !canTimeOut);

    return (
      <div
        className={`bg-white rounded-lg shadow-md overflow-hidden transition-all duration-200 transform hover:-translate-y-1 hover:shadow-lg cursor-pointer ${
          activeSubject === index ? "ring-2 ring-emerald-500" : ""
        }`}
        onClick={() => setActiveSubject(activeSubject === index ? null : index)}
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
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                </svg>
              </div>
              <div className="ml-3">
                <span className="text-xs text-gray-500">Teacher</span>
                <p className="text-sm font-medium text-gray-800">
                  {getTeacherName()}
                </p>
              </div>
            </div>

            <div className="flex items-center">
              <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
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
              {subject.attendanceStatus === "none" ? (
                <div className="space-y-2 mt-4">
                  {!subject.excuseSubmitted && (
                    <>
                      <button
                        className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-2 rounded text-sm transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                        onClick={(e) => {
                          e.stopPropagation();
                          markAttendance(subject);
                        }}
                      >
                        Mark Attendance
                      </button>
                      <button
                        className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 rounded text-sm transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-300"
                        onClick={(e) => {
                          e.stopPropagation();
                          submitExcuse(subject);
                        }}
                      >
                        Submit Excuse
                      </button>
                    </>
                  )}
                  {subject.excuseSubmitted && (
                    <button
                      className="w-full bg-gray-400 text-white py-2 rounded text-sm cursor-not-allowed"
                      disabled
                    >
                      Pending Excuse
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-2 mt-4">
                  <button
                    className={`w-full text-white py-2 rounded text-sm transition-colors duration-200 focus:outline-none focus:ring-2 ${
                      isMarkAttendanceDisabled
                        ? "bg-gray-400 cursor-not-allowed focus:ring-gray-300"
                        : "bg-emerald-500 hover:bg-emerald-600 focus:ring-emerald-300"
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isMarkAttendanceDisabled) {
                        markAttendance(subject);
                      }
                    }}
                    disabled={isMarkAttendanceDisabled}
                  >
                    {getButtonText()}
                  </button>
                  {subject.attendanceStatus === "completed" && (
                    <p className="text-xs text-center text-gray-500 mt-1">
                      You've already recorded attendance for today
                    </p>
                  )}
                  {subject.attendanceStatus === "timeIn" && !canTimeOut && (
                    <p className="text-xs text-center text-gray-500 mt-1">
                      {timeOutMessage.includes("Absent")
                        ? "You can no longer time out for this class"
                        : "You can only time out after class ends"}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div>
      {showFaceModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Verify Your Identity</h2>

            <div className="relative mb-4">
              <video
                ref={videoRef}
                autoPlay
                muted
                className="w-full h-auto rounded border border-gray-300"
              />
              {isVerifying && (
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
                </div>
              )}
            </div>

            <p className="text-center mb-4 min-h-6">{verificationStatus}</p>

            <div className="flex justify-center space-x-4">
              {!isVerifying ? (
                <>
                  <button
                    onClick={verifyIdentity}
                    className="px-4 py-2 bg-emerald-500 text-white rounded hover:bg-emerald-600"
                  >
                    Verify
                  </button>
                  <button
                    onClick={() => {
                      clearInterval(intervalRef.current);
                      setShowFaceModal(false);
                      stopCamera();
                    }}
                    className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800">Class Attendance</h1>
        <p className="text-gray-600 mt-1">
          Track your attendance for all enrolled classes
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {subjects.map((subject, index) => (
          <AttendanceCard
            key={index}
            subject={subject}
            index={index}
            activeSubject={activeSubject}
            setActiveSubject={setActiveSubject}
            markAttendance={handleMarkAttendance}
          />
        ))}
      </div>
    </div>
  );
};

export default Attendance;
